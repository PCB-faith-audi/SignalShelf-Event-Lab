const warehouseUrl = 'http://localhost:4000/warehouse/resources';

export async function pollWarehouse(resources) {
    try {
        const response = await fetch(warehouseUrl);

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

export function startPolling(resources) {
    pollWarehouse(resources);

    setInterval(() => {
        pollWarehouse(resources);
    }, 300000);
}