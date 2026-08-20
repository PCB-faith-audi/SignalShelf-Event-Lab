import { Worker } from 'bullmq';
import dotenv from 'dotenv';
import crypto from 'node:crypto';

dotenv.config();

const webhookSecret = process.env.WEBHOOK_SECRET;

function generateWebhookSignature(payload) {
    return crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');
}

const worker = new Worker(
    'print-jobs',
    async job => {
        console.log('Worker processing print job:', job.data);

        const completion = {
            jobId: job.data.jobId,
            attendeeId: job.data.attendeeId,
            status: 'completed'
        };

        const payload = JSON.stringify(completion);
        const signature = generateWebhookSignature(payload);

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

        if (!response.ok) {
            throw new Error(
                `Webhook failed: ${response.status} ${result}`
            );
        }

        console.log(
            'Webhook completed:',
            response.status,
            result
        );

        return {
            status: 'CHECKED_IN',
            jobId: job.data.jobId,
            attendeeId: job.data.attendeeId
        };
    },
    {
        connection: {
            host: '127.0.0.1',
            port: 6379
        }
    }
);

worker.on('completed', job => {
    console.log(
        `BullMQ job ${job.id} completed successfully`
    );
});

worker.on('failed', (job, error) => {
    console.error(
        `BullMQ job ${job?.id} failed:`,
        error.message
    );
});

console.log('BullMQ printer worker is running');
