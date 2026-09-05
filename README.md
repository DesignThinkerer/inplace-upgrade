# inplace-upgrade
In-place upgrader plugin for TiddlyWiki single-file wikis

# Repo structure

```
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
