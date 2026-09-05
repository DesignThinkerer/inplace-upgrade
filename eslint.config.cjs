"use strict";

const js = require("@eslint/js");

module.exports = [
    {
        ignores: [
            "node_modules/**",
            "test/wiki/output/**",
            "dist/**",
            "playwright-report/**",
            "test-results/**"
        ]
    },
    js.configs.recommended,
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "commonjs",
            globals: {
                $tw: "readonly",
                fetch: "readonly",
                DOMParser: "readonly",
                Blob: "readonly",
                URL: "readonly",
                URLSearchParams: "readonly",
                location: "readonly",
                AbortController: "readonly",
                confirm: "readonly",
                alert: "readonly",
                document: "readonly",
                window: "readonly",
                console: "readonly",
                setTimeout: "readonly",
                clearTimeout: "readonly"
            }
        },
        rules: {
            "no-var": "error",
            "prefer-const": "error",
            "no-unused-vars": "error"
        }
    }
];
