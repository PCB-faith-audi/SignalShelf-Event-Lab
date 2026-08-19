import express from 'express';

const app = express();

app.use(express.json());

const warehouseResources = {
    'room-101': 'available',
    'room-102': 'occupied',
    'room-103': 'maintenance'
};

app.get('/warehouse/resources', (req, res) => {
    res.json(warehouseResources);
});

app.post('/warehouse/resources/:id', (req, res) => {
    const resourceId = req.params.id;
    const { status } = req.body;

    if (!['available', 'occupied', 'maintenance'].includes(status)) {
        return res.status(400).json({
            error: 'Invalid resource status'
        });
    }

    if (!warehouseResources[resourceId]) {
        return res.status(404).json({
            error: 'Resource not found'
        });
    }

    warehouseResources[resourceId] = status;

    res.status(200).json({
        resourceId,
        status
    });
});

app.listen(4000, () => {
    console.log('Mock Warehouse API running on port 4000');
});