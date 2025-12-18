import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType, BorderStyle, HeadingLevel } from 'docx'

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
                    name: member.name || 'Unknown',
                    phone: member.phone || '',
                    balance: balance.toFixed(2)
                }
            })
        )

        console.log(`💰 Calculated balances for ${memberData.length} members`)

        // Calculate total balance
        const totalBalance = memberData.reduce((sum, m) => sum + parseFloat(m.balance), 0)

        // Create table header row
        const headerRow = new TableRow({
            children: [
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Name', bold: true })] })],
                    shading: { fill: 'E0E0E0' },
                }),
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Phone', bold: true })] })],
                    shading: { fill: 'E0E0E0' },
                }),
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Balance', bold: true })] })],
                    shading: { fill: 'E0E0E0' },
                }),
            ],
        })

        // Create data rows
        const dataRows = memberData.map(member => new TableRow({
            children: [
                new TableCell({
                    children: [new Paragraph({ text: member.name || 'Unknown' })],
                }),
                new TableCell({
                    children: [new Paragraph({ text: member.phone || '-' })],
                }),
                new TableCell({
                    children: [new Paragraph({ 
                        children: [new TextRun({ 
                            text: `$${parseFloat(member.balance).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`,
                            color: parseFloat(member.balance) > 0 ? 'FF0000' : '000000'
                        })]
                    })],
                }),
            ],
        }))

        // Create total row
        const totalRow = new TableRow({
            children: [
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Total', bold: true })] })],
                    shading: { fill: 'F5F5F5' },
                }),
                new TableCell({
                    children: [new Paragraph({ text: '' })],
                    shading: { fill: 'F5F5F5' },
                }),
                new TableCell({
                    children: [new Paragraph({ 
                        children: [new TextRun({ 
                            text: `$${totalBalance.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`,
                            bold: true,
                            color: totalBalance > 0 ? 'FF0000' : '000000'
                        })]
                    })],
                    shading: { fill: 'F5F5F5' },
                }),
            ],
        })

        // Create the document
        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    // Title
                    new Paragraph({
                        text: 'Board Member Report',
                        heading: HeadingLevel.HEADING_1,
                        alignment: AlignmentType.CENTER,
                    }),
                    // Date
                    new Paragraph({
                        text: `Generated: ${getMelbourneDate()}`,
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 400 },
                    }),
                    // Table
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [headerRow, ...dataRows, totalRow],
                    }),
                    // Summary
                    new Paragraph({
                        text: `Total Members: ${memberData.length}`,
                        spacing: { before: 400 },
                    }),
                ],
            }],
        })

        // Generate the document buffer
        const buffer = await Packer.toBuffer(doc)
        
        console.log(`✅ Generated Word document with ${memberData.length} members`)

        // Return the Word file as a download
        return new NextResponse(buffer, {
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
