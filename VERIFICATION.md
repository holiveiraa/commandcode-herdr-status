# Verification — v0.1.0

Versions: Command Code 1.88.3; herdr-core 0.1.18; Herdr Desktop 0.1.13;
Node 26.13.0 on Linux x86_64 / Omarchy.

- Eleven contract tests passed (`npm test`).
- Official `cmd mods inspect` recognized session hooks, event observers and the
  diagnostic slash command. `cmd mods list` loaded `herdr-status` from the
  local package installed with `cmd mods add … -g`.
- Synthetic lifecycle events over a real isolated core PTY produced:
  `idle → working → blocked(permission) → working → blocked(question) → working → idle → clear`.
- Actual Command Code in an isolated core loaded the installed mod and reported
  `{app: "command-code", state: "idle"}`.
- One short actual model prompt (no tools or file changes requested) reported
  `working → idle`, and its visible answer contained `OK`.
- Actual `/exit` cleared the terminal's status. Tests stopped only their own core
  and cleaned up their own terminals; existing terminals were preserved.
- Opened a local Desktop space for the integration. Verified the actual
  window screenshot: Command Code's name and icon appear in the **Idle** group
  in Agents alongside a remote Codex session. No program-table customization
  was needed; Herdr already knows `app=command-code`.

Scope: actual permission/question **protocol transitions** were verified with
synthetic events; an actual model-triggered permission/question dialog was not
exercised. Abrupt SIGKILL/machine-loss cleanup is not guaranteed (see README).
Other Command Code versions and remote hosts have not been verified. T3/ACP silence
was checked at the activation gate in contract tests; no live T3 chat was run.

The project has no third-party runtime dependencies. No model account or credentials are needed for the unit tests. Live verification
uses the existing local Command Code account and is optional.
