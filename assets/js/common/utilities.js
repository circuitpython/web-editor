function timeout(callback, ms) {
    return Promise.race([callback(), sleep(ms).then(() => {throw Error("Timed Out");})]);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export {timeout, sleep};