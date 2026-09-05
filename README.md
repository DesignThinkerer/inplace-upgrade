# inplace-upgrade

In-place upgrader plugin for TiddlyWiki single-file wikis.

[![CI](https://github.com/DesignThinkerer/inplace-upgrade/actions/workflows/ci.yml/badge.svg)](https://github.com/DesignThinkerer/inplace-upgrade/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/DesignThinkerer/inplace-upgrade)](https://github.com/DesignThinkerer/inplace-upgrade/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Overview

Upgrading a single-file TiddlyWiki usually means exporting your tiddlers, dragging them into the
official [upgrade wizard](https://tiddlywiki.com/upgrade.html), and manually re-uploading the
result. `inplace-upgrade` does this from right inside your wiki, in the browser, without leaving
the page.

### Features

* Upgrade to the latest stable release or prerelease.
* Works with standard TiddlyWiki savers.
* Supports external-core wikis.
* Optionally downloads an HTML backup before upgrading.
* Preserves edits made after an upgrade and before reloading.
* Asks for explicit confirmation before making any changes, with an extra warning if backups are disabled.
* Attempts to confirm that the save actually succeeded before offering to reload.

## Installation

1. Download the latest `library.html` from the [Releases page](https://github.com/DesignThinkerer/inplace-upgrade/releases).
2. Drag and drop it into your TiddlyWiki.
3. Save and reload your wiki.

## Usage

The plugin adds an "Upgrade" panel (via the `$action-inplace-upgrade` widget) where you pick a
target edition and, optionally, disable the automatic backup. When you click upgrade:

1. You're asked to confirm the upgrade (with an extra warning if backups are disabled).
2. If enabled, an HTML backup of your current wiki is downloaded first.
3. The target shell is fetched, your tiddlers are merged into it, and the result is handed to your
   saver.
4. Once the save is confirmed, you're offered a reload into the upgraded wiki. Any edits made
   before reloading are preserved.

## Requirements

* TiddlyWiki 5.3.2 or later.
* A browser environment with a target URL reachable via `fetch()` (remote targets must allow CORS;
  local `file://` wikis may need a relative target URL or a local web server).

## Repo structure

```text
inplace-upgrade/
├── plugins/
│   └── theophile.dev/
│       └── inplace-upgrade/
│           ├── action-upgradewiki.js
│           ├── core-url.tid
│           ├── icon.tid
│           ├── latest-version.tid
│           ├── library.tid
│           ├── PageTemplate/
│           │   └── wikireloadwarning.tid
│           ├── readme.tid
│           ├── upgrade.tid
│           └── plugin.info
├── test/
│   ├── wiki/                  # dev/test wiki that includes the plugin + TW core as a dependency
│   ├── unit/                  # jasmine specs for pure JS logic
│   └── integration/           # e.g. puppeteer/playwright tests that boot the wiki in a headless browser
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
├── scripts/
│   ├── build.js               # unpacks JSON plugin -> individual .tid/.js files, or vice versa
│   └── release.js
├── .editorconfig
├── .eslintrc.json
├── .gitignore
├── package.json
├── LICENSE
├── README.md
└── CONTRIBUTING.md
```

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, build, lint, and test instructions.

## License

MIT — see [LICENSE](LICENSE).
