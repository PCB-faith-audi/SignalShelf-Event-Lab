const warehouseUrl = 'http://localhost:4000/warehouse/resources';

export async function pollWarehouse(resources) {
    try {
        const response = await fetch(warehouseUrl);

        if (!response.ok) {
            throw new Error(`Warehouse request failed: ${response.status}`);
        }

        const data = await response.json();

        for (const resourceId in data) {
            const oldStatus = resources[resourceId];
            const newStatus = data[resourceId];

           if (oldStatus !== undefined && oldStatus !== newStatus) {
            const event = {
        event: 'resource.updated',
        resourceId,
        oldStatus,
        newStatus
    };

    console.log(
        `Change detected: ${resourceId}: ${oldStatus} → ${newStatus}`
    );

    console.log('Generated event:', event);
}

            resources[resourceId] = newStatus;
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
    }, 10000);
}
