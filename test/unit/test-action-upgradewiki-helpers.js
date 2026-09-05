/*\
title: test-action-upgradewiki-helpers.js
type: application/javascript
tags: [[$:/tags/test-spec]]
\*/

"use strict";

describe("inplace-upgrade helper tests", function() {
    const helpers = $tw.modules.execute("$:/plugins/theophile.dev/inplace-upgrade/action-upgradewiki.js").__testHelpers;

    it("sanitizes site title characters and keeps fallback", function() {
        expect(helpers.sanitizeSiteTitle("My:/\\*?\"<>|% Title")).toBe("My---------- Title");
        expect(helpers.sanitizeSiteTitle("   ")).toBe("tiddlywiki");
        expect(helpers.sanitizeSiteTitle("")).toBe("tiddlywiki");
    });

    it("escapes less-than characters in serialized store JSON", function() {
        const json = JSON.stringify([{ title: "x", text: "<script>alert(1)</script>" }]);
        expect(helpers.sanitizeJsonForScriptTag(json)).toContain("\\u003cscript>");
        expect(helpers.sanitizeJsonForScriptTag(json)).not.toContain("<script>");
    });

    it("resolves external core URL from target shell", function() {
        const resolved = helpers.resolveCoreUrl(
            "https://tiddlywiki.com/prerelease/empty-external-core.html",
            "./tiddlywikicore-5.3.8.js",
            "https://example.org/base/wiki.html"
        );
        expect(resolved).toBe("https://tiddlywiki.com/prerelease/tiddlywikicore-5.3.8.js");
    });
});
