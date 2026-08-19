const resources = {};

async function pollWarehouse() {
    try {
        const response = await fetch(
            'http://localhost:4000/warehouse/resources'
        );

        if (!response.ok) {
            throw new Error(`Warehouse request failed: ${response.status}`);
        }

        const data = await response.json();

        for (const resourceId in data) {
            resources[resourceId] = data[resourceId];
        }

        console.log('Warehouse polled successfully');
        console.log('SignalShelf cache:', resources);

    } catch (error) {
        console.error('Polling failed:', error.message);
    }
}

pollWarehouse();

setInterval(pollWarehouse, 300000);