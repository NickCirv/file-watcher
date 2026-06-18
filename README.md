<div align="center">

# file-watcher

**Watch files for changes and run any command automatically — zero dependencies, nodemon alternative**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?labelColor=0B0A09)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen?labelColor=0B0A09)](package.json)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-blue?labelColor=0B0A09)](https://nodejs.org)

</div>

## Install

```bash
npx github:NickCirv/file-watcher . -- npm test
```

Two commands, same tool: `file-watcher` and the short alias `fw`.

## Usage

```bash
# Watch a directory, run tests on every change
fw src/ -- npm test

# Filter by extension, clear terminal between runs
fw . --ext js,ts --clear -- node server.js

# Watch TypeScript files with a glob pattern
fw "**/*.ts" -- tsc --noEmit

# Use polling (Docker volumes, network drives, WSL)
fw . --poll 1000 -- npm run build

# Run immediately on start, then on every change
fw src/ --initial -- npm test
```

| Flag | Default | Description |
|------|---------|-------------|
| `<pattern>` | `.` | Glob pattern or directory to watch |
| `--ext <list>` | all | Comma-separated extensions, e.g. `js,ts` |
| `--debounce <ms>` | `300` | Coalesces rapid changes |
| `--ignore <glob>` | — | Ignore pattern (repeatable) |
| `--clear` | `false` | Clear terminal before each run |
| `--once` | `false` | Run on first change then exit |
| `--poll <ms>` | off | Polling mode for network/Docker mounts |
| `--initial` | `false` | Run command on startup before any change |
| `--delay <ms>` | `0` | Extra wait after change before running |
| `--env KEY=VAL` | — | Env var for command, values never logged |
| `--no-watchrc` | — | Skip `.watchrc` config file |

## What it does

`file-watcher` uses Node's built-in `fs.watch` (or polling on request) to detect file changes in any directory or glob pattern, then re-runs your command. It auto-ignores `node_modules`, `.git`, `dist`, `.next`, `.nuxt`, and `coverage`. Commands are spawned as argument arrays — no shell injection possible. Drop a `.watchrc` JSON file in your project root to persist options without repeating flags.

---
<sub>Zero dependencies · Node 18+ · MIT · by <a href="https://github.com/NickCirv">NickCirv</a></sub>
