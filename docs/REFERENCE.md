# file-watcher — command reference

[Overview](../README.md) · [Research record](RESEARCH.md)

Describes revision `d67e37e91537184be71106820c64be2d564e2149`. Commands are source-inspected; no execution results are asserted.

## Workflow

Provides fs.watch and polling modes, extension/glob filtering, debounce, initial execution and one-shot operation. Reads .watchrc unless --no-watchrc is set.

Use a harmless command to check the watch scope before connecting build or mutation tasks.

```bash
node index.js ../your-project/src --ext js,ts -- node --version
```

## Commands and controls

| Control | Behavior in the inspected implementation |
| --- | --- |
| `PATH` | Select a watch root or pattern |
| `--ext LIST` | Filter file extensions |
| `--poll MS` | Use interval polling |
| `--initial` | Run once at startup |
| `-- COMMAND` | Separate watcher options from child-command arguments |

## Interpretation and side effects

The child command inherits environment variables and executes with your permissions. File-event behavior varies across operating systems and mounted filesystems. Put watcher flags before the -- separator; arguments after it belong to the child.

## Implementation reference

- [package.json](https://github.com/NickCirv/file-watcher/blob/d67e37e91537184be71106820c64be2d564e2149/package.json)
- [index.js](https://github.com/NickCirv/file-watcher/blob/d67e37e91537184be71106820c64be2d564e2149/index.js)
- [test/smoke.test.js](https://github.com/NickCirv/file-watcher/blob/d67e37e91537184be71106820c64be2d564e2149/test/smoke.test.js)
