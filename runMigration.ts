import 'dotenv/config';
import postgres from 'postgres';
import fs from 'fs';

async function runMigration() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL not found');
    }

    const sql = postgres(connectionString);

    try {
        console.log('🔄 Running return status migration...\n');

        // Step 1: Add new enum values
        console.log('Step 1: Adding new enum values (nieuw, onderweg)...');
        await sql`ALTER TYPE return_status ADD VALUE IF NOT EXISTS 'nieuw'`;
        await sql`ALTER TYPE return_status ADD VALUE IF NOT EXISTS 'onderweg'`;
        console.log('✅ Enum values added\n');

        // Step 2: Migrate existing data
        console.log('Step 2: Migrating existing nieuw_onderweg returns...');

        // Returns WITH tracking → onderweg
        const resultOnderweg = await sql`
            UPDATE returns 
            SET status = 'onderweg' 
            WHERE status = 'nieuw_onderweg' 
              AND tracking_number IS NOT NULL 
              AND tracking_number != ''
            RETURNING id
        `;
        console.log(`✅ Migrated ${resultOnderweg.length} returns to 'onderweg' (with tracking)`);

        // Returns WITHOUT tracking → nieuw
        const resultNieuw = await sql`
            UPDATE returns 
            SET status = 'nieuw' 
            WHERE status = 'nieuw_onderweg'
            RETURNING id
        `;
        console.log(`✅ Migrated ${resultNieuw.length} returns to 'nieuw' (without tracking)\n`);

        // Step 3: Verify migration
        console.log('Step 3: Verifying migration...');
        const stats = await sql`
            SELECT 
                status, 
                COUNT(*) as count,
                COUNT(CASE WHEN tracking_number IS NOT NULL AND tracking_number != '' THEN 1 END) as has_tracking
            FROM returns 
            WHERE status IN ('nieuw', 'onderweg', 'nieuw_onderweg')
            GROUP BY status
        `;

        console.log('\n📊 Migration Results:');
        console.log('Status         | Count | Has Tracking');
        console.log('---------------|-------|-------------');
        stats.forEach(row => {
            console.log(`${row.status.padEnd(14)} | ${row.count.toString().padEnd(5)} | ${row.has_tracking}`);
        });

        console.log('\n✅ Migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await sql.end();
    }
}

runMigration();
