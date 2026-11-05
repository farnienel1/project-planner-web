import re,sys
src=open(sys.argv[1]).read(); name=sys.argv[2]; out=sys.argv[3]
i=src.index('function %s('%name); j=src.index('{',i); d=0;k=j
while True:
    if src[k]=='{': d+=1
    elif src[k]=='}':
        d-=1
        if d==0: break
    k+=1
open(out,'w').write(src[:j]+'{ return true; }'+src[k+1:])
