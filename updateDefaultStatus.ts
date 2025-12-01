import 'dotenv/config';
import postgres from 'postgres';

async function updateDefaultStatus() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL not found');
    }

    const sql = postgres(connectionString);

    try {
        console.log('🔄 Updating default return status...\n');

        // Update the default value for status column
        await sql`
            ALTER TABLE returns 
            ALTER COLUMN status SET DEFAULT 'nieuw'
        `;
        console.log('✅ Default status changed to "nieuw"\n');

        // Check current column default
        const result = await sql`
            SELECT column_name, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'returns' 
              AND column_name = 'status'
        `;

        console.log('📋 Current Default:');
        console.log(result[0]);

        console.log('\n✅ Migration completed successfully!');
        console.log('\n💡 Note: Existing returns with "nieuw_onderweg" status were NOT changed.');
        console.log('   New manually created returns will now get "nieuw" status by default.');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await sql.end();
    }
}

updateDefaultStatus();
