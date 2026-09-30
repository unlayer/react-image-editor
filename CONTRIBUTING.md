# Contributing

## Prerequisites

- [Node.js](https://nodejs.org/) >= v22.13, which pnpm 11 requires. The published component still supports Node 20; CI tests on Node 20, 22 and 24.
- [pnpm](https://pnpm.io/installation) 11. The exact version is pinned in the `packageManager` field of `package.json`.

## Installation

- Running `pnpm install` in the root directory installs everything you need for development, including the demo app in `demo/` (a pnpm workspace package).
- npm, Yarn and Bun aren't supported. `npm install` and `npm run` stop with an `EBADDEVENGINES` error.

### Dependency install scripts

pnpm doesn't run a dependency's install scripts (`preinstall`, `install`, `postinstall`) unless the package is listed under `allowBuilds` in `pnpm-workspace.yaml`, and the install fails when a dependency brings in one that hasn't been reviewed. If that happens, check what the script does, then add the package with `true` (it needs the script) or `false` (it works without it) and a comment saying why.

## Demo Development Server

- `pnpm dev` runs the demo app at [http://localhost:5173](http://localhost:5173) with hot module reloading. The demo imports the component straight from `src/`, so it doubles as a development harness.

## Running Tests

- `pnpm test` runs the tests once.
- `pnpm test:coverage` runs the tests and produces a coverage report in `coverage/`.
- `pnpm test:watch` runs the tests on every change.

## Building

- `pnpm build` builds the component for publishing to npm.
- `pnpm --dir demo build` builds the demo app.

## Conventions

- Commit messages follow [Conventional Commits 1.0](https://www.conventionalcommits.org/en/v1.0.0/).
- All dependency versions are pinned exact (no `^`/`~` ranges).
- No `console.log` / `console.debug` — use `console.info`, `console.warn`, or `console.error`.
