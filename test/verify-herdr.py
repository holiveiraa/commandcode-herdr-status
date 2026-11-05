from pathlib import Path
import argparse,json,os,shutil,subprocess,tempfile,time
parser=argparse.ArgumentParser()
parser.add_argument("--live-model", action="store_true", help="Send one short prompt using the configured account")
options=parser.parse_args()
project=Path(__file__).resolve().parents[1]
root=Path(tempfile.mkdtemp(prefix='commandcode-herdr-test-'))
env=dict(os.environ)
for key in list(env):
 if key.startswith('HC_'):env.pop(key)
env['HC_SESSION']='status-verification'
for key,folder in [('XDG_RUNTIME_DIR','runtime'),('XDG_STATE_HOME','state'),('XDG_CONFIG_HOME','config')]:
 p=root/folder;p.mkdir(mode=0o700);env[key]=str(p)
hc=shutil.which('hc')
assert hc, 'Install herdr-core first'
cmd=shutil.which('cmd')
assert cmd, 'Install Command Code first'
node=shutil.which('node')
assert node, 'Install Node first'
def call(*args):
 r=subprocess.run([hc,*args],env=env,capture_output=True,text=True,timeout=25)
 if r.returncode:raise RuntimeError(r.stderr[:1500])
 return json.loads(r.stdout) if r.stdout.strip() else None
def terminal(result):
 if 'terminal' in result:
  v=result['terminal'];return v.get('address',v.get('id')) if isinstance(v,dict) else v
 return result.get('address',result.get('id'))
started=[]
try:
 r=call('run','--bg','--json','--cwd',str(root),node,str(project/'test/transport-driver.mjs'));print('Synthetic terminal:',r,flush=True)
 t=terminal(r);assert t;started.append(t)
 seen=[]
 until=time.monotonic()+12
 while time.monotonic()<until:
  state=call('get',t,'--json');info=state.get('terminal',state)
  status=info.get('status');value=(status.get('state'),status.get('kind')) if isinstance(status,dict) else status
  if not seen or seen[-1]!=value:seen.append(value)
  if info.get('state')=='finished':break
  time.sleep(.12)
 print('PTY status transitions:',seen,flush=True)
 assert ('blocked','permission') in seen and ('blocked','question') in seen and ('working',None) in seen and ('idle',None) in seen
 assert seen[-1] is None, 'Status must clear after session end'
 r=call('run','--bg','--json','--cwd',str(root),cmd,'--trust','--no-auto-update','--skip-onboarding','--no-skills');print('Real Command Code terminal:',r,flush=True)
 t=terminal(r);assert t;started.append(t)
 until=time.monotonic()+25
 while time.monotonic()<until:
  state=call('get',t,'--json');info=state.get('terminal',state);status=info.get('status')
  if isinstance(status,dict) and status.get('app')=='command-code' and status.get('state')=='idle':break
  time.sleep(.25)
 else:
  print('Startup output:',call('read','--lines','16',t,'--json'),flush=True)
  raise AssertionError('Real Command Code did not announce idle')
 print('Real Command Code reported:',status,flush=True)
 if options.live_model:
  call('send',t,'Teste técnico isolado do indicador de status. Responda somente OK. Não use ferramentas e não altere arquivos.','--json')
  seen_working=False
  until=time.monotonic()+75
  while time.monotonic()<until:
   result=call('get',t,'--json');item=result.get('terminal',result);report=item.get('status') or {}
   if report.get('state')=='working':seen_working=True
   if seen_working and report.get('state')=='idle':break
   time.sleep(.1)
  assert seen_working and report.get('state')=='idle', 'Real model turn did not settle'
  print('Real model turn: working -> idle.',flush=True)
  text=call('read','--lines','12',t,'--json').get('text','')
  print('Model answered OK:', 'OK' in text,flush=True)
 call('send','--force',t,'/exit','--json')
 until=time.monotonic()+10
 while time.monotonic()<until:
  state=call('get',t,'--json');info=state.get('terminal',state)
  if info.get('state')=='finished':break
  time.sleep(.2)
 assert info.get('status') is None, info
 print('Real Command Code exit: status cleared.',flush=True)
finally:
 for t in started:
  try:call('kill',t,'--json')
  except Exception:pass
  try:call('rm',t,'--json')
  except Exception:pass
 try:call('server','stop','--json')
 except Exception:pass
 print('Isolated test core cleaned up. Artifacts:',root,flush=True)
