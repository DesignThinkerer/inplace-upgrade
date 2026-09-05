"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repositoryRoot = path.resolve(__dirname, "..");
const env = {
    ...process.env,
    TIDDLYWIKI_PLUGIN_PATH: path.join(repositoryRoot, "plugins")
};

const args = ["tiddlywiki", "./test/library", "--build", "library"];
const runner = process.platform === "win32" ? "npx.cmd" : "npx";

const result = spawnSync(runner, args, {
    cwd: repositoryRoot,
    stdio: "inherit",
    env
});

if (result.error) {
    console.error(result.error);
    process.exit(1);
}

process.exit(result.status || 0);
