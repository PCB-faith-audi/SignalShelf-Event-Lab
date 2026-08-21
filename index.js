import express from 'express';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { attendees } from './attendees.js';
import { addPrintJob } from './redis-queue.js';

dotenv.config();

const app = express();

const webhookSecret = process.env.WEBHOOK_SECRET;

if (!webhookSecret) {
    throw new Error(
        'WEBHOOK_SECRET environment variable is required'
    );
}

function verifyWebhookSignature(payload, signature) {
    if (!signature || !webhookSecret) {
        return false;
    }

    const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const receivedBuffer = Buffer.from(signature, 'utf8');

    if (expectedBuffer.length !== receivedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

app.get('/', (req, res) => {
    res.send('Hello SignalShelf');
});

app.post('/check-in/:attendeeId', async (req, res) => {
    const attendeeId = req.params.attendeeId;
    const attendee = attendees[attendeeId];

    if (!attendee) {
        return res.status(404).json({
            error: 'Attendee not found'
        });
    }

    if (
        attendee.status === 'PENDING' ||
        attendee.status === 'CHECKED_IN'
    ) {
        return res.status(409).json({
            error: 'Attendee already has a check-in in progress or is already checked in',
            status: attendee.status
        });
    }

    const jobId = crypto.randomUUID();

    attendee.status = 'PENDING';
    attendee.jobId = jobId;

    try {
    await addPrintJob({
        jobId,
        attendeeId
    });
} catch (error) {
    console.error(
        'Failed to queue print job:',
        error.message
    );

    attendee.status = 'NOT_CHECKED_IN';
    attendee.jobId = null;

    return res.status(503).json({
        error: 'Unable to queue print request'
    });
}

    console.log(
        `Check-in request queued for ${attendeeId}. Job ID: ${jobId}`
    );

    return res.status(202).json({
        message: 'Print request queued',
        attendeeId,
        jobId,
        status: 'PENDING'
    });
});

app.get('/attendees/:attendeeId', (req, res) => {
    const attendee = attendees[req.params.attendeeId];

    if (!attendee) {
        return res.status(404).json({
            error: 'Attendee not found'
        });
    }

    res.json(attendee);
});

app.post('/webhooks/print-complete', (req, res) => {
        const signature = req.headers['x-webhook-signature'];

    if (!verifyWebhookSignature(req.rawBody, signature)) {
        return res.status(401).json({
            error: 'Invalid webhook signature'
        });
    }
    const { jobId, attendeeId, status } = req.body;

    if (!jobId || !attendeeId || status !== 'completed') {
        return res.status(400).json({
            error: 'Invalid print completion'
        });
    }

    const attendee = attendees[attendeeId];

    if (!attendee) {
        return res.status(404).json({
            error: 'Attendee not found'
        });
    }

    if (attendee.jobId !== jobId) {
        return res.status(409).json({
            error: 'Job does not match attendee'
        });
    }

    if (attendee.status === 'CHECKED_IN') {
    return res.status(200).json({
        message: 'Check-in already confirmed',
        attendeeId,
        jobId,
        status: 'CHECKED_IN'
    });
}

    attendee.status = 'CHECKED_IN';

    console.log(
        `Attendee ${attendeeId} checked in. Job ${jobId} completed.`
    );

    return res.status(200).json({
        message: 'Check-in confirmed',
        attendeeId,
        jobId,
        status: 'CHECKED_IN'
    });
});

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'signalshelf-event-lab',
        queue: 'bullmq',
        broker: 'redis'
    });
});

app.use((req, res) => {
    res.status(404).send('Not Found');
});

const server = app.listen(3000, () => {
    console.log('SignalShelf server is running');
});

async function shutdown(signal) {
    console.log(`\nReceived ${signal}. Shutting down API server...`);

    server.close(() => {
        console.log('HTTP server closed successfully');
        process.exit(0);
    });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));