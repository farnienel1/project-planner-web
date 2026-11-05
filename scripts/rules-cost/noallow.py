import re,sys
s=open(sys.argv[1]).read(); o=[];i=0
while True:
    m=re.search(r'allow [a-z, ]+:\s*if\s',s[i:])
    if not m: o.append(s[i:]);break
    st=i+m.end(); o.append(s[i:st]); d=0;k=st
    while True:
        c=s[k]
        if c in '([{': d+=1
        elif c in ')]}': d-=1
        elif c==';' and d==0: break
        k+=1
    o.append('false;'); i=k+1
open(sys.argv[2],'w').write(''.join(o))
