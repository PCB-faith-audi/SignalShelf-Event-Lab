import express from 'express';

const app = express();
const resources = {};

app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello SignalShelf');
});

app.post('/webhooks/resource-update', (req, res) => {
    console.log('Webhook received');
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
    
    console.log('Valid status update received');

    resources[resourceId] = status;

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

app.listen(3000,() => {
    console.log('SignalShelf server is running');
});