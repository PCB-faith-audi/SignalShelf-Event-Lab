import crypto from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

const webhookSecret = process.env.WEBHOOK_SECRET;

const MAX_RETRIES = 3;

function generateWebhookSignature(payload) {
    return crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');
}

async function sendPrintCompletion(job) {
    const completion = {
        jobId: job.jobId,
        attendeeId: job.attendeeId,
        status: 'completed'
    };

    const payload = JSON.stringify(completion);
    const signature = generateWebhookSignature(payload);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(
                'http://localhost:3000/webhooks/print-complete',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-webhook-signature': signature
                    },
                    body: payload
                }
            );

            const result = await response.text();

            console.log(
                `Webhook attempt ${attempt}/${MAX_RETRIES}:`,
                response.status,
                result
            );

            if (response.ok) {
                return true;
            }

        } catch (error) {
            console.error(
                `Webhook attempt ${attempt}/${MAX_RETRIES} failed:`,
                error.message
            );
        }

        if (attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    console.error(
        `Webhook delivery failed after ${MAX_RETRIES} attempts for job ${job.jobId}`
    );

    return false;
}

export function processPrintQueue(printQueue) {
    const job = printQueue.shift();

    if (!job) {
        return;
    }

    job.attempts = (job.attempts || 0) + 1;

    console.log('Printer vendor processing job:', job);

    setTimeout(async () => {
        console.log(
            `Badge printed for ${job.attendeeId}. Job ID: ${job.jobId}`
        );

        const success = await sendPrintCompletion(job);

        if (!success) {
            if (job.attempts < MAX_RETRIES) {
                console.log(
                    `Retrying job ${job.jobId}. Attempt ${job.attempts + 1}/${MAX_RETRIES}`
                );

                printQueue.push(job);
            } else {
                console.error(
                    `Job ${job.jobId} permanently failed after ${MAX_RETRIES} attempts`
                );
            }
        }
    }, 2000);
}

export function startPrinterVendor(printQueue) {
    console.log('Mock badge-printer vendor is running');

    setInterval(() => {
        processPrintQueue(printQueue);
    }, 1000);
}
