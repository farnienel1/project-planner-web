import re,sys
sys.path.insert(0,sys.argv[1])
from metric import toks
src=open(sys.argv[2]).read()
PATS=[('request.resource.data',r'(?<![\w.])request\.resource\.data(?![\w])','nd'),
      ('request.auth.token',r'(?<![\w.])request\.auth\.token(?![\w])','tk'),
      ('request.auth.uid',r'(?<![\w.])request\.auth\.uid(?![\w])','me'),
      ('resource.data',r'(?<![\w.])resource\.data(?![\w])','od')]
def find_funcs(s):
    out=[]
    for m in re.finditer(r'\bfunction\s+(\w+)\s*\(([^)]*)\)\s*\{',s):
        i=m.end(); d=1; j=i; q=None
        while d:
            c=s[j]
            if q:
                if c=='\\': j+=2; continue
                if c==q: q=None
            elif c in '\'"': q=c
            elif c=='/' and s[j+1]=='/':
                j=s.index('\n',j); continue
            elif c=='{': d+=1
            elif c=='}': d-=1
            j+=1
        out.append((m.group(1),m.group(2),i,j-1))
    return out
def split_strings(b):
    # returns list of (is_code, text)
    parts=[];cur='';q=None;i=0
    while i<len(b):
        c=b[i]
        if q:
            cur+=c
            if c=='\\': cur+=b[i+1]; i+=2; continue
            if c==q: parts.append((False,cur)); cur=''; q=None
        elif c in '\'"':
            parts.append((True,cur)); cur=c; q=c
        else: cur+=c
        i+=1
    parts.append((q is None,cur))
    return parts
def idents(b): return set(re.findall(r'[A-Za-z_]\w*',b))
PROT=set(open(__import__('os').environ['PROTECT']).read().split(',')) if __import__('os').environ.get('PROTECT') else set()
funcs=find_funcs(src)
# only innermost-safe: process from end so offsets stay valid; skip functions containing nested functions
edits=[]
changed=[]
for name,params,a,b in funcs:
    body=src[a:b]
    if 'function ' in body or name in PROT: continue
    new=body
    for pname,rx,var in PATS:
        parts=split_strings(new)
        k=sum(len(re.findall(rx,t)) for c,t in parts if c)
        T=len(toks(pname))
        if k*(T-1)-(T+4)<=0: continue
        used=idents(new)|set(x.strip() for x in params.split(','))
        v=var; n=2
        while v in used: v=var+str(n); n+=1
        parts=[(c,re.sub(rx,v,t) if c else t) for c,t in parts]
        nb=''.join(t for c,t in parts)
        # insert let after leading whitespace
        m=re.match(r'\s*',nb); ind=re.search(r'\n([ ]*)\S',nb)
        indent=ind.group(1) if ind else '    '
        nb=nb[:m.end()]+'let %s = %s;\n%s'%(v,pname,indent)+nb[m.end():]
        new=nb
    if new!=body: edits.append((a,b,new)); changed.append(name)
for a,b,new in sorted(edits,reverse=True): src=src[:a]+new+src[b:]
open(sys.argv[3],'w').write(src)
print(len(changed),changed)
