import re,sys,json,functools
TOK=re.compile(r'//[^\n]*|/\*.*?\*/|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|==|!=|<=|>=|&&|\|\||[^\s]',re.S)
def toks(s): return [t for t in TOK.findall(s) if not t.startswith('//') and not t.startswith('/*')]
def parse(src):
    T=toks(src); funcs={}; rules=[]; i=0; dup=[]
    # find functions and allow statements, track brace depth not needed for global names
    n=len(T)
    while i<n:
        t=T[i]
        if t=='function' and i+1<n:
            name=T[i+1]; j=i+2
            # params
            assert T[j]=='('; k=j; 
            while T[k]!=')': k+=1
            params=[x for x in T[j+1:k] if x!=',']
            assert T[k+1]=='{'; d=0; m=k+1
            while True:
                if T[m]=='{': d+=1
                elif T[m]=='}':
                    d-=1
                    if d==0: break
                m+=1
            body=T[k+2:m]
            if name in funcs: dup.append(name)
            funcs[name]={'params':params,'body':body}
            i=m+1; continue
        if t=='allow':
            j=i+1
            while T[j]!=':' : j+=1
            meths=[x for x in T[i+1:j] if x!=',']
            k=j+1; d=0
            while True:
                if T[k] in '([{': d+=1
                elif T[k] in ')]}': d-=1
                elif T[k]==';' and d==0: break
                k+=1
            cond=T[j+1:k]
            if cond and cond[0]=='if': cond=cond[1:]
            rules.append((meths,cond)); i=k+1; continue
        i+=1
    return funcs,rules,dup
def calls(body,funcs):
    out=[]
    for i,t in enumerate(body):
        if t in funcs and i+1<len(body) and body[i+1]=='(' and (i==0 or body[i-1]!='.'):
            out.append(t)
    return out
GETS={'get','getAfter','exists','existsAfter'}
def analyze(path):
    src=open(path).read(); funcs,rules,dup=parse(src)
    @functools.lru_cache(None)
    def size(f):
        b=funcs[f]['body']; return len(b)+sum(size(c) for c in calls(b,funcs))
    @functools.lru_cache(None)
    def ncalls(f):
        b=funcs[f]['body']; return sum(1+ncalls(c) for c in calls(b,funcs))
    @functools.lru_cache(None)
    def ngets(f):
        b=funcs[f]['body']; own=sum(1 for i,t in enumerate(b) if t in GETS and i+1<len(b) and b[i+1]=='(' and (i==0 or b[i-1]!='.'))
        return own+sum(ngets(c) for c in calls(b,funcs))
    @functools.lru_cache(None)
    def depth(f):
        cs=calls(funcs[f]['body'],funcs); return 1+max([depth(c) for c in cs],default=0)
    @functools.lru_cache(None)
    def nlets(f):
        b=funcs[f]['body']; return b.count('let')+sum(nlets(c) for c in calls(b,funcs))
    tot_size=tot_calls=tot_gets=0; maxd=0; rmax=0; lets_exp=0
    per=[]
    for meths,cond in rules:
        cs=calls(cond,funcs)
        s=len(cond)+sum(size(c) for c in cs); nc=sum(1+ncalls(c) for c in cs)
        g=sum(1 for i,t in enumerate(cond) if t in GETS and i+1<len(cond) and cond[i+1]=='(')+sum(ngets(c) for c in cs)
        d=max([depth(c) for c in cs],default=0)
        mult=len(meths)
        tot_size+=s; tot_calls+=nc; tot_gets+=g; maxd=max(maxd,d); rmax=max(rmax,s)
        lets_exp+=sum(nlets(c) for c in cs)
        per.append((s,nc,meths,' '.join(cond)[:80]))
    # nesting: max paren/ternary depth in any function body
    def nest(b):
        d=m=0
        for t in b:
            if t in '([{': d+=1; m=max(m,d)
            elif t in ')]}': d-=1
        return m
    used=set()
    for _,c in rules: used.update(calls(c,funcs))
    stack=list(used)
    while stack:
        f=stack.pop()
        for c in calls(funcs[f]['body'],funcs):
            if c not in used: used.add(c); stack.append(c)
    edges=sum(len(calls(f['body'],funcs)) for f in funcs.values())
    r=dict(file=path.split('/')[-1],bytes=len(src.encode()),tokens=len(toks(src)),functions=len(funcs),dead=len(funcs)-len(used),
      call_edges=edges,lets=sum(f['body'].count('let') for f in funcs.values()),allows=len(rules),
      max_call_depth=maxd,max_nest=max(nest(f['body']) for f in funcs.values()),
      inlined_tokens=tot_size,inlined_calls=tot_calls,inlined_gets=tot_gets,inlined_lets=lets_exp,max_rule_inlined=rmax,dups=dup)
    return r,per,funcs,size,ncalls
if __name__=='__main__':
    for p in sys.argv[1:]:
        r,per,*_=analyze(p); print(json.dumps(r))

def total2(path):
    r,per,funcs,size,ncalls=analyze(path)
    fs=sum(size(f) for f in funcs); fc=sum(ncalls(f) for f in funcs)
    return r['inlined_tokens'],fs,r['inlined_tokens']+fs, r['inlined_calls']+fc
