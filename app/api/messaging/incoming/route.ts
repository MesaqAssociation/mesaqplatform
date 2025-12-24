import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { corsHeaders } from '@/lib/cors'

export const runtime = 'nodejs'

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function GET(req: NextRequest) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
  }
  
  try {
    jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
  }

  try {
    const apiKey = process.env.PICKY_ASSIST_API_KEY
    const projectId = process.env.PICKY_ASSIST_PROJECT_ID

    if (!apiKey || !projectId) {
      return NextResponse.json({ 
        error: 'Picky Assist not configured',
        messages: [] 
      }, { headers: corsHeaders })
    }

    const { searchParams } = new URL(req.url)
    const limit = searchParams.get('limit') || '50'

    // Fetch incoming messages from Picky Assist
    const endpoint = `https://app.pickyassist.com/app/api/v2/messages?project_id=${projectId}&limit=${limit}&direction=inbound`
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      }
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Failed to fetch incoming messages:', error)
      return NextResponse.json({ 
        error: 'Failed to fetch messages',
        messages: [] 
      }, { headers: corsHeaders })
    }

    const result = await response.json()
    const messages = result.messages || result.data || []

    // Format messages for display
    const formattedMessages = messages.map((msg: any) => ({
      id: msg.id || msg.message_id,
      phone: msg.phone || msg.from || msg.sender,
      message: msg.message || msg.body || msg.text,
      timestamp: msg.timestamp || msg.created_at || msg.date,
      type: msg.type || 'text',
      status: msg.status || 'received'
    }))

    return NextResponse.json({ 
      messages: formattedMessages 
    }, { headers: corsHeaders })
  } catch (err: any) {
    console.error('Get incoming messages error:', err)
    return NextResponse.json({ 
      error: 'Failed to fetch messages',
      messages: [] 
    }, { headers: corsHeaders })
  }
}

