// Boot strap load everything from code.circuitpython.org
let SITE = "https://code.circuitpython.org"

async function fetchLocation(location, options = {}) {
    let fetchOptions = {
        ...options
    }

    const response = await fetch(new URL(location, SITE), fetchOptions);

    if (!response.ok) {
        throw new Error(response.statusText);
    }

    return response.text();
}

function replaceAssetLinks(code) {
    code = code.replace(/(href|src)="(assets\/.*?)"/gmi, (all, a, b) => {
        return `${a}="${SITE}/${b}"`
    });
    code = code.replace(/srcset="(.*? 1x)(,\n?\s+)(.*? 2x)(,\n?\s+)(.*? 3x)"/gmi, (all, a, b, c, d, e) => {
        return `srcset="${SITE}/${a}${b}${SITE}/${c}${d}${SITE}/${e}"`
    });

    return code;
}

// Fetch the HTML
let html = await fetchLocation("/");

// Replace any relative asset links with absolute links
html = replaceAssetLinks(await fetchLocation("/"));

// Put the HTML into the document
document.querySelector('html').innerHTML = html;

// Run the JavaScript somehow...


// This may require using stuff like jsdelivr or similar for codemirror so we aren't using npm