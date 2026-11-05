import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { register, transition, emptyState, statusFor, encodeStatus } from '../src/herdr-status.ts';

function fixture(overrides = {}, saved = new Map()) {
  const runtime = Object.assign(new EventEmitter(), { env: { HC_TERMINAL_ID: 'test' }, pid: 123, stdout: { isTTY: true } }, overrides);
  const handlers = new Map(), output = [];
  let hooks;
  const cmd = { hooks: h => { hooks = h; }, on: (t, f) => handlers.set(t, f),
    state: { get: k => saved.get(k), set: (k, v) => saved.set(k, v) }, addCommand() {} };
  register(cmd, runtime, text => output.push(text));
  return { runtime, output, handlers, saved, hooks: () => hooks,
    event(type, kind) { handlers.get(type)?.({ type, kind, prompt: 'SECRET' }); },
    status() { return output.at(-1); } };
}

test('real lifecycle: idle, working, overlapping questions/permissions, completion', () => {
  const f = fixture(); f.hooks().onSessionStart();
  assert.equal(f.status(), encodeStatus({state:'idle'}));
  f.event('run_start'); f.event('interaction_requested', 'question');
  f.event('interaction_requested', 'permission');
  assert.equal(f.status(), encodeStatus({state:'blocked',kind:'permission'}));
  f.event('interaction_resolved', 'permission');
  assert.equal(f.status(), encodeStatus({state:'blocked',kind:'question'}));
  f.event('interaction_resolved', 'question');
  assert.equal(f.status(), encodeStatus({state:'working'}));
  f.event('run_end'); assert.equal(f.status(), encodeStatus({state:'idle'}));
  assert.ok(f.output.every(s => !s.includes('SECRET')));
});
test('nested runs and compaction do not report idle prematurely', () => {
  let s = emptyState();
  for (const type of ['run_start','run_start','run_end','compaction_start','run_end']) s=transition(s,{type});
  assert.equal(statusFor(s).state,'working');
  s=transition(s,{type:'compaction_done'}); assert.equal(statusFor(s).state,'idle');
});
test('cancellation clears stale blockers; unmatched resolutions cannot underflow', () => {
  const f=fixture(); f.hooks().onSessionStart();
  f.event('run_start'); f.event('interaction_requested','permission'); f.event('run_end');
  assert.equal(f.status(),encodeStatus({state:'idle'}));
  f.event('interaction_resolved','permission'); f.event('run_end');
  assert.equal(f.status(),encodeStatus({state:'idle'}));
});
test('silent outside core, in ACP/headless and inherited child processes', () => {
  for (const runtime of [{env:{}},{stdout:{isTTY:false}},{env:{HC_TERMINAL_ID:'test',COMMANDCODE_HERDR_STATUS_OWNER:'["","test"]:999'}}]) {
    const f=fixture(runtime); assert.equal(f.hooks(),undefined); assert.deepEqual(f.output,[]);
  }
});
test('a child in a different PTY can report its own status', () => {
  const f=fixture({env:{HC_TERMINAL_ID:'new-terminal',COMMANDCODE_HERDR_STATUS_OWNER:'["","parent"]:999'}});
  f.hooks().onSessionStart(); assert.equal(f.status(),encodeStatus({state:'idle'}));
});
test('shutdown clears synchronously and removes listener and ownership', () => {
  const f=fixture(); f.hooks().onSessionStart(); f.hooks().onSessionEnd();
  assert.equal(f.status(),encodeStatus({state:'clear'}));
  assert.equal(f.runtime.listenerCount('exit'),0);
  assert.equal(f.runtime.env.COMMANDCODE_HERDR_STATUS_OWNER,undefined);
  f.runtime.emit('exit'); assert.equal(f.output.length,2);
});
test('process exit clears even if session end was not delivered', () => {
  const f=fixture(); f.hooks().onSessionStart(); f.runtime.emit('exit');
  assert.equal(f.status(),encodeStatus({state:'clear'}));
});
test('reload restores working state and releases ownership for replacement', () => {
  const f=fixture(); f.hooks().onSessionStart(); f.event('run_start'); f.hooks().onSessionEnd();
  const g=fixture({},f.saved); g.hooks().onSessionStart({source:'reload'});
  assert.equal(g.status(),encodeStatus({state:'working'}));
});
test('duplicate states are suppressed', () => {
  const f=fixture(); f.hooks().onSessionStart(); f.event('compaction_done');
  assert.equal(f.output.length,1);
});
test('transport failure cannot interrupt a session', () => {
  let hooks;
  register({hooks:h=>{hooks=h;},on:()=>{},addCommand:()=>{},state:{set(){}}},Object.assign(new EventEmitter(),{env:{HC_TERMINAL_ID:'t'},pid:2,stdout:{isTTY:true}}),()=>{throw Error('closed');});
  assert.doesNotThrow(()=>hooks.onSessionStart());
  assert.doesNotThrow(()=>hooks.onSessionEnd());
});
test('a new session in the same process reacquires ownership after session end', () => {
  const f=fixture(); f.hooks().onSessionStart(); f.event('run_start'); f.hooks().onSessionEnd();
  f.hooks().onSessionStart();
  assert.equal(f.status(),encodeStatus({state:'idle'}));
  assert.equal(f.runtime.listenerCount('exit'),1);
});
