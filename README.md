# 👻 TypeGhost

[![CI](https://github.com/SidyKing/typeghost/actions/workflows/ci.yml/badge.svg)](https://github.com/SidyKing/typeghost/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-a78bfa.svg)](LICENSE)

> **A teleprompter for your code.** Write it once, "type" it live.

TypeGhost replays pre-written code in your editor with human-like typing — irregular rhythm, thinking pauses, even typos that get noticed and fixed. Perfect for conference talks, screencasts, YouTube tutorials and classroom demos: no more typos in front of 300 people, no more "wait, what did I mistype?".

![TypeGhost typing a fibonacci function by itself, pausing at a checkpoint, then finishing](docs/demo.gif)

**[▶ Try the live demo in your browser](https://sidyking.github.io/typeghost/)** — no install needed.

## Two ways to fake it

### 🎬 Auto mode
Press play. Your code types itself at a human pace while you narrate. Pause anytime, or drop `checkpoints` in your script so playback stops exactly where you want to talk.

### 🕶 Hacker mode (the crowd favorite)
**You mash any keys — the real script comes out.** Your hands are genuinely moving, the rhythm is genuinely yours, and you physically cannot make a typo. This is the most convincing illusion for live presentations.

## VS Code extension

1. Install the extension (Marketplace listing coming — for now: `npm install && npm run build`, then F5 in VS Code, or `npx vsce package` in `packages/vscode-extension`).
2. Copy your prepared code, open the file you'll "write" in front of your audience.
3. Run **`TypeGhost: Play From Clipboard`** — or **`TypeGhost: Hacker Mode From Clipboard`** and start mashing.

| Command | What it does |
|---|---|
| `TypeGhost: Play From Clipboard / File…` | Auto-types the script at the cursor |
| `TypeGhost: Hacker Mode From Clipboard / File…` | Your keystrokes type the script |
| `TypeGhost: Pause / Resume` (`ctrl/cmd+alt+T`) | Also continues past checkpoints |
| `TypeGhost: Stop` (`ctrl/cmd+alt+backspace`) | Instantly hands the keyboard back |

Settings: typing speed, typo simulation on/off and rate, characters per keystroke in hacker mode.

## Script directives

Any comment with a `~` glued to the comment marker is a TypeGhost directive. It is stripped from what gets typed:

```js
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
//~ pause 800

//~ checkpoint explain-recursion
console.log(fibonacci(10));
```

- `//~ pause 800` — extra pause (ms) before the next character.
- `//~ checkpoint <name>` — auto playback stops here until you resume. Talk to your audience, then hit `ctrl/cmd+alt+T`.
- Works in any language: `#~` (Python, shell), `--~` (SQL, Lua, Haskell), `;;~` (Lisp), `%~` (LaTeX, Erlang).

## How it compares

| | TypeGhost | [vscode-hacker-typer](https://github.com/jevakallio/vscode-hacker-typer) | [doitlive](https://github.com/sloria/doitlive) | [demo-magic](https://github.com/paxtonhare/demo-magic) |
|---|---|---|---|---|
| Target | **Editors** (VS Code, web, more coming) | VS Code | Terminal | Terminal |
| Auto mode with human-like typing | ✅ typos, rhythm, thinking pauses | ❌ | partial | partial |
| Hacker mode (mash keys) | ✅ | ✅ | ✅ | ❌ |
| Checkpoints / pauses in script | ✅ | ~ | ✅ | ✅ |
| Editor-agnostic core library | ✅ `@typeghost/core` | ❌ | ❌ | ❌ |
| Maintained | ✅ | ❌ (archived-ish, last push 2023) | ✅ | ~ |

Terminal demos? Use the excellent `doitlive`. Editor demos? That's what TypeGhost is for.

## Monorepo layout

```
packages/
  core/               @typeghost/core — the typing engine (pure TS, tested, no editor deps)
  vscode-extension/   the VS Code extension
  web-demo/           the Monaco-based browser playground
```

```bash
npm install
npm run build
npm test        # engine test suite
npm run dev:web # playground on http://127.0.0.1:8123
```

The engine's golden rule, enforced by tests: **whatever the simulation does — typos, corrections, pauses — the final buffer is byte-identical to your script.** Your demo cannot derail.

## Roadmap

- [ ] Publish `@typeghost/core` to npm and the extension to the VS Code Marketplace / Open VSX
- [ ] **Record mode** — code it once for real, TypeGhost captures and replays the session
- [ ] Multi-file scenarios (open file, jump to line, edit in the middle)
- [ ] Checkpoint control from a presentation remote / foot pedal
- [ ] JetBrains adapter on top of `@typeghost/core`
- [ ] `//~ speed 30` directive for per-section pacing

Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## FAQ

**Is this… cheating?**
It's a teleprompter. Newscasters use them, keynote speakers use them, and [half](https://github.com/sloria/doitlive) [the](https://github.com/paxtonhare/demo-magic) [conference](https://github.com/jevakallio/vscode-hacker-typer) [circuit](https://github.com/LeaVerou/rety) already fakes terminal demos. Your audience came to learn, not to watch you hunt for a missing semicolon.

**Does hacker mode work with the Vim extension?**
Not simultaneously — both need to own the `type` command. TypeGhost tells you instead of failing silently.

## License

[MIT](LICENSE) © Papa Sidy Mactar Traoré
