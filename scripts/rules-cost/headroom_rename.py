import re,sys
s=open(sys.argv[1]).read(); old,new=sys.argv[3],sys.argv[4]
out=[];i=0
for m in re.finditer(r"'(?:\\.|[^'\\])*'|\"(?:\\.|[^\"\\])*\"|//[^\n]*",s):
    seg=s[i:m.start()]
    out.append(re.sub(r'(?<![.\w])'+old+r'(?!\w)',new,seg)); out.append(m.group(0)); i=m.end()
out.append(re.sub(r'(?<![.\w])'+old+r'(?!\w)',new,s[i:]))
open(sys.argv[2],'w').write(''.join(out))
