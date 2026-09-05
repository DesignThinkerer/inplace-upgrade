/*\
title: $:/plugins/theophile.dev/inplace-upgrade/action-upgradewiki.js
type: application/javascript
module-type: widget

Action widget to perform core update via empty.html injection.
\*/
"use strict";

const { widget: Widget } = require("$:/core/modules/widgets/widget.js");

const DEFAULT_FILTER = "[all[tiddlers]] -[prefix[$:/core]] -[prefix[$:/boot/]] -[prefix[$:/temp/]] -[prefix[$:/state/]] -[prefix[$:/HistoryList]] -[prefix[$:/StoryList]] -[[$:/config/SaveWikiButton/Template]]";
const UPGRADE_STATE_TIDDLER = "$:/state/inplace-upgrade/status";
const STORE_SELECTOR = "script.tiddlywiki-tiddler-store";
const CORE_SELECTOR = 'script[src*="tiddlywikicore"]';
const SAVE_NOTIFICATION_TITLE = "$:/language/Notifications/Save/Done";
const SAVE_COMPLETION_TIMEOUT_MS = 20000;
const URLConstructor = typeof URL === "undefined" ? require("url").URL : URL;

function sanitizeJsonForScriptTag(jsonString) {
    return jsonString.replace(/</g, "\\u003c");
}

function sanitizeSiteTitle(siteTitle) {
    const siteTitleText = siteTitle === undefined || siteTitle === null ? "wiki" : siteTitle;
    return siteTitleText.trim().replace(/[/\\?%*:|"<>]/g, "-") || "tiddlywiki";
}

function resolveCoreUrl(targetUrl, coreSource, baseUri) {
    const targetUrlObject = new URLConstructor(targetUrl, baseUri);
    return new URLConstructor(coreSource, targetUrlObject).href;
}

class InplaceUpgradeWidget extends Widget {
    render(parent) {
        this.computeAttributes();
        this.execute();
        this.parentDomNode = parent;
        // Nested content is ignored
    }

    execute() {
        this.targetUrl = this.getAttribute("targetUrl");
        this.filter = this.getAttribute("filter", DEFAULT_FILTER);
        this.autoBackup = this.getAttribute("autoBackup", "yes") !== "no";
        this.statusTiddler = this.getAttribute("statusTiddler", "$:/temp/inplace-upgrade/status");
    }

    // Attribute changes only update cached action state.
    refresh(changedTiddlers) {
        if (Object.keys(this.computeAttributes()).length) {
            this.execute();
        }
        return this.refreshChildren(changedTiddlers);
    }

    getSaveTemplate() {
        return $tw.wiki.getTiddlerText(
            "$:/config/SaveWikiButton/Template",
            "$:/core/save/all"
        ).trim();
    }

    invokeAction() {
        if (!$tw.browser) {
            console.warn("The inplace-upgrade widget only runs in the browser.");
            return true;
        }
        const { targetUrl, filter, autoBackup } = this;

        if (!targetUrl) {
            this.setStatus("Error: Target URL is required.", true, false);
            return true;
        }

        const upgradeState = $tw.wiki.getTiddlerText(UPGRADE_STATE_TIDDLER);
        if (upgradeState === "running") {
            this.setStatus("Upgrade already in progress.", false, true);
            return true;
        }
        if (upgradeState === "reload-required") {
            this.setStatus("Wiki upgraded! Wait for the save to complete, then {{$:/core/ui/Buttons/refresh}}", false, false);
            return true;
        }

        // Explicit, unavoidable confirmation before any destructive action is taken.
        // If the user has disabled the automatic backup, make the risk of proceeding
        // without one very explicit rather than letting a single unconfirmed checkbox
        // silently skip the safety net.
        const confirmMessage = autoBackup
            ? "This will download a safety backup, then attempt to rewrite your wiki's core in place.\n\nContinue?"
            : "Automatic backup is DISABLED. If this upgrade fails or corrupts your save, you may lose data with no way to recover it.\n\nAre you sure you want to continue WITHOUT a backup?";
        if (!confirm(confirmMessage)) {
            this.setStatus("Upgrade cancelled by user.", false, false);
            return true;
        }

        $tw.wiki.addTiddler(new $tw.Tiddler({
            title: UPGRADE_STATE_TIDDLER,
            text: "running"
        }));
        this.setStatus("Starting upgrade pipeline...", false, true);

        // invokeAction is synchronous and expects a boolean.
        (async () => {
            try {
                // 1. Back up tiddlers before upgrade. This step is mandatory whenever
                // autoBackup is enabled: any failure here aborts the whole upgrade
                // rather than silently proceeding without a safety net.
                if (autoBackup) {
                    this.setStatus("Step 1/6: Downloading HTML safety backup...", false, true);
                    try {
                        this.downloadBackup();
                    } catch (error) {
                        throw new Error(`backup could not start: ${error.message}`);
                    }
                }

                // 2. Fetch the selected empty.html.
                this.setStatus("Step 2/6: Fetching target empty.html...", false, true);
                let response;
                const fetchController = new AbortController();
                const fetchTimeoutId = setTimeout(() => fetchController.abort(), 15000);
                try {
                    response = await fetch(targetUrl, { cache: "no-cache", signal: fetchController.signal });
                } catch (error) {
                    throw new Error(
                        error.name === "AbortError"
                            ? "Timed out fetching target (15s). Check the URL and your network connection."
                            : "Network/CORS error fetching target. If running locally (file://), use a relative path or local server."
                    );
                } finally {
                    clearTimeout(fetchTimeoutId);
                }

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status} (${response.statusText}) fetching target container.`);
                }
                const targetHtml = await response.text();

                // Parse the fetched shell as a DOM document
                const targetDoc = new DOMParser().parseFromString(targetHtml, "text/html");

                const storeNodes = targetDoc.querySelectorAll(STORE_SELECTOR);

                if (storeNodes.length === 0) {
                    throw new Error("The target URL is not a compatible TiddlyWiki HTML file (no tiddler store found).");
                }

                // 3. Analyze the external core and prepare configuration.
                this.setStatus("Step 3/6: Analyzing core and extracting data...", false, true);
                const coreScriptNodes = targetDoc.querySelectorAll(CORE_SELECTOR);
                if (coreScriptNodes.length > 1) {
                    throw new Error("The target URL contains multiple core script references; unable to determine which one to update.");
                }
                const coreScriptNode = coreScriptNodes[0] || null;
                let coreUrl;
                let extraConfigs = [];

                if (coreScriptNode) {
                    coreUrl = resolveCoreUrl(targetUrl, coreScriptNode.getAttribute("src"), document.baseURI);

                    // The plugin's packaged coreURL macro reads this configuration tiddler.
                    extraConfigs = [{
                        title: "$:/config/inplace-upgrade/core-url",
                        url: coreUrl
                    }];
                }

                // 4. Assemble the target shell with the current source tiddlers.
                this.setStatus("Step 4/6: Assembling upgraded container...", false, true);
                const buildUpgradedHtml = () => {
                    // Work on a fresh clone so repeated saves before reload start from the fetched shell
                    const doc = targetDoc.cloneNode(true);
                    const clonedStoreNodes = doc.querySelectorAll(STORE_SELECTOR);
                    const storeNode = clonedStoreNodes[clonedStoreNodes.length - 1]; // Always target the last one
                    
                    const coreNode = coreScriptNode
                        ? doc.querySelectorAll(CORE_SELECTOR)[0]
                        : null;

                    let tiddlers;
                    try {
                        tiddlers = JSON.parse($tw.wiki.getTiddlersAsJson(filter).trim() || "[]");
                    } catch (error) {
                        throw new Error(`Failed to parse exported tiddlers as JSON: ${error.message}`);
                    }
                    const mergedTiddlers = extraConfigs.length
                        ? tiddlers.concat(extraConfigs)
                        : tiddlers;

                    const sanitizedJson = sanitizeJsonForScriptTag(JSON.stringify(mergedTiddlers));

                    const newStoreNode = doc.createElement("script");
                    newStoreNode.setAttribute("class", "tiddlywiki-tiddler-store");
                    newStoreNode.setAttribute("type", "application/json");
                    newStoreNode.textContent = sanitizedJson;

                    storeNode.insertAdjacentElement("afterend", newStoreNode);

                    if (coreNode && coreUrl) {
                        coreNode.setAttribute("src", coreUrl);
                    }

                    return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
                };

                // 5. Deliver the payload through the native saver, and actually wait
                // to find out whether it succeeded or failed before trusting it.
                this.setStatus("Step 5/6: Pushing to active saver...", false, true);

                const PAYLOAD_TITLE = "$:/temp/inplace-upgrade/payload";
                const getSaveTemplate = () => this.getSaveTemplate();
                const originalRenderTiddler = $tw.wiki.renderTiddler;

                // Until reload, normal saves retain the new shell and current tiddler changes.
                // The save template is re-read on every call (not captured once) so that
                // changing $:/config/SaveWikiButton/Template after the upgrade doesn't
                // silently stop interception.
                $tw.wiki.renderTiddler = function(...args) {
                    const [, templateTitle] = args;

                    return templateTitle === PAYLOAD_TITLE || templateTitle === getSaveTemplate()
                        ? buildUpgradedHtml()
                        : originalRenderTiddler.apply(this, args);
                };

                // Core's saver-handler signals outcome in exactly two ways we can
                // observe without modifying core: a success notification display,
                // or an alert() raised from its own error callback. Intercept both
                // temporarily so we can tell success from failure from "unknown/timeout".
                const waitForSaveOutcome = () => new Promise((resolve) => {
                    let settled = false;
                    const saveErrorPrefix = $tw.language.getString("Error/WhileSaving");
                    const originalNotifierDisplay = $tw.notifier.display;
                    const originalAlert = window.alert;

                    const cleanup = () => {
                        $tw.notifier.display = originalNotifierDisplay;
                        window.alert = originalAlert;
                        clearTimeout(timeoutId);
                    };
                    const settle = (outcome, detail) => {
                        if (settled) {
                            return;
                        }
                        settled = true;
                        cleanup();
                        resolve({ outcome, detail });
                    };

                    $tw.notifier.display = function(title, ...rest) {
                        if (title === SAVE_NOTIFICATION_TITLE) {
                            settle("success");
                        }
                        return originalNotifierDisplay.call(this, title, ...rest);
                    };

                    window.alert = function(message, ...rest) {
                        if (typeof message === "string" && saveErrorPrefix && message.indexOf(saveErrorPrefix) !== -1) {
                            settle("failure", message);
                            return undefined;
                        }
                        return originalAlert.call(this, message, ...rest);
                    };

                    const timeoutId = setTimeout(() => {
                        settle("unknown");
                    }, SAVE_COMPLETION_TIMEOUT_MS);
                });

                const outcomePromise = waitForSaveOutcome();

                try {
                    $tw.rootWidget.dispatchEvent({
                        type: "tm-save-wiki",
                        param: PAYLOAD_TITLE,
                        paramObject: {
                            type: "text/html"
                        }
                    });
                } catch (error) {
                    $tw.wiki.renderTiddler = originalRenderTiddler;
                    throw error;
                }

                this.setStatus("Step 6/6: Waiting for saver to confirm completion...", false, true);
                const { outcome, detail } = await outcomePromise;

                if (outcome === "failure") {
                    // Restore original renderTiddler: the save did not go through,
                    // so don't leave the wiki pointed at the upgraded shell.
                    $tw.wiki.renderTiddler = originalRenderTiddler;
                    throw new Error(`Saver reported a failure: ${detail || "unknown error"}. The upgrade was NOT applied — your original wiki is unchanged.`);
                }

                if (outcome === "unknown") {
                    // We can't confirm success (e.g. an async network saver that
                    // doesn't route through the core notification/alert path, or a
                    // download saver awaiting a file picker). Do not claim success;
                    // tell the user to verify manually before reloading.
                    $tw.wiki.addTiddler(new $tw.Tiddler({
                        title: UPGRADE_STATE_TIDDLER,
                        text: "unconfirmed"
                    }));
                    this.setStatus(
                        "Save outcome could not be confirmed automatically. Please verify the save genuinely completed (check your saver's own confirmation) BEFORE reloading. If you're confident it saved, {{$:/core/ui/Buttons/refresh}}",
                        false,
                        false
                    );
                    return;
                }

                // outcome === "success"
                $tw.wiki.addTiddler(new $tw.Tiddler({
                    title: UPGRADE_STATE_TIDDLER,
                    text: "reload-required"
                }));
                this.setStatus("Wiki upgraded and save confirmed! You may now {{$:/core/ui/Buttons/refresh}}", false, false);

            } catch (err) {
                console.error("In-place upgrade error:", err);
                this.setStatus(`Failed: ${err.message}`, true, false);
                alert(`Upgrade aborted:\n${err.message}`);
            } finally {
                if ($tw.wiki.checkTiddlerText(UPGRADE_STATE_TIDDLER, "running")) {
                    $tw.wiki.deleteTiddler(UPGRADE_STATE_TIDDLER);
                }
            }
        })();

        return true;
    }

    setStatus(message, isError, isRunning) {
        const existingTiddler = $tw.wiki.getTiddler(this.statusTiddler);
        $tw.wiki.addTiddler(new $tw.Tiddler(
            $tw.wiki.getCreationFields(),
            existingTiddler,
            {
                title: this.statusTiddler,
                text: message,
                "is-error": isError ? "yes" : "no",
                "is-running": isRunning ? "yes" : "no"
            },
            $tw.wiki.getModificationFields()
        ));
    }

    getSafeSiteTitle() {
        // Render the SiteTitle as text/plain to resolve transclusions and strip Wikitext formatting
        const renderedTitle = $tw.wiki.renderTiddler("text/plain", "$:/SiteTitle");
        
        // Fall back to "wiki" if the rendered result is empty
        return sanitizeSiteTitle(renderedTitle || "wiki");
    }

    downloadBackup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `${this.getSafeSiteTitle()}-backup-pre-upgrade-${timestamp}.html`;
        const backupHtml = $tw.wiki.renderTiddler("text/plain", this.getSaveTemplate());

        const blob = new Blob([backupHtml], { type: "text/html;charset=utf-8" });
        const downloadUrl = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
    }
}

exports["action-inplace-upgrade"] = InplaceUpgradeWidget;
exports.__testHelpers = {
    sanitizeJsonForScriptTag,
    sanitizeSiteTitle,
    resolveCoreUrl
};