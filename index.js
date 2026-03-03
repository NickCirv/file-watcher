#!/usr/bin/env node

/**
 * file-watcher — Watch files/directories for changes, run commands automatically.
 * Zero dependencies. Pure Node.js built-ins. Node 18+ required.
 *
 * Usage: file-watcher <pattern> -- <command> [options]
 *        fw <dir> --ext js,ts -- npm test
 */

import fs from 'fs';
import path from 'path';
import { spawnSync, spawn } from 'child_process';
import os from 'os';
import { fileURLToPath } from 'url';
import readline from 'readline';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Version ───────────────────────────────────────────────────────────────────

const VERSION = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')
).version;

// ─── ANSI Colors ───────────────────────────────────────────────────────────────

const NO_COLOR = process.env.NO_COLOR !== undefined || !process.stdout.isTTY;

const COLORS = {
  reset:   '\x1b[0m',
  dim:     '\x1b[2m',
  bold:    '\x1b[1m',
  cyan:    '\x1b[36m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
};

function c(color, str) {
  if (NO_COLOR) return str;
  return `${COLORS[color] ?? ''}${str}${COLORS.reset}`;
}

// ─── Timestamp ─────────────────────────────────────────────────────────────────

function timestamp() {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

// ─── Glob Matching ─────────────────────────────────────────────────────────────

function globToRegex(pattern) {
  const norm = pattern.replace(/\\/g, '/');
  let re = '';
  let i = 0;
  while (i < norm.length) {
    const ch = norm[i];
    if (ch === '*' && norm[i + 1] === '*') {
      re += '.*';
      i += 2;
      if (norm[i] === '/') i++;
    } else if (ch === '*') {
      re += '[^/]*';
      i++;
    } else if (ch === '?') {
      re += '[^/]';
      i++;
    } else if ('.+^${}()|[]\\'.includes(ch)) {
      re += '\\' + ch;
      i++;
    } else {
      re += ch;
      i++;
    }
  }
  return new RegExp('^' + re + '$');
}

function matchesGlob(filePath, pattern) {
  const norm = filePath.replace(/\\/g, '/');
  const base = path.basename(norm);
  const rx = globToRegex(pattern);
  return rx.test(norm) || rx.test(base);
}

function matchesAnyGlob(filePath, patterns) {
  return patterns.some(p => matchesGlob(filePath, p));
}

// ─── Argument Parsing ──────────────────────────────────────────────────────────

const DEFAULT_IGNORE = ['node_modules', '.git', 'dist', '.next', '.nuxt', 'coverage'];

function parseArgs(argv) {
  const args = argv.slice(2);

  const opts = {
    patterns:  [],
    command:   [],      // array: [cmd, ...args] after -- separator
    ext:       [],      // --ext js,ts
    debounce:  300,     // --debounce <ms>
    ignore:    [],      // --ignore <pattern>
    clear:     false,   // --clear
    once:      false,   // --once
    poll:      0,       // --poll <ms>
    initial:   false,   // --initial
    delay:     0,       // --delay <ms>
    env:       {},      // --env KEY=VALUE
    verbose:   false,   // --verbose
    help:      false,
    version:   false,
    watchrc:   true,    // load .watchrc by default
  };

  // Split on -- separator
  const dashIdx = args.indexOf('--');
  let preArgs = dashIdx === -1 ? args : args.slice(0, dashIdx);
  const postArgs = dashIdx === -1 ? [] : args.slice(dashIdx + 1);

  if (postArgs.length > 0) {
    opts.command = postArgs; // command is already split on spaces by shell
  }

  let i = 0;
  while (i < preArgs.length) {
    const arg = preArgs[i];
    switch (arg) {
      case '--ext':
      case '-e':
        opts.ext = preArgs[++i].split(',').map(e => e.trim().replace(/^\./, ''));
        break;
      case '--debounce':
        opts.debounce = Math.max(0, parseInt(preArgs[++i], 10) || 300);
        break;
      case '--ignore':
        opts.ignore.push(preArgs[++i]);
        break;
      case '--clear':
        opts.clear = true;
        break;
      case '--once':
        opts.once = true;
        break;
      case '--poll':
        opts.poll = Math.max(50, parseInt(preArgs[++i], 10) || 500);
        break;
      case '--initial':
        opts.initial = true;
        break;
      case '--delay':
        opts.delay = Math.max(0, parseInt(preArgs[++i], 10) || 0);
        break;
      case '--env': {
        const pair = preArgs[++i];
        const eq = pair.indexOf('=');
        if (eq > 0) {
          const key = pair.slice(0, eq);
          const val = pair.slice(eq + 1);
          opts.env[key] = val;
        }
        break;
      }
      case '--verbose':
        opts.verbose = true;
        break;
      case '--no-watchrc':
        opts.watchrc = false;
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
        if (!arg.startsWith('-')) {
          opts.patterns.push(arg);
        }
        break;
    }
    i++;
  }

  return opts;
}

// ─── .watchrc Config ───────────────────────────────────────────────────────────

function loadWatchrc(opts) {
  const rcPath = path.join(process.cwd(), '.watchrc');
  try {
    const raw = fs.readFileSync(rcPath, 'utf8');
    const cfg = JSON.parse(raw);

    // Only apply rc values if CLI didn't already set them
    if (cfg.pattern && opts.patterns.length === 0) {
      opts.patterns = Array.isArray(cfg.pattern) ? cfg.pattern : [cfg.pattern];
    }
    if (cfg.command && opts.command.length === 0) {
      // command in watchrc is a string — split it safely
      opts.command = splitCommand(cfg.command);
    }
    if (cfg.ext && opts.ext.length === 0) {
      opts.ext = (Array.isArray(cfg.ext) ? cfg.ext : cfg.ext.split(','))
        .map(e => e.trim().replace(/^\./, ''));
    }
    if (cfg.ignore && opts.ignore.length === 0) {
      opts.ignore = Array.isArray(cfg.ignore) ? cfg.ignore : [cfg.ignore];
    }
    if (typeof cfg.debounce === 'number' && opts.debounce === 300) {
      opts.debounce = cfg.debounce;
    }
    if (typeof cfg.clear === 'boolean' && !opts.clear) {
      opts.clear = cfg.clear;
    }
    if (typeof cfg.initial === 'boolean' && !opts.initial) {
      opts.initial = cfg.initial;
    }

    return rcPath;
  } catch (_) {
    return null;
  }
}

// ─── Command Splitting ─────────────────────────────────────────────────────────

function splitCommand(cmdStr) {
  const parts = [];
  let cur = '';
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < cmdStr.length; i++) {
    const ch = cmdStr[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === ' ' && !inSingle && !inDouble) {
      if (cur.length > 0) { parts.push(cur); cur = ''; }
    } else {
      cur += ch;
    }
  }
  if (cur.length > 0) parts.push(cur);
  return parts;
}

// ─── Ignore Logic ──────────────────────────────────────────────────────────────

function buildIgnorePatterns(userIgnore) {
  // Always include sensible defaults
  const defaults = DEFAULT_IGNORE.map(d => `**/${d}/**`).concat(
    DEFAULT_IGNORE.map(d => `${d}/**`)
  );
  return [...new Set([...defaults, ...userIgnore])];
}

function shouldIgnore(relPath, ignorePatterns) {
  const norm = relPath.replace(/\\/g, '/');
  // Fast check: any path segment is in DEFAULT_IGNORE
  const segments = norm.split('/');
  if (segments.some(s => DEFAULT_IGNORE.includes(s))) return true;
  return matchesAnyGlob(norm, ignorePatterns);
}

function matchesExtFilter(relPath, exts) {
  if (exts.length === 0) return true;
  const ext = path.extname(relPath).slice(1).toLowerCase();
  return exts.includes(ext);
}

// ─── Event Display ─────────────────────────────────────────────────────────────

const EVENT_COLORS = {
  rename:  'green',   // new file / delete
  change:  'yellow',
  add:     'green',
  delete:  'red',
};

function detectEventType(fullPath, fsEvent) {
  if (fsEvent === 'change') return 'change';
  // 'rename' = add or delete — check existence
  try {
    fs.accessSync(fullPath, fs.constants.F_OK);
    return 'add';
  } catch (_) {
    return 'delete';
  }
}

function logEvent(relPath, eventType) {
  const color = EVENT_COLORS[eventType] ?? 'cyan';
  const label = eventType.padEnd(6);
  console.log(
    `${c('dim', timestamp())} ${c(color, label)} ${c('dim', relPath)}`
  );
}

// ─── Process Runner ────────────────────────────────────────────────────────────

let activeChild = null;
let runCount = 0;

function killActive() {
  if (!activeChild || activeChild.killed) { activeChild = null; return; }
  try {
    process.kill(-activeChild.pid, 'SIGTERM');
  } catch (_) {
    try { activeChild.kill('SIGTERM'); } catch (__) {}
  }
  activeChild = null;
}

function runCommand(cmdParts, opts, relPath) {
  if (opts.clear) {
    readline.clearScreenDown(process.stdout);
    process.stdout.write('\x1b[2J\x1b[H');
  }

  const [cmd, ...args] = cmdParts;
  runCount++;

  // Build env: inherit process.env + user-supplied --env vars
  // Never log values
  const childEnv = Object.assign({}, process.env, opts.env);

  const startMs = Date.now();

  console.log(
    `${c('dim', timestamp())} ${c('cyan', '▶')} ${c('bold', cmdParts.join(' '))}` +
    (relPath ? ` ${c('dim', `[${relPath}]`)}` : '')
  );

  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: childEnv,
  });

  const duration = Date.now() - startMs;
  const code = result.status ?? (result.signal ? 1 : 0);
  const codeColor = code === 0 ? 'green' : 'red';

  if (result.error) {
    console.error(
      `${c('dim', timestamp())} ${c('red', 'error')} ${result.error.message}`
    );
    return;
  }

  console.log(
    `${c('dim', timestamp())} ${c(codeColor, `exit ${code}`)} ${c('dim', `${duration}ms`)}`
  );
}

// Restart mode: long-running process that gets killed on each change
function runCommandRestart(cmdParts, opts, relPath) {
  if (opts.clear) {
    readline.clearScreenDown(process.stdout);
    process.stdout.write('\x1b[2J\x1b[H');
  }

  killActive();

  const [cmd, ...args] = cmdParts;
  const childEnv = Object.assign({}, process.env, opts.env);

  console.log(
    `${c('dim', timestamp())} ${c('cyan', '▶')} ${c('bold', cmdParts.join(' '))}` +
    (relPath ? ` ${c('dim', `[${relPath}]`)}` : '')
  );

  activeChild = spawn(cmd, args, {
    stdio: 'inherit',
    env: childEnv,
    detached: true,
  });

  activeChild.on('exit', (code, signal) => {
    if (code === null && signal) return; // killed by us
    if (code !== null) {
      const codeColor = code === 0 ? 'green' : 'red';
      console.log(`${c('dim', timestamp())} ${c(codeColor, `exit ${code}`)}`);
    }
    activeChild = null;
  });

  activeChild.on('error', (err) => {
    console.error(`${c('dim', timestamp())} ${c('red', 'error')} ${err.message}`);
    activeChild = null;
  });
}

// ─── Polling Watcher ───────────────────────────────────────────────────────────

function startPolling(roots, onEvent, opts) {
  const snapshot = new Map();

  function scan(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (_) { return; }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(process.cwd(), full).replace(/\\/g, '/');
      if (shouldIgnore(rel, buildIgnorePatterns(opts.ignore))) continue;
      if (entry.isDirectory()) {
        scan(full);
      } else {
        let stat;
        try { stat = fs.statSync(full); } catch (_) { continue; }
        const prev = snapshot.get(full);
        if (prev === undefined) {
          snapshot.set(full, stat.mtimeMs);
        } else if (stat.mtimeMs !== prev) {
          snapshot.set(full, stat.mtimeMs);
          onEvent('change', full);
        }
      }
    }
  }

  for (const root of roots) scan(root);
  const interval = setInterval(() => { for (const root of roots) scan(root); }, opts.poll);
  return interval;
}

// ─── fs.watch Watcher ──────────────────────────────────────────────────────────

function startFsWatch(roots, onEvent, opts) {
  const platform = os.platform();
  const supportsRecursive = platform === 'darwin' || platform === 'win32';
  const watchers = [];

  for (const root of roots) {
    try {
      const watchOpts = { persistent: true };
      if (supportsRecursive) watchOpts.recursive = true;

      const watcher = fs.watch(root, watchOpts, (eventType, filename) => {
        if (!filename) return;
        // filename may be relative to root or absolute
        const full = path.isAbsolute(filename)
          ? filename
          : path.join(root, filename);
        onEvent(eventType, full);
      });

      watcher.on('error', (err) => {
        if (err.code === 'ERR_FEATURE_UNAVAILABLE_ON_PLATFORM' || err.code === 'ENOSYS') {
          console.log(c('yellow', 'warn') + ' recursive watch not available on this platform, falling back to polling');
          // Close this watcher and switch to polling
          for (const w of watchers) { try { w.close(); } catch (_) {} }
          watchers.length = 0;
          const interval = startPolling(roots, onEvent, { ...opts, poll: 500 });
          // Store interval ref for cleanup via a sentinel
          watchers.push({ close: () => clearInterval(interval) });
        } else {
          console.error(c('red', 'watch error') + ' ' + err.message);
        }
      });

      // On Linux without recursive support, manually watch subdirs
      if (!supportsRecursive) {
        function watchSubdirs(dir) {
          let entries;
          try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
          catch (_) { return; }
          for (const entry of entries) {
            if (entry.isDirectory()) {
              const sub = path.join(dir, entry.name);
              const rel = path.relative(process.cwd(), sub);
              if (shouldIgnore(rel, buildIgnorePatterns(opts.ignore))) continue;
              try {
                const subWatcher = fs.watch(sub, watchOpts, (et, fn) => {
                  if (!fn) return;
                  const full = path.join(sub, fn);
                  onEvent(et, full);
                });
                subWatcher.on('error', () => {});
                watchers.push(subWatcher);
              } catch (_) {}
              watchSubdirs(sub);
            }
          }
        }
        watchSubdirs(root);
      }

      watchers.push(watcher);
    } catch (err) {
      console.error(`${c('red', 'error')} Cannot watch ${root}: ${err.message}`);
    }
  }

  return watchers;
}

// ─── Help ──────────────────────────────────────────────────────────────────────

function printHelp() {
  process.stdout.write(`
${c('bold', 'file-watcher')} ${c('dim', `v${VERSION}`)} — Watch files for changes, run commands automatically.

${c('bold', 'USAGE')}
  file-watcher <pattern> -- <command> [options]
  fw <dir> --ext js,ts -- <command>
  fw . -- npm test

${c('bold', 'EXAMPLES')}
  fw src/ -- npm test
  fw "**/*.ts" -- tsc --noEmit
  fw . --ext js,ts -- node server.js
  fw src/ -- npm run build --debounce 500 --clear
  fw . -- node app.js --poll 1000
  fw . --initial -- npm test
  fw src/ -- npm test --once
  fw . --env NODE_ENV=test -- npm test
  fw . -- npm run build --delay 200

${c('bold', 'OPTIONS')}
  ${c('cyan', '<pattern>')}         Glob pattern or directory to watch
  ${c('cyan', '--ext <list>')}      File extensions to watch (comma-separated, e.g. js,ts)
  ${c('cyan', '--debounce <ms>')}   Debounce delay after change (default: 300)
  ${c('cyan', '--ignore <glob>')}   Ignore pattern (repeatable)
  ${c('cyan', '--clear')}           Clear terminal before each run
  ${c('cyan', '--once')}            Run command once on first change, then exit
  ${c('cyan', '--poll <ms>')}       Use polling instead of fs.watch (network drives)
  ${c('cyan', '--initial')}         Run command immediately on start, before any changes
  ${c('cyan', '--delay <ms>')}      Delay before running after change detected
  ${c('cyan', '--env KEY=VAL')}     Extra environment variable for command (repeatable)
  ${c('cyan', '--verbose')}         Show extra debug info
  ${c('cyan', '--no-watchrc')}      Skip loading .watchrc config file
  ${c('cyan', '--help, -h')}        Show this help
  ${c('cyan', '--version, -v')}     Show version

${c('bold', 'DEFAULT IGNORE')}
  node_modules, .git, dist, .next, .nuxt, coverage

${c('bold', '.watchrc')} (JSON config file in working directory)
  { "pattern": "src/", "command": "npm test", "ext": "js,ts", "debounce": 500 }

${c('bold', 'EVENT COLORS')}
  ${c('green', 'add')}      New file detected
  ${c('yellow', 'change')}   File modified
  ${c('red', 'delete')}   File removed

${c('dim', `Zero dependencies · Node 18+ · MIT License · github.com/NickCirv/file-watcher`)}
`);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

const opts = parseArgs(process.argv);

if (opts.version) {
  console.log(VERSION);
  process.exit(0);
}

if (opts.help) {
  printHelp();
  process.exit(0);
}

// Load .watchrc before validation
if (opts.watchrc) {
  const rcFile = loadWatchrc(opts);
  if (rcFile && opts.verbose) {
    console.log(c('dim', `Loaded config from ${rcFile}`));
  }
}

if (opts.command.length === 0) {
  console.error(c('red', 'error') + ' No command specified. Use: fw <pattern> -- <command>');
  console.error(c('dim', 'Run fw --help for usage.'));
  process.exit(1);
}

// Resolve watch roots
const watchPatterns = opts.patterns.length > 0 ? opts.patterns : ['.'];
const ignorePatterns = buildIgnorePatterns(opts.ignore);

const watchRoots = (() => {
  const roots = new Set();
  for (const p of watchPatterns) {
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
})();

// Print startup banner
console.log(
  `${c('cyan', 'file-watcher')} ${c('dim', `v${VERSION}`)} ` +
  `watching ${c('bold', watchPatterns.join(', '))} ` +
  `${c('dim', '→')} ${c('green', opts.command.join(' '))}`
);
if (opts.ext.length > 0)    console.log(c('dim', `  ext: .${opts.ext.join(', .')}`));
if (opts.debounce !== 300)  console.log(c('dim', `  debounce: ${opts.debounce}ms`));
if (opts.delay > 0)         console.log(c('dim', `  delay: ${opts.delay}ms`));
if (opts.poll > 0)          console.log(c('dim', `  polling: every ${opts.poll}ms`));
if (opts.ignore.length > 0) console.log(c('dim', `  ignore: ${opts.ignore.join(', ')}`));
if (opts.initial)           console.log(c('dim', '  initial run enabled'));
if (opts.once)              console.log(c('dim', '  once mode — exit after first change'));
console.log(c('dim', '  Press Ctrl+C to stop.'));
console.log('');

// Debounce state — use crypto.randomBytes for unique run IDs
let debounceTimer = null;
let changeCount = 0;

function handleChange(fsEvent, fullPath) {
  const rel = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');

  if (shouldIgnore(rel, ignorePatterns)) return;

  // Extension filter
  if (!matchesExtFilter(rel, opts.ext)) return;

  // Pattern filter (only if user specified patterns that look like globs)
  if (watchPatterns.some(p => p.includes('*') || p.includes('?'))) {
    if (!matchesAnyGlob(rel, watchPatterns)) return;
  }

  const eventType = detectEventType(fullPath, fsEvent);
  logEvent(rel, eventType);

  changeCount++;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    setTimeout(() => {
      executeRun(rel);
    }, opts.delay);
  }, opts.debounce);
}

let hasRanOnce = false;

function executeRun(relPath) {
  if (opts.once && hasRanOnce) return;
  hasRanOnce = true;

  runCommand(opts.command, opts, relPath);

  if (opts.once) {
    console.log(c('dim', '\n--once: exiting after first run.'));
    shutdown(0);
  }
}

// Initial run before watching
if (opts.initial) {
  console.log(c('dim', `${timestamp()} initial run`));
  runCommand(opts.command, opts, null);
}

// Start watching
let cleanupFn = null;

if (opts.poll > 0) {
  console.log(c('dim', `Using polling mode (${opts.poll}ms interval)\n`));
  const interval = startPolling(watchRoots, handleChange, opts);
  cleanupFn = () => clearInterval(interval);
} else {
  const watchers = startFsWatch(watchRoots, handleChange, opts);
  cleanupFn = () => { for (const w of watchers) { try { w.close(); } catch (_) {} } };
}

// ─── Graceful Shutdown ─────────────────────────────────────────────────────────

function shutdown(code = 0) {
  console.log('\n' + c('dim', `file-watcher stopped. ${runCount} run(s) total.`));
  clearTimeout(debounceTimer);
  killActive();
  if (cleanupFn) cleanupFn();
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
