import { Queue } from 'bullmq';
import { redisConnection } from './redis-config.js';

const printQueue = new Queue('print-jobs', {
    connection: redisConnection
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

export async function closePrintQueue() {
    await printQueue.close();
}

export { printQueue };