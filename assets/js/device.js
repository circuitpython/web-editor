// Boot strap load everything from code.circuitpython.org
//SITE = "https://code.circuitpython.org/"
SITE = "https://localhost:8080" // TODO: change this to the live site

async function fetchLocation(location, options = {}) {
    let fetchOptions = {
        ...options
    }

    const response = await fetch(new URL(location, SITE), fetchOptions);

    if (!response.ok) {
        throw new Error(response.statusText);
    }

    return response.text;
}

let html = await fetchLocation("/");

console.log(html);

// Strategy:
// Fetch the site page and replace the document contents with it (this may be tricky)?
// Change the relative links on the fly to prepend SITE
// This will likely require using stuff like jsdelivr or similar for codemirror so we aren't using npm