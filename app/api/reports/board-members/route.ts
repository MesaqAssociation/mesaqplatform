import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType, BorderStyle, HeadingLevel, Header, Footer, PageNumber } from 'docx'

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

        // Create table header row with navy blue background
        const headerRow = new TableRow({
            children: [
                new TableCell({
                    children: [new Paragraph({ 
                        children: [new TextRun({ text: 'Name', bold: true, color: 'FFFFFF', size: 24 })] ,
                        alignment: AlignmentType.LEFT,
                    })],
                    shading: { fill: '1E3A5F' },
                    width: { size: 40, type: WidthType.PERCENTAGE },
                }),
                new TableCell({
                    children: [new Paragraph({ 
                        children: [new TextRun({ text: 'Phone', bold: true, color: 'FFFFFF', size: 24 })],
                        alignment: AlignmentType.LEFT,
                    })],
                    shading: { fill: '1E3A5F' },
                    width: { size: 30, type: WidthType.PERCENTAGE },
                }),
                new TableCell({
                    children: [new Paragraph({ 
                        children: [new TextRun({ text: 'Balance Owed', bold: true, color: 'FFFFFF', size: 24 })],
                        alignment: AlignmentType.RIGHT,
                    })],
                    shading: { fill: '1E3A5F' },
                    width: { size: 30, type: WidthType.PERCENTAGE },
                }),
            ],
            tableHeader: true,
        })

        // Create data rows with alternating colors
        const dataRows = memberData.map((member, index) => new TableRow({
            children: [
                new TableCell({
                    children: [new Paragraph({ 
                        children: [new TextRun({ text: member.name || 'Unknown', size: 22 })]
                    })],
                    shading: { fill: index % 2 === 0 ? 'F8FAFC' : 'FFFFFF' },
                }),
                new TableCell({
                    children: [new Paragraph({ 
                        children: [new TextRun({ text: member.phone || '-', size: 22 })]
                    })],
                    shading: { fill: index % 2 === 0 ? 'F8FAFC' : 'FFFFFF' },
                }),
                new TableCell({
                    children: [new Paragraph({ 
                        children: [new TextRun({ 
                            text: `$${parseFloat(member.balance).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`,
                            color: parseFloat(member.balance) > 0 ? 'DC2626' : '16A34A',
                            size: 22,
                        })],
                        alignment: AlignmentType.RIGHT,
                    })],
                    shading: { fill: index % 2 === 0 ? 'F8FAFC' : 'FFFFFF' },
                }),
            ],
        }))

        // Create total row
        const totalRow = new TableRow({
            children: [
                new TableCell({
                    children: [new Paragraph({ 
                        children: [new TextRun({ text: 'TOTAL', bold: true, size: 24 })]
                    })],
                    shading: { fill: 'E2E8F0' },
                    columnSpan: 2,
                }),
                new TableCell({
                    children: [new Paragraph({ 
                        children: [new TextRun({ 
                            text: `$${totalBalance.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`,
                            bold: true,
                            color: totalBalance > 0 ? 'DC2626' : '16A34A',
                            size: 24,
                        })],
                        alignment: AlignmentType.RIGHT,
                    })],
                    shading: { fill: 'E2E8F0' },
                }),
            ],
        })

        // Count members with outstanding balance
        const membersWithBalance = memberData.filter(m => parseFloat(m.balance) > 0).length

        // Create the document
        const doc = new Document({
            sections: [{
                properties: {
                    page: {
                        margin: {
                            top: 720,    // 0.5 inch in twips
                            right: 720,
                            bottom: 720,
                            left: 720,
                        },
                    },
                },
                headers: {
                    default: new Header({
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({ text: 'MESAQ Association', bold: true, size: 20, color: '64748B' }),
                                ],
                                alignment: AlignmentType.RIGHT,
                            }),
                        ],
                    }),
                },
                footers: {
                    default: new Footer({
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({ text: 'Page ', size: 18, color: '64748B' }),
                                    new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '64748B' }),
                                    new TextRun({ text: ' of ', size: 18, color: '64748B' }),
                                    new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: '64748B' }),
                                ],
                                alignment: AlignmentType.CENTER,
                            }),
                        ],
                    }),
                },
                children: [
                    // Title
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Board Member Report', bold: true, size: 48, color: '1E3A5F' })
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 100 },
                    }),
                    // Subtitle
                    new Paragraph({
                        children: [
                            new TextRun({ text: `Generated: ${getMelbourneDate()}`, italics: true, size: 22, color: '64748B' })
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 400 },
                    }),
                    // Summary section
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Summary', bold: true, size: 28, color: '1E3A5F' })
                        ],
                        spacing: { after: 100 },
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: `Total Members: ${memberData.length}`, size: 22 }),
                            new TextRun({ text: '   |   ', size: 22, color: '94A3B8' }),
                            new TextRun({ text: `With Outstanding Balance: ${membersWithBalance}`, size: 22 }),
                            new TextRun({ text: '   |   ', size: 22, color: '94A3B8' }),
                            new TextRun({ text: `Total Owed: $${totalBalance.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, size: 22, color: totalBalance > 0 ? 'DC2626' : '16A34A', bold: true }),
                        ],
                        spacing: { after: 300 },
                    }),
                    // Table
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [headerRow, ...dataRows, totalRow],
                        borders: {
                            top: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                            bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                            left: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                            right: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                        },
                    }),
                    // Notes
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Notes:', bold: true, size: 20, color: '64748B' })
                        ],
                        spacing: { before: 300, after: 50 },
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: '• Red amounts indicate outstanding balances owed by members', size: 18, color: '64748B' })
                        ],
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: '• Green amounts indicate members who are paid up or have credit', size: 18, color: '64748B' })
                        ],
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
