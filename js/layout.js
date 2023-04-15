import state from './state.js'

const btnModeEditor = document.getElementById('btn-mode-editor');
const btnModeSerial = document.getElementById('btn-mode-serial');

export const mainContent = document.getElementById('main-content');
const editorPage = document.getElementById('editor-page');
const serialPage = document.getElementById('serial-page');
const pageSeparator = document.getElementById('page-separator');

btnModeEditor.addEventListener('click', async function (e) {
    if (btnModeEditor.classList.contains('active') && !btnModeSerial.classList.contains('active')) {
        // this would cause both editor & serial pages to disappear
        return;
    }
    btnModeEditor.classList.toggle('active');
    editorPage.classList.toggle('active')
    updatePageLayout(true, false);
});

btnModeSerial.addEventListener('click', async function (e) {
    if (btnModeSerial.classList.contains('active') && !btnModeEditor.classList.contains('active')) {
        // this would cause both editor & serial pages to disappear
        return;
    }
    btnModeSerial.classList.toggle('active');
    serialPage.classList.toggle('active')
    updatePageLayout(false, true);
});

function updatePageLayout(editor = false, serial = false) {
    if (editorPage.classList.contains('active') && serialPage.classList.contains('active')) {
        pageSeparator.classList.add('active');
    } else {
        pageSeparator.classList.remove('active');
        editorPage.style.width = null;
        editorPage.style.flex = null;
        serialPage.style.width = null;
        serialPage.style.flex = null;
        return;
    }

    if (mainContent.offsetWidth < 768) {
        if (editor) {
            btnModeSerial.classList.remove('active');
            serialPage.classList.remove('active');
        } else if (serial) {
            btnModeEditor.classList.remove('active');
            editorPage.classList.remove('active');
        }
        pageSeparator.classList.remove('active');
    } else {
        let w = mainContent.offsetWidth;
        let s = pageSeparator.offsetWidth;
        editorPage.style.width = ((w - s) / 2) + 'px';
        editorPage.style.flex = '0 0 auto';
        serialPage.style.width = ((w - s) / 2) + 'px';
        serialPage.style.flex = '0 0 auto';
    }

    if (serial) {
        refitTerminal();
    }
}

export function showEditor() {
    btnModeEditor.classList.add('active');
    editorPage.classList.add('active');
    updatePageLayout(true, false);
}

export function showSerial() {
    btnModeSerial.classList.add('active');
    serialPage.classList.add('active');
    updatePageLayout(false, true);
}

function refitTerminal() {
    // Re-fitting the terminal requires a full re-layout of the DOM which can be tricky to time right.
    // see https://www.macarthur.me/posts/when-dom-updates-appear-to-be-asynchronous
    window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                if (state.fitter) {
                    state.fitter.fit();
                }
            });
        });
    });
}

function fixViewportHeight() {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    refitTerminal();
}
fixViewportHeight();
window.addEventListener("resize", fixViewportHeight);

function resize(e) {
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

function stopResize(e) {
    window.removeEventListener('mousemove', resize, false);
    window.removeEventListener('mouseup', stopResize, false);
}

pageSeparator.addEventListener('mousedown', async function (e) {
    window.addEventListener('mousemove', resize, false);
    window.addEventListener('mouseup', stopResize, false);
});
