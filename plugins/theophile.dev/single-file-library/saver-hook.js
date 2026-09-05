/*\
tags: $:/tags/demo-only
module-type: startup
title: $:/plugins/theophile.dev/single-file-library/saver-hook.js
type: application/javascript
\*/

exports.name = "twplib-saver-hook";
exports.platforms = ["browser", "node"];
exports.after = ["startup"];
exports.before = ["commands"];
exports.synchronous = true;

exports.startup = () => {
    const { wiki } = $tw;
    const original = wiki.renderTiddler.bind(wiki);

    wiki.renderTiddler = function(outputType, templateTitle, ...rest) {
        const result = original(outputType, templateTitle, ...rest);

        const saveTemplate = (wiki.getTiddlerText(
            "$:/config/SaveWikiButton/Template",
            "$:/core/save/all"
        ) || "$:/core/save/all").trim();

        const saveTemplates = new Set([
            saveTemplate,
            "$:/core/save/all",
            "$:/core/save/offline-external-js",
            "$:/plugins/tiddlywiki/tiddlyweb/save/offline"
        ]);

        if (saveTemplates.has(templateTitle)) {
            try {
                return addLibraryData(result);
            } catch (e) {
                console.error("[twplib] saver hook failed:", e.message, e.stack);
            }
        }
        return result;
    };

    const endOfJsonString = (s, i) => {
        let j = i + 1;
        while (j < s.length) {
            if (s[j] === "\\") {
                j += 2;
                continue;
            }
            if (s[j] === "\"") {
                return j + 1;
            }
            j++;
        }
        return -1;
    };

    const endOfJsonObject = (s, i) => {
        let depth = 0;
        let j = i;
        while (j < s.length) {
            const c = s[j];
            if (c === "\"") {
                j = endOfJsonString(s, j);
                if (j < 0) {
                    return -1;
                }
                continue;
            }
            if (c === "{") {
                depth++;
            } else if (c === "}") {
                depth--;
                if (depth === 0) {
                    return j + 1;
                }
            }
            j++;
        }
        return -1;
    };

    // Walk the tiddler store and return the exact { ... } slices written by $jsontiddler.
    const locateStoreTiddlers = (html) => {
        const markerAt = html.indexOf("class=\"tiddlywiki-tiddler-store\"");
        if (markerAt === -1) {
            return [];
        }
        const arrayStart = html.indexOf("[", markerAt);
        const arrayEnd = html.indexOf("]</script>", arrayStart);
        if (arrayStart === -1 || arrayEnd === -1) {
            return [];
        }

        const out = [];
        let i = arrayStart + 1;
        while (i < arrayEnd) {
            const c = html[i];
            if (c <= " " || c === ",") {
                i++;
                continue;
            }
            if (c !== "{") {
                break;
            }
            const objEnd = endOfJsonObject(html, i);
            if (objEnd < 0) {
                break;
            }
            try {
                const fields = JSON.parse(html.slice(i, objEnd));
                if (fields && fields.title) {
                    out.push({
                        title: fields.title,
                        fields,
                        charStart: i,
                        charEnd: objEnd
                    });
                }
            } catch (e) {
                // Skip malformed objects rather than aborting the index.
                console.warn("Malformed JSON object in tiddler store:", e);
            }
            i = objEnd;
        }
        return out;
    };

    const addLibraryData = (html) => {
        const getUtf8ByteLength = (str, start, end) => {
            let len = 0;
            for (let i = start; i < end; i++) {
                const code = str.charCodeAt(i);
                if (code < 0x0080) {
                    len += 1;
                } else if (code < 0x0800) {
                    len += 2;
                } else if (code >= 0xD800 && code <= 0xDFFF) {
                    len += 4;
                    i++;
                } else {
                    len += 3;
                }
            }
            return len;
        };

        const getFullLength = (str) => getUtf8ByteLength(str, 0, str.length);

        const bootstrap = wiki.getTiddlerText(
            "$:/plugins/theophile.dev/single-file-library/bootstrap.js",
            ""
        );
        const headIdx = html.indexOf("<head");
        if (headIdx === -1) {
            return html;
        }

        const insertAt = html.indexOf(">", headIdx) + 1;
        const tag = `\n<script id="twplib-bootstrap">${bootstrap}</script>\n`;
        const tagByteLen = getFullLength(tag);

        const filterStr = "[[$:/plugins/theophile.dev/inplace-upgrade]]";
        const wanted = new Set(wiki.filterTiddlers(filterStr));
        const cacheHash = String(Date.now()).padStart(13, "0");

        const writeIndex = (indexJson) => {
            const scriptOpen = `\n<script type="application/json">\n`;
            const scriptClose = `\n</script>`;
            const htmlByteLen = getFullLength(html) + tagByteLen;
            const indexStart = htmlByteLen + getFullLength(scriptOpen);
            const indexEnd = indexStart + getFullLength(indexJson) - 1;
            const modifiedTag = tag
                .replace("0000000000", String(indexStart).padStart(10, "0"))
                .replace("0000000000", String(indexEnd).padStart(10, "0"))
                .replace("0000000000000", cacheHash);
            return `${html.slice(0, insertAt)}${modifiedTag}${html.slice(insertAt)}${scriptOpen}${indexJson}${scriptClose}`;
        };

        const emptyIndex = () => writeIndex(JSON.stringify({ version: 1, keys: [], data: [] }));

        if (wanted.size === 0) {
            return emptyIndex();
        }

        const pluginData = {};
        const charRanges = [];
        for (const item of locateStoreTiddlers(html)) {
            if (!wanted.has(item.title)) {
                continue;
            }
            pluginData[item.title] = { fields: item.fields };
            charRanges.push({
                title: item.title,
                charStart: item.charStart,
                charEnd: item.charEnd
            });
        }

        if (charRanges.length === 0) {
            return emptyIndex();
        }

        const points = [...new Set([
            0,
            ...charRanges.flatMap((r) => [r.charStart, r.charEnd]),
            html.length
        ])].sort((a, b) => a - b);

        const charToByte = {};
        let prevChar = 0;
        let prevByte = 0;
        for (const pos of points) {
            prevByte += getUtf8ByteLength(html, prevChar, pos);
            prevChar = pos;
            charToByte[pos] = prevByte;
        }

        const rows = charRanges.map((r) => {
            const shiftStart = r.charStart >= insertAt ? tagByteLen : 0;
            const shiftEnd = r.charEnd >= insertAt ? tagByteLen : 0;
            const restFields = { ...pluginData[r.title].fields };
            delete restFields.text;
            return {
                ...restFields,
                start: charToByte[r.charStart] + shiftStart,
                end: charToByte[r.charEnd] - 1 + shiftEnd
            };
        });

        const keys = [...new Set(rows.flatMap(Object.keys))];
        const data = rows.map((e) => keys.map((k) => e[k] ?? null));
        return writeIndex(JSON.stringify({ version: 1, keys, data }));
    };
};
