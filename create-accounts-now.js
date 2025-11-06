const fs = require('fs');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Capitalize first letter of each word
function capitalizeName(name) {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

async function createAccounts() {
  const accounts = fs.readFileSync('accounts', 'utf-8').split('\n').filter(line => line.trim());
  
  console.log(`Creating ${accounts.length} accounts...\n`);
  
  let created = 0;
  let skipped = 0;
  
  for (const line of accounts) {
    const parts = line.trim().split(' ');
    const phone = parts[0];
    const name = capitalizeName(parts.slice(1).join(' '));
    const password = phone;
    
    try {
      // Check if exists
      const check = await pool.query('SELECT id FROM users WHERE phone = $1', [phone]);
      if (check.rows.length > 0) {
        console.log(`⏭️  ${name} (${phone}) - already exists`);
        skipped++;
        continue;
      }
      
      // Hash password
      const hash = await bcrypt.hash(password, 10);
      
      // Insert
      await pool.query(
        `INSERT INTO users (id, name, phone, password_hash, role) 
         VALUES (gen_random_uuid()::text, $1, $2, $3, 'Community Member')`,
        [name, phone, hash]
      );
      
      console.log(`✅ ${name} (${phone})`);
      created++;
    } catch (err) {
      console.log(`❌ ${name} (${phone}) - ${err.message}`);
    }
  }
  
  console.log(`\n✅ Created: ${created}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`\n🔐 Password for all: their phone number`);
  
  await pool.end();
}

createAccounts();

