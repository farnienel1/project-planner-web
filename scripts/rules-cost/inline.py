import sys,re,collections
import os; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import rp
SIMPLE=re.compile(r"^([A-Za-z_]\w*|'[^']*'|\d+|true|false|null)$")
def split_args(T,o,c):
    args=[];d=0;st=o+1
    for k in range(o+1,c):
        x=T[k].t
        if x in '([{': d+=1
        elif x in ')]}': d-=1
        elif x==',' and d==0: args.append((st,k-1)); st=k+1
    if st<=c-1: args.append((st,c-1))
    return args
def scope_vars(sc): return [v for s in sc for v in s['vars']]
def try_inline(src,maxsites=1,verbose=False,skip=()):
    T,F,A=rp.parse(src)
    byname={f.name:f for f in F}
    names=set(byname)
    # call sites: (container kind, container obj, token index in T)
    sites=collections.defaultdict(list)
    for f in F:
        for i in rp.call_sites(T[f.ti:f.tend+1],names): sites[T[f.ti+i].t].append(('f',f,f.ti+i))
    for a in A:
        for i in rp.call_sites(T[a.ti:a.tend+1],names): sites[T[a.ti+i].t].append(('a',a,a.ti+i))
    cands=[]
    for f in F:
        s=sites.get(f.name,[])
        if not s or len(s)>maxsites or f.lets or f.name in skip: continue
        cands.append(f)
    cands.sort(key=lambda f:-len(f.bodytoks))
    for f in cands:
        ok=True; plan=[]
        rs,re_=f.ret; ri=T.index(rs,f.ti); rj=T.index(re_,ri)
        ret=T[ri:rj+1]
        refs=rp.ident_refs(ret)
        free=set(ret[i].t for i in refs if ret[i].t not in f.params and ret[i].t not in rp.GLOBALS and ret[i].t not in names)
        for kind,cont,ci in sites[f.name]:
            # caller bindings
            if kind=='f':
                bound=set(cont.params)|set(l[0] for l in cont.lets)
                csc=cont.scope
            else:
                bound=set(); csc=cont.scope
            # match vars introduced deeper than callee's scope
            deeper=scope_vars(csc[len(f.scope):]) if len(csc)>=len(f.scope) else None
            if deeper is None: ok=False;break
            if free & (bound|set(deeper)): ok=False; break
            o=ci+1; c=rp.match_close(T,o); args=split_args(T,o,c)
            if len(args)!=len(f.params): ok=False;break
            argtxt=[src[T[a].s:T[b].e] for a,b in args]
            uses={p:sum(1 for i in refs if ret[i].t==p) for p in f.params}
            sub={}
            for p,at in zip(f.params,argtxt):
                simple=bool(SIMPLE.match(at.strip()))
                if uses[p]>1 and not simple: ok=False;break
                sub[p]=at.strip() if simple else '('+at.strip()+')'
            if not ok: break
            # build new text of return expr
            out=[];last=ret[0].s
            for i in refs:
                x=ret[i]
                if x.t in sub:
                    out.append(src[last:x.s]); out.append(sub[x.t]); last=x.e
            out.append(src[last:ret[-1].e])
            body=''.join(out)
            plan.append((T[ci].s,T[c].e,'('+body+')'))
        if not ok: continue
        # apply: replace call sites, remove definition
        edits=plan+[(f.start,f.end,'')]
        edits.sort(key=lambda e:-e[0])
        new=src
        for a,b,txt in edits: new=new[:a]+txt+new[b:]
        if verbose: print('inlined',f.name,'into',[ (k, getattr(c,'name',c.methods)) for k,c,_ in sites[f.name]])
        return new,f.name
    return None,None
if __name__=='__main__':
    src=open(sys.argv[1]).read(); out=sys.argv[2]; maxs=int(sys.argv[3]) if len(sys.argv)>3 else 1
    n=0; done=[]
    while True:
        new,name=try_inline(src,maxs)
        if not new: break
        src=new; n+=1; done.append(name)
    src=re.sub(r'\n[ \t]*\n(?:[ \t]*\n)+','\n\n',src)
    open(out,'w').write(src); print('inlined',n); print(' '.join(done))
