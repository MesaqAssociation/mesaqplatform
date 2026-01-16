import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType } from 'docx'

export const runtime = 'nodejs'

// Verify admin/board auth
async function verifyAuth(): Promise<boolean> {
    const token = cookies().get('auth_token')?.value
    if (!token || !process.env.AUTH_SECRET) return false
    
    try {
        jwt.verify(token, process.env.AUTH_SECRET)
        return true
    } catch {
        return false
    }
}

// Generate User Manual DOCX
function generateUserManual(): Document {
    return new Document({
        sections: [{
            properties: {
                page: {
                    margin: { top: 720, right: 720, bottom: 720, left: 720 },
                },
            },
            children: [
                // Title
                new Paragraph({
                    children: [new TextRun({ text: 'Mesaq Platform User Manual', bold: true, size: 56, color: '1E3A5F' })],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 400 },
                }),
                
                // Table of Contents
                new Paragraph({
                    children: [new TextRun({ text: 'Table of Contents', bold: true, size: 32 })],
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 300, after: 200 },
                }),
                ...[
                    '1. Dashboard',
                    '2. Calendar',
                    '3. Members',
                    '4. Finance',
                    '5. Events',
                    '6. Documents',
                    '7. Messaging',
                    '8. Community Settings',
                    '9. Personal Settings',
                    '10. Regular Member View',
                    '11. Roles & Permissions',
                ].map(item => new Paragraph({
                    children: [new TextRun({ text: item, size: 22 })],
                    spacing: { after: 50 },
                })),

                // Dashboard Section
                new Paragraph({
                    children: [new TextRun({ text: '1. Dashboard', bold: true, size: 32, color: '1E3A5F' })],
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 400, after: 200 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: 'What Each Card Means', bold: true, size: 26 })],
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 100 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• Total Members: Number of active members in the community', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• Upcoming Events: Events scheduled in the near future', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• Messages: Recent message activity', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• Account Balance: Current bank account balance', size: 22 })],
                }),

                new Paragraph({
                    children: [new TextRun({ text: 'Need Attention Section', bold: true, size: 26 })],
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 100 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: 'The dashboard shows items that require admin action:', size: 22 })],
                    spacing: { after: 100 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: 'Unknown Payers: ', bold: true, size: 22 }), new TextRun({ text: 'Credit transactions that couldn\'t be automatically matched to any member. Click "View Unknown Transactions" to see and assign them.', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: 'Special Payments: ', bold: true, size: 22 }), new TextRun({ text: 'Payments matched to members but categorized as "Special Payment" instead of "Membership Payment". Review and reclassify as needed.', size: 22 })],
                }),

                // Members Section
                new Paragraph({
                    children: [new TextRun({ text: '2. Members', bold: true, size: 32, color: '1E3A5F' })],
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 400, after: 200 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: 'Creating Members', bold: true, size: 26 })],
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 100 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: '1. Go to Members → Create Member', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '2. Fill in required fields: Name, Phone', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '3. Optional: Member ID, Banking Name, Payment Plan, Group', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '4. Click "Create Member"', size: 22 })],
                }),

                new Paragraph({
                    children: [new TextRun({ text: 'Deactivating Members', bold: true, size: 26 })],
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 100 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: 'Deactivating a member:', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• Removes them from searches and bulk messaging', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• Prevents them from signing in', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• Keeps their information for records', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• Still matches future payments to them', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• Does NOT change their balance', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• Shows red profile picture and "Deactivated" badge', size: 22 })],
                }),

                new Paragraph({
                    children: [new TextRun({ text: 'Payment Plans', bold: true, size: 26 })],
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 100 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• Monthly: Payment expected every month', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• Quarterly: Payment expected in January, April, July, October', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• Semi-annually: Payment expected in January and July', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• Yearly: Payment expected in January only', size: 22 })],
                }),

                // Finance Section
                new Paragraph({
                    children: [new TextRun({ text: '3. Finance', bold: true, size: 32, color: '1E3A5F' })],
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 400, after: 200 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: 'How Balance is Calculated', bold: true, size: 26 })],
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 100 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• Monthly membership fee: $40 (configurable)', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• Balance = Paid amount - Expected payments', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• Special Payments do NOT count towards membership balance', size: 22, bold: true })],
                }),

                new Paragraph({
                    children: [new TextRun({ text: 'Uploading Bank Statements', bold: true, size: 26 })],
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 100 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: '1. Go to Finance', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '2. Click "Upload Statement"', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '3. Select a PDF bank statement file', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '4. System automatically extracts and matches transactions', size: 22 })],
                }),

                // Messaging Section
                new Paragraph({
                    children: [new TextRun({ text: '4. Messaging', bold: true, size: 32, color: '1E3A5F' })],
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 400, after: 200 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: 'Sending Bulk Messages', bold: true, size: 26 })],
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 100 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: '1. Go to Messaging → Bulk Message tab', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '2. Select members to message', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '3. Type your message (can use placeholders like {name}, {balance})', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '4. Click "Send"', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: 'Note: Deactivated members are NOT included in bulk messaging.', size: 22, italics: true })],
                }),

                // Roles Section
                new Paragraph({
                    children: [new TextRun({ text: '5. Roles & Permissions', bold: true, size: 32, color: '1E3A5F' })],
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 400, after: 200 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: 'All board members have access to the admin dashboard.', size: 22 })],
                    spacing: { after: 100 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• Manager: Full access including Community Settings', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• Public Officer: Admin dashboard access', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• Logistics Officer: Admin dashboard access', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• Finance Officer: Admin dashboard + Finance operations', size: 22 })],
                }),

                // Footer
                new Paragraph({
                    children: [new TextRun({ text: `Generated: ${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}`, size: 18, color: '94A3B8', italics: true })],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 600 },
                }),
            ],
        }],
    })
}

// Generate Technical Handbook DOCX
function generateTechnicalHandbook(): Document {
    return new Document({
        sections: [{
            properties: {
                page: {
                    margin: { top: 720, right: 720, bottom: 720, left: 720 },
                },
            },
            children: [
                // Title
                new Paragraph({
                    children: [new TextRun({ text: 'Mesaq Technical Handbook', bold: true, size: 56, color: '1E3A5F' })],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 200 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: 'Developer & Operations Guide', size: 28, color: '64748B', italics: true })],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 400 },
                }),

                // Quick Start
                new Paragraph({
                    children: [new TextRun({ text: 'Quick Start', bold: true, size: 32, color: '1E3A5F' })],
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 300, after: 200 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: 'Stack: ', bold: true, size: 22 }), new TextRun({ text: 'Next.js 14 (App Router) + React 18 + TypeScript + Tailwind/Shadcn UI, Postgres (Supabase) via pg, JWT auth in HttpOnly cookie.', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: 'Run locally:', bold: true, size: 22 })],
                    spacing: { before: 100 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: '1. Configure .env.local', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '2. npm install', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '3. npm run dev', size: 22 })],
                }),

                // Architecture
                new Paragraph({
                    children: [new TextRun({ text: 'Architecture', bold: true, size: 32, color: '1E3A5F' })],
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 400, after: 200 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: 'Mesaq is a single Next.js application with:', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• UI pages under app/** (client components)', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• Backend API under app/api/**/route.ts (serverless)', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• Shared logic under lib/**', size: 22 })],
                }),

                // External Services
                new Paragraph({
                    children: [new TextRun({ text: 'External Services', bold: true, size: 32, color: '1E3A5F' })],
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 400, after: 200 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• Supabase Postgres: Primary database', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• Mobile Message API: SMS messaging', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• Cloudflare R2: Object storage (statements, documents)', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• Telegram Bot: Statement upload + member creation', size: 22 })],
                }),

                // Database
                new Paragraph({
                    children: [new TextRun({ text: 'Database Tables', bold: true, size: 32, color: '1E3A5F' })],
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 400, after: 200 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• users: Members and admins (auth, role, contact, banking_name)', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '  - is_active: Deactivated members can\'t log in but still receive payments', size: 22, color: '64748B' })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '  - payment_plan: monthly, quarterly, semi_annually, yearly', size: 22, color: '64748B' })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• financial_accounts: Bank accounts', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• transactions: Imported or manual transactions', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• bank_statements: Uploaded statement metadata', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• membership_payments: Payment records by month', size: 22 })],
                }),

                // Cron Jobs
                new Paragraph({
                    children: [new TextRun({ text: 'Cron Jobs', bold: true, size: 32, color: '1E3A5F' })],
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 400, after: 200 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: 'Daily cron endpoint: GET/POST /api/cron/daily', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '1st of month:', bold: true, size: 22 })],
                    spacing: { before: 100 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• Send payment reminders to members with negative balance', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• Apply pending fee changes', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: 'Every day:', bold: true, size: 22 })],
                    spacing: { before: 100 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• Send scheduled notifications', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: 'Last day of month:', bold: true, size: 22 })],
                    spacing: { before: 100 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: '• Create automated backup', size: 22 })],
                }),

                // Debugging
                new Paragraph({
                    children: [new TextRun({ text: 'Common Debugging', bold: true, size: 32, color: '1E3A5F' })],
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 400, after: 200 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: '401 Unauthorized:', bold: true, size: 22 }), new TextRun({ text: ' Check AUTH_SECRET env var and auth_token cookie', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: '403 Forbidden:', bold: true, size: 22 }), new TextRun({ text: ' Check user role matches allowed roles for endpoint', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: 'DB Connection:', bold: true, size: 22 }), new TextRun({ text: ' Use Supabase transaction pooler URL', size: 22 })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: 'PDF Parsing:', bold: true, size: 22 }), new TextRun({ text: ' Must be text-based PDF, not scanned image', size: 22 })],
                }),

                // Footer
                new Paragraph({
                    children: [new TextRun({ text: `Generated: ${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}`, size: 18, color: '94A3B8', italics: true })],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 600 },
                }),
            ],
        }],
    })
}

export async function GET(req: NextRequest) {
    const isAuthed = await verifyAuth()
    if (!isAuthed) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const docType = searchParams.get('type') // 'user-manual' or 'technical-handbook'

    try {
        let doc: Document
        let filename: string

        if (docType === 'technical-handbook') {
            doc = generateTechnicalHandbook()
            filename = 'MESAQ_Technical_Handbook.docx'
        } else {
            doc = generateUserManual()
            filename = 'MESAQ_User_Manual.docx'
        }

        const buffer = await Packer.toBuffer(doc)

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        })
    } catch (err: any) {
        console.error('Document generation error:', err)
        return NextResponse.json({ 
            error: 'Failed to generate document',
            details: err.message 
        }, { status: 500 })
    }
}

