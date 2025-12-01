import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import pg from 'pg';
import * as schema from '../shared/schema';

const { Pool } = pg;

async function fixOrderNumber() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });

    const db = drizzle(pool, { schema });

    console.log('Fixing order #10935...');

    // Update the order with correct number
    const result = await db
        .update(schema.orders)
        .set({ orderNumber: 10935 })
        .where(eq(schema.orders.shopifyOrderId, '12031295516719'))
        .returning();

    console.log('Updated:', result);

    await pool.end();
}

fixOrderNumber().catch(console.error);
