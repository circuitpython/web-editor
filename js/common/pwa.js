export function registerPWA() {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
        return;
    }

    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch((error) => {
            console.warn("Unable to register service worker", error);
        });
    });
}
