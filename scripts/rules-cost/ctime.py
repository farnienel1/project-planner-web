import json,urllib.request,sys,time
import os
PORT=int(os.environ.get('EMU_PORT','8313'))
def load(p,f):
    body={'rules':{'files':[{'name':'firestore.rules','content':open(f).read()}]}}
    r=urllib.request.Request(f'http://127.0.0.1:{PORT}/emulator/v1/projects/{p}:securityRules',method='PUT',data=json.dumps(body).encode(),headers={'Content-Type':'application/json'})
    t=time.time()
    try:
        with urllib.request.urlopen(r) as x: out=x.read().decode(); st=x.status
    except urllib.error.HTTPError as e: out=e.read().decode(); st=e.code
    return st,time.time()-t,out
if __name__=='__main__':
    n=int(sys.argv[1])
    for f in sys.argv[2:]:
        ts=[]
        for i in range(n):
            st,dt,out=load('ct-%d'%i,f); ts.append(dt)
        ts.sort()
        nw=out.count('"severity"') if out else 0
        print(f.split('/')[-1],st,'median %.3f min %.3f'%(ts[len(ts)//2],ts[0]),'issues',nw, out[:300] if st!=200 or nw else '')
