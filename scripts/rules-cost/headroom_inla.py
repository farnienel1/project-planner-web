"""Inline single-site functions called from an allow condition: lets and params substituted textually.
Kept only when the static compile cost falls."""
import re,sys,collections
sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
sys.path.insert(0,sys.argv[3])
import headroom_inl as inl, metric, os
ALLOWDUP=os.environ.get('ALLOWDUP')=='1'
SKIP=set(os.environ.get('SKIP','').split(','))
import equiv as E
def pw(t):
    tt=E.toks(t)
    return t if ((tt and E.is_primary(tt) and not t.strip().startswith('!')) or (re.match(r'^/databases/\(default\)/[^ \n]*$',t.strip()) and t.count('(')==t.count(')'))) else '('+t+')'
def cost(s):
    open(__import__('tempfile').gettempdir()+'/_rules_headroom.rules','w').write(s)
    return metric.total2(__import__('tempfile').gettempdir()+'/_rules_headroom.rules')[2]
def try_one(src,n,F,sp,k):
    f=F[n][0]; B=f['body']
    T=[x[0] for x in sp]; c=E.matching(T,k+1)
    args=[];cur=[];d=0
    for j in range(k+2,c):
        x=T[j]
        if x in '([{': d+=1
        elif x in ')]}': d-=1
        if x==',' and d==0: args.append(cur); cur=[]
        else: cur.append(j)
    if cur: args.append(cur)
    if len(args)!=len(f['params']): return None
    ren={}
    def rtext(i,j):
        out=[];last=B[i][1]
        for q in range(i,j):
            t,a,b=B[q]
            if t in ren and (q==0 or B[q-1][0]!='.') and not (q+1<len(B) and B[q+1][0]=='('):
                out.append(src[last:a]); out.append(ren[t]); last=b
        out.append(src[last:B[j-1][2]]); return ''.join(out)
    for p,a in zip(f['params'],args):
        at=src[sp[a[0]][1]:sp[a[-1]][2]]
        ren[p]=pw(at)
    def uses(v):
        return sum(1 for q,(t,a,b) in enumerate(B) if t==v and (q==0 or B[q-1][0]!='.') and not (q+1<len(B) and B[q+1][0]=='(') and not (q>0 and B[q-1][0]=='let'))
    for p in f['params']:
        if uses(p)>1 and not ALLOWDUP and not re.match(r"^[A-Za-z_][\w.]*$|^'[^']*'$",ren[p]): return None
    for (i,j) in f['stm']:
        if B[i][0]=='let':
            txt=rtext(i+3,j)
            if uses(B[i+1][0])>1 and not ALLOWDUP and not (len(E.toks(txt))<=8 and '(' not in txt): return None
            ren[B[i+1][0]]=pw(txt)
    ri,rj=f['stm'][-1]
    cl=src.rfind('\n',0,sp[k][1])+1; cind=len(src[cl:sp[k][1]])-len(src[cl:sp[k][1]].lstrip(' '))
    rexpr=inl.reind(rtext(ri+1,rj),cind)
    edits=[(sp[k][1],sp[c][2],pw(rexpr)),(f['start'],f['end'],'')]
    edits.sort(key=lambda e:-e[0]); new=src
    for a,b,t in edits: new=new[:a]+t+new[b:]
    return re.sub(r'\n[ ]*\n([ ]*\n)+','\n\n',new)
src=open(sys.argv[1]).read(); base=cost(src); tried=set(); done=[]
while True:
    F=inl.functions(src); dup={n for n,l in F.items() if len(l)>1}
    sp,sites=inl.callsites(src,F,set(F))
    best=None
    for n,ks in sites.items():
        if len(ks)!=1 or n in dup or n in tried or n in SKIP: continue
        if inl.owner(src,F,sp[ks[0]][1]) is not None: continue
        new=try_one(src,n,F,sp,ks[0])
        if new is None: tried.add(n); continue
        c=cost(new)
        if c<base and len(new.encode())-len(src.encode())<=500 and (best is None or c<best[0]): best=(c,n,new)
        else: tried.add(n)
    if not best: break
    done.append((best[1],best[0],len(best[2].encode())-len(src.encode()))); base,n,src=best
open(sys.argv[2],'w').write(src)
for d in done: print(d)
