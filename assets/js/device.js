// Boot strap load everything from code.circuitpython.org
let SITE = "https://code.circuitpython.org";
if (location.hostname == "localhost" || location.hostname == "127.0.0.1") {
    // For development purposes
    SITE = `${location.protocol}//${location.host}`;
}

async function fetchLocation(location, options = {}) {
    let fetchOptions = {
        ...options
    };

    const response = await fetch(new URL(location, SITE), fetchOptions);

    if (!response.ok) {
        throw new Error(response.statusText);
    }

    return response.text();
}

function replaceAssetLinks(code) {
    code = code.replace(/(href|src|srcset)="(assets\/.*?)"/gmi, (all, a, b) => {
        return `${a}="${SITE}/${b}"`;
    });
    code = code.replace(/srcset="(.*? 1x)(,\n?\s*)(.*? 2x)(,\n?\s*)(.*? 3x)"/gmi, (all, a, b, c, d, e) => {
        return `srcset="${SITE}/${a}${b}${SITE}/${c}${d}${SITE}/${e}"`;
    });

    return code;
}

function getTitle(code) {
    let titleTag = code.match(/<title>(.*?)<\/title>/);
    if (titleTag) return titleTag[1];
    return null;
}

// Fetch the HTML and Replace any relative asset links with absolute links
let html = replaceAssetLinks(await fetchLocation("/"));
let title = getTitle(html);

// Put the HTML into the document
document.body.innerHTML = html;
if (title) document.title = title;

let scriptElements = Array.from(document.getElementsByTagName("script"));
function loadNextScript() {
    function getNextScript() {
        if (scriptElements.length == 0) {
            return null;
        }
        return scriptElements.shift();
    }

    let script = getNextScript();

    if (!script) {
        // Wait until above scripts have run, then trigger the window load
        document.dispatchEvent(new Event("DOMContentLoaded"));
        return;
    }

    // We're only running external scripts
    if (!script.src || !script.src.startsWith(SITE)) {
        loadNextScript();
    }
    // Create a replacement for it
    let newScript = document.createElement('script');
    newScript.src = script.src;
    newScript.onload = () => {
        loadNextScript();
    };
    if (script.type) {
        newScript.type = script.type;
    }

    // Remove the existing script from the DOM and Start the script
    script.parentNode.removeChild(script);
    document.documentElement.appendChild(newScript);
}

// Start loading the scripts
loadNextScript();