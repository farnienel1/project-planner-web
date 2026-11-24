"""Fully inline every allow condition of a firestore.rules file (functions and lets substituted)
and print one normalised line per (match path, method). Two files whose outputs are identical
decide every request the same way (pure refactor), assuming the rules language is referentially
transparent (it is: no side effects; lets are lazy)."""
import re,sys
TOK=re.compile(r'//[^\n]*|/\*.*?\*/|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|==|!=|<=|>=|&&|\|\||[^\s]',re.S)
def toks(s): return [t for t in TOK.findall(s) if not t.startswith('//') and not t.startswith('/*')]
PRIM_BAD={'&&','||','==','!=','<','>','<=','>=','?',':','+','-','*','/','%','!','in','is'}
def matching(T,i):
    o=T[i]; c={'(':')','[':']','{':'}'}[o]; d=0
    for j in range(i,len(T)):
        if T[j] in '([{': d+=1
        elif T[j] in ')]}': d-=1
        if d==0: return j
    raise Exception('unbalanced')
def is_primary(e):
    if len(e)>2 and e[0]=='/' and e[1]=='databases':
        d=0
        for k,t in enumerate(e):
            if t in '([{': d+=1
            elif t in ')]}': d-=1
            elif d==0 and t in PRIM_BAD and not (t=='/' ): return False
            elif d==0 and t=='/' and k+1<len(e) and not re.match(r'[A-Za-z_$(]',e[k+1]): return False
        return True
    d=0
    for t in e:
        if t in '([{': d+=1
        elif t in ')]}': d-=1
        elif d==0 and t in PRIM_BAD: return False
    return True
def wrap(e): return e if is_primary(e) else ['(']+e+[')']
class Scope:
    def __init__(s,parent,path): s.parent=parent; s.funcs={}; s.path=path; s.allows=[]
    def find(s,n):
        x=s
        while x:
            if n in x.funcs: return x.funcs[n],x
            x=x.parent
        return None,None
def parse(T):
    root=Scope(None,''); allscopes=[root]
    def block(i,scope):
        while i<len(T):
            t=T[i]
            if t=='}': return i+1
            if t=='match':
                j=i+1
                while not (T[j]=='{' and not (re.match(r'[A-Za-z_]',T[j+1]) and (T[j+2]=='}' or T[j+2:j+6]==['=','*','*','}']))): j+=1
                sc=Scope(scope,scope.path+''.join(T[i+1:j])); allscopes.append(sc)
                i=block(j+1,sc); continue
            if t=='function':
                name=T[i+1]; j=i+2; k=matching(T,j)
                params=[x for x in T[j+1:k] if x!=',']
                e=matching(T,k+1); body=T[k+2:e]
                lets=[]; p=0
                while body[p]=='let':
                    q=p+3; d=0
                    while not(body[q]==';' and d==0):
                        if body[q] in '([{': d+=1
                        elif body[q] in ')]}': d-=1
                        q+=1
                    lets.append((body[p+1],body[p+3:q])); p=q+1
                assert body[p]=='return', (name,body[p:p+5])
                ret=body[p+1:]
                if ret and ret[-1]==';': ret=ret[:-1]
                scope.funcs[name]=(params,lets,ret)
                i=e+1; continue
            if t=='allow':
                j=i+1
                while T[j]!=':': j+=1
                meths=[x for x in T[i+1:j] if x!=',']
                k=j+1; d=0
                while True:
                    if T[k] in '([{': d+=1
                    elif T[k] in ')]}': d-=1
                    elif T[k]==';' and d==0: break
                    k+=1
                cond=T[j+1:k]
                if cond and cond[0]=='if': cond=cond[1:]
                scope.allows.append((meths,cond)); i=k+1; continue
            if t in ('service','rules_version'):
                if t=='service':
                    j=i
                    while T[j]!='{': j+=1
                    return block(j+1,scope)
                while T[i]!=';': i+=1
                i+=1; continue
            i+=1
        return i
    block(0,root)
    return allscopes
sys.setrecursionlimit(100000)
def expand(e,scope,env,depth=0):
    out=[]; i=0
    while i<len(e):
        t=e[i]
        prev=e[i-1] if i>0 else None
        if re.match(r'[A-Za-z_]',t) and prev!='.':
            if i+1<len(e) and e[i+1]=='(':
                f,fs=scope.find(t)
                if f:
                    k=matching(e,i+1)
                    args=[];cur=[];d=0
                    for x in e[i+2:k]:
                        if x in '([{': d+=1
                        elif x in ')]}': d-=1
                        if x==',' and d==0: args.append(cur); cur=[]
                        else: cur.append(x)
                    if cur: args.append(cur)
                    args=[expand(a,scope,env,depth+1) for a in args]
                    params,lets,ret=f
                    assert len(args)==len(params),(t,len(args),len(params))
                    fenv=dict(zip(params,args))
                    for ln,le in lets: fenv[ln]=expand(le,fs,fenv,depth+1)
                    out+=wrap(expand(ret,fs,fenv,depth+1)); i=k+1; continue
            if t in env:
                out+=wrap(env[t]); i+=1; continue
        out.append(t); i+=1
    return out
def dedouble(e):
    out=list(e); changed=True
    while changed:
        changed=False
        i=0
        while i<len(out):
            if out[i]=='(' and (i==0 or out[i-1] in ('in','is') or not (re.match(r'[A-Za-z_0-9]',out[i-1]) or out[i-1] in (')',']','$'))):
                j=E_match(out,i)
                inner=out[i+1:j]
                if (len(inner)>1 and inner[0]=='(' and E_match(out,i+1)==j-1) or (inner and is_primary(inner)):
                    if inner and inner[0]=='(' and E_match(out,i+1)==j-1: out=out[:i]+inner+out[j+1:]
                    else: out=out[:i]+inner+out[j+1:]
                    changed=True; continue
            i+=1
    return out
def E_match(T,i): return matching(T,i)
def norm(e):
    e=dedouble(e)
    # strip redundant outer parens repeatedly
    while len(e)>1 and e[0]=='(' and matching(e,0)==len(e)-1: e=e[1:-1]
    return e
if __name__=='__main__':
    T=toks(open(sys.argv[1]).read())
    res={}
    for sc in parse(T):
        for meths,cond in sc.allows:
            x=' '.join(norm(expand(cond,sc,{})))
            for m in meths:
                key=sc.path+' '+m
                res[key]=(res[key]+' || ' if key in res else '')+'('+x+')'
    for k in sorted(res): print(k+'\t'+res[k])
