import pdf from 'pdf-parse'
import fs from 'fs'
import path from 'path'

async function extractText() {
  try {
    const pdfPath = path.join(process.cwd(), 'public', 'Statement(19) copy.pdf')
    
    console.log('📄 Reading PDF file...')
    const buffer = fs.readFileSync(pdfPath)
    
    console.log('🔍 Extracting text...\n')
    const data = await pdf(buffer)
    
    console.log('='.repeat(80))
    console.log('RAW PDF TEXT')
    console.log('='.repeat(80))
    console.log(data.text)
    console.log('='.repeat(80))
    console.log(`\nTotal pages: ${data.numpages}`)
    console.log(`Total text length: ${data.text.length} characters`)
    
    // Save to file for easier inspection
    const outputPath = path.join(process.cwd(), 'pdf-text-output.txt')
    fs.writeFileSync(outputPath, data.text)
    console.log(`\n✅ Text saved to: ${outputPath}`)
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    console.error(error)
  }
}

extractText()

