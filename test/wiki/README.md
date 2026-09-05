# Demo vs. test tiddlers

This wiki builds two different HTML files from the same `tiddlers/` folder (see
`tiddlywiki.info`):

| Build target | npm script     | Output                        | Used by                                             |
| ------------- | -------------- | ------------------------------ | ---------------------------------------------------- |
| `index`       | `npm run build` | `test/wiki/output/index.html` | GitHub Pages demo (`.github/workflows/pages.yml`)     |
| `test`        | `npm run test`  | `test/wiki/output/test.html`  | Jasmine unit tests + Playwright integration tests     |

By default **every tiddler in `tiddlers/` ships in both builds** — the `test` target applies no
filtering at all. Only the `index` target removes tiddlers, via a `--deletetiddlers` step that
runs before rendering:

```
[prefix[$:/plugins/tiddlywiki/tiddlyweb]] [prefix[$:/plugins/tiddlywiki/jasmine]] [tag[$:/tags/test-spec]] [prefix[$:/tests/]]
```

## Add a tiddler to `test.html` only (excluded from the demo)

Make it match one of the clauses above, e.g.:

* Tag it `$:/tags/test-spec` (used for Jasmine spec tiddlers), or
* Prefix its title with `$:/tests/` (used for Playwright-only tiddlers).

Both patterns are already used by existing tiddlers (`tiddlers/tests/test-action-upgradewiki-helpers.js`,
`tiddlers/e2e-upgrade.tid`). No change to `tiddlywiki.info` is needed.

## Add a tiddler to the demo (`index.html`) only (excluded from `test.html`)

The `test` target has no exclusion filter, so this direction requires a `tiddlywiki.info` change:

1. Give the tiddler a distinguishing tag or title prefix (e.g. tag it `$:/tags/demo-only`).
2. Add a `--deletetiddlers` step for that filter to the `test` build array, before its
   `--rendertiddler` step — mirroring the step already used by the `index` target.

## Default tiddlers differ too

What the wiki opens to (`$:/DefaultTiddlers`) is also build-specific:

* `tiddlers/DefaultTiddlers.tid` ships the test build's default: `[[$:/tests/inplace-upgrade/e2e]]`.
* The `index` target overwrites that tiddler's `text` field with `--setfield`, by wikifying
  `tiddlers/DefaultTiddlersTemplate.tid` (`$:/temp/inplace-upgrade/default-tiddlers-template`,
  `text/plain`) as `text/plain`, then deletes the template tiddler so it doesn't ship. The 3rd
  `--setfield` argument is that template's **title**, not a literal value — passing a literal
  string wrapped in `[[..]]` there would silently set the field to `undefined` instead.

To change what the demo opens to by default, edit `DefaultTiddlersTemplate.tid`, not
`DefaultTiddlers.tid`.

## Verifying

```bash
npm run build   # writes test/wiki/output/index.html
npm run test    # writes test/wiki/output/test.html
grep -c 'YOUR-TIDDLER-TITLE' test/wiki/output/index.html test/wiki/output/test.html
```
