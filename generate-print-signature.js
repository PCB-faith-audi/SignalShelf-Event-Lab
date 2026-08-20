import crypto from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

const jobId = process.argv[2];
const attendeeId = process.argv[3];

if (!jobId || !attendeeId) {
    console.error(
        'Usage: node generate-print-signature.js <jobId> <attendeeId>'
    );
    process.exit(1);
}

const payload = JSON.stringify({
    jobId,
    attendeeId,
    status: 'completed'
});

const signature = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

console.log('Payload:', payload);
console.log('Signature:', signature);
