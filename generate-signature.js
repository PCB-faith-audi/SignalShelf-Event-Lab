import { createHmac } from 'node:crypto';

const secret = 'signalshelf_demo_secret';

const payload = JSON.stringify({
    event: 'resource.updated',
    resourceId: 'room-101',
    status: 'available'
});

const signature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

console.log('Payload:', payload);
console.log('Signature:', signature);
