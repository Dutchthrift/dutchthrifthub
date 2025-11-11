import { promises as fs } from 'fs';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

async function runMigration() {
  const sql = postgres(DATABASE_URL);
  
  try {
    console.log('Reading migration file...');
    const migrationSQL = await fs.readFile('migrations/0001_add_returns_tables.sql', 'utf-8');
    
    console.log('Running migration...');
    await sql.unsafe(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

runMigration().catch((error) => {
  console.error(error);
  process.exit(1);
});
