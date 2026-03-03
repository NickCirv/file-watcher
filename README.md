# file-watcher

> Watch files and directories for changes, run commands automatically. Zero dependencies. nodemon alternative.

[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-blue)](https://github.com/NickCirv/file-watcher)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Install

```bash
# Use without installing
npx file-watcher . -- npm test

# Install globally
npm install -g file-watcher
```

Two commands, same tool: `file-watcher` and the short alias `fw`.

## Quick Start

```
$ fw src/ -- npm test
file-watcher v1.0.0 watching src/ → npm test
  Press Ctrl+C to stop.

12:04:31 change  src/index.js
12:04:31 ▶ npm test
  ✓ 3 tests passed
12:04:31 exit 0  312ms

12:05:02 change  src/utils.js
12:05:02 ▶ npm test
  ✓ 3 tests passed
12:05:02 exit 0  298ms
```

## Usage

```
fw <pattern> -- <command> [options]
file-watcher <pattern> -- <command> [options]
```

Everything after `--` is the command. Arguments before `--` are watch options.

## Examples

```bash
# Watch a directory, run tests on change
fw src/ -- npm test

# Watch specific extensions only
fw . --ext js,ts -- node server.js

# Watch TypeScript files with glob pattern
fw "**/*.ts" -- tsc --noEmit

# Clear terminal before each run, 500ms debounce
fw src/ -- npm run build --debounce 500 --clear

# Use polling (network drives, Docker volumes, WSL)
fw . -- npm test --poll 1000

# Run command immediately on start, then on every change
fw src/ -- npm test --initial

# Run once on first change, then exit
fw src/ -- npm test --once

# Delay 200ms after change before running (let writes settle)
fw . -- npm run build --delay 200

# Extra environment variables (safe — never logged)
fw . --env NODE_ENV=test --env PORT=3001 -- npm test

# Ignore additional patterns
fw . --ignore "**/*.log" --ignore "tmp/**" -- npm test
```

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `<pattern>` | `.` | Glob pattern or directory to watch |
| `--ext <list>` | all | File extensions to filter, comma-separated (e.g. `js,ts`) |
| `--debounce <ms>` | `300` | Debounce delay — coalesces rapid changes |
| `--ignore <glob>` | — | Ignore pattern, repeatable |
| `--clear` | `false` | Clear terminal before each run |
| `--once` | `false` | Run on first change then exit |
| `--poll <ms>` | off | Use polling instead of `fs.watch` (network drives, Docker) |
| `--initial` | `false` | Run command immediately on start |
| `--delay <ms>` | `0` | Extra wait after change before running |
| `--env KEY=VAL` | — | Extra env var for command, repeatable. Values never logged. |
| `--verbose` | `false` | Show extra debug info |
| `--no-watchrc` | — | Skip loading `.watchrc` config file |
| `--help, -h` | — | Show help |
| `--version, -v` | — | Show version |

## Default Ignore

These are always ignored: `node_modules`, `.git`, `dist`, `.next`, `.nuxt`, `coverage`.

Add more with `--ignore`:

```bash
fw . --ignore "**/*.log" --ignore "build/**" -- npm test
```

## Event Display

Events are color-coded in the terminal:

- **green** `add` — new file detected
- **yellow** `change` — file modified
- **red** `delete` — file removed

Each run shows the command, exit code, and duration:

```
12:04:31 change  src/index.js
12:04:31 ▶ npm test
12:04:31 exit 0  312ms
```

## Glob Patterns

| Pattern | Matches |
|---------|---------|
| `*` | Any characters except `/` |
| `**` | Any characters including `/` |
| `?` | Single character |

```bash
fw "src/**/*.ts" -- tsc      # All .ts files under src/
fw "**/*.js" -- node lint.js  # All .js files anywhere
fw "src/*.js" -- node test.js # .js files directly in src/
```

## .watchrc Config File

Place a `.watchrc` file in your project root (JSON). CLI flags take priority over `.watchrc`.

```json
{
  "pattern": "src/",
  "command": "npm test",
  "ext": "js,ts",
  "ignore": ["**/*.log"],
  "debounce": 500,
  "clear": true,
  "initial": true
}
```

Then just run `fw` with no arguments.

## Platform Notes

- **macOS / Windows**: Uses `fs.watch` with native recursive support.
- **Linux**: Watches subdirectories individually. For large trees or network mounts, use `--poll`.
- **Docker / WSL / Network drives**: Use `--poll <ms>` — native watchers may not fire across filesystem boundaries.

## Security

- Zero external dependencies — only Node.js built-ins (`fs`, `path`, `os`, `crypto`, `readline`, `child_process`).
- Commands run via `spawnSync` / `spawn` with an argument array — never passed to a shell. No shell injection possible.
- `--env` values are passed directly to `process.env` and never logged.
- `crypto.randomBytes` used for internal ID generation, never `Math.random`.

## Why not nodemon?

nodemon is great — but it ships with 9+ transitive dependencies, requires config file setup for advanced use, and bundles features most projects never use. `file-watcher` does one thing: watch files, run commands. Single file, zero deps, auditable in minutes.

---

MIT License · Node 18+ · [github.com/NickCirv/file-watcher](https://github.com/NickCirv/file-watcher)
