# Contributing

## Prerequisites

[Node.js](https://nodejs.org/) >= v20 must be installed. CI tests on Node 20, 22 and 24.

## Installation

- Running `npm install` in the component's root directory will install everything you need for development.
- Running `npm install` in the `demo` directory will install everything you need to run the demo app locally.

## Demo Development Server

- `npm run dev` from the `demo` directory runs the demo app at [http://localhost:5173](http://localhost:5173) with hot module reloading. The demo imports the component straight from `src/`, so it doubles as a development harness.

## Running Tests

- `npm test` runs the tests once.
- `npm run test:coverage` runs the tests and produces a coverage report in `coverage/`.
- `npm run test:watch` runs the tests on every change.

## Building

- `npm run build` builds the component for publishing to npm.
- `npm run build` in the `demo` directory builds the demo app.

## Conventions

- Commit messages follow [Conventional Commits 1.0](https://www.conventionalcommits.org/en/v1.0.0/).
- All dependency versions are pinned exact (no `^`/`~` ranges).
- No `console.log` / `console.debug` — use `console.info`, `console.warn`, or `console.error`.
