import re,sys,collections
sys.path.insert(0,sys.argv[1]); sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from metric import analyze
import equiv as E
SRC=sys.argv[2]; OUT=sys.argv[3]; MINSAVE=int(sys.argv[4]) if len(sys.argv)>4 else 8
src=open(SRC).read()
r,per,funcs,size,ncalls=analyze(SRC)
TOKRE=E.TOK
def tokspans(s,a,b):
    out=[]
    for m in TOKRE.finditer(s,a,b):
        t=m.group(0)
        if t.startswith('//') or t.startswith('/*'): continue
        out.append((t,m.start(),m.end()))
    return out
def cost(tl):
    c=0
    for i,t in enumerate(tl):
        c+=1
        if t in funcs and i+1<len(tl) and tl[i+1]=='(' and (i==0 or tl[i-1]!='.'): c+=size(t)
    return c
def candidates(sp):
    T=[x[0] for x in sp]; out=[]
    for i,t in enumerate(T):
        if not re.match(r'[A-Za-z_]',t) or t in ('in','is','true','false','null','return','let','if') or (i>0 and T[i-1]=='.'): continue
        # build primary chain starting at i
        j=i+1
        if j<len(T) and T[j]=='(': j=E.matching(T,j)+1
        while j<len(T):
            if T[j]=='.' and j+1<len(T) and re.match(r'[A-Za-z_]',T[j+1]):
                j+=2
                if j<len(T) and T[j]=='(': j=E.matching(T,j)+1
                # record intermediate
                out.append((i,j))
            elif T[j]=='[': j=E.matching(T,j)+1; out.append((i,j))
            else: break
        if i+1<len(T) and T[i+1]=='(' and T[i] in funcs: out.append((i,E.matching(T,i+1)+1))
    return out
def process(sp, existing_idents, lets_ok_vars):
    """sp: token spans of the expression region to dedupe. returns list of (name, exprtext) and replacements"""
    T=[x[0] for x in sp]
    groups=collections.defaultdict(list)
    for i,j in candidates(sp):
        key=' '.join(T[i:j])
        # skip if refers to a 'let' var defined later? we only process return region so fine
        if T[i] in ('request','resource') and j-i<=5: continue
        groups[key].append((i,j))
    chosen=[]; used=set()
    # prefer biggest savings
    def sav(k):
        occ=groups[k]; c=cost(k.split(' '))
        return (len(occ)-1)*c - (len(occ)+5)
    keys=sorted([k for k in groups if len(groups[k])>1], key=lambda k:-sav(k))
    taken=[]
    for k in keys:
        occ=[o for o in groups[k] if not any(not(o[1]<=a or o[0]>=b) for a,b in taken)]
        # occurrences must not overlap each other
        if len(occ)<2: continue
        c=cost(k.split(' '))
        if (len(occ)-1)*c-(len(occ)+5)<MINSAVE: continue
        chosen.append((k,occ)); taken+=occ
    return chosen
# locate function bodies and allow conditions in source
PROT=set(open(__import__('os').environ['PROTECT']).read().split(',')) if __import__('os').environ.get('PROTECT') else set()
edits=[]; names=set(re.findall(r'[A-Za-z_]\w*',src)); report=[]
def vname(k):
    T=k.split(' ')
    if T[0] in funcs and T[1]=='(':
        return T[0]+'V' if T[2]==')' else T[0]+'Of'
    ids=[t.strip("'") for t in T if (re.match(r'^[A-Za-z_]\w*$',t) or re.match(r"^'[A-Za-z_]\w*'$",t)) and t not in ('get','data','true','false','null','request','auth')] or ['v']
    ids=[re.sub(r"\W","",t) for t in ids][:3]
    x=ids[0]+''.join(i[0].upper()+i[1:] for i in ids[1:])
    return x
def fresh(base):
    n=base; i=2
    while n in names: n=base+str(i); i+=1
    names.add(n); return n
for m in re.finditer(r'\bfunction\s+(\w+)\s*\(([^)]*)\)\s*\{',src):
    sp=tokspans(src,m.end(),len(src))
    T=[x[0] for x in sp]; e=E.matching(['{']+T,0)-1
    body=sp[:e]
    if any(x[0]=='function' for x in body) or m.group(1) in PROT: continue
    # find 'return'
    ri=[k for k,x in enumerate(body) if x[0]=='return'][0]
    region=body[ri+1:]
    if region and region[-1][0]==';': region=region[:-1]
    ch=process(region,None,None)
    ch=ch[:max(0,10-sum(1 for x in body if x[0]=='let'))]
    if not ch: continue
    lets=[]; reps=[]
    for k,occ in ch:
        v=fresh(vname(k))
        a,b=occ[0]; lets.append((v,src[region[a][1]:region[b-1][2]]))
        for a,b in occ: reps.append((region[a][1],region[b-1][2],v))
        report.append((m.group(1),k[:60],len(occ),v))
    edits.append(('fn',body[ri][1],lets,reps))
for m in (re.finditer(r'\ballow\s+([a-z, ]+):\s*if\s',src) if len(sys.argv)>5 else []):
    sp=tokspans(src,m.end(),len(src)); d=0
    for k,x in enumerate(sp):
        if x[0] in '([{': d+=1
        elif x[0] in ')]}': d-=1
        elif x[0]==';' and d==0: break
    region=sp[:k]
    ch=process(region,None,None)
    if not ch: continue
    lets=[]; reps=[]
    for kk,occ in ch:
        v=fresh('h'+re.sub(r'\W','',kk.split(' ')[0])[:10].capitalize())
        a,b=occ[0]; lets.append((v,src[region[a][1]:region[b-1][2]]))
        for a,b in occ: reps.append((region[a][1],region[b-1][2],v))
        report.append(('allow@%d'%m.start(),kk[:60],len(occ)))
    edits.append(('allow',(m,region),lets,reps))
# apply from end
ops=[]
for kind,pos,lets,reps in edits:
    for a,b,v in reps: ops.append((a,b,v))
    if kind=='fn':
        ind=' '*(len(src[:pos])-len(src[:pos].rstrip(' ')))  # indentation before 'return'
        ins=''.join('let %s = %s;\n%s'%(v,t,ind) for v,t in lets)
        ops.append((pos,pos,ins))
    else:
        m,region=pos
        fname=fresh('allowCond')
        a=region[0][1]; b=region[-1][2]
        # wrap: replace condition with fname() and define function before the allow line
        line_start=src.rfind('\n',0,m.start())+1
        ind=src[line_start:m.start()]
        ops.append(('WRAP',a,b,fname,lets,line_start,ind))
# perform: build result by handling WRAP specially
src2=src
simple=[o for o in ops if o[0]!='WRAP']; wraps=[o for o in ops if o[0]=='WRAP']
# apply simple replacements but for wrapped conds we need the replaced text, so do in descending order with markers
allops=[(o[0],o[1],('S',o[2])) for o in simple]+[(o[1],o[2],o) for o in wraps]
allops.sort(key=lambda x:(x[0],x[1]),reverse=True)
# nested: simple reps fall inside wrap ranges; handle by applying simple first, tracking offset per wrap
for a,b,o in sorted([x for x in allops if x[2][0]=='S'],key=lambda x:x[0],reverse=True):
    pass
out=src; shifts=[]
def adj(p):
    return p+sum(d for q,d in shifts if q<=p)
for a,b,o in sorted([x for x in allops if x[2][0]=='S'],key=lambda x:(x[0],x[1]),reverse=True):
    out=out[:a]+o[1]+out[b:]; shifts.append((a,len(o[1])-(b-a)))
for _,a,b,fname,lets,ls,ind in sorted(wraps,key=lambda w:w[1],reverse=True):
    A=adj(a); B=adj(b)
    # recompute B: shifts with q<b include reps inside (a,b)
    cond=out[A:B]
    L=adj(ls)
    fn='%sfunction %s() {\n%s'%(ind,fname,''.join('%s  let %s = %s;\n'%(ind,v,t) for v,t in lets))+'%s  return %s;\n%s}\n'%(ind,cond,ind)
    out=out[:A]+fname+'()'+out[B:]
    out=out[:L]+fn+out[L:]
open(OUT,'w').write(out)
for x in report: print(x)
