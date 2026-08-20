const printQueue = [];

export function publishPrintRequest(job) {
    printQueue.push(job);

    console.log('Print request published to queue:', job);

    return true;
}

export function getNextPrintJob() {
    return printQueue.shift();
}

export function getQueueLength() {
    return printQueue.length;
}