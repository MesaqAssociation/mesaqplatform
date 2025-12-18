/**
 * Script to generate a clean Word template for board member reports
 * Run with: npx tsx scripts/create-report-template.ts
 * 
 * This creates a template file that can be edited in Word
 * and used with Docxtemplater without XML fragmentation issues.
 */

import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType, BorderStyle, HeadingLevel, Header, Footer, PageNumber, ImageRun } from 'docx'
import { writeFileSync } from 'fs'
import { join } from 'path'

async function createTemplate() {
  // Create header row
  const headerRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ 
          children: [new TextRun({ text: 'Name', bold: true, size: 24 })] 
        })],
        shading: { fill: '1a365d' },
        width: { size: 40, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ 
          children: [new TextRun({ text: 'Phone', bold: true, size: 24, color: 'FFFFFF' })] 
        })],
        shading: { fill: '1a365d' },
        width: { size: 30, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ 
          children: [new TextRun({ text: 'Balance', bold: true, size: 24, color: 'FFFFFF' })] 
        })],
        shading: { fill: '1a365d' },
        width: { size: 30, type: WidthType.PERCENTAGE },
      }),
    ],
    tableHeader: true,
  })

  // Sample data rows (will be replaced dynamically)
  const sampleRows = [
    { name: '{name}', phone: '{phone}', balance: '{balance}' },
    { name: 'John Smith', phone: '0412345678', balance: '$0.00' },
    { name: 'Jane Doe', phone: '0498765432', balance: '$120.00' },
  ].map((data, index) => new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ 
          children: [new TextRun({ text: data.name, size: 22 })] 
        })],
        shading: { fill: index % 2 === 0 ? 'f8fafc' : 'FFFFFF' },
      }),
      new TableCell({
        children: [new Paragraph({ 
          children: [new TextRun({ text: data.phone, size: 22 })] 
        })],
        shading: { fill: index % 2 === 0 ? 'f8fafc' : 'FFFFFF' },
      }),
      new TableCell({
        children: [new Paragraph({ 
          children: [new TextRun({ 
            text: data.balance, 
            size: 22,
            color: data.balance.includes('$0') ? '000000' : 'DC2626'
          })] 
        })],
        shading: { fill: index % 2 === 0 ? 'f8fafc' : 'FFFFFF' },
      }),
    ],
  }))

  // Total row
  const totalRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ 
          children: [new TextRun({ text: 'TOTAL', bold: true, size: 24 })] 
        })],
        shading: { fill: 'e2e8f0' },
        columnSpan: 2,
      }),
      new TableCell({
        children: [new Paragraph({ 
          children: [new TextRun({ text: '{total}', bold: true, size: 24 })] 
        })],
        shading: { fill: 'e2e8f0' },
      }),
    ],
  })

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 720,    // 0.5 inch
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
                new TextRun({ text: 'MESAQ Association', bold: true, size: 28 }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'Page ', size: 18 }),
                new TextRun({
                  children: [PageNumber.CURRENT],
                  size: 18,
                }),
                new TextRun({ text: ' of ', size: 18 }),
                new TextRun({
                  children: [PageNumber.TOTAL_PAGES],
                  size: 18,
                }),
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
            new TextRun({ 
              text: 'Board Member Report', 
              bold: true, 
              size: 48,
              color: '1a365d'
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        // Subtitle with date
        new Paragraph({
          children: [
            new TextRun({ 
              text: 'Generated: {date}', 
              size: 24,
              italics: true,
              color: '64748b'
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),
        // Summary section
        new Paragraph({
          children: [
            new TextRun({ text: 'Summary', bold: true, size: 28 })
          ],
          spacing: { before: 200, after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Total Members: {memberCount}', size: 22 })
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Total Outstanding: {totalOwed}', size: 22, color: 'DC2626' })
          ],
          spacing: { after: 300 },
        }),
        // Table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [headerRow, ...sampleRows, totalRow],
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: 'e2e8f0' },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: 'e2e8f0' },
            left: { style: BorderStyle.SINGLE, size: 1, color: 'e2e8f0' },
            right: { style: BorderStyle.SINGLE, size: 1, color: 'e2e8f0' },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'e2e8f0' },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'e2e8f0' },
          },
        }),
        // Notes section
        new Paragraph({
          children: [
            new TextRun({ text: 'Notes', bold: true, size: 28 })
          ],
          spacing: { before: 400, after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({ 
              text: '• Balances in red indicate outstanding amounts owed',
              size: 22,
              color: '64748b'
            })
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ 
              text: '• This report is auto-generated from the Mesaq platform',
              size: 22,
              color: '64748b'
            })
          ],
        }),
      ],
    }],
  })

  const buffer = await Packer.toBuffer(doc)
  const outputPath = join(process.cwd(), 'public', 'report-template-styled.docx')
  writeFileSync(outputPath, buffer)
  
  console.log(`✅ Template created at: ${outputPath}`)
  console.log('\nYou can now edit this template in Word to customize the styling.')
  console.log('The following placeholders will be replaced dynamically:')
  console.log('  {date} - Report generation date')
  console.log('  {memberCount} - Total number of members')
  console.log('  {totalOwed} - Total outstanding balance')
  console.log('  {name}, {phone}, {balance} - Member data in each row')
}

createTemplate().catch(console.error)
