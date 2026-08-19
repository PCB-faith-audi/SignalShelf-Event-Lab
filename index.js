import express from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import dotenv from 'dotenv';
import { startPolling } from './poller.js';

dotenv.config();

const app = express();
const resources = {};

const webhookSecret = process.env.WEBHOOK_SECRET;

function verifyWebhookSignature(payload, signature) {
    if (!signature || !webhookSecret) {
        return false;
    }

    const expectedSignature = createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const receivedBuffer = Buffer.from(signature, 'utf8');

    if (expectedBuffer.length !== receivedBuffer.length) {
        return false;
    }

    return timingSafeEqual(expectedBuffer, receivedBuffer);
}

app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

app.get('/', (req, res) => {
    res.send('Hello SignalShelf');
});

app.post('/webhooks/resource-update', (req, res) => {
    console.log('Webhook received');

    const signature = req.headers['x-webhook-signature'];

    if (!verifyWebhookSignature(req.rawBody, signature)) {
        console.log('Invalid webhook signature');
        return res.status(401).send('Invalid webhook signature');
    }

    console.log('Webhook signature verified');
    console.log('Request body:', req.body);

    const { event, resourceId, status } = req.body;

    if (
        event !== 'resource.updated' ||
        !resourceId ||
        !['available', 'occupied', 'maintenance'].includes(status)
    ) {
        console.log('Invalid resource update received');
        return res.status(400).send('Invalid resource update');
    }

    resources[resourceId] = status;

    console.log('Valid status update received');

    res.status(200).send('Webhook received');
});

app.get('/resources/:id', (req, res) => {

    const resourceId = req.params.id;
    const status = resources[resourceId];

    if (!status) {
        res.status(404).send('Resource not found');
        return;
    }

    res.send(status);

});

app.use((req, res) => {
    res.status(404).send('Not Found');
});

app.listen(3000, () => {
    console.log('SignalShelf server is running');
    startPolling(resources);
});