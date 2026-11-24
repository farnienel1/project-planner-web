"""Inline functions that have exactly one call site and whose caller is a function (lets merged, renamed)."""
import re,sys,collections
sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import equiv as E
def pw(t):
    tt=E.toks(t)
    return t if ((tt and E.is_primary(tt) and not t.strip().startswith('!')) or (re.match(r'^/databases/\(default\)/[^ \n]*$',t.strip()) and t.count('(')==t.count(')'))) else '('+t+')'
KW={'in','is','true','false','null','return','let','if','request','resource','function'}
def reind(t,base):
    ls=t.split('\n')
    if len(ls)==1: return t
    rest=[l for l in ls[1:] if l.strip()]
    mi=min(len(l)-len(l.lstrip(' ')) for l in rest)
    return '\n'.join([ls[0]]+[' '*(base+2)+l[mi:] for l in ls[1:] if l.strip()])

def spans(s,a=0,b=None):
    out=[]
    for m in E.TOK.finditer(s,a,len(s) if b is None else b):
        t=m.group(0)
        if t.startswith('//') or t.startswith('/*'): continue
        out.append((t,m.start(),m.end()))
    return out
def functions(src):
    F={}
    for m in re.finditer(r'\bfunction\s+(\w+)\s*\(([^)]*)\)\s*\{',src):
        sp=spans(src,m.end())
        T=['{']+[x[0] for x in sp]; e=E.matching(T,0)-1
        body=sp[:e]
        start=src.rfind('\n',0,m.start())+1
        end=sp[e][2]
        if end<len(src) and src[end]=='\n': end+=1
        params=[p.strip() for p in m.group(2).split(',') if p.strip()]
        # statements
        stm=[];i=0
        while i<len(body):
            d=0;j=i
            while not(body[j][0]==';' and d==0):
                if body[j][0] in '([{': d+=1
                elif body[j][0] in ')]}': d-=1
                j+=1
            stm.append((i,j)); i=j+1
        F.setdefault(m.group(1),[]).append(dict(name=m.group(1),params=params,body=body,stm=stm,start=start,end=end,hdr=m.start()))
    return F
def callsites(src,F,names):
    res=collections.defaultdict(list)
    sp=spans(src)
    for k,(t,a,b) in enumerate(sp):
        if t in names and k+1<len(sp) and sp[k+1][0]=='(' and (k==0 or sp[k-1][0] not in ('.','function')):
            res[t].append(k)
    return sp,res
def owner(src,F,pos):
    for n,lst in F.items():
        for f in lst:
            if f['body'] and f['body'][0][1]<=pos<f['body'][-1][2]: return f
    return None
PROT=set(open(__import__('os').environ['PROTECT']).read().split(',')) if __import__('os').environ.get('PROTECT') else set()
def step(src,skip):
    F=functions(src)
    dupnames={n for n,l in F.items() if len(l)>1}
    names=set(F)
    sp,sites=callsites(src,F,names)
    cands=[]
    for n,ks in sites.items():
        if len(ks)!=1 or n in dupnames or n in skip: continue
        f=F[n][0]
        g=owner(src,F,sp[ks[0]][1])
        if g is None or g['name']==n or g['name'] in PROT: continue
        cands.append((len(f['body']),n,ks[0],f,g))
    cands.sort(reverse=True)
    for _,n,k,f,g in cands:
        # call args
        T=[x[0] for x in sp]; c=E.matching(T,k+1)
        args=[];cur=[];d=0
        for j in range(k+2,c):
            x=T[j]
            if x in '([{': d+=1
            elif x in ')]}': d-=1
            if x==',' and d==0: args.append(cur); cur=[]
            else: cur.append(j)
        if cur: args.append(cur)
        if len(args)!=len(f['params']): continue
        gidents=set(x[0] for x in g['body'])|set(g['params'])
        pref=''.join(ch for ch in n if ch.isupper()).lower() or n[:3]
        pref=n[0]+pref
        def nm(v):
            x=pref+v[0].upper()+v[1:]; i=2
            while x in gidents: x=pref+v[0].upper()+v[1:]+str(i); i+=1
            return x
        ren={}
        newlets=[]
        B=f['body']
        def uses(v):
            return sum(1 for q,(t,a,b) in enumerate(B) if t==v and (q==0 or B[q-1][0]!='.') and not (q+1<len(B) and B[q+1][0]=='(') and not (q>0 and B[q-1][0]=='let'))
        def rtext(i,j):
            out=[];last=B[i][1]
            for q in range(i,j):
                t,a,b=B[q]
                if t in ren and (q==0 or B[q-1][0]!='.') and not (q+1<len(B) and B[q+1][0]=='('):
                    out.append(src[last:a]); out.append(ren[t]); last=b
            out.append(src[last:B[j-1][2]]); return ''.join(out)
        for p,a in zip(f['params'],args):
            atext=src[sp[a[0]][1]:sp[a[-1]][2]]
            if len(a)==1 and re.match(r"^[A-Za-z_]\w*$|^'[^']*'$|^\d+$",atext) and atext not in KW|{'true','false','null'}:
                ren[p]=atext
            elif uses(p)<=1:
                ren[p]=pw(atext)
            else:
                ren[p]=nm(p); newlets.append((ren[p],atext))
        for (i,j) in f['stm']:
            if B[i][0]=='let':
                v=B[i+1][0]; txt=rtext(i+3,j)
                if uses(v)<=1: ren[v]=pw(txt)
                else: ren[v]=nm(v); newlets.append((ren[v],txt))
        if __import__('os').environ.get('NOLETS')=='1' and newlets: continue
        if sum(1 for (i,j) in g['stm'] if g['body'][i][0]=='let')+len(newlets)>10: continue
        ri,rj=f['stm'][-1]; assert f['body'][ri][0]=='return'
        rexpr=rtext(ri+1,rj)
        # find statement of g containing call
        cpos=sp[k][1]
        st=None
        for (i,j) in g['stm']:
            if g['body'][i][1]<=cpos<=g['body'][j][2]: st=g['body'][i][1]; break
        line=src.rfind('\n',0,st)+1; ind=src[line:st]
        newlets=[(v,reind(t,len(ind))) for v,t in newlets]
        ins=''.join('let %s = %s;\n%s'%(v,t,ind) for v,t in newlets)
        cl=src.rfind('\n',0,sp[k][1])+1; cind=len(src[cl:sp[k][1]])-len(src[cl:sp[k][1]].lstrip(' '))
        rexpr=reind(rexpr,cind)
        edits=[(sp[k][1],sp[c][2],pw(rexpr)),(st,st,ins),(f['start'],f['end'],'')]
        # blank line cleanup: if function preceded by blank line, remove one
        edits.sort(key=lambda e:-e[0])
        new=src
        for a,b,t in edits: new=new[:a]+t+new[b:]
        new=re.sub(r'\n[ ]*\n([ ]*\n)+','\n\n',new)
        return new,n,g['name']
    return None,None,None
if __name__=='__main__':
    src=open(sys.argv[1]).read(); skip=set(sys.argv[3].split(',')) if len(sys.argv)>3 and sys.argv[3] else set()
    done=[]
    while True:
        new,n,g=step(src,skip)
        if not new: break
        src=new; done.append((n,g))
    open(sys.argv[2],'w').write(src)
    for d in done: print('inlined %s into %s'%d)
