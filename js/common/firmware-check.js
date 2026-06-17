// Helpers for comparing CircuitPython firmware versions and surfacing
// "newer firmware available" suggestions in the UI.
//
// CircuitPython release tags follow a SemVer-ish form, e.g.:
//   9.2.8                stable
//   10.0.0-alpha.1       development pre-release
//   10.0.0-beta.0
//   10.0.0-rc.0
//
// We parse the version into a tuple we can compare numerically and use the
// GitHub releases API for adafruit/circuitpython to find the latest stable
// and the latest dev (prerelease) versions. Per-board availability is left
// to the linked board page on circuitpython.org, which only lists builds
// that actually exist for that board.
//
// See https://github.com/circuitpython/web-editor/issues/357

const RELEASES_API = "https://api.github.com/repos/adafruit/circuitpython/releases";

// Cache the API result for the lifetime of the page so opening the device
// info dialog repeatedly doesn't hammer the API.
let _releasesPromise = null;

// Pre-release identifier ranking. Lower number = earlier in the release cycle.
// Anything not listed (or an empty pre-release section) is treated as a final
// stable release and ranks highest within the same X.Y.Z.
const PRERELEASE_RANK = {
    "alpha": 0,
    "beta": 1,
    "rc": 2,
};

// Parse a version string like "9.2.8", "10.0.0-alpha.1", or "10.0.0-rc.0"
// into a comparable structure. Returns null if it can't be parsed.
function parseVersion(versionString) {
    if (typeof versionString !== "string") return null;
    // Trim a leading "v" and any trailing build metadata after "+"
    let raw = versionString.trim().replace(/^v/i, "").split("+", 1)[0];
    // Tolerate "-dirty" suffix on builds compiled from a working tree
    raw = raw.replace(/-dirty$/i, "");
    const match = raw.match(/^(\d+)\.(\d+)\.(\d+)(?:[-.]([A-Za-z]+)\.?(\d+)?)?$/);
    if (!match) return null;

    const [, maj, min, patch, preLabel, preNum] = match;
    let preRank = Number.POSITIVE_INFINITY; // stable releases rank above any pre-release
    let preNumber = 0;
    let isPrerelease = false;
    if (preLabel) {
        isPrerelease = true;
        const label = preLabel.toLowerCase();
        preRank = label in PRERELEASE_RANK ? PRERELEASE_RANK[label] : -1;
        preNumber = preNum ? parseInt(preNum, 10) : 0;
    }
    return {
        raw: versionString,
        major: parseInt(maj, 10),
        minor: parseInt(min, 10),
        patch: parseInt(patch, 10),
        prerelease: isPrerelease,
        preRank,
        preNumber,
    };
}

// Compare two parsed versions. Returns negative if a < b, positive if a > b, 0 if equal.
function compareVersions(a, b) {
    if (!a && !b) return 0;
    if (!a) return -1;
    if (!b) return 1;
    if (a.major !== b.major) return a.major - b.major;
    if (a.minor !== b.minor) return a.minor - b.minor;
    if (a.patch !== b.patch) return a.patch - b.patch;
    if (a.preRank !== b.preRank) return a.preRank - b.preRank;
    return a.preNumber - b.preNumber;
}

// Fetch (and cache) the list of CircuitPython releases from GitHub and pick
// the highest stable + highest dev pre-release. Returns
// { stable: parsedVersion|null, dev: parsedVersion|null }.
async function fetchLatestReleases() {
    if (_releasesPromise) return _releasesPromise;

    _releasesPromise = (async () => {
        let response;
        try {
            response = await fetch(`${RELEASES_API}?per_page=30`, {
                headers: {"Accept": "application/vnd.github+json"},
            });
        } catch (err) {
            console.warn("Firmware check: fetch failed", err);
            return {stable: null, dev: null};
        }
        if (!response.ok) {
            console.warn("Firmware check: GitHub API returned", response.status);
            return {stable: null, dev: null};
        }
        let releases;
        try {
            releases = await response.json();
        } catch (err) {
            console.warn("Firmware check: bad JSON from GitHub", err);
            return {stable: null, dev: null};
        }

        let stable = null;
        let dev = null;
        for (const release of releases) {
            if (release.draft) continue;
            const parsed = parseVersion(release.tag_name);
            if (!parsed) continue;
            if (release.prerelease || parsed.prerelease) {
                if (compareVersions(parsed, dev) > 0) dev = parsed;
            } else {
                if (compareVersions(parsed, stable) > 0) stable = parsed;
            }
        }
        return {stable, dev};
    })();

    return _releasesPromise;
}

// Decide which (if any) firmware suggestions to surface for a device that
// is currently running `currentVersionString`. Implements the logic from
// https://github.com/circuitpython/web-editor/issues/357:
//
// - If the user is running a development release:
//   - Suggest the latest stable if it is newer.
//   - Suggest the latest dev release if it is newer than what they're running.
// - If the user is running a stable release:
//   - Suggest a newer stable, if any.
//   - Suggest a newer dev release, if any.
//
// Returns { suggestions: [{type: "stable"|"dev", version: "10.0.0"}], current }.
function buildSuggestions(currentVersionString, latestReleases) {
    const current = parseVersion(currentVersionString);
    const suggestions = [];
    if (!current || !latestReleases) {
        return {suggestions, current};
    }
    const {stable, dev} = latestReleases;

    if (stable && compareVersions(stable, current) > 0) {
        suggestions.push({type: "stable", version: stable.raw});
    }
    if (dev && compareVersions(dev, current) > 0) {
        suggestions.push({type: "dev", version: dev.raw});
    }
    return {suggestions, current};
}

// Format suggestions as a small HTML snippet suitable for injecting into a
// device info table. `boardId` is used to deep-link to the board's download
// page on circuitpython.org. Returns an empty string when there is nothing
// to suggest.
function renderSuggestionsHtml(suggestions, boardId) {
    if (!suggestions || suggestions.length === 0) return "";
    const safeBoard = encodeURIComponent(boardId || "");
    const link = safeBoard
        ? `https://circuitpython.org/board/${safeBoard}/`
        : "https://circuitpython.org/downloads";
    const items = suggestions.map((s) => {
        const label = s.type === "dev" ? "development release" : "stable release";
        return `<li>Newer ${label} available: <strong>${s.version}</strong></li>`;
    }).join("");
    return (
        `<div class="firmware-update-suggestion">` +
        `<i class="fa-solid fa-circle-info"></i> ` +
        `<span class="firmware-update-suggestion__title">Update available</span>` +
        `<ul>${items}</ul>` +
        `<a href="${link}" target="_blank" rel="noopener">Download from circuitpython.org</a>` +
        `</div>`
    );
}

// Convenience: fetch latest releases, compute suggestions for the given
// device version + board, and (if any) render them into `containerElement`.
// Failures are non-fatal -- nothing is rendered if the API call fails or the
// version string can't be parsed.
async function renderFirmwareSuggestions(containerElement, deviceInfo) {
    if (!containerElement || !deviceInfo) return;
    try {
        const latest = await fetchLatestReleases();
        const {suggestions} = buildSuggestions(deviceInfo.version, latest);
        const html = renderSuggestionsHtml(suggestions, deviceInfo.board_id);
        containerElement.innerHTML = html;
    } catch (err) {
        console.warn("Firmware check failed", err);
        containerElement.innerHTML = "";
    }
}

export {
    parseVersion,
    compareVersions,
    fetchLatestReleases,
    buildSuggestions,
    renderSuggestionsHtml,
    renderFirmwareSuggestions,
};
