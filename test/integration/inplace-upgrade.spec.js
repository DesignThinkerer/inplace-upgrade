"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");

test("in-place upgrade rewrites rendered save HTML", async ({ page }) => {
    const fixturePath = path.resolve(__dirname, "../fixtures/empty-external-core.html");
    const fixtureHtml = fs.readFileSync(fixturePath, "utf8");

    await page.route("**/test/fixtures/empty-external-core.html", async (route) => {
        await route.fulfill({
            status: 200,
            contentType: "text/html",
            body: fixtureHtml
        });
    });

    page.on("dialog", async (dialog) => {
        await dialog.accept();
    });

    await page.goto("/test/wiki/output/test.html");
    await expect(page.locator(".e2e-upgrade-external")).toBeVisible();

    await page.click(".e2e-upgrade-external");
    await expect(page.locator(".e2e-status")).toContainText(/Save outcome could not be confirmed automatically|Wiki upgraded and save confirmed/, { timeout: 20000 });

    const rendered = await page.evaluate(() => {
        const saveTemplate = $tw.wiki.getTiddlerText("$:/config/SaveWikiButton/Template", "$:/core/save/all").trim();
        return $tw.wiki.renderTiddler("text/plain", saveTemplate);
    });

    expect(rendered).toContain("$:/config/inplace-upgrade/core-url");
    expect(rendered).toContain("https://cdn.example.com/tiddlywikicore-5.3.2.js");
    expect(rendered).toContain("\\u003cscript>alert('x')\\u003c/script>");
});
