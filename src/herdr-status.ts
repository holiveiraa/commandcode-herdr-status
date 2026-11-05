import { writeSync } from 'node:fs';

// No prompt text, tool arguments, paths, account data or answers go on the wire.
const OWNER = 'COMMANDCODE_HERDR_STATUS_OWNER';
const STATE_KEY = 'herdr-status.lifecycle.v1';
const EVENTS = ['run_start', 'run_end', 'compaction_start', 'compaction_done',
  'interaction_requested', 'interaction_resolved'];

export function emptyState() {
  return { running: 0, compacting: 0, permissions: 0, questions: 0 };
}

export function transition(state, event) {
  const next = { ...state };
  const bump = (key, delta) => { next[key] = Math.max(0, next[key] + delta); };
  switch (event.type) {
    case 'run_start': bump('running', 1); break;
    case 'run_end':
      bump('running', -1);
      // Cancellation can end a run before its pending interaction resolves.
      if (next.running === 0) { next.permissions = 0; next.questions = 0; }
      break;
    case 'compaction_start': bump('compacting', 1); break;
    case 'compaction_done': bump('compacting', -1); break;
    case 'interaction_requested':
      bump(event.kind === 'permission' ? 'permissions' : 'questions', 1); break;
    case 'interaction_resolved':
      bump(event.kind === 'permission' ? 'permissions' : 'questions', -1); break;
  }
  return next;
}

export function statusFor(state) {
  if (state.permissions > 0) return { state: 'blocked', kind: 'permission' };
  if (state.questions > 0) return { state: 'blocked', kind: 'question' };
  return { state: state.running > 0 || state.compacting > 0 ? 'working' : 'idle' };
}

export function encodeStatus(status) {
  return `\x1b]7501;state=${status.state}${status.kind ? `:kind=${status.kind}` : ''}:app=command-code\x1b\\`;
}

// Runtime injection is for contract tests; production uses only the terminal
// already owned by this Command Code process. Never open someone else's PTY.
export function register(cmd, runtime = process, output = (text) => writeSync(process.stdout.fd, text)) {
  const env = runtime.env;
  if (!env.HC_TERMINAL_ID || !runtime.stdout.isTTY) return;
  const terminal = JSON.stringify([env.HC_TERMINAL_SOCKET ?? '', env.HC_TERMINAL_ID]) + ':';
  const owner = terminal + runtime.pid;
  // A nested process in this PTY must not overwrite its parent. A child in a
  // different hc terminal, however, has its own status and may report normally.
  if (env[OWNER]?.startsWith(terminal)) return;
  env[OWNER] = owner;
  let active = false;
  let last = '';
  let state = emptyState();
  const send = (status) => {
    const wire = encodeStatus(status);
    if (wire === last) return;
    try { output(wire); last = wire; } catch { /* status cannot break coding */ }
  };
  const report = () => send(statusFor(state));
  const clear = () => { if (active) { send({ state: 'clear' }); active = false; } };
  const exit = () => clear();
  runtime.on('exit', exit);
  cmd.hooks({
    onSessionStart({ source } = {}) {
      if (env[OWNER]?.startsWith(terminal) && env[OWNER] !== owner) return;
      env[OWNER] = owner;
      if (!runtime.listeners('exit').includes(exit)) runtime.on('exit', exit);
      active = true;
      last = '';
      state = source === 'reload' ? (cmd.state.get(STATE_KEY) ?? emptyState()) : emptyState();
      cmd.state.set(STATE_KEY, state);
      report();
    },
    onSessionEnd() {
      clear();
      runtime.removeListener('exit', exit);
      if (env[OWNER] === owner) delete env[OWNER];
    },
  });
  for (const type of EVENTS) cmd.on(type, event => {
    if (!active) return;
    state = transition(state, event);
    cmd.state.set(STATE_KEY, state);
    report();
  });
  cmd.addCommand({
    name: 'herdr-status',
    description: 'Show the Herdr Desktop status reporter state',
    handler: () => ({ message: `Herdr Desktop reporter 0.1.0: ${active ? JSON.stringify(statusFor(state)) : 'inactive'}` }),
  });
}

export default function herdrStatus(cmd) { register(cmd); }
