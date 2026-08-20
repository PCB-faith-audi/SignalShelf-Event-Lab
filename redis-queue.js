import { Queue } from 'bullmq';

const printQueue = new Queue('print-jobs', {
    connection: {
        host: '127.0.0.1',
        port: 6379
    }
});

export async function addPrintJob(job) {
    const queuedJob = await printQueue.add(
        'print-badge',
        job,
        {
            attempts: 3,
            backoff: {
                type: 'fixed',
                delay: 1000
            },
            removeOnComplete: true,
            removeOnFail: false
        }
    );

    console.log(
        'BullMQ print job queued:',
        queuedJob.id,
        job
    );

    return queuedJob;
}

export { printQueue };