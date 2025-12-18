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

// Helper function to get current year
function getCurrentYear(): number {
    const now = new Date()
    const melbourneTime = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }))
    return melbourneTime.getFullYear()
}

// Helper function to calculate member balance (amount owed)
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

// Helper function to get total membership payments for a member in the current year
async function getMembershipPaymentsThisYear(userId: string): Promise<number> {
    try {
        const currentYear = getCurrentYear()
        const startDate = `${currentYear}-01-01`
        
        const { rows } = await pool.query(`
            SELECT COALESCE(SUM(t.amount), 0) as total
            FROM transactions t
            WHERE t.matched_member_id = $1
              AND t.category = 'Membership Payment'
              AND t.transaction_type = 'credit'
              AND t.transaction_date >= $2::date
        `, [userId, startDate])

        return parseFloat(rows[0]?.total || '0')
    } catch (err) {
        console.error('Error getting membership payments for user:', userId, err)
        return 0
    }
}

// Helper function to get total event payments (NOT donations) for a member in the current year
async function getEventPaymentsThisYear(userId: string): Promise<number> {
    try {
        const currentYear = getCurrentYear()
        const startDate = `${currentYear}-01-01`
        
        // Get event payments - this is the "Special" category that excludes donations
        // It includes 'Event Payment' and also legacy 'Special Payment' that aren't donations
        const { rows } = await pool.query(`
            SELECT COALESCE(SUM(t.amount), 0) as total
            FROM transactions t
            WHERE t.matched_member_id = $1
              AND t.category IN ('Event Payment', 'Special Payment')
              AND t.category != 'Donation'
              AND t.transaction_type = 'credit'
              AND t.transaction_date >= $2::date
        `, [userId, startDate])

        return parseFloat(rows[0]?.total || '0')
    } catch (err) {
        console.error('Error getting event payments for user:', userId, err)
        return 0
    }
}

export async function GET(req: NextRequest) {
    const auth = await verifyBoardAuth()
    if (!auth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const currentYear = getCurrentYear()
        
        // Get all members with their details including member_id
        const { rows: members } = await pool.query(`
      SELECT id, member_id, name, email, phone, date_joined
      FROM users
      WHERE date_joined IS NOT NULL
      ORDER BY name ASC
    `)

        console.log(`📊 Found ${members.length} members for annual report (${currentYear})`)

        // Calculate all payment data for each member
        const memberData = await Promise.all(
            members.map(async (member: any, index: number) => {
                const membershipPayments = await getMembershipPaymentsThisYear(member.id)
                const eventPayments = await getEventPaymentsThisYear(member.id)
                const currentBalance = await getMemberBalance(member.id)
                const sum = membershipPayments + eventPayments
                
                return {
                    rowNum: index + 1,
                    memberId: member.member_id || '-',
                    name: member.name || 'Unknown',
                    membershipPayments: membershipPayments.toFixed(2),
                    eventPayments: eventPayments.toFixed(2),
                    sum: sum.toFixed(2),
                    currentBalance: currentBalance.toFixed(2)
                }
            })
        )

        console.log(`💰 Calculated annual payments for ${memberData.length} members`)

        // Calculate totals
        const totalMembershipPayments = memberData.reduce((sum, m) => sum + parseFloat(m.membershipPayments), 0)
        const totalEventPayments = memberData.reduce((sum, m) => sum + parseFloat(m.eventPayments), 0)
        const totalSum = memberData.reduce((sum, m) => sum + parseFloat(m.sum), 0)
        const totalBalance = memberData.reduce((sum, m) => sum + parseFloat(m.currentBalance), 0)

        // Create table header row with navy blue background
        // Columns: ID, Name, Membership Payments, Special (Events), Sum, Current Balance
        const headerRow = new TableRow({
            children: [
                new TableCell({
                    children: [new Paragraph({ 
                        children: [new TextRun({ text: 'ID', bold: true, color: 'FFFFFF', size: 20 })],
                        alignment: AlignmentType.CENTER,
                    })],
                    shading: { fill: '1E3A5F' },
                    width: { size: 8, type: WidthType.PERCENTAGE },
                }),
                new TableCell({
                    children: [new Paragraph({ 
                        children: [new TextRun({ text: 'Name', bold: true, color: 'FFFFFF', size: 20 })],
                        alignment: AlignmentType.LEFT,
                    })],
                    shading: { fill: '1E3A5F' },
                    width: { size: 25, type: WidthType.PERCENTAGE },
                }),
                new TableCell({
                    children: [new Paragraph({ 
                        children: [new TextRun({ text: 'Membership', bold: true, color: 'FFFFFF', size: 20 })],
                        alignment: AlignmentType.RIGHT,
                    })],
                    shading: { fill: '1E3A5F' },
                    width: { size: 17, type: WidthType.PERCENTAGE },
                }),
                new TableCell({
                    children: [new Paragraph({ 
                        children: [new TextRun({ text: 'Special', bold: true, color: 'FFFFFF', size: 20 })],
                        alignment: AlignmentType.RIGHT,
                    })],
                    shading: { fill: '1E3A5F' },
                    width: { size: 17, type: WidthType.PERCENTAGE },
                }),
                new TableCell({
                    children: [new Paragraph({ 
                        children: [new TextRun({ text: 'Sum', bold: true, color: 'FFFFFF', size: 20 })],
                        alignment: AlignmentType.RIGHT,
                    })],
                    shading: { fill: '1E3A5F' },
                    width: { size: 16, type: WidthType.PERCENTAGE },
                }),
                new TableCell({
                    children: [new Paragraph({ 
                        children: [new TextRun({ text: 'Balance', bold: true, color: 'FFFFFF', size: 20 })],
                        alignment: AlignmentType.RIGHT,
                    })],
                    shading: { fill: '1E3A5F' },
                    width: { size: 17, type: WidthType.PERCENTAGE },
                }),
            ],
            tableHeader: true,
        })

        // Create data rows with alternating colors
        const dataRows = memberData.map((member, index) => new TableRow({
            children: [
                new TableCell({
                    children: [new Paragraph({ 
                        children: [new TextRun({ text: member.memberId, size: 18 })],
                        alignment: AlignmentType.CENTER,
                    })],
                    shading: { fill: index % 2 === 0 ? 'F8FAFC' : 'FFFFFF' },
                }),
                new TableCell({
                    children: [new Paragraph({ 
                        children: [new TextRun({ text: member.name, size: 18 })]
                    })],
                    shading: { fill: index % 2 === 0 ? 'F8FAFC' : 'FFFFFF' },
                }),
                new TableCell({
                    children: [new Paragraph({ 
                        children: [new TextRun({ 
                            text: `$${parseFloat(member.membershipPayments).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`,
                            color: '16A34A',
                            size: 18,
                        })],
                        alignment: AlignmentType.RIGHT,
                    })],
                    shading: { fill: index % 2 === 0 ? 'F8FAFC' : 'FFFFFF' },
                }),
                new TableCell({
                    children: [new Paragraph({ 
                        children: [new TextRun({ 
                            text: `$${parseFloat(member.eventPayments).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`,
                            color: '2563EB',
                            size: 18,
                        })],
                        alignment: AlignmentType.RIGHT,
                    })],
                    shading: { fill: index % 2 === 0 ? 'F8FAFC' : 'FFFFFF' },
                }),
                new TableCell({
                    children: [new Paragraph({ 
                        children: [new TextRun({ 
                            text: `$${parseFloat(member.sum).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`,
                            bold: true,
                            size: 18,
                        })],
                        alignment: AlignmentType.RIGHT,
                    })],
                    shading: { fill: index % 2 === 0 ? 'F8FAFC' : 'FFFFFF' },
                }),
                new TableCell({
                    children: [new Paragraph({ 
                        children: [new TextRun({ 
                            text: `$${parseFloat(member.currentBalance).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`,
                            color: parseFloat(member.currentBalance) > 0 ? 'DC2626' : '16A34A',
                            size: 18,
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
                        children: [new TextRun({ text: 'TOTAL', bold: true, size: 20 })]
                    })],
                    shading: { fill: 'E2E8F0' },
                    columnSpan: 2,
                }),
                new TableCell({
                    children: [new Paragraph({ 
                        children: [new TextRun({ 
                            text: `$${totalMembershipPayments.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`,
                            bold: true,
                            color: '16A34A',
                            size: 20,
                        })],
                        alignment: AlignmentType.RIGHT,
                    })],
                    shading: { fill: 'E2E8F0' },
                }),
                new TableCell({
                    children: [new Paragraph({ 
                        children: [new TextRun({ 
                            text: `$${totalEventPayments.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`,
                            bold: true,
                            color: '2563EB',
                            size: 20,
                        })],
                        alignment: AlignmentType.RIGHT,
                    })],
                    shading: { fill: 'E2E8F0' },
                }),
                new TableCell({
                    children: [new Paragraph({ 
                        children: [new TextRun({ 
                            text: `$${totalSum.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`,
                            bold: true,
                            size: 20,
                        })],
                        alignment: AlignmentType.RIGHT,
                    })],
                    shading: { fill: 'E2E8F0' },
                }),
                new TableCell({
                    children: [new Paragraph({ 
                        children: [new TextRun({ 
                            text: `$${totalBalance.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`,
                            bold: true,
                            color: totalBalance > 0 ? 'DC2626' : '16A34A',
                            size: 20,
                        })],
                        alignment: AlignmentType.RIGHT,
                    })],
                    shading: { fill: 'E2E8F0' },
                }),
            ],
        })

        // Count members with outstanding balance
        const membersWithBalance = memberData.filter(m => parseFloat(m.currentBalance) > 0).length

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
                            new TextRun({ text: `Annual Report ${currentYear}`, bold: true, size: 48, color: '1E3A5F' })
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 100 },
                    }),
                    // Subtitle
                    new Paragraph({
                        children: [
                            new TextRun({ text: `Period: January 1, ${currentYear} to Present`, italics: true, size: 24, color: '64748B' })
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 50 },
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: `Generated: ${getMelbourneDate()}`, italics: true, size: 20, color: '94A3B8' })
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
                        spacing: { after: 100 },
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: `Total Membership Payments: $${totalMembershipPayments.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, size: 22, color: '16A34A' }),
                            new TextRun({ text: '   |   ', size: 22, color: '94A3B8' }),
                            new TextRun({ text: `Total Event Payments: $${totalEventPayments.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, size: 22, color: '2563EB' }),
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
                            new TextRun({ text: 'Column Definitions:', bold: true, size: 20, color: '64748B' })
                        ],
                        spacing: { before: 300, after: 50 },
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: '• ID: Member identification number', size: 18, color: '64748B' })
                        ],
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: '• Membership: Total membership fee payments this year (green)', size: 18, color: '64748B' })
                        ],
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: '• Special: Event payments only - excludes donations (blue)', size: 18, color: '64748B' })
                        ],
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: '• Sum: Total of Membership + Special payments', size: 18, color: '64748B' })
                        ],
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: '• Balance: Outstanding amount owed (red = owes money, green = paid up)', size: 18, color: '64748B' })
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
                'Content-Disposition': `attachment; filename="Annual-Report-${currentYear}-${getMelbourneDate().replace(/\//g, '-')}.docx"`,
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
