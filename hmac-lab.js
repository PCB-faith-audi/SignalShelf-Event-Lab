import { createHmac } from 'node:crypto';

const secret = 'signalshelf_demo_secret';
const message = 'resource.updated:room-101:available';

const signature = createHmac('sha256', secret)
    .update(message)
    .digest('hex');

console.log('Message:', message);
console.log('Signature:', signature);