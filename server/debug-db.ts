import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

async function debugNotes() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        console.log('Connected to database');

        // 1. Check total count of notes
        const countRes = await client.query('SELECT COUNT(*) FROM notes');
        console.log('Total notes in DB:', countRes.rows[0].count);

        // 2. Check notes for the specific case ID from the logs
        const caseId = 'b4babac7-b485-43f4-9462-a8f52af8b5dd';
        console.log(`Checking notes for entityId: ${caseId}`);

        const notesRes = await client.query(`
      SELECT id, "entityType", "entityId", content, "createdAt", "deletedAt" 
      FROM notes 
      WHERE "entityId" = $1
    `, [caseId]);

        console.log('Notes found for this case:', notesRes.rows.length);
        console.log(JSON.stringify(notesRes.rows, null, 2));

        // 3. Check the most recently created notes
        console.log('Most recent 5 notes:');
        const recentRes = await client.query(`
      SELECT id, "entityType", "entityId", content, "createdAt" 
      FROM notes 
      ORDER BY "createdAt" DESC 
      LIMIT 5
    `);
        console.log(JSON.stringify(recentRes.rows, null, 2));

        // 4. Check table definition/RLS
        // This query checks if RLS is enabled
        const rlsRes = await client.query(`
      SELECT relname, relrowsecurity 
      FROM pg_class 
      WHERE relname = 'notes'
    `);
        console.log('RLS Status for notes table:', rlsRes.rows[0]);

    } catch (error) {
        console.error('Error debugging DB:', error);
    } finally {
        await client.end();
    }
}

debugNotes();
