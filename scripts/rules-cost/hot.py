import sys,collections
import os; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from metric import *
r,per,funcs,size,ncalls=analyze(sys.argv[1])
cnt=collections.Counter()
def walk(f,m):
    cnt[f]+=m
    for c in calls(funcs[f]['body'],funcs): walk(c,m)
import functools
# expansion count via memo of call multiplicity
mult=collections.Counter()
for meths,cond in parse(open(sys.argv[1]).read())[1]:
    for c in calls(cond,funcs): mult[c]+=1
# propagate in topological order: compute total via recursion with counts
tot=collections.Counter()
@functools.lru_cache(None)
def sub(f):
    c=collections.Counter({f:1})
    for x in calls(funcs[f]['body'],funcs): c.update(sub(x))
    return c
for f,m in mult.items():
    for g,k in sub(f).items(): tot[g]+=k*m
rows=sorted(((tot[f]*len(funcs[f]['body']),tot[f],len(funcs[f]['body']),size(f),f) for f in funcs),reverse=True)
N=int(sys.argv[2]) if len(sys.argv)>2 else 40
print('contrib  expansions  own  inlined  name')
for x in rows[:N]: print('%8d %8d %6d %8d  %s'%x)
print('rules top:')
for s in sorted(per,reverse=True)[:15]: print(s)
