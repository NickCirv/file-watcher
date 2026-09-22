# file-watcher — research record

## Revision and scope

- Repository: [NickCirv/file-watcher](https://github.com/NickCirv/file-watcher)
- Commit: `d67e37e91537184be71106820c64be2d564e2149`
- Tree: `bd6a2e8c74a02ceb8db4a656efd3f0c3e3d2dd93`
- Captured: 6 of 6 eligible text files (all eligible text files).
- Recursive tree truncated: `False`.
- Runtime verification: **unverified**; no repository code, installation or test command was executed.

The captured file inventory is broader than the semantic review. Authoring inspected package metadata, entrypoint/argument handling and implementation paths relevant to the claims below, plus test declarations. This is documentation research, not a line-by-line security audit. Generated/binary artifacts, lockfiles and file types outside the acquisition filter were not inspected.

## Claim and evidence

| Claim | Pinned evidence | Status |
| --- | --- | --- |
| Runtime requirement and executable mapping | [package.json](https://github.com/NickCirv/file-watcher/blob/d67e37e91537184be71106820c64be2d564e2149/package.json) | verified in manifest; installation unverified |
| Run a chosen command when matching local files change. | [implementation](https://github.com/NickCirv/file-watcher/blob/d67e37e91537184be71106820c64be2d564e2149/index.js) | partially verified by static implementation review |
| Operational limits and side effects | [implementation](https://github.com/NickCirv/file-watcher/blob/d67e37e91537184be71106820c64be2d564e2149/index.js) and source map in [reference](REFERENCE.md) | partially verified; runtime unverified |
| Test command definition | [package.json](https://github.com/NickCirv/file-watcher/blob/d67e37e91537184be71106820c64be2d564e2149/package.json) | verified as a declaration only |

## Findings carried into the rewrite

The child command inherits environment variables and executes with your permissions. File-event behavior varies across operating systems and mounted filesystems. Put watcher flags before the -- separator; arguments after it belong to the child.

No runtime checks were executed for this documentation review. The committed smoke test checks entrypoint JavaScript syntax; it does not exercise the command behavior.

## Documentation inventory and disposition

| Existing document | Disposition |
| --- | --- |
| [README.md](https://github.com/NickCirv/file-watcher/blob/d67e37e91537184be71106820c64be2d564e2149/README.md) | Rewritten overview; historical copy remains at this pinned URL. |

New supporting documents: `docs/REFERENCE.md` and `docs/RESEARCH.md`. No original source or protected legal/security file was changed.

## Protected-file evidence

- `LICENSE` SHA-256 `8edf13ba2a2e443fa49e42493414f6952a4a14b6c407983a7c95162ab37f6265`.

## Remaining verification

Clean installation, useful-command execution, malformed input, side-effect boundaries, platform compatibility and end-to-end tests remain unverified. Package-registry availability and live API destinations were not checked. No performance, customer-adoption, compliance or production-readiness claim is made.

## Captured evidence index

- [LICENSE](https://github.com/NickCirv/file-watcher/blob/d67e37e91537184be71106820c64be2d564e2149/LICENSE) · blob `481c289c06c96c07330f8c7dedd847c5c07ca384`.
- [README.md](https://github.com/NickCirv/file-watcher/blob/d67e37e91537184be71106820c64be2d564e2149/README.md) · blob `7cbb99cc57ea24a1ce2d7ea3f8d95f536dce4c77`.
- [package.json](https://github.com/NickCirv/file-watcher/blob/d67e37e91537184be71106820c64be2d564e2149/package.json) · blob `19b73fff68c41a789d8362ca2b7cf371c3951b53`.
- [.github/workflows/ci.yml](https://github.com/NickCirv/file-watcher/blob/d67e37e91537184be71106820c64be2d564e2149/.github/workflows/ci.yml) · blob `44515034a394670de44454a7a1bd2c7ef0c9836e`.
- [index.js](https://github.com/NickCirv/file-watcher/blob/d67e37e91537184be71106820c64be2d564e2149/index.js) · blob `f69c3799f75850e2e85973a5d24cb8bc5f055490`.
- [test/smoke.test.js](https://github.com/NickCirv/file-watcher/blob/d67e37e91537184be71106820c64be2d564e2149/test/smoke.test.js) · blob `ebbccaaf2583b4850575f835313e4b0afd21bff7`.

## Tree files outside the captured text set

These paths were mapped but their contents were not acquired in this research pass:

- `banner.svg`
