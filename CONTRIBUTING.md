# Contributing to inplace-upgrade

Thank you for taking the time to contribute! Please follow the workflow outlined below.

## 1. Fork and Clone

1. Fork the repository to your own GitHub account.
2. Clone your fork:
   ```bash
   git clone [https://github.com/YOUR-USERNAME/inplace-upgrade.git](https://github.com/YOUR-USERNAME/inplace-upgrade.git)
   cd inplace-upgrade
```

3. Install the required dependencies:

```bash
npm install
```



## 2. Branching

Always create a new branch for your work. Never commit directly to the `main` branch.

```bash
git checkout -b feature/your-feature-name
```

## 3. Local Development

Run the local development wiki for manual testing:

```bash
npm run dev
```

This boots a local TiddlyWiki server at `http://127.0.0.1:8080` (running `npx tiddlywiki ./test/wiki --listen`).

*Note: See [test/wiki/README.md](test/wiki/README.md) for details on how tiddlers are included in or excluded from the demo (`index.html`) and test (`test.html`) builds.*

## 4. Code Style & Standards

* **Indentation:** JavaScript uses 4-space indentation.
* **Variables:** Use `const` or `let`. Never use `var`.
* **Source of Truth:** The unpacked plugin source resides in `plugins/theophile.dev/inplace-upgrade/`. TiddlyWiki builds the packaged plugin output from this folder. Do not manually edit compiled output files.

## 5. Testing and Validation

Before pushing your commits, you must ensure all tests and linters pass. The repository is protected by automated GitHub Actions status checks that will block any Pull Request failing these commands:

* **Linting:**
```bash
npm run lint
```


* **Unit Tests** (Jasmine via TiddlyWiki test build):
```bash
npm test
```


* **Integration Tests** (Playwright, builds wiki first):
```bash
npm run test:e2e
```


* **Full Pipeline Check** (Runs all the above):
```bash
npm run ci
```



## 6. Opening a Pull Request

1. Push your feature branch to your fork.
2. Open a Pull Request against the `main` branch of `DesignThinkerer/inplace-upgrade`.
3. Keep your changes minimal and strictly focused on a single feature or bug fix.
4. **Review Requirement:** All PRs require at least one approving review from a core maintainer before they can be merged. If you push new commits to your branch after an approval, the approval is automatically dismissed and a re-review will be required.