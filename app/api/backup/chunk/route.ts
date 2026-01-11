import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { uploadToR2, isR2Configured } from '@/lib/cloudflare-r2'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes per chunk

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// List of tables to backup in order
const BACKUP_TABLES = [
  'system_settings',
  'financial_accounts',
  'users',
  'events',
  'member_events',
  'bank_statements',
  'member_groups',
  'payment_keywords',
  'scheduled_notifications',
  'community_documents',
  'membership_payments',
  'transactions', // largest table last
]

// Helper to check admin role
async function isAdmin(token: string): Promise<boolean> {
  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET!) as any
    const userId = decoded.userId || decoded.sub
    
    const { rows } = await pool.query('SELECT role FROM users WHERE id = $1', [userId])
    if (rows.length === 0) return false
    
    const role = rows[0].role?.toLowerCase()
    return ['admin', 'board', 'manager'].includes(role)
  } catch {
    return false
  }
}

// Helper to get Melbourne date
function getMelbourneDate(): { month: string, year: number, timestamp: number } {
  const now = new Date()
  const melbourneTime = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }))
  
  return {
    month: melbourneTime.toLocaleString('en-US', { month: 'long' }),
    year: melbourneTime.getFullYear(),
    timestamp: Date.now()
  }
}

// GET - Get backup status (which chunks are done)
export async function GET(req: NextRequest) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!(await isAdmin(token))) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  try {
    // Get the current backup session status
    const { rows } = await pool.query(`
      SELECT key, value FROM system_settings 
      WHERE key LIKE 'backup_chunk_%'
    `)
    
    const chunks: Record<string, any> = {}
    for (const row of rows) {
      const table = row.key.replace('backup_chunk_', '')
      chunks[table] = JSON.parse(row.value)
    }
    
    return NextResponse.json({
      tables: BACKUP_TABLES,
      completedChunks: chunks,
      isComplete: BACKUP_TABLES.every(t => chunks[t]?.status === 'done')
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST - Backup a single table chunk
export async function POST(req: NextRequest) {
  const token = cookies().get('auth_token')?.value
  
  // Allow cron requests with special header
  const cronSecret = req.headers.get('x-cron-secret')
  const isCron = cronSecret === process.env.CRON_SECRET
  
  if (!isCron) {
    if (!token || !process.env.AUTH_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!(await isAdmin(token))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
  }

  if (!isR2Configured()) {
    return NextResponse.json({ error: 'R2 storage not configured' }, { status: 500 })
  }

  try {
    const { table, finalize } = await req.json()
    const { month, year, timestamp } = getMelbourneDate()
    
    // If finalize is true, combine all chunks into final backup
    if (finalize) {
      console.log('📦 Finalizing backup - combining chunks...')
      
      const chunks: Record<string, any[]> = {}
      const counts: Record<string, number> = {}
      
      for (const t of BACKUP_TABLES) {
        const { rows: chunkRows } = await pool.query(
          `SELECT value FROM system_settings WHERE key = $1`,
          [`backup_chunk_${t}`]
        )
        
        if (chunkRows.length > 0) {
          const chunkData = JSON.parse(chunkRows[0].value)
          if (chunkData.data) {
            chunks[t] = chunkData.data
            counts[t] = chunkData.data.length
          }
        }
      }
      
      const backupData = {
        version: '2.0',
        created_at: new Date().toISOString(),
        created_by: isCron ? 'cron' : 'admin',
        tables: chunks,
        counts
      }
      
      const jsonString = JSON.stringify(backupData)
      const buffer = Buffer.from(jsonString, 'utf-8')
      const filename = `MesaqBackup-${month}-${year}.json`
      
      console.log(`📦 Final backup size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`)
      
      const url = await uploadToR2(buffer, filename, 'application/json', 'backups')
      
      // Clean up chunk data from settings
      await pool.query(`DELETE FROM system_settings WHERE key LIKE 'backup_chunk_%'`)
      
      // Store backup record
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS backup_records (
            id SERIAL PRIMARY KEY,
            key TEXT NOT NULL,
            filename TEXT NOT NULL,
            url TEXT NOT NULL,
            size INTEGER DEFAULT 0,
            month TEXT,
            year INTEGER,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `)
        
        const keyMatch = url.match(/backups\/[^/]+\.json/)
        const key = keyMatch ? keyMatch[0] : `backups/${timestamp}-${filename}`
        
        await pool.query(`
          INSERT INTO backup_records (key, filename, url, size, month, year)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [key, filename, url, buffer.length, month, year])
      } catch (dbErr) {
        console.error('⚠️ Failed to save backup record:', dbErr)
      }
      
      return NextResponse.json({
        success: true,
        finalized: true,
        url,
        filename,
        counts
      })
    }
    
    // Otherwise, backup a single table
    if (!table || !BACKUP_TABLES.includes(table)) {
      return NextResponse.json({ 
        error: 'Invalid table', 
        validTables: BACKUP_TABLES 
      }, { status: 400 })
    }
    
    console.log(`📦 Backing up table: ${table}`)
    
    // Query the table
    let rows: any[] = []
    try {
      const result = await pool.query(`SELECT * FROM ${table}`)
      rows = result.rows
    } catch (err: any) {
      console.log(`⚠️ Table ${table} doesn't exist or is empty`)
      rows = []
    }
    
    // Store chunk data temporarily in system_settings
    const chunkData = {
      status: 'done',
      count: rows.length,
      timestamp: Date.now(),
      data: rows
    }
    
    await pool.query(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `, [`backup_chunk_${table}`, JSON.stringify(chunkData)])
    
    console.log(`✅ Backed up ${table}: ${rows.length} records`)
    
    // Check if all tables are done
    const { rows: allChunks } = await pool.query(`
      SELECT key FROM system_settings WHERE key LIKE 'backup_chunk_%'
    `)
    const completedTables = allChunks.map(r => r.key.replace('backup_chunk_', ''))
    const allDone = BACKUP_TABLES.every(t => completedTables.includes(t))
    
    return NextResponse.json({
      success: true,
      table,
      count: rows.length,
      completedTables,
      allDone,
      nextTable: allDone ? null : BACKUP_TABLES.find(t => !completedTables.includes(t))
    })
  } catch (err: any) {
    console.error('Chunk backup error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE - Clear chunk backup session
export async function DELETE(req: NextRequest) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!(await isAdmin(token))) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  try {
    await pool.query(`DELETE FROM system_settings WHERE key LIKE 'backup_chunk_%'`)
    return NextResponse.json({ success: true, message: 'Chunk session cleared' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

