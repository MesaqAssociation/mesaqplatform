/**
 * Test script for Mobile Message API
 * 
 * Usage:
 * 1. Make sure .env.local has MOBILE_MESSAGE_USERNAME and MOBILE_MESSAGE_PASSWORD
 * 2. Run: node scripts/test-mobile-message.js
 */

require('dotenv').config({ path: '.env.local' })

const username = process.env.MOBILE_MESSAGE_USERNAME
const password = process.env.MOBILE_MESSAGE_PASSWORD

if (!username || !password) {
  console.error('❌ Missing MOBILE_MESSAGE_USERNAME or MOBILE_MESSAGE_PASSWORD in .env.local')
  process.exit(1)
}

console.log('✅ Credentials found')
console.log(`   Username: ${username}`)
console.log(`   Password: ${password.substring(0, 3)}...${password.substring(password.length - 3)}`)
console.log('')

const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')

async function testBalance() {
  console.log('📊 Testing Balance/Account endpoint...')
  console.log('   GET https://api.mobilemessage.com.au/v1/account')
  
  try {
    const response = await fetch('https://api.mobilemessage.com.au/v1/account', {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      }
    })
    
    console.log(`   Status: ${response.status} ${response.statusText}`)
    
    const text = await response.text()
    console.log('   Response:', text)
    
    try {
      const json = JSON.parse(text)
      console.log('   Parsed JSON:', JSON.stringify(json, null, 2))
    } catch {
      console.log('   (Response is not valid JSON)')
    }
  } catch (error) {
    console.error('   Error:', error.message)
  }
  console.log('')
}

async function testAlternativeEndpoints() {
  console.log('🔍 Testing alternative balance endpoints...')
  
  const endpoints = [
    'https://api.mobilemessage.com.au/v1/balance',
    'https://api.mobilemessage.com.au/v1/credits',
    'https://api.mobilemessage.com.au/v1/account/balance',
    'https://api.mobilemessage.com.au/account',
    'https://api.mobilemessage.com.au/balance',
  ]
  
  for (const url of endpoints) {
    console.log(`   GET ${url}`)
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        }
      })
      console.log(`   Status: ${response.status}`)
      if (response.ok) {
        const text = await response.text()
        console.log(`   ✅ Response: ${text.substring(0, 200)}`)
      }
    } catch (error) {
      console.log(`   Error: ${error.message}`)
    }
  }
  console.log('')
}

async function testSendEndpoints() {
  console.log('📤 Testing Send SMS endpoints (no actual send)...')
  
  const endpoints = [
    'https://api.mobilemessage.com.au/v1/sms',
    'https://api.mobilemessage.com.au/v1/sms/send',
    'https://api.mobilemessage.com.au/v1/send',
    'https://api.mobilemessage.com.au/sms',
    'https://api.mobilemessage.com.au/send',
  ]
  
  // Just check if endpoint exists with OPTIONS or a minimal GET
  for (const url of endpoints) {
    console.log(`   Checking ${url}`)
    try {
      // Try GET first to see if endpoint exists
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        }
      })
      console.log(`   GET Status: ${response.status}`)
      if (response.status !== 404) {
        const text = await response.text()
        console.log(`   Response: ${text.substring(0, 100)}`)
      }
    } catch (error) {
      console.log(`   Error: ${error.message}`)
    }
  }
  console.log('')
}

async function main() {
  console.log('='.repeat(60))
  console.log('Mobile Message API Test')
  console.log('='.repeat(60))
  console.log('')
  
  await testBalance()
  await testAlternativeEndpoints()
  await testSendEndpoints()
  
  console.log('='.repeat(60))
  console.log('Test complete!')
  console.log('='.repeat(60))
}

main().catch(console.error)

