import express from 'express';
import dotenv from 'dotenv';
import { startPrinterVendor } from './printer-vendor.js';

dotenv.config();

const app = express();

app.use(express.json());

const printQueue = [];

app.post('/print-queue', (req, res) => {
    const { jobId, attendeeId } = req.body;

    if (!jobId || !attendeeId) {
        return res.status(400).json({
            error: 'Invalid print job'
        });
    }

    const job = {
        jobId,
        attendeeId
    };

    printQueue.push(job);

    console.log('Job added to vendor queue:', job);

    res.status(202).json({
        message: 'Print job accepted',
        jobId
    });
});

app.get('/print-queue', (req, res) => {
    res.json({
        queueLength: printQueue.length,
        jobs: printQueue
    });
});

app.listen(4000, () => {
    console.log('Mock badge-printer vendor is running on port 4000');

    startPrinterVendor(printQueue);
});