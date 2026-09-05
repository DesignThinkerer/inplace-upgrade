"use strict";

const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(repositoryRoot, "package.json");
const pluginInfoPath = path.join(repositoryRoot, "plugins/theophile.dev/inplace-upgrade/plugin.info");

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const pluginInfo = JSON.parse(fs.readFileSync(pluginInfoPath, "utf8"));

if (packageJson.version !== pluginInfo.version) {
    console.error(`Version mismatch: package.json=${packageJson.version} plugin.info=${pluginInfo.version}`);
    process.exit(1);
}

console.log(`Version check passed: ${packageJson.version}`);
