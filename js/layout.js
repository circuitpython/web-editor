import state from './state.js'
import { loadSetting, saveSetting } from './common/utilities.js';

const btnModeEditor = document.getElementById('btn-mode-editor');
const btnModeSerial = document.getElementById('btn-mode-serial');

export const mainContent = document.getElementById('main-content');
const editorPage = document.getElementById('editor-page');
const serialPage = document.getElementById('serial-page');
const pageSeparator = document.getElementById('page-separator');

const SETTING_EDITOR_VISIBLE = "editor-visible";
const SETTING_TERMINAL_VISIBLE = "terminal-visible";

const UPDATE_TYPE_EDITOR = 1;
const UPDATE_TYPE_SERIAL = 2;

const MINIMUM_COLS = 2;
const MINIMUM_ROWS = 1;

function isEditorVisible() {
    return editorPage.classList.contains('active');
}

function isSerialVisible() {
    return serialPage.classList.contains('active');
}

async function toggleEditor() {
    if (isSerialVisible()) {
        editorPage.classList.toggle('active');
        saveSetting(SETTING_EDITOR_VISIBLE, isEditorVisible());
        updatePageLayout(UPDATE_TYPE_EDITOR);
    }
}

async function toggleSerial() {
    if (isEditorVisible()) {
        serialPage.classList.toggle('active');
        saveSetting(SETTING_TERMINAL_VISIBLE, isSerialVisible());
        updatePageLayout(UPDATE_TYPE_SERIAL);
    }
}

btnModeEditor.removeEventListener('click', toggleEditor);
btnModeEditor.addEventListener('click', toggleEditor);

btnModeSerial.removeEventListener('click', toggleSerial);
btnModeSerial.addEventListener('click', toggleSerial);

// Show the editor panel if hidden
export function showEditor() {
    editorPage.classList.add('active');
    updatePageLayout(UPDATE_TYPE_EDITOR);
}

// Show the serial panel if hidden
export function showSerial() {
    serialPage.classList.add('active');
    updatePageLayout(UPDATE_TYPE_SERIAL);
}

// update type is used to indicate which button was clicked
function updatePageLayout(updateType) {
    // If both are visible, show the separator
    if (isEditorVisible() && isSerialVisible()) {
        pageSeparator.classList.add('active');
    } else {
        pageSeparator.classList.remove('active');
        editorPage.style.width = null;
        editorPage.style.flex = null;
        serialPage.style.width = null;
        serialPage.style.flex = null;
        return;
    }

    // Mobile layout, so only show one or the other
    if (mainContent.offsetWidth < 768) {
        // Prioritize based on the update type
        if (updateType == UPDATE_TYPE_EDITOR && isEditorVisible()) {
            serialPage.classList.remove('active');
        } else if (updateType == UPDATE_TYPE_SERIAL && isSerialVisible()) {
            editorPage.classList.remove('active');
        }

        // Make sure the separator is hidden for mobile
        pageSeparator.classList.remove('active');
    } else {
        let w = mainContent.offsetWidth;
        let s = pageSeparator.offsetWidth;
        editorPage.style.width = ((w - s) / 2) + 'px';
        editorPage.style.flex = 'none';
        serialPage.style.width = ((w - s) / 2) + 'px';
        serialPage.style.flex = 'none';
    }

    // Match the button state to the panel state to avoid getting out of sync
    if (isEditorVisible()) {
        btnModeEditor.classList.add('active');
    } else {
        btnModeEditor.classList.remove('active');
    }

    if (isSerialVisible()) {
        btnModeSerial.classList.add('active');
    } else {
        btnModeSerial.classList.remove('active');
    }

    if (isSerialVisible()) {
        refitTerminal();
    }
}

function refitTerminal() {
    // Custom function to replace the terminal refit function as it was a bit buggy

    // Re-fitting the terminal requires a full re-layout of the DOM which can be tricky to time right.
    // see https://www.macarthur.me/posts/when-dom-updates-appear-to-be-asynchronous
    window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                const TERMINAL_ROW_HEIGHT = state.terminal._core._renderService.dimensions.css.cell.height;
                const TERMINAL_COL_WIDTH = state.terminal._core._renderService.dimensions.css.cell.width;

                // Get the height of the header, footer, and serial bar to determine the height of the terminal
                let siteHeader = document.getElementById('site-header');
                let mobileHeader = document.getElementById('mobile-header');
                let headerHeight = siteHeader.offsetHeight;
                if (siteHeader.style.display === 'none') {
                    headerHeight = mobileHeader.offsetHeight;
                }
                let foorterBarHeight = document.getElementById('footer-bar').offsetHeight;
                let serialBarHeight = document.getElementById('serial-bar').offsetHeight;
                let viewportHeight = window.innerHeight;
                let terminalHeight = viewportHeight - headerHeight - foorterBarHeight - serialBarHeight;
                let terminalWidth = document.getElementById('serial-page').offsetWidth;
                let screen = document.querySelector('.xterm-screen');
                if (screen) {
                    let cols = Math.floor(terminalWidth / TERMINAL_COL_WIDTH);
                    let rows = Math.floor(terminalHeight / TERMINAL_ROW_HEIGHT);
                    if (cols < MINIMUM_COLS) {
                        cols = MINIMUM_COLS;
                    }
                    if (rows < MINIMUM_ROWS) {
                        rows = MINIMUM_ROWS;
                    }
                    screen.style.width = (cols * TERMINAL_COL_WIDTH) + 'px';
                    screen.style.height = (rows * TERMINAL_ROW_HEIGHT) + 'px';
                }
            });
        });
    });
}

// Fix the viewport height for mobile devices by setting
// the --vh css variable to 1% of the window inner height
function fixViewportHeight(e) {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    updatePageLayout(UPDATE_TYPE_EDITOR);
}

// Resize the panes when the separator is moved
function resizePanels(e) {
    const w = mainContent.offsetWidth;
    const gap = pageSeparator.offsetWidth;
    const ratio = e.clientX / w;
    const hidingThreshold = 0.1;
    const minimumThreshold = 0.2;
    if (ratio < hidingThreshold) {
        editorPage.classList.remove('active');
        btnModeEditor.classList.remove('active');
        updatePageLayout();
        stopResize();
        return;
    } else if (ratio > 1 - hidingThreshold) {
        serialPage.classList.remove('active');
        btnModeSerial.classList.remove('active');
        updatePageLayout();
        stopResize();
        return;
    } else if (ratio < minimumThreshold || ratio > 1 - minimumThreshold) {
        return;
    }
    editorPage.style.width = (e.clientX - gap / 2) + 'px';
    serialPage.style.width = (w - e.clientX - gap / 2) + 'px';
}

// For the moment, we're going to just use this to keep track of the shown and hidden states
// of the terminal and editor (possibly plotter)
function loadPanelSettings() {
    // Load all saved settings or defaults
    // Update the terminal first
    if (loadSetting(SETTING_EDITOR_VISIBLE, true)) {
        editorPage.classList.add('active');
    } else {
        editorPage.classList.remove('active');
    }

    if (loadSetting(SETTING_TERMINAL_VISIBLE, false)) {
        serialPage.classList.add('active');
    } else {
        serialPage.classList.remove('active');
    }

    // Make sure at lest one is visible
    if (!isEditorVisible() && !isSerialVisible()) {
        editorPage.classList.add('active');
    }

    updatePageLayout(UPDATE_TYPE_SERIAL);
}

function stopResize(e) {
    window.removeEventListener('mousemove', resizePanels, false);
    window.removeEventListener('mouseup', stopResize, false);
}

pageSeparator.addEventListener('mousedown', async function (e) {
    window.addEventListener('mousemove', resizePanels, false);
    window.addEventListener('mouseup', stopResize, false);
});

fixViewportHeight();
window.addEventListener("resize", fixViewportHeight);
loadPanelSettings();