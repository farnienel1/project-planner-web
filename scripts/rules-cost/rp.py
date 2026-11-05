# Minimal Firestore-rules structural parser with token spans.
import re
TOKRE=re.compile(r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|==|!=|<=|>=|&&|\|\||\S',re.S)
GLOBALS={'request','resource','math','duration','timestamp','latlng','hashing','debug','true','false','null','in','is','let','return','function',
 'string','int','float','bool','path','map','list','number','exists','existsAfter','get','getAfter','database','set','bytes','constraint'}
class Tok:
    __slots__=('t','s','e')
    def __init__(s,t,a,b): s.t=t; s.s=a; s.e=b
    def __repr__(s): return s.t
def tokenize(src):
    return [Tok(m.group(),m.start(),m.end()) for m in TOKRE.finditer(src)]
def isid(t): return re.match(r'[A-Za-z_]\w*$',t) is not None
def match_close(T,i):
    o=T[i].t; c={'(':')','[':']','{':'}'}[o]; d=0
    for k in range(i,len(T)):
        if T[k].t in '([{': d+=1
        elif T[k].t in ')]}':
            d-=1
            if d==0: return k
    raise ValueError('unbalanced')
class Func:
    def __init__(s,**k): s.__dict__.update(k)
class Allow:
    def __init__(s,**k): s.__dict__.update(k)
def parse(src):
    T=tokenize(src); funcs=[]; allows=[]; scope=[]  # scope: list of (matchpattern, vars, closeidx)
    stack=[]  # (close_index, scope_entry)
    i=0; n=len(T)
    while i<n:
        while stack and i>stack[-1][0]: stack.pop()
        t=T[i].t
        if t=='match':
            j=i+1
            while not (T[j].t=='{' and T[j-1].t!='/'): j+=1
            pat=src[T[i+1].s:T[j-1].e]
            vars_=re.findall(r'\{(\w+)(?:=\*\*)?\}',pat)
            close=match_close(T,j)
            stack.append((close,{'pat':pat,'vars':vars_,'open':j,'close':close}))
            i=j+1; continue
        if t=='function':
            name=T[i+1].t; j=i+2; assert T[j].t=='('
            k=match_close(T,j); params=[x.t for x in T[j+1:k] if x.t!=',']
            assert T[k+1].t=='{'; bc=match_close(T,k+1)
            body=T[k+2:bc]
            # lets
            lets=[]; p=0
            while p<len(body) and body[p].t=='let':
                nm=body[p+1].t; assert body[p+2].t=='='; q=p+3; d=0
                while True:
                    x=body[q].t
                    if x in '([{': d+=1
                    elif x in ')]}': d-=1
                    elif x==';' and d==0: break
                    q+=1
                lets.append((nm,body[p+3],body[q-1])); p=q+1
            assert body[p].t=='return',(name,body[p].t)
            q=len(body)-1
            assert body[q].t==';', name
            ret=(body[p+1],body[q-1])
            funcs.append(Func(name=name,params=params,start=T[i].s,end=T[bc].e,bodytoks=body,lets=lets,ret=ret,
                              scope=[s[1] for s in stack],ti=i,tend=bc))
            i=bc+1; continue
        if t=='allow':
            j=i+1
            while T[j].t!=':': j+=1
            k=j+1; d=0
            while True:
                x=T[k].t
                if x in '([{': d+=1
                elif x in ')]}': d-=1
                elif x==';' and d==0: break
                k+=1
            ct=T[j+1:k]
            if ct and ct[0].t=='if': ct=ct[1:]
            allows.append(Allow(methods=[x.t for x in T[i+1:j] if x.t!=','],start=T[i].s,end=T[k].e,cond=ct,scope=[s[1] for s in stack],ti=i,tend=k))
            i=k+1; continue
        i+=1
    return T,funcs,allows
def call_sites(toks,names):
    out=[]
    for i,x in enumerate(toks):
        if x.t in names and i+1<len(toks) and toks[i+1].t=='(' and (i==0 or toks[i-1].t not in ('.','function')):
            out.append(i)
    return out
def ident_refs(toks):
    """identifier tokens that are variable references (not members, not path segments, not map keys)."""
    out=[]
    for i,x in enumerate(toks):
        if not isid(x.t): continue
        prev=toks[i-1].t if i>0 else ''
        if prev=='.': continue
        if prev=='/': continue
        if prev=='(' and i>1 and toks[i-2].t=='/': continue
        if i+1<len(toks) and toks[i+1].t=='(' : continue  # function call name
        out.append(i)
    return out
