import {sleep, isIp, switchDevice} from './utilities.js';
import * as focusTrap from 'focus-trap';

const SELECTOR_CLOSE_BUTTON = ".popup-modal__close";
const SELECTOR_BLACKOUT = "#blackout";
const SELECTOR_CLICKBLOCK = "#clickblock";
const BLACKOUT_ZINDEX = 1000;

var modalLayers = [];

class GenericModal {
    constructor(modalId) {
        this._modalId = modalId;
        this._currentModal = null;
        this._resolve = null;
        this._reject = null;
        this.closeModal = this._closeModal.bind(this);
        this._elements = {};
        this._modalLayerId;
        this._trap = null;
    }

    _addDialogElement(elementId, domElement, eventName = null, eventHandler = null) {
        if (elementId in this._elements) {
            this._removeDialogElement(elementId);
        }
        if (domElement) {
            let newElement = {
                element: domElement,
                event: eventName,
                handler: eventHandler ? eventHandler.bind(this) : null
            };
            if (newElement.handler && newElement.event) {
                newElement.element.addEventListener(newElement.event, newElement.handler);
            }
            this._elements[elementId] = newElement;
        }
    }

    _removeDialogElement(elementId) {
        if (!(elementId in this._elements)) {
            return false;
        }
        if (this._elements[elementId].handler && this._elements[elementId].event) {
            this._elements[elementId].element.removeEventListener(this._elements[elementId].event, this._elements[elementId].handler);
        }
        delete this._elements[elementId];
        return true;
    }

    _removeAllDialogElements() {
        let elementIdsToRemove = Object.keys(this._elements);
        for (const elementId of elementIdsToRemove) {
            this._removeDialogElement(elementId);
        }
    }

    _getElement(elementId) {
        if (elementId in this._elements) {
            return this._elements[elementId].element;
        }
        return null;
    }

    _setElementEnabled(elementId, enabled) {
        let element = this._getElement(elementId);
        if (!element) return;
        element.disabled = !enabled;
    }

    _setElementValue(elementId, value) {
        let element = this._getElement(elementId);
        if (!element) return;
        element.value = value;
    }

    _setElementHtml(elementId, value) {
        let element = this._getElement(elementId);
        if (!element) return;
        element.innerHTML = value;
    }

    async _showMessage(message) {
        const messageDialog = new MessageModal("message");
        return await messageDialog.open(message);
    }

    _addModalLayer(modal) {
        if (modalLayers < 1) {
            const bodyBlackout = document.querySelector(SELECTOR_BLACKOUT);
            if (bodyBlackout) {
                bodyBlackout.classList.add('is-blacked-out');
                bodyBlackout.style.zIndex = BLACKOUT_ZINDEX;
            }
            this._addDialogElement('bodyBlackout', bodyBlackout, 'click', this._closeModal);
            document.body.style.overflow = 'hidden';
            bodyBlackout.style.top = `${window.scrollY}px`;
        }

        modalLayers.push(this);
        this._modalLayerId = modalLayers.length;
        modal.style.zIndex = BLACKOUT_ZINDEX + 1 + (this._modalLayerId * 2);

        if (!this._trap && modal.dataset.tabbable !== "false"){
            this._trap = focusTrap.createFocusTrap(modal, {
                initialFocus: () => modal,
                allowOutsideClick: true,
            });
        }

        if (modalLayers.length >= 2) {
            // Then we will make it so the clickblock layer appears
            const clickBlock = document.querySelector(SELECTOR_CLICKBLOCK);
            if (clickBlock) {
                clickBlock.classList.add('is-blacked-out');
                clickBlock.style.zIndex = modal.style.zIndex - 1;
                // Remove any existing events from clickblock
                const topmostDialog = modalLayers[modalLayers.length - 2];
                clickBlock.removeEventListener("click", topmostDialog.close.bind(topmostDialog));
                if (modal.classList.contains("closable")) {
                    clickBlock.addEventListener("click", this.close.bind(this));
                }
            }
        }
        document.body.appendChild(modal);
    }

    _removeTopModalLayer() {
        const modal = modalLayers.pop();
        if (modalLayers.length < 1) {
            const bodyBlackout = document.querySelector(SELECTOR_BLACKOUT);
            if (bodyBlackout) {
                bodyBlackout.classList.remove('is-blacked-out');
                const scrollY = document.body.style.top;
                document.body.style.overflow = '';
                window.scrollTo(0, parseInt(scrollY || '0') * -1);
            }
        } else {
            const clickBlock = document.querySelector(SELECTOR_CLICKBLOCK);
            if (clickBlock) {
                if (modalLayers.length < 2) {
                    clickBlock.classList.remove('is-blacked-out');
                } else {
                    // Move click block just underneath topmost layer
                    clickBlock.style.zIndex = modalLayers[modalLayers.length - 1].style.zIndex - 1;
                    clickBlock.removeEventListener("click", this.close.bind(this));
                    // if the topmost modal has the closable class then:
                    if (modal.getModal().classList.contains("closable")) {
                        // Clickblock needs to have a click event added that will close the top most dialog
                        clickBlock.addEventListener("click", modal.close.bind(modal));
                    }
                }
            }
        }
        modal.getModal().remove();
    }

    _openModal() {
        const modal = document.querySelector(`[data-popup-modal="${this._modalId}"]`).cloneNode(true);
        if (!modal) {
            throw new Error(`Modal with ID "${this._modalId}" not found.`);
        }
        modal.classList.add('is--visible');
        this._addModalLayer(modal);
        const closeButton = modal.querySelector(SELECTOR_CLOSE_BUTTON);
        this._addDialogElement('closeButton', closeButton, 'click', this._closeModal);

        return modal;
    }

    _closeModal() {
        // If promise has not been resolved yet, resolve it with null
        if (this._resolve !== null) {
            this._resolve(null);
            this._resolve = null;
            this._reject = null;
        }

        if (this._currentModal) {
            if (this._trap) {
                this._trap.deactivate();
                this._trap = null;
            }
            this._removeTopModalLayer();
            this._removeAllDialogElements();
            this._currentModal.classList.remove('is--visible');
            this._currentModal = null;
        }
    }

    _returnValue(value) {
        this._resolve(value);
        this._resolve = null;
        this._reject = null;
        this._closeModal();
    }

    isOpen() {
        return this._currentModal !== null;
    }

    isVisible() {
        var style = window.getComputedStyle(this._currentModal);
        return style.display !== 'none';
    }

    close() {
        this._closeModal();
    }

    getModal() {
        if (this._currentModal) {
            return this._currentModal;
        }
        throw Error("Modal has not been opened yet. No instance available");
    }

    async open() {
        this._currentModal = this._openModal();

        let p = new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });

        if (this._trap) {
            this._trap.activate();
        }
        return p;
    }
}

class MessageModal extends GenericModal {
    async open(message) {
        let p = super.open();
        const okButton = this._currentModal.querySelector("button.ok-button");
        this._addDialogElement('okButton', okButton, 'click', this._closeModal);
        this._currentModal.querySelector("#message").innerHTML = message;

        return p;
    }
}

class InputModal extends GenericModal {
    _handleOkButton(event) {
        this._returnValue(this._getElement('inputValueField').value);
    }

    async open(message, defaultValue="") {
        let p = super.open();
        const cancelButton = this._currentModal.querySelector("button.cancel-button");
        this._addDialogElement('cancelButton', cancelButton, 'click', this._closeModal);
        const okButton = this._currentModal.querySelector("button.ok-button");
        this._addDialogElement('okButton', okButton, 'click', this._handleOkButton);
        const inputValueField = this._currentModal.querySelector("#inputvalue");
        this._addDialogElement('inputValueField', inputValueField);
        this._setElementValue('inputValueField', defaultValue);
        this._currentModal.querySelector("#message").innerHTML = message;

        return p;
    }
}

class ProgressDialog extends GenericModal {
    async open() {
        let p = super.open();
        while (!this.isVisible()) {
            await sleep(10);
        }
        this.setPercentage(0);
        return p;
    }

    setStatus(message) {
        this._currentModal.querySelector("#status").innerHTML = message;
    }

    setPercentage(percentage) {
        percentage = Math.round(percentage);
        this._currentModal.querySelector("#percentage").innerHTML = `${percentage}%`;
        this._currentModal.querySelector("progress").value = percentage / 100;
    }
}

class UnsavedDialog extends GenericModal {
    _handleSaveButton() {
        this._returnValue(true);
    }

    _handleDontSaveButton() {
        this._returnValue(false);
    }

    async open(message) {
        let p = super.open();
        const cancelButton = this._currentModal.querySelector("button.cancel-button");
        this._addDialogElement('cancelButton', cancelButton, 'click', this._closeModal);
        const saveButton = this._currentModal.querySelector("button.ok-button");
        this._addDialogElement('saveButton', saveButton, 'click', this._handleSaveButton);
        const dontSaveButton = this._currentModal.querySelector("button.not-ok-button");
        this._addDialogElement('dontSaveButton', dontSaveButton, 'click', this._handleDontSaveButton);
        this._currentModal.querySelector("#message").innerHTML = message;

        return p;
    }
}

// Returns the value of the clicked Button except cancel
// (This should eventually replace the UnsavedDialog and possibly the MessageModal)
class ButtonValueDialog extends GenericModal {
    _handleOtherButton(event) {
        let button = event.target;
        if (button.tagName.toLowerCase() !== 'button') {
            button = button.parentNode;
        }
        this._returnValue(button.value);
    }

    async open(message = null) {
        let p = super.open();
        let buttons = this._currentModal.querySelectorAll("button");
        buttons.forEach((button) => {
            if (button.classList.contains("cancel-button")) {
                this._addDialogElement('cancelButton', button, 'click', this._closeModal);
            } else {
                const buttonName = button.id.replace(/-([a-z])/g, (g) => {
                    return g[1].toUpperCase();
                }) + 'Button';
                this._addDialogElement(buttonName, button, 'click', this._handleOtherButton);
            }
        });

        const msgElement = this._currentModal.querySelector("#message");
        if (message && msgElement) {
            msgElement.innerHTML = message;
        }

        return p;
    }
}

class DiscoveryModal extends GenericModal {
    async _getVersionInfo() {
        const deviceInfo = await this._showBusy(this._fileHelper.versionInfo());
        this._currentModal.querySelector("#version").textContent = deviceInfo.version;
        const boardLink = this._currentModal.querySelector("#board");
        boardLink.href = `https://circuitpython.org/board/${deviceInfo.board_id}/`;
        boardLink.textContent = deviceInfo.board_name;
        const hostname = this._currentModal.querySelector("#hostname");
        let port = `${deviceInfo.port != 80 ? ':' + deviceInfo.port : ''}`;
        hostname.href = `http://${deviceInfo.hostname}.local${port}/code/`;
        hostname.textContent = deviceInfo.hostname;
        let ip = this._currentModal.querySelector("#ip");
        ip.href = `http://${deviceInfo.ip + port}/code/`;
        ip.textContent = deviceInfo.ip;
        this._currentModal.querySelector("#builddate").textContent = deviceInfo.build_date;
        this._currentModal.querySelector("#mcuname").textContent = deviceInfo.mcu_name;
        this._currentModal.querySelector("#boardid").textContent = deviceInfo.board_id;
        this._currentModal.querySelector("#uid").textContent = deviceInfo.uid;
    }

    async _refreshDevices() {
        const otherDevices = await this._showBusy(this._fileHelper.otherDevices());
        let newDevices = [];
        if (otherDevices.total == 0) {
            let span = document.createElement("span");
            span.textContent = "No other devices found.";
            newDevices.push(span);
        } else {
            for (let device of otherDevices.devices) {
                let a = document.createElement("a");
                let port = `${device.port != 80 ? ':' + device.port : ''}`;
                let server = isIp() ? device.ip : device.hostname + ".local";
                a.setAttribute("device-host", `${server}${port}`);
                a.addEventListener("click", (event) => {
                    let clickedItem = event.target;
                    if (clickedItem.tagName.toLowerCase() != "a") {
                        clickedItem = clickedItem.parentNode;
                    }
                    let deviceHost = clickedItem.getAttribute("device-host");
                    switchDevice(deviceHost, this._docState);
                });
                a.textContent = `${device.instance_name} (${device.hostname})`;
                newDevices.push(a);
            }
        }
        this._currentModal.querySelector("#devices").replaceChildren(...newDevices);
    }

    async open(workflow, documentState) {
        this._workflow = workflow;
        this._fileHelper = workflow.fileHelper;
        this._showBusy = workflow.showBusy.bind(workflow);
        this._docState = documentState;

        let p = super.open();
        const okButton = this._currentModal.querySelector("button.ok-button");
        this._addDialogElement('okButton', okButton, 'click', this._closeModal);

        const refreshIcon = this._currentModal.querySelector("i.refresh");
        this._addDialogElement('refreshIcon', refreshIcon, 'click', this._refreshDevices);

        await this._getVersionInfo();
        await this._refreshDevices();
        return p;
    }
}

class DeviceInfoModal extends GenericModal {
        async _getDeviceInfo() {
        const deviceInfo = await this._showBusy(this._fileHelper.versionInfo());
        this._currentModal.querySelector("#version").textContent = deviceInfo.version;
        const boardLink = this._currentModal.querySelector("#board");
        boardLink.href = `https://circuitpython.org/board/${deviceInfo.board_id}/`;
        boardLink.textContent = deviceInfo.board_name;
        this._currentModal.querySelector("#builddate").textContent = deviceInfo.build_date;
        this._currentModal.querySelector("#mcuname").textContent = deviceInfo.mcu_name;
        this._currentModal.querySelector("#boardid").textContent = deviceInfo.board_id;
        this._currentModal.querySelector("#uid").textContent = deviceInfo.uid;
    }

    async open(workflow, documentState) {
        this._workflow = workflow;
        this._fileHelper = workflow.fileHelper;
        this._showBusy = workflow.showBusy.bind(workflow);
        this._docState = documentState;

        let p = super.open();
        const okButton = this._currentModal.querySelector("button.ok-button");
        this._addDialogElement('okButton', okButton, 'click', this._closeModal);

        const refreshIcon = this._currentModal.querySelector("i.refresh");
        this._addDialogElement('refreshIcon', refreshIcon, 'click', this._refreshDevices);

        await this._getDeviceInfo();
        return p;
    }
}

export {
    GenericModal,
    MessageModal,
    ButtonValueDialog,
    UnsavedDialog,
    DiscoveryModal,
    ProgressDialog,
    DeviceInfoModal,
    InputModal
};