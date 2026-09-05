# Contributing

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

## Development wiki

Run the local dev wiki for manual testing:

```bash
npm run dev
```

This runs `npx tiddlywiki ./test/wiki --listen`.

See [test/wiki/README.md](test/wiki/README.md) for how tiddlers are included in, or excluded
from, the demo (`index.html`) and test (`test.html`) builds.

## Test and build commands

- Unit tests (Jasmine via TiddlyWiki test build):
  ```bash
  npm test
  ```
- Integration tests (Playwright, builds wiki first):
  ```bash
  npm run test:e2e
  ```
- Lint:
  ```bash
  npm run lint
  ```
- Full pipeline:
  ```bash
  npm run ci
  ```

## Code style

- JavaScript uses 4-space indentation.
- Use `const`/`let`, never `var`.
- ESLint must pass before opening a PR.

## Plugin source of truth

This repository stores the unpacked plugin source in:

`plugins/theophile.dev/inplace-upgrade/`

That folder is the source of truth. TiddlyWiki builds packaged plugin output from this folder when generating library/release wikis.

## Pull requests

- Keep changes minimal and focused.
- Ensure `npm run ci` passes before opening or updating a PR.
