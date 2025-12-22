
import { db } from './server/services/database';
import { customers, orders, returns, emailThreads } from './shared/schema';
import { eq, ilike, or, and, isNotNull, exists } from 'drizzle-orm';

async function debugReturns() {
    console.log('--- Debugging Returns Tab Issues ---');

    try {
        // 1. Check if there are ANY returns in the database
        const allReturns = await db.select().from(returns).limit(5);
        console.log(`Total returns found (sample 5): ${allReturns.length}`);
        if (allReturns.length > 0) {
            console.log('Sample return:', JSON.stringify(allReturns[0], null, 2));
        } else {
            console.log('CRITICAL: No returns found in database table!');
        }

        if (allReturns.length > 0) {
            const sampleReturn = allReturns[0];
            console.log(`Tracing return ID: ${sampleReturn.id}, Order ID: ${sampleReturn.orderId}`);

            if (sampleReturn.orderId) {
                const order = await db.query.orders.findFirst({
                    where: eq(orders.id, sampleReturn.orderId),
                    with: {
                        customer: true
                    }
                });

                if (order && order.customer) {
                    console.log(`Found Customer: ${order.customer.firstName} ${order.customer.lastName} (${order.customer.email})`);

                    // 3. Search for names
                    const customerEmails = await db.select().from(emailThreads)
                        .where(
                            ilike(emailThreads.subject, `%${order.customer.email}%`)
                        ).limit(5);

                    console.log(`Found ${customerEmails.length} threads potential match by subject/email query.`);

                    // 4. Test the EXACT "hasReturn" filter logic check
                    const hasReturnCheck = await db.select({ id: emailThreads.id }).from(emailThreads).where(
                        exists(
                            db.select().from(returns)
                                .innerJoin(orders, eq(returns.orderId, orders.id))
                                .innerJoin(customers, eq(orders.customerId, customers.id))
                                .where(
                                    eq(customers.email, order.customer.email)
                                )
                        )
                    ).limit(1);

                    console.log(`Storage-like Logic Check for customer ${order.customer.email}:`, hasReturnCheck.length > 0 ? 'MATCH' : 'NO MATCH');
                } else {
                    console.log('Order or Customer not found for this return.');
                }
            }
        }
    } catch (error) {
        console.error('Error debugging returns:', error);
    }
    process.exit(0);
}

debugReturns();
