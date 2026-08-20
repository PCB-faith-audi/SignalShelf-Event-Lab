import crypto from 'node:crypto';

const secret = 'signalshelf_demo_secret';

const payload = JSON.stringify({
    jobId: '9097fe89-5307-4aee-8a1c-597dd75bd823',
    attendeeId: 'ATT-001',
    status: 'completed'
});

const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

console.log('Payload:', payload);
console.log('Signature:', signature);