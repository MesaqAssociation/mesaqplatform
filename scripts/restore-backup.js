const fs = require('fs');
const { Pool } = require('pg');

// This script restores a backup file to the database
// Run with: node scripts/restore-backup.js /path/to/backup.json

async function main() {
  const backupPath = process.argv[2];
  if (!backupPath) {
    console.error('Usage: node scripts/restore-backup.js <backup-file-path>');
    process.exit(1);
  }

  console.log('Reading backup file...');
  const backupContent = fs.readFileSync(backupPath, 'utf8');
  const backup = JSON.parse(backupContent);
  
  console.log(`Backup version: ${backup.version}`);
  console.log(`Created at: ${backup.created_at}`);

  // Get DATABASE_URL from environment
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is not set');
    console.error('Run: source .env.local or export DATABASE_URL=...');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    console.log('Connected to database');

    // Count existing records
    const counts = {};
    for (const table of Object.keys(backup.tables)) {
      try {
        const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
        counts[table] = parseInt(result.rows[0].count);
        console.log(`  ${table}: ${counts[table]} existing records, ${backup.tables[table].length} in backup`);
      } catch (err) {
        console.log(`  ${table}: table may not exist or error: ${err.message}`);
      }
    }

    // Restore transactions (we have 170, need 428)
    if (backup.tables.transactions) {
      console.log('\nRestoring transactions...');
      let insertedCount = 0;
      let skippedCount = 0;
      
      for (const tx of backup.tables.transactions) {
        try {
          await client.query(`
            INSERT INTO transactions (id, account_id, transaction_date, description, amount, transaction_type, balance_after, source, transaction_name, category, matched_member_id, statement_id, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (id) DO NOTHING
          `, [
            tx.id, tx.account_id, tx.transaction_date, tx.description, tx.amount,
            tx.transaction_type, tx.balance_after, tx.source, tx.transaction_name,
            tx.category, tx.matched_member_id, tx.statement_id, tx.created_at
          ]);
          insertedCount++;
        } catch (err) {
          skippedCount++;
          if (skippedCount === 1) console.log(`  First error: ${err.message}`);
        }
        
        if (insertedCount % 50 === 0) {
          console.log(`  Processed ${insertedCount}/${backup.tables.transactions.length} transactions...`);
        }
      }
      console.log(`  Completed: ${insertedCount} processed, ${skippedCount} errors`);
    }

    // Restore membership_payments (need to check schema)
    if (backup.tables.membership_payments) {
      console.log('\nRestoring membership_payments...');
      
      // First check the current schema
      const schemaResult = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'membership_payments' AND table_schema = 'public'
      `);
      const columns = schemaResult.rows.map(r => r.column_name);
      console.log(`  Current columns: ${columns.join(', ')}`);
      
      // The backup may have: id, user_id, payment_month, amount, paid, transaction_id, created_at
      // The current schema has: id, user_id, payment_month, amount, status, payment_date, transaction_id, created_at
      
      let insertedCount = 0;
      let skippedCount = 0;
      
      for (const mp of backup.tables.membership_payments) {
        try {
          if (columns.includes('paid') && !columns.includes('status')) {
            // Old schema with 'paid' boolean only
            await client.query(`
              INSERT INTO membership_payments (id, user_id, payment_month, amount, paid, transaction_id, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (id) DO NOTHING
            `, [mp.id, mp.user_id, mp.payment_month, mp.amount, mp.paid, mp.transaction_id, mp.created_at]);
          } else if (columns.includes('status')) {
            // New schema with 'status' text and 'payment_date'
            // Convert boolean 'paid' to text 'status'
            const status = mp.status || (mp.paid === true || mp.paid === 'true' ? 'paid' : 'pending');
            // Use payment_date if available, otherwise use payment_month
            const paymentDate = mp.payment_date || mp.payment_month || new Date().toISOString().split('T')[0];
            await client.query(`
              INSERT INTO membership_payments (id, user_id, payment_month, amount, status, payment_date, transaction_id, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              ON CONFLICT (user_id, payment_month) DO NOTHING
            `, [mp.id, mp.user_id, mp.payment_month, mp.amount, status, paymentDate, mp.transaction_id, mp.created_at]);
          }
          insertedCount++;
        } catch (err) {
          skippedCount++;
          if (skippedCount <= 3) console.log(`  Error: ${err.message}`);
        }
        
        if (insertedCount % 25 === 0) {
          console.log(`  Processed ${insertedCount}/${backup.tables.membership_payments.length} membership_payments...`);
        }
      }
      console.log(`  Completed: ${insertedCount} processed, ${skippedCount} errors`);
    }

    // Restore scheduled_notifications
    if (backup.tables.scheduled_notifications && backup.tables.scheduled_notifications.length > 0) {
      console.log('\nRestoring scheduled_notifications...');
      for (const sn of backup.tables.scheduled_notifications) {
        try {
          await client.query(`
            INSERT INTO scheduled_notifications (id, title, message, scheduled_date, recipient_type, recipient_ids, status, created_by, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO NOTHING
          `, [sn.id, sn.title, sn.message, sn.scheduled_date, sn.recipient_type, sn.recipient_ids, sn.status, sn.created_by, sn.created_at]);
        } catch (err) {
          console.log(`  Error: ${err.message}`);
        }
      }
      console.log(`  Completed: ${backup.tables.scheduled_notifications.length} scheduled_notifications`);
    }

    // Restore community_documents
    if (backup.tables.community_documents && backup.tables.community_documents.length > 0) {
      console.log('\nRestoring community_documents...');
      for (const doc of backup.tables.community_documents) {
        try {
          await client.query(`
            INSERT INTO community_documents (id, name, description, file_url, file_name, file_size, file_type, uploaded_by, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO NOTHING
          `, [doc.id, doc.name, doc.description, doc.file_url, doc.file_name, doc.file_size, doc.file_type, doc.uploaded_by, doc.created_at]);
        } catch (err) {
          console.log(`  Error: ${err.message}`);
        }
      }
      console.log(`  Completed: ${backup.tables.community_documents.length} community_documents`);
    }

    // Verify final counts
    console.log('\nFinal counts:');
    for (const table of Object.keys(backup.tables)) {
      try {
        const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
        const count = parseInt(result.rows[0].count);
        const target = backup.tables[table].length;
        const status = count >= target ? '✅' : `⚠️ (expected ${target})`;
        console.log(`  ${table}: ${count} ${status}`);
      } catch (err) {
        console.log(`  ${table}: error - ${err.message}`);
      }
    }

    client.release();
    console.log('\nRestore complete!');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

