"use strict";

const config = {
    testDir: "./test/integration",
    retries: process.env.CI ? 2 : 0,
    use: {
        baseURL: "http://127.0.0.1:4173"
    },
    webServer: {
        command: "python3 -m http.server 4173 --directory .",
        port: 4173,
        reuseExistingServer: !process.env.CI
    }
};

module.exports = config;
