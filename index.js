#!/usr/bin/env node

/**
 * file-watcher — Watch files, run commands on change.
 * Zero dependencies. Pure Node.js ES modules.
 * Node 18+ required (fs.watch recursive option).
 */

import fs from 'fs';
import path from 'path';
import { spawnSync, spawn } from 'child_process';
import os from 'os';
import { fileURLToPath } from 'url';

// ─── ANSI Colors ───────────────────────────────────────────────────────────────

const C = {
  reset:  '\x1b[0m',
  dim:    '\x1b[2m',
  bold:   '\x1b[1m',
  cyan:   '\x1b[36m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  blue:   '\x1b[34m',
  magenta:'\x1b[35m',
};

const c = (color, str) => `${C[color]}${str}${C.reset}`;

// ─── Glob Matching ─────────────────────────────────────────────────────────────

/**
 * Convert a glob pattern to a RegExp.
 * Supports: ** (any chars including /), * (any chars except /), ? (single char)
 */
function globToRegex(pattern) {
  // Normalize separators
  const normalized = pattern.replace(/\\/g, '/');
  let regexStr = '';
  let i = 0;
  while (i < normalized.length) {
    const ch = normalized[i];
    if (ch === '*' && normalized[i + 1] === '*') {
      // ** — match anything including slashes
      regexStr += '.*';
      i += 2;
      // Skip trailing slash after **
      if (normalized[i] === '/') i++;
    } else if (ch === '*') {
      // * — match anything except /
      regexStr += '[^/]*';
      i++;
    } else if (ch === '?') {
      // ? — single char except /
      regexStr += '[^/]';
      i++;
    } else if ('.+^${}()|[]\\'.includes(ch)) {
      // Escape regex special chars
      regexStr += '\\' + ch;
      i++;
    } else {
      regexStr += ch;
      i++;
    }
  }
  return new RegExp('^' + regexStr + '$');
}

function matchesGlob(filePath, pattern) {
  const normalized = filePath.replace(/\\/g, '/');
  // Match against full path and basename
  const basename = path.basename(normalized);
  const regex = globToRegex(pattern);
  return regex.test(normalized) || regex.test(basename);
}

function matchesAnyGlob(filePath, patterns) {
  return patterns.some(p => matchesGlob(filePath, p));
}

// ─── Argument Parsing ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    patterns:  [],
    run:       null,
    debounce:  200,
    ignore:    [],
    restart:   false,
    clear:     false,
    once:      false,
    quiet:     false,
    delay:     0,
    help:      false,
    version:   false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    switch (arg) {
      case '--run':
      case '-r':
        opts.run = args[++i];
        break;
      case '--debounce':
      case '-d':
        opts.debounce = parseInt(args[++i], 10);
        break;
      case '--ignore':
      case '-i':
        opts.ignore.push(args[++i]);
        break;
      case '--delay':
        opts.delay = parseInt(args[++i], 10);
        break;
      case '--restart':
        opts.restart = true;
        break;
      case '--clear':
        opts.clear = true;
        break;
      case '--once':
        opts.once = true;
        break;
      case '--quiet':
      case '-q':
        opts.quiet = true;
        break;
      case '--help':
      case '-h':
        opts.help = true;
        break;
      case '--version':
      case '-v':
        opts.version = true;
        break;
      default:
        if (!arg.startsWith('--')) {
          opts.patterns.push(arg);
        }
        break;
    }
    i++;
  }

  return opts;
}

// ─── Shell Command Splitting ───────────────────────────────────────────────────

/**
 * Split a shell-like command string into [cmd, ...args] array.
 * Handles single/double quoted strings. No shell interpolation.
 */
function splitCommand(cmdStr) {
  const parts = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < cmdStr.length; i++) {
    const ch = cmdStr[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === ' ' && !inSingle && !inDouble) {
      if (current.length > 0) {
        parts.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current.length > 0) parts.push(current);
  return parts;
}

// ─── Help & Version ────────────────────────────────────────────────────────────

function printVersion() {
  // Read version from package.json relative to this file
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  console.log(pkg.version);
}

function printHelp() {
  console.log(`
${c('bold', 'file-watcher')} ${c('dim', 'v1.0.0')} — Watch files, run commands on change.

${c('bold', 'USAGE')}
  fw <pattern> --run <command> [options]
  file-watcher <pattern> --run <command> [options]

${c('bold', 'EXAMPLES')}
  fw src/ --run "npm test"
  fw "**/*.ts" --run "tsc" --ignore "node_modules/**"
  fw src/ --run "npm run build" --debounce 300 --clear
  fw --run "npm start" --restart
  fw src/index.js --run "node src/index.js" --restart --once

${c('bold', 'OPTIONS')}
  ${c('cyan', '<pattern>')}            Glob pattern or directory to watch (default: current dir)
  ${c('cyan', '--run, -r')}            Command to run on change ${c('dim', '(required)')}
  ${c('cyan', '--debounce, -d')}       Debounce delay in ms ${c('dim', '(default: 200)')}
  ${c('cyan', '--ignore, -i')}         Glob pattern to ignore ${c('dim', '(repeatable)')}
  ${c('cyan', '--delay')}              Additional wait before running, ms ${c('dim', '(default: 0)')}
  ${c('cyan', '--restart')}            Kill and restart long-running process on change
  ${c('cyan', '--clear')}              Clear terminal before each run
  ${c('cyan', '--once')}               Run once on first match, then exit
  ${c('cyan', '--quiet, -q')}          Suppress file change logs
  ${c('cyan', '--help, -h')}           Show this help
  ${c('cyan', '--version, -v')}        Show version

${c('bold', 'GLOB PATTERNS')}
  *           Match any characters except /
  **          Match any characters including /
  ?           Match a single character
  Examples:   "**/*.ts"  "src/**"  "*.{js,ts}"

${c('dim', 'Zero dependencies · Node 18+ · MIT License')}
`);
}

// ─── Timestamp ─────────────────────────────────────────────────────────────────

function timestamp() {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

// ─── Process Runner ────────────────────────────────────────────────────────────

let activeChild = null;

function killChild() {
  if (activeChild && !activeChild.killed) {
    try {
      // Kill process group so child subprocesses also die
      process.kill(-activeChild.pid, 'SIGTERM');
    } catch (_) {
      try { activeChild.kill('SIGTERM'); } catch (__) {}
    }
    activeChild = null;
  }
}

function runCommand(cmdParts, opts, changedFile) {
  if (opts.clear) process.stdout.write('\x1b[2J\x1b[H');

  if (!opts.quiet) {
    const fileStr = changedFile ? c('blue', changedFile) : '';
    const arrow = changedFile ? ` ${c('dim', '→')} ` : '';
    console.log(
      `${c('dim', timestamp())} ${c('yellow', '◆')} ${fileStr}${arrow}${c('green', cmdParts.join(' '))}`
    );
  }

  if (opts.restart) {
    killChild();

    const [cmd, ...args] = cmdParts;
    activeChild = spawn(cmd, args, {
      stdio: 'inherit',
      detached: true, // allows killing process group
    });

    activeChild.on('exit', (code) => {
      if (code !== null && !opts.quiet) {
        const color = code === 0 ? 'green' : 'red';
        console.log(`${c('dim', timestamp())} ${c(color, `exit ${code}`)}`);
      }
      activeChild = null;
    });

    activeChild.on('error', (err) => {
      console.error(`${c('red', 'error')} ${err.message}`);
      activeChild = null;
    });
  } else {
    const [cmd, ...args] = cmdParts;
    const result = spawnSync(cmd, args, { stdio: 'inherit' });

    if (result.error) {
      console.error(`${c('red', 'error')} ${result.error.message}`);
    } else if (!opts.quiet) {
      const code = result.status ?? 0;
      const color = code === 0 ? 'green' : 'red';
      console.log(`${c('dim', timestamp())} ${c(color, `exit ${code}`)}`);
    }
  }
}

// ─── Watcher ───────────────────────────────────────────────────────────────────

function resolveWatchRoot(patterns) {
  // If patterns are directories, watch them directly.
  // Otherwise watch the nearest ancestor directory.
  const roots = new Set();
  for (const p of patterns) {
    // Strip glob chars to find real path prefix
    const plain = p.split(/[*?{[]/)[0].replace(/\/$/, '') || '.';
    const resolved = path.resolve(plain);
    try {
      const stat = fs.statSync(resolved);
      roots.add(stat.isDirectory() ? resolved : path.dirname(resolved));
    } catch (_) {
      roots.add(path.resolve('.'));
    }
  }
  return [...roots];
}

function shouldIgnore(filePath, ignorePatterns) {
  const normalized = filePath.replace(/\\/g, '/');
  // Always ignore common noisy dirs unless user has explicit patterns
  const defaults = ['node_modules/**', '.git/**', '.DS_Store'];
  const all = [...defaults, ...ignorePatterns];
  return matchesAnyGlob(normalized, all);
}

function startWatcher(opts) {
  const watchPatterns = opts.patterns.length > 0 ? opts.patterns : ['.'];
  const watchRoots = resolveWatchRoot(watchPatterns);
  const cmdParts = splitCommand(opts.run);

  if (cmdParts.length === 0) {
    console.error(c('red', 'error') + ' --run command is empty');
    process.exit(1);
  }

  const platform = os.platform();
  const useRecursive = platform === 'darwin' || platform === 'win32';

  let debounceTimer = null;
  let pendingFile = null;
  let hasRun = false;

  function triggerRun(filePath) {
    if (opts.once && hasRun) return;
    pendingFile = filePath;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const wait = opts.delay > 0 ? opts.delay : 0;
      setTimeout(() => {
        hasRun = true;
        runCommand(cmdParts, opts, pendingFile);
        if (opts.once) {
          process.exit(0);
        }
      }, wait);
    }, opts.debounce);
  }

  function onFileChange(eventType, filename) {
    if (!filename) return;
    const full = path.resolve(filename);
    const rel = path.relative(process.cwd(), full).replace(/\\/g, '/');

    if (shouldIgnore(rel, opts.ignore)) return;

    // Check if file matches any watch pattern
    const matched =
      opts.patterns.length === 0 ||
      matchesAnyGlob(rel, opts.patterns) ||
      matchesAnyGlob(filename, opts.patterns);

    if (!matched) return;

    triggerRun(rel);
  }

  // Print startup message
  console.log(
    `${c('cyan', 'file-watcher')} ${c('dim', 'watching')} ${c('bold', watchPatterns.join(', '))} ` +
    `${c('dim', '→')} ${c('green', opts.run)}`
  );
  if (opts.debounce !== 200) {
    console.log(`${c('dim', `debounce: ${opts.debounce}ms`)}`);
  }
  if (opts.ignore.length > 0) {
    console.log(`${c('dim', `ignoring: ${opts.ignore.join(', ')}`)}`);
  }
  console.log(c('dim', 'Press Ctrl+C to stop.\n'));

  const watchers = [];

  for (const root of watchRoots) {
    try {
      const watchOpts = { persistent: true };
      if (useRecursive) watchOpts.recursive = true;

      const watcher = fs.watch(root, watchOpts, onFileChange);
      watchers.push(watcher);

      watcher.on('error', (err) => {
        // On Linux, recursive may not be supported — fall back to polling
        if (err.code === 'ERR_FEATURE_UNAVAILABLE_ON_PLATFORM') {
          console.log(c('yellow', 'info') + ' recursive fs.watch not available, using polling fallback');
          startPollingFallback(root, onFileChange, opts);
        } else {
          console.error(c('red', 'watch error') + ' ' + err.message);
        }
      });
    } catch (err) {
      console.error(`${c('red', 'error')} Cannot watch ${root}: ${err.message}`);
    }
  }

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n' + c('dim', 'Stopping file-watcher...'));
    killChild();
    for (const w of watchers) {
      try { w.close(); } catch (_) {}
    }
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    killChild();
    for (const w of watchers) {
      try { w.close(); } catch (_) {}
    }
    process.exit(0);
  });
}

// ─── Polling Fallback (Linux without inotify recursive) ────────────────────────

function startPollingFallback(root, onChange, opts, intervalMs = 500) {
  const snapshot = new Map(); // filePath → mtime

  function scan(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const rel = path.relative(root, full);
        if (shouldIgnore(rel, opts.ignore)) continue;
        if (entry.isDirectory()) {
          scan(full);
        } else {
          try {
            const stat = fs.statSync(full);
            const prev = snapshot.get(full);
            const mtime = stat.mtimeMs;
            if (prev === undefined) {
              snapshot.set(full, mtime);
            } else if (mtime !== prev) {
              snapshot.set(full, mtime);
              onChange('change', full);
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  // Initial scan to populate snapshot
  scan(root);

  setInterval(() => scan(root), intervalMs);
}

// ─── Entry Point ───────────────────────────────────────────────────────────────

const opts = parseArgs(process.argv);

if (opts.version) {
  printVersion();
  process.exit(0);
}

if (opts.help || !opts.run) {
  printHelp();
  process.exit(opts.help ? 0 : 1);
}

startWatcher(opts);
