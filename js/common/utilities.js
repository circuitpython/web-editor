// Run the callback and if it doesn't complete in the given time, throw an error
function timeout(callback, ms) {
    return Promise.race([callback(), sleep(ms).then(() => {throw Error("Timed Out");})]);
}

// Sleep for the given number of milliseconds
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Check if the current host is a test host
function isTestHost() {
    return location.hostname == "localhost" || location.hostname == "127.0.0.1";
}

// Build a url hash from the given object parameters
function buildHash(hashParams) {
    let segments = [];
    for (const item in hashParams) {
        segments.push(`${item}=${hashParams[item]}`);
    }
    if (segments.length == 0) {
        return '';
    }

    return '#' + segments.join('&');
}

// Build a url from the given url and extra parameters object
function makeUrl(url, extraParams = {}) {
    let urlParams = {
        ...getUrlParams(),
        ...extraParams
    };
    let oldUrl = new URL(url);
    if (isTestHost()) {
        urlParams.host = oldUrl.hostname;
        return new URL(oldUrl.pathname, `http://${location.host}/`) + buildHash(urlParams);
    }

    return new URL(oldUrl) + buildHash(urlParams);
}

// Check if the current url is a valid CircuitPython Web Workflow local device name
function isMdns() {
    // Check for cpy-XXXXXX.local (and optionally cpy-XXXXXX-###.local for mDNS name resolution)
    return location.hostname.search(/cpy-[0-9a-f]{6}(?:-[0-9]+)?.local/gi) == 0;
}

// Check if the current url is an IP address
function isIp() {
    return location.hostname.search(/([0-9]{1,3}.){4}/gi) == 0;
}

// Check if the current url is a Web Workflow, IP, or Test Address and current path is /code/
function isLocal() {
    return (isMdns() || location.hostname == "localhost" || isIp()) && (location.pathname == "/code/");
}

// Parse out the url parameters from the current url
function getUrlParams() {
    // This should look for and validate very specific values
    var hashParams = {};
    if (location.hash) {
        location.hash.substr(1).split("&").forEach(function(item) {hashParams[item.split("=")[0]] = item.split("=")[1];});
    }
    return hashParams;
}

// Get a url parameter by name and optionally remove it from the current url in the process
function getUrlParam(name, remove = true) {
    let urlParams = getUrlParams();
    let paramValue = null;
    if (name in urlParams) {
        paramValue = urlParams[name];
        if (remove) {
            delete urlParams[name];
            let currentURL = new URL(window.location);
            currentURL.hash = buildHash(urlParams);
            window.history.replaceState({}, '', currentURL);
        }
    }

    return paramValue;
}

// Switch to a new url with the current document state and reload the page if the host and path are the same
function switchUrl(url, documentState, backend = null) {
    let params  ={state: encodeURIComponent(JSON.stringify(documentState))}
    if (backend) {
        params.backend = backend;
    }
    let server = makeUrl(url, params);
    let oldHost = window.location.host;
    let oldPath = window.location.pathname;
    window.onbeforeunload = () => {};
    window.location.href = server;
    let serverUrl = new URL(server);
    if (serverUrl.host == oldHost && serverUrl.pathname == oldPath) {
        window.location.reload();
    }
}

// Switch to a new device url with the current document state
function switchDevice(deviceHost, documentState) {
    switchUrl(`http://${deviceHost}/code/`, documentState);
}

// Return an uploaded file as an array buffer
function readUploadedFileAsArrayBuffer(inputFile) {
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
        reader.onerror = () => {
            reader.abort();
            reject(new DOMException("Problem parsing input file."));
        };

        reader.onload = () => {
            resolve(reader.result);
        };
        reader.readAsArrayBuffer(inputFile);
    });
};

// Load a setting from local storage with a default value if it doesn't exist
function loadSetting(setting, defaultValue) {
    let value = JSON.parse(window.localStorage.getItem(setting));
    console.log(`Loading setting ${setting} with value ${value}`);
    if (value == null) {
      return defaultValue;
    }

    return value;
}

// Save a setting to local storage
function saveSetting(setting, value) {
    console.log(`Saving setting ${setting} with value ${value}`);
    window.localStorage.setItem(setting, JSON.stringify(value));
}

export {
    isTestHost,
    buildHash,
    makeUrl,
    isMdns,
    isIp,
    isLocal,
    getUrlParams,
    getUrlParam,
    timeout,
    sleep,
    switchUrl,
    switchDevice,
    readUploadedFileAsArrayBuffer,
    loadSetting,
    saveSetting
};