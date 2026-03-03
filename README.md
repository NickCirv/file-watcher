# file-watcher

> Watch files, run commands on change. Zero dependencies. Simpler than nodemon.

[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-blue)](https://github.com/NickCirv/file-watcher)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Install

```bash
# Use without installing
npx file-watcher --help

# Or install globally
npm install -g file-watcher
```

## Quick Start

```
$ fw src/ --run "npm test"
file-watcher watching src/ → npm test

12:04:31 ◆ src/index.js → npm test
  ✓ 3 tests passed
12:04:31 exit 0

12:05:02 ◆ src/utils.js → npm test
  ✓ 3 tests passed
12:05:02 exit 0
```

## Usage

```
fw <pattern> --run <command> [options]
file-watcher <pattern> --run <command> [options]
```

## Examples

```bash
# Watch a directory, run tests on change
fw src/ --run "npm test"

# Watch TypeScript files, ignore node_modules
fw "**/*.ts" --run "tsc" --ignore "node_modules/**"

# Watch with debounce + clear terminal before each run
fw src/ --run "npm run build" --debounce 300 --clear

# Restart a long-running server on file change (like nodemon)
fw src/ --run "node src/server.js" --restart

# Run once on first change then exit
fw src/index.js --run "node src/index.js" --once

# Quiet mode — only show command output, no fw logs
fw "**/*.go" --run "go test ./..." --quiet
```

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `<pattern>` | `.` | Glob pattern or directory to watch |
| `--run, -r` | _(required)_ | Command to run on change |
| `--debounce, -d` | `200` | Debounce delay in milliseconds |
| `--ignore, -i` | — | Glob pattern to ignore (repeatable) |
| `--delay` | `0` | Additional wait before running (ms) |
| `--restart` | `false` | Kill and restart process on each change |
| `--clear` | `false` | Clear terminal before each run |
| `--once` | `false` | Run once on first match, then exit |
| `--quiet, -q` | `false` | Suppress file change logs |
| `--help, -h` | — | Show help |
| `--version, -v` | — | Show version |

## Glob Patterns

| Pattern | Matches |
|---------|---------|
| `*` | Any characters except `/` |
| `**` | Any characters including `/` |
| `?` | Single character |

```bash
fw "src/**/*.ts"     # All TypeScript files under src/
fw "**/*.{js,ts}"    # All JS and TS files
fw "src/*.js"        # JS files directly in src/
```

## Why not nodemon?

nodemon is excellent — but it pulls in 9+ dependencies, adds config file overhead, and does more than most projects need. `file-watcher` covers 95% of the use cases with zero install footprint, zero config, and a single readable file you can audit in 5 minutes.

---

Built with Node.js · Zero dependencies · MIT License
