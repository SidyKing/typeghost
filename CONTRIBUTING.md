# Contributing to TypeGhost

Thanks for wanting to help! 👻

## Setup

```bash
npm install
npm run build
npm test
```

The repo is an npm workspace monorepo:

| Package | What it is |
|---|---|
| `packages/core` | The typing engine — pure TypeScript, no editor dependencies. |
| `packages/vscode-extension` | The VS Code extension (bundled with esbuild). |
| `packages/web-demo` | The browser playground built on Monaco. |

## Developing

- **Core**: `npm test -w typeghost-core` runs the vitest suite. New engine behavior needs a test.
- **Extension**: open the repo in VS Code, `npm run build -w typeghost-vscode`, then press F5 (Extension Development Host).
- **Web demo**: `npm run dev:web` and open http://127.0.0.1:8123.

## Guidelines

- Keep `typeghost-core` free of editor-specific code — adapters live in their own packages.
- The golden rule of the engine: whatever the simulation does (typos, pauses), the final buffer must be byte-identical to the clean source. Tests enforce this.
- One feature per PR, with a line in the README if user-facing.

## Ideas we'd love help with

See the [roadmap](README.md#roadmap) — record mode, remote-clicker checkpoint control and per-section speed directives are all up for grabs.
