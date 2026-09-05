tags: $:/tags/demo-only
title: $:/plugins/theophile.dev/single-file-library/bootstrap.js
type: application/javascript

(() => {
    if (!new URLSearchParams(location.search).has("twplib")) return;

    const targetUrl = location.origin + location.pathname;

    const handler = `
        const INDEX_START = '0000000000';
        const INDEX_END = '0000000000';
        const CACHE_HASH = '0000000000000';
        const T = ${JSON.stringify(targetUrl)};
        const _SK = \`twplib-idx:\${T}:\${CACHE_HASH}\`;
        
        let _i = null;

        try {
            for (const k of Object.keys(sessionStorage)) {
                if (k.startsWith(\`twplib-idx:\${T}\`) && k !== _SK) {
                    sessionStorage.removeItem(k);
                }
            }
        } catch (e) {}

        const fi = async () => {
            if (_i) return _i;

            try {
                const c = sessionStorage.getItem(_SK);
                if (c) {
                    const j = JSON.parse(c);
                    if (j?.data) {
                        _i = j;
                        return _i;
                    }
                    sessionStorage.removeItem(_SK);
                }
            } catch (e) {}

            const start = parseInt(INDEX_START, 10);
            const end = parseInt(INDEX_END, 10);
            
            const response = await fetch(T, { headers: { Range: \`bytes=\${start}-\${end}\` } });
            
            if (response.status !== 206) {
                throw new Error(\`Server does not support Range Requests (got \${response.status})\`);
            }
            
            const j = await response.json();
            
            try {
                sessionStorage.setItem(_SK, JSON.stringify(j));
            } catch (e) {}
            
            _i = j;
            return j;
        };

        const fp = (idx, title) => {
            const ti = idx.keys.indexOf('title');
            const row = idx.data.find(r => r[ti] === title);
            
            if (!row) return null;
            
            return idx.keys.reduce((acc, key, i) => {
                if (row[i] != null) acc[key] = row[i];
                return acc;
            }, {});
        };

        const tp = (idx) => {
            return idx.data.map(row => 
                idx.keys.reduce((acc, key, i) => {
                    if (row[i] != null) acc[key] = row[i];
                    return acc;
                }, {})
            );
        };

        const sr = (e, status, body) => {
            if (!e.source) return;
            e.source.postMessage({
                verb: 'GET-RESPONSE',
                status: String(status),
                cookies: e.data.cookies,
                url: e.data.url,
                type: status === 200 ? 'application/json' : 'text/plain',
                body
            }, '*');
        };

        window.addEventListener('message', async (e) => {
            if (e.data?.verb !== 'GET') return;
            
            const u = e.data.url || '';
            
            if (u === 'recipes/library/tiddlers.json') {
                const idx = await fi();
                sr(e, 200, JSON.stringify(tp(idx)));
                
            } else if (u.startsWith('recipes/library/tiddlers/')) {
                let enc = u.slice(25);
                if (enc.endsWith('.json')) enc = enc.slice(0, -5);
                
                const title = decodeURIComponent(enc);
                const idx = await fi();
                const p = fp(idx, title);
                
                if (!p) return sr(e, 404, 'Not found');
                
                const response = await fetch(T, { headers: { Range: \`bytes=\${p.start}-\${p.end}\` } });
                const body = await response.text();
                
                sr(e, 200, body);
            } else {
                sr(e, 404, 'Not found');
            }
        });

        fi();
        parent.postMessage({ verb: 'TWPLIB-READY' }, '*');
    `;

    const blobHtml = `<meta charset="utf-8"><script>\n${handler}\n<${"/"}script>`;

    window.stop();
    window.location.replace(URL.createObjectURL(
        new Blob([blobHtml], { type: "text/html" })
    ));
})();
