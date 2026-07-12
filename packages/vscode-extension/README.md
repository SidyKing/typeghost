# 👻 TypeGhost — fake live coding

> **A teleprompter for your code.** Write it once, "type" it live.

TypeGhost replays pre-written code in your editor with human-like typing — irregular rhythm, thinking pauses, even typos that get noticed and fixed. No more typos in front of 300 people, no more "wait, what did I mistype?".

![TypeGhost typing a fibonacci function by itself, pausing at a checkpoint, then finishing](https://raw.githubusercontent.com/SidyKing/typeghost/main/docs/demo.gif)

## Two ways to fake it

- **🎬 Auto mode** — press play, the code types itself at a human pace while you narrate. Drop checkpoints in your script so playback stops exactly where you want to talk.
- **🕶 Hacker mode** — *you mash any keys, the real script comes out.* Your hands genuinely move, the rhythm is genuinely yours, and you physically cannot make a typo.

## Commands

| Command | What it does |
|---|---|
| `TypeGhost: Play From Clipboard / File…` | Auto-types the script at the cursor |
| `TypeGhost: Hacker Mode From Clipboard / File…` | Your keystrokes type the script |
| `TypeGhost: Pause / Resume` (`ctrl/cmd+alt+T`) | Also continues past checkpoints |
| `TypeGhost: Stop` (`ctrl/cmd+alt+backspace`) | Instantly hands the keyboard back |

## Script directives

Comments with a `~` glued to the comment marker control the playback and are stripped from the output:

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
- `//~ checkpoint <name>` — playback stops until you hit `ctrl/cmd+alt+T`.
- Any language works: `#~` (Python, shell), `--~` (SQL, Lua), `;;~` (Lisp), `%~` (LaTeX).

## Settings

| Setting | Default | |
|---|---|---|
| `typeghost.charsPerSecond` | `14` | Average auto-typing speed |
| `typeghost.typos` | `true` | Simulate corrected typos (auto mode) |
| `typeghost.typoRate` | `0.025` | Probability per letter |
| `typeghost.charsPerKeystroke` | `3` | Hacker mode: script chars per keystroke |

Whatever the simulation does, the final buffer is **byte-identical to your script** — enforced by the engine's test suite. Your demo cannot derail.

**Heads-up:** hacker mode takes over the `type` command, so it can't run at the same time as the Vim extension.

---

Part of the [TypeGhost project](https://github.com/SidyKing/typeghost) — engine, browser playground and roadmap live there. MIT licensed.
