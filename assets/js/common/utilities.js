function timeout(callback, ms) {
    return Promise.race([callback(), sleep(ms).then(() => {throw Error("Timed Out");})]);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isTestHost() {
    return location.hostname == "localhost" || location.hostname == "127.0.0.1";
}

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

function isMdns() {
    // Check for cpy-XXXXXX.local (and optionally cpy-XXXXXX-###.local for mDNS name resolution)
    return location.hostname.search(/cpy-[0-9a-f]{6}(?:-[0-9]+)?.local/gi) == 0;
}

function isIp() {
    return location.hostname.search(/([0-9]{1,3}.){4}/gi) == 0;
}

function isLocal() {
    return (isMdns() || location.hostname == "localhost" || isIp()) && (location.pathname == "/code/");
}

function getUrlParams() {
    // This should look for and validate very specific values
    var hashParams = {};
    if (location.hash) {
        location.hash.substr(1).split("&").forEach(function(item) {hashParams[item.split("=")[0]] = item.split("=")[1];});
    }
    return hashParams;
}

function getUrlParam(name) {
    let urlParams = getUrlParams();
    if (name in urlParams) {
        return urlParams[name];
    }

    return null;
}

function regexEscape(regexString) {
    return regexString.replace(/\\/, "\\\\");
}

function switchUrl(url, documentState) {
    let server = makeUrl(url, {
        state: encodeURIComponent(JSON.stringify(documentState))
    });
    let oldHost = window.location.host;
    let oldPath = window.location.pathname;
    window.onbeforeunload = () => {};
    window.location.href = server;
    let serverUrl = new URL(server);
    if (serverUrl.host == oldHost && serverUrl.pathname == oldPath) {
        window.location.reload();
    }
}

function switchDevice(deviceHost, documentState) {
    switchUrl(`http://${deviceHost}/code/`, documentState);
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
    regexEscape,
    switchUrl,
    switchDevice
};