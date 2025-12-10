/**
 * Fix Purchase Orders Script - API Version
 * 
 * This script fixes purchase orders via the running API server.
 * Make sure the dev server is running first!
 * 
 * Run with: npx tsx server/scripts/fix-purchase-orders.ts
 */

const API_URL = 'http://localhost:5000';

async function fixPurchaseOrders() {
    console.log('🔧 Starting purchase order fix via API...\n');

    try {
        // 1. Get all purchase orders from API
        const response = await fetch(`${API_URL}/api/purchase-orders`);
        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const allPOs = await response.json();
        console.log(`📊 Total purchase orders in database: ${allPOs.length}`);

        // Valid active statuses (shown in kanban)
        const validActiveStatuses = ['aangekocht', 'ontvangen'];

        // Count orders by status
        const statusCounts: Record<string, number> = {};
        for (const po of allPOs) {
            const status = po.status || 'null';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        }
        console.log('\n📈 Status breakdown:');
        for (const [status, count] of Object.entries(statusCounts)) {
            console.log(`   ${status}: ${count}`);
        }

        // 2. Find problematic orders (not aangekocht/ontvangen AND not archived)
        const problematicPOs = allPOs.filter((po: any) => {
            const isValidActive = validActiveStatuses.includes(po.status || '');
            const isArchived = po.archived === true;
            const isVerwerkt = po.status === 'verwerkt';

            // Problem: not a valid active status AND not archived
            // OR: is verwerkt but NOT archived
            return (!isValidActive && !isArchived) || (isVerwerkt && !isArchived);
        });

        console.log(`\n⚠️  Problematic orders found: ${problematicPOs.length}`);

        if (problematicPOs.length === 0) {
            console.log('✅ No problematic orders found. All orders are properly categorized.');
            return;
        }

        console.log('\n📋 Orders to fix:');
        for (const po of problematicPOs) {
            console.log(`   - ${po.poNumber || po.id}: status="${po.status}", archived=${po.archived}`);
        }

        // 3. Fix the orders via API
        console.log('\n🔄 Fixing orders...');

        let fixedCount = 0;
        for (const po of problematicPOs) {
            try {
                let updateData: any = {};

                // If status is verwerkt, just set archived to true
                if (po.status === 'verwerkt') {
                    updateData = { archived: true };
                    console.log(`   📤 ${po.poNumber}: Setting archived=true (status was verwerkt)`);
                }
                // If status is not valid (not aangekocht/ontvangen/verwerkt), set to aangekocht
                else if (!validActiveStatuses.includes(po.status || '')) {
                    updateData = { status: 'aangekocht' };
                    console.log(`   📤 ${po.poNumber}: Setting status=aangekocht (was "${po.status}")`);
                } else {
                    continue; // Already handled
                }

                const patchResponse = await fetch(`${API_URL}/api/purchase-orders/${po.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updateData)
                });

                if (patchResponse.ok) {
                    console.log(`   ✅ ${po.poNumber}: Fixed successfully`);
                    fixedCount++;
                } else {
                    console.error(`   ❌ ${po.poNumber}: API error ${patchResponse.status}`);
                }
            } catch (error) {
                console.error(`   ❌ Failed to fix ${po.poNumber}:`, error);
            }
        }

        console.log(`\n✅ Fixed ${fixedCount}/${problematicPOs.length} orders`);

        // 4. Verify the fix
        const verifyResponse = await fetch(`${API_URL}/api/purchase-orders`);
        const verifyPOs = await verifyResponse.json();

        const remainingProblems = verifyPOs.filter((po: any) => {
            const isValidActive = validActiveStatuses.includes(po.status || '');
            const isArchived = po.archived === true;
            return !isValidActive && !isArchived;
        });

        if (remainingProblems.length === 0) {
            console.log('✅ Verification passed: All orders are now properly categorized!');
        } else {
            console.log(`⚠️  ${remainingProblems.length} orders still have issues.`);
        }
    } catch (error) {
        console.error('Error connecting to API:', error);
        console.log('\n💡 Make sure the dev server is running: npm run dev');
    }
}

// Run the fix
fixPurchaseOrders()
    .then(() => {
        console.log('\n🎉 Script completed!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    });
