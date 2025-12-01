// Trigger sync and show detailed response
async function triggerSync() {
    try {
        console.log('🔄 Triggering Shopify returns sync...\n');

        const response = await fetch('http://localhost:5000/api/shopify/sync-returns', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log(`Status: ${response.status} ${response.statusText}\n`);

        const result = await response.json();

        if (response.ok) {
            console.log('✅ Sync Response:');
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.log('❌ Error Response:');
            console.log(JSON.stringify(result, null, 2));
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
    }
}

triggerSync();
