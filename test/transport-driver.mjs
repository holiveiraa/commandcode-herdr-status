// Synthetic lifecycle events, carried over a real herdr-core PTY.
import herdrStatus from '../src/herdr-status.ts';
const listeners = new Map(), saved = new Map();
let hooks;
herdrStatus({ hooks:h=>{hooks=h;}, on:(type,fn)=>listeners.set(type,fn), addCommand(){},
  state:{ get:k=>saved.get(k), set:(k,v)=>saved.set(k,v) } });
if (!hooks) throw Error('Reporter did not activate in the test PTY');
const pause = () => new Promise(resolve=>setTimeout(resolve,900));
hooks.onSessionStart(); await pause();
for (const event of [
  {type:'run_start'},
  {type:'interaction_requested',kind:'permission'},
  {type:'interaction_resolved',kind:'permission'},
  {type:'interaction_requested',kind:'question'},
  {type:'interaction_resolved',kind:'question'},
  {type:'run_end'},
]) { listeners.get(event.type)(event); await pause(); }
hooks.onSessionEnd(); await pause();
