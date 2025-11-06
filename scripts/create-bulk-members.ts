/**
 * Bulk create members from accounts file
 * 
 * Usage:
 *   npx tsx scripts/create-bulk-members.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import bcrypt from 'bcryptjs'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// Capitalize first letter of each word
function capitalizeName(name: string): string {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

async function createBulkMembers() {
  try {
    // Read accounts file
    const accountsPath = path.join(process.cwd(), 'accounts')
    const fileContent = fs.readFileSync(accountsPath, 'utf-8')
    const lines = fileContent.split('\n').filter(line => line.trim())

    console.log(`📋 Found ${lines.length} accounts to create\n`)

    let successCount = 0
    let skipCount = 0
    let errorCount = 0

    for (const line of lines) {
      const parts = line.trim().split(' ')
      if (parts.length < 2) {
        console.log(`⚠️  Skipping invalid line: ${line}`)
        skipCount++
        continue
      }

      const phone = parts[0]
      const nameParts = parts.slice(1)
      const name = capitalizeName(nameParts.join(' '))

      // Default password is their phone number
      const password = phone
      const hashedPassword = await bcrypt.hash(password, 10)

      try {
        // Check if phone already exists
        const { rows: existing } = await pool.query(
          'SELECT id, name FROM users WHERE phone = $1',
          [phone]
        )

        if (existing.length > 0) {
          console.log(`⏭️  Skipped: ${name} (${phone}) - already exists as "${existing[0].name}"`)
          skipCount++
          continue
        }

        // Insert new member
        await pool.query(
          `INSERT INTO users (id, name, phone, password_hash, role) 
           VALUES (gen_random_uuid()::text, $1, $2, $3, 'Community Member')`,
          [name, phone, hashedPassword]
        )

        console.log(`✅ Created: ${name} (${phone})`)
        successCount++
      } catch (err: any) {
        console.error(`❌ Error creating ${name} (${phone}):`)
        console.error(`   Message: ${err.message}`)
        console.error(`   Code: ${err.code}`)
        if (err.detail) console.error(`   Detail: ${err.detail}`)
        errorCount++
      }
    }

    console.log(`\n📊 Summary:`)
    console.log(`   ✅ Successfully created: ${successCount}`)
    console.log(`   ⏭️  Skipped (already exist): ${skipCount}`)
    console.log(`   ❌ Errors: ${errorCount}`)
    console.log(`   📋 Total processed: ${lines.length}`)

    console.log(`\n🔐 Default passwords:`)
    console.log(`   All members can login with their phone number as the password`)
    console.log(`   Example: Phone 0421817100 → Password: 0421817100`)

  } catch (err: any) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

createBulkMembers()

