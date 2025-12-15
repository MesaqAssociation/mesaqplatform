import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { readFileSync } from 'fs'
import { join } from 'path'

export const runtime = 'nodejs'

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
})

// Helper function to verify auth and check if user is board/admin
async function verifyBoardAuth(): Promise<{ userId: string; role: string } | null> {
    const token = cookies().get('auth_token')?.value
    if (!token || !process.env.AUTH_SECRET) {
        return null
    }

    try {
        const decoded = jwt.verify(token, process.env.AUTH_SECRET) as { sub: string }

        // Get user role
        const { rows } = await pool.query('SELECT role FROM users WHERE id = $1', [decoded.sub])
        if (rows.length === 0) return null

        const role = rows[0].role

        // Only allow board, admin, and Manager roles
        if (!['board', 'admin', 'Manager'].includes(role)) {
            return null
        }

        return { userId: decoded.sub, role }
    } catch {
        return null
    }
}

// Helper function to get Melbourne date in dd/mm/yyyy format
function getMelbourneDate(): string {
    const now = new Date()
    const melbourneTime = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }))

    const day = String(melbourneTime.getDate()).padStart(2, '0')
    const month = String(melbourneTime.getMonth() + 1).padStart(2, '0')
    const year = melbourneTime.getFullYear()

    return `${day}/${month}/${year}`
}

// Helper function to calculate member balance
async function getMemberBalance(userId: string): Promise<number> {
    try {
        // Get monthly fee
        const { rows: feeRows } = await pool.query(
            "SELECT value FROM system_settings WHERE key = 'monthly_membership_fee'"
        )
        const monthlyFee = parseFloat(feeRows[0]?.value || '40.00')

        // Calculate months owed
        const { rows: balanceRows } = await pool.query(`
      WITH months_owed AS (
        SELECT 
          COUNT(DISTINCT DATE_TRUNC('month', gs::date)) as months
        FROM users u
        CROSS JOIN generate_series(
          GREATEST(u.date_joined::date, '2024-01-01'::date),
          CURRENT_DATE,
          '1 month'::interval
        ) gs
        WHERE u.id = $1
      ),
      months_paid AS (
        SELECT COUNT(*) as months
        FROM membership_payments
        WHERE user_id = $1 AND status = 'paid'
      )
      SELECT 
        (mo.months - COALESCE(mp.months, 0)) as months_behind
      FROM months_owed mo
      LEFT JOIN months_paid mp ON true
    `, [userId])

        const monthsBehind = balanceRows[0]?.months_behind || 0
        return monthsBehind * monthlyFee
    } catch (err) {
        console.error('Error calculating balance for user:', userId, err)
        return 0
    }
}

export async function GET(req: NextRequest) {
    const auth = await verifyBoardAuth()
    if (!auth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Get all members with their details
        const { rows: members } = await pool.query(`
      SELECT id, name, email, phone, date_joined
      FROM users
      WHERE date_joined IS NOT NULL
      ORDER BY name ASC
    `)

        console.log(`📊 Found ${members.length} members for report`)

        // Calculate balance for each member
        const memberData = await Promise.all(
            members.map(async (member: any) => {
                const balance = await getMemberBalance(member.id)
                return {
                    member_id: member.id,
                    member_name: member.name,
                    balance: `$${balance.toFixed(2)}`
                }
            })
        )

        console.log(`💰 Calculated balances for ${memberData.length} members`)

        // Load the template
        const templatePath = join(process.cwd(), 'public', 'report-template.docx')
        console.log(`📄 Loading template from: ${templatePath}`)

        let content: string
        try {
            content = readFileSync(templatePath, 'binary')
            console.log(`✅ Template loaded, size: ${content.length} bytes`)
        } catch (err: any) {
            console.error('❌ Failed to load template:', err.message)
            return NextResponse.json({
                error: 'Report template not found',
                details: 'Please ensure report-template.docx exists in the public folder'
            }, { status: 500 })
        }

        // Create a new PizZip instance with the template
        const zip = new PizZip(content)

        // Create docxtemplater instance with error handling
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
        })

        // Set the template data
        const templateData = {
            date: getMelbourneDate(),
            members: memberData
        }

        console.log(`🔧 Rendering template with data:`, JSON.stringify(templateData, null, 2))

        try {
            doc.render(templateData)
        } catch (renderError: any) {
            console.error('❌ Template rendering error:', renderError)
            console.error('Error name:', renderError.name)
            console.error('Error properties:', renderError.properties)

            // Log all individual errors if it's a multi-error
            if (renderError.properties?.errors) {
                console.error('Individual errors:')
                renderError.properties.errors.forEach((err: any, index: number) => {
                    console.error(`  Error ${index + 1}:`, {
                        message: err.message,
                        name: err.name,
                        properties: err.properties
                    })
                })
            }

            throw new Error(`Template rendering failed: ${renderError.message}. Please ensure the template has the correct placeholders: {{date}} and {{#members}}{{member_id}}{{member_name}}{{balance}}{{/members}}`)
        }

        console.log(`✅ Template rendered successfully`)

        // Generate the document
        const buffer = doc.getZip().generate({
            type: 'nodebuffer',
            compression: 'DEFLATE',
        }) as Buffer

        console.log(`📦 Generated document, size: ${buffer.length} bytes`)

        // Return the file as a download
        return new NextResponse(new Uint8Array(buffer), {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="Board-Member-Report-${getMelbourneDate().replace(/\//g, '-')}.docx"`,
            },
        })
    } catch (err: any) {
        console.error('❌ Report generation error:', err)
        console.error('Error stack:', err.stack)
        return NextResponse.json({
            error: 'Failed to generate report',
            details: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        }, { status: 500 })
    }
}
