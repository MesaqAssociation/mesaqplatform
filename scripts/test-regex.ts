const testLines = [
  "08 SepTransfer from ABDUL MOHAMMADI NetBank",
  "05 Sep2025 OPENING BALANCE$49,662.83CR",
  "13 SepFast Transfer From NARGIS SUREYA SULTANI",
  "04 Oct 2025 CLOSING BALANCE$51,352.83CR",
]

const pattern = /^(\d{1,2}\s+\w{3})(?:\s+\d{4})?\s+(.+)/

testLines.forEach(line => {
  console.log(`\nTesting: "${line}"`)
  const match = line.match(pattern)
  if (match) {
    console.log(`  ✅ MATCH`)
    console.log(`     Date: "${match[1]}"`)
    console.log(`     Transaction: "${match[2]}"`)
  } else {
    console.log(`  ❌ NO MATCH`)
    
    // Try without requiring space after month
    const pattern2 = /^(\d{1,2}\s+\w{3})(.+)/
    const match2 = line.match(pattern2)
    if (match2) {
      console.log(`  ✅ MATCH (no space required)`)
      console.log(`     Date: "${match2[1]}"`)
      console.log(`     Rest: "${match2[2]}"`)
    }
  }
})

