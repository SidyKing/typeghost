# @typeghost/core

> The typing engine behind [TypeGhost](https://github.com/SidyKing/typeghost) — a teleprompter for your code.

Turns any source text into a stream of human-looking typing steps: irregular rhythm, thinking pauses, typos that get noticed and fixed, and script directives for pauses and checkpoints. Pure TypeScript, zero dependencies, no editor assumptions — you bring the adapter.

Powers the [TypeGhost VS Code extension](https://marketplace.visualstudio.com/items?itemName=PapaSidyMactarTRAORE.typeghost) and the [browser demo](https://sidyking.github.io/typeghost/) (Monaco).

## Install

```bash
npm install @typeghost/core
```

## Usage

```ts
import { compileScript, Player } from '@typeghost/core';

const script = compileScript(`function hello() {
  console.log("world");
}
//~ pause 800
//~ checkpoint explain
hello();
`);

// Your adapter: apply each edit wherever you want the code to appear.
const player = new Player(script, (event) => {
  if (event.kind === 'insert') myEditor.insertAtCursor(event.text);
  else myEditor.deleteBeforeCursor(event.count);
});

await player.play();      // auto mode — checkpoints pause until player.resume()
// …or wire player.advance(3) to keystrokes for hacker mode.
```

## The guarantees

- **Byte-exact output** — whatever the simulation does (typos, corrections, pauses), applying every event reproduces your script exactly. Enforced by the test suite.
- **Typo bursts are atomic** — playback never stops between a wrong character and its correction.
- **Throttle-proof** — steps are scheduled against a wall clock; if the host clamps timers (hidden browser tabs), the player catches up in bursts instead of slowing down.
- **Deterministic when seeded** — pass `seed` in the options for reproducible playback.

## Directives

Comment lines with a `~` glued to the comment marker (any language: `//~`, `#~`, `--~`, `;;~`, `%~`) are stripped from the output and control playback:

| Directive | Effect |
|---|---|
| `//~ pause 800` | extra pause (ms) before the next character |
| `//~ checkpoint <name>` | auto playback stops until `resume()` |

## API

- `compileScript(source, options?)` → `{ steps, checkpoints, cleanSource }`
- `humanize(text, options?)` → `Step[]` (no directive parsing)
- `new Player(script, apply, playerOptions?)` — `play()`, `pause()`, `resume()`, `stop()`, `advance(chars)`, `state`, `progress`
- Options: `cps`, `jitter`, `typoRate`, `thinkRate`, `newlinePauseMs`, `punctuationPauseMs`, `seed`… — see the typed definitions.

MIT © [Papa Sidy Mactar TRAORE](https://github.com/SidyKing)
