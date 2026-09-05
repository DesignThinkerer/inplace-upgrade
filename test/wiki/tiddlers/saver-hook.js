tags: $:/tags/demo-only
module-type: startup
title: $:/plugins/theophile.dev/single-file-library/saver-hook.js
type: application/javascript

exports.name = "twplib-saver-hook";
exports.platforms = ["browser", "node"];
exports.after = ["startup"];
exports.before = ["commands"];
exports.synchronous = true;

exports.startup = () => {
    const { wiki } = $tw;
    const original = wiki.renderTiddler.bind(wiki);

    // Using rest parameters to safely pass all arguments down
    wiki.renderTiddler = function(outputType, templateTitle, ...rest) {
        const result = original(outputType, templateTitle, ...rest);
        
        const templateContent = wiki.getTiddlerText(
            "$:/config/SaveWikiButton/Template",
            "$:/core/save/all"
        );
        const saveTemplate = (templateContent || "$:/core/save/all").trim();

        if (templateTitle === saveTemplate) {
            try {
                return addLibraryData(result);
            } catch (e) {
                console.error("[twplib] saver hook failed:", e.message, e.stack);
            }
        }
        return result;
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

        // 1. Prepare bootstrap tag, but DO NOT inject it into the HTML yet.
        const bootstrap = wiki.getTiddlerText(
            "$:/plugins/theophile.dev/single-file-library/bootstrap.js", 
            ""
        );
        const headIdx = html.indexOf("<head");
        if (headIdx === -1) return html;

        const insertAt = html.indexOf(">", headIdx) + 1;
        const tag = `\n<script id="twplib-bootstrap">${bootstrap}</script>\n`;
        const tagByteLen = getFullLength(tag);

        // 2. Get plugin titles from the assetList filter
        const filterStr = wiki.getTiddlerText(
            "$:/plugins/theophile.dev/single-file-library/assetList", 
            ""
        ).trim() || "[has[plugin-type]type[application/json]]";
        const titles = wiki.filterTiddlers(filterStr);

        // Generate a 13-character timestamp for cache busting
        const cacheHash = String(Date.now()).padStart(13, "0");

        // Build empty columnar index if no plugins match the filter
        if (titles.length === 0) {
            const empty = JSON.stringify({ version: 1, keys: [], data: [] });
            const scriptOpenEmpty = `\n<script type="application/json">\n`;
            const emptyStart = getFullLength(html) + tagByteLen + getFullLength(scriptOpenEmpty);
            const emptyEnd = emptyStart + getFullLength(empty) - 1;
            
            const modTagEmpty = tag
                .replace("0000000000", String(emptyStart).padStart(10, "0"))
                .replace("0000000000", String(emptyEnd).padStart(10, "0"))
                .replace("0000000000000", cacheHash);
            
            return `${html.slice(0, insertAt)}${modTagEmpty}${html.slice(insertAt)}${scriptOpenEmpty}${empty}\n</script>`;
        }

        // 3. For each plugin, compute its canonical JSON as written in the tiddler store
        const pluginData = {};
        for (const title of titles) {
            const tiddler = wiki.getTiddler(title);
            if (!tiddler) continue;
            
            const fields = tiddler.getFieldStrings();
            const json = JSON.stringify(fields).replace(/</g, "\\u003C");
            pluginData[title] = { json, fields };
        }

        // 4. Find the character position of each plugin in the ORIGINAL HTML
        const charRanges = [];
        const storeStart = Math.max(0, html.indexOf('class="tiddlywiki-tiddler-store"'));

        for (const [title, { json }] of Object.entries(pluginData)) {
            const idx = html.indexOf(json, storeStart);
            if (idx === -1) {
                console.warn("[twplib] plugin not found in store, skipping:", title);
                continue;
            }
            charRanges.push({ title, charStart: idx, charEnd: idx + json.length });
        }

        // 5. Convert character positions to UTF-8 byte positions (single pass)
        // flatMap and Set cleanly handle flattening and deduplicating the array
        const points = [...new Set([
            0, 
            ...charRanges.flatMap(r => [r.charStart, r.charEnd]), 
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

        // 6. Build columnar index
        const rows = charRanges.map(r => {
            const shiftStart = r.charStart >= insertAt ? tagByteLen : 0;
            const shiftEnd = r.charEnd >= insertAt ? tagByteLen : 0;

            const byteStart = charToByte[r.charStart] + shiftStart;
            const byteEnd = charToByte[r.charEnd] - 1 + shiftEnd;

            // Object destructuring isolates `text` so we can easily grab the rest of the fields
            const { text, ...restFields } = pluginData[r.title].fields;
            
            return {
                ...restFields,
                start: byteStart,
                end: byteEnd
            };
        });

        // Use Set & flatMap to extract all unique keys across all rows
        const keys = [...new Set(rows.flatMap(Object.keys))];

        // Nullish coalescing provides a clean fallback to `null` if the key doesn't exist
        const data = rows.map(e => keys.map(k => e[k] ?? null));

        const indexJson = JSON.stringify({ version: 1, keys, data });

        // 7. Calculate index offsets, modify bootstrap tag, and assemble output
        const scriptOpen = `\n<script type="application/json">\n`;
        const scriptClose = `\n</script>`;
        const htmlByteLen = charToByte[html.length] + tagByteLen;
        const indexStart = htmlByteLen + getFullLength(scriptOpen);
        const indexEnd = indexStart + getFullLength(indexJson) - 1;

        const modifiedTag = tag
            .replace("0000000000", String(indexStart).padStart(10, "0"))
            .replace("0000000000", String(indexEnd).padStart(10, "0"))
            .replace("0000000000000", cacheHash); // Inject cache hash
                            
        return `${html.slice(0, insertAt)}${modifiedTag}${html.slice(insertAt)}${scriptOpen}${indexJson}${scriptClose}`;
    };
};
