# Command Code → Herdr Desktop

[![Version](https://img.shields.io/badge/version-0.1.0-blue)](https://github.com/holiveiraa/commandcode-herdr-status/releases/tag/v0.1.0)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**See what Command Code is doing without switching between terminal tabs.**

A small [Command Code mod](https://commandcode.ai/docs/mods) that reports real
agent lifecycle events to [Herdr Desktop](https://herdr.dev/) over OSC 7501.
Command Code appears in the **Agents** panel with its name, icon and live state.

```text
Session starts        → Idle
Agent works           → Working
Permission / question → Needs you
Run finishes          → Idle / Done*
Session ends          → Removed from Agents

* Herdr controls the Done presentation for unviewed completed work.
```

No runtime dependencies. Uses documented extension points in both applications.
The mod observes events and writes terminal status; it does not patch binaries,
wrap `cmd`, scrape screen output or change the agent's approval behavior.

## Install

Install a pinned release for all projects:

```sh
cmd mods add holiveiraa/commandcode-herdr-status@v0.1.0 -g
```

Then start a **new** `cmd` session inside a Herdr Desktop terminal. Accept the
normal workspace-trust prompt if the folder is new. The reporter activates when
the agent session initializes. Existing sessions can use `/reload` or be restarted
when convenient.

Check the installed mod with `cmd mods list`. In an active Herdr session,
`/herdr-status` displays the reporter's current state.

### Compatibility

| Component | Verified version |
| --- | --- |
| Command Code | 1.88.3 |
| Herdr Desktop | 0.1.13 |
| herdr-core (`hc`) | 0.1.18 |
| Platform | Linux x86_64 |

Command Code's **ModApi is experimental**. Retest after upgrades; other versions
and operating systems are not yet claimed as verified. This integration targets
Herdr **Desktop / herdr-core**, rather than the original Herdr TUI.

### Install from source

```sh
git clone https://github.com/holiveiraa/commandcode-herdr-status.git
cd commandcode-herdr-status
git checkout v0.1.0
npm test
cmd mods inspect ./src/herdr-status.ts
cmd mods add "$PWD" -g
```

A local-source installation references the checkout. Keep it at its installed
path. Command Code watches file-backed mods for hot reload, so source edits may
affect running sessions.

## States and privacy

| Event | Report |
| --- | --- |
| Session begins | `idle` |
| Run or compaction starts | `working` |
| Permission dialog opens | `blocked`, kind `permission` |
| Question opens | `blocked`, kind `question` |
| Interaction resolves | Remaining blocked interaction, working, or idle |
| Last run finishes or is cancelled | `idle` |
| Session ends or process exits normally | `clear` |

Overlapping runs, compaction and interactions are counted. Permissions take
priority over questions. Hot reload preserves the lifecycle counters; session
switches release and reacquire ownership.

**Only state, interaction kind and `app=command-code` are emitted.** Prompts,
answers, commands, paths, model replies and credentials never appear in status
reports. The mod makes no network requests.

The reporter requires `HC_TERMINAL_ID` and a TTY on stdout. It stays silent in
ordinary terminals, redirected print output and ACP hosts such as T3 Code. Nested
processes in the same terminal cannot replace their parent's report; a different
Herdr terminal can report independently. Existing MCP servers and lifecycle hooks,
including ai-memory, keep their own configuration.

## Remote machines

Install the mod on the machine **running Command Code**. In a remote Herdr
terminal, run the same installation command on that host. Status travels through
the existing terminal connection, without another service or inbound port.

Remote deployment has not yet been verified for this release. Check the remote
Command Code version and run the verification suite before relying on it.

## Disable, uninstall and update

```sh
# Temporarily disable; re-enable with `cmd mods enable herdr-status -g`.
cmd mods disable herdr-status -g

# Remove the mod.
cmd mods remove herdr-status -g
```

Restart the agent after changing installation or enablement. `cmd mods list`
shows configured sources; a local checkout can also be removed using the exact
`local:/absolute/path` source listed there.

For upgrades, select and install a reviewed release tag, then run the tests.
Avoid floating branch references when you need reproducible installations.

## Development and verification

Node **22.18+** is needed for the dependency-free contract suite:

```sh
npm test
```

The eleven tests cover lifecycle transitions, overlapping blockers, cancellation,
compaction, duplicate suppression, headless environments, child processes,
shutdown, session switches, hot reload and transport errors.

With Herdr core and Command Code installed, and this mod installed globally:

```sh
python3 test/verify-herdr.py
# Optional: send one short prompt using your configured model account.
python3 test/verify-herdr.py --live-model
```

The integration verifier creates its own `HC_SESSION` and temporary XDG paths,
trusts only its temporary test folder, and cleans up only its own terminals and
core. The transport driver feeds **synthetic lifecycle events** into a real PTY;
the separate real-CLI check verifies startup and exit. Live-model mode also checks
a real `working → idle` turn. Artifacts remain at the printed temporary path.

See [VERIFICATION.md](VERIFICATION.md) for results and the distinction between
synthetic interaction tests and real model execution.

### Limitations

- SIGKILL or machine loss cannot run an exit handler; terminal cleanup in these
  cases belongs to herdr-core.
- Status reflects events exposed by Command Code. Interactions outside that
  event stream cannot be inferred by this mod.
- Write failures are ignored so a broken terminal connection cannot stop coding.
- The mod never changes signal handlers or answers permission prompts.

## Contributing

Bug reports should include the Command Code, Herdr Desktop, herdr-core and Node
versions, OS, installation method and steps to reproduce. Redact credentials and
private project content from logs. Run `npm test` and add a regression test for
behavior changes.

## License and references

[MIT](LICENSE). Independently maintained; not a first-party Command Code or Herdr release.

- [Command Code Mods](https://commandcode.ai/docs/mods)
- [Herdr core and OSC 7501](https://herdr.dev/core/)
