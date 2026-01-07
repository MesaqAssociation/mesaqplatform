import { Pool } from 'pg'

export type SentMessageData = {
  messageType: 'payment_reminder' | 'event_notification' | 'scheduled' | 'admin_message'
  templateId?: string
  messageContent: string
  recipientPhone: string
  recipientName?: string
  recipientMemberId?: string
  status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
  pickyAssistId?: string
  errorMessage?: string
  sentBy?: string
  batchId?: string
}

/**
 * Store a sent message in the database
 */
export async function storeSentMessage(
  pool: Pool,
  data: SentMessageData
): Promise<string | null> {
  try {
    const { rows } = await pool.query(`
      INSERT INTO sent_messages (
        message_type,
        template_id,
        message_content,
        recipient_phone,
        recipient_name,
        recipient_member_id,
        status,
        picky_assist_id,
        error_message,
        sent_by,
        batch_id,
        sent_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      RETURNING id
    `, [
      data.messageType,
      data.templateId || null,
      data.messageContent,
      data.recipientPhone,
      data.recipientName || null,
      data.recipientMemberId || null,
      data.status || 'sent',
      data.pickyAssistId || null,
      data.errorMessage || null,
      data.sentBy || null,
      data.batchId || null
    ])
    
    return rows[0]?.id || null
  } catch (error) {
    console.error('Failed to store sent message:', error)
    return null
  }
}

/**
 * Store multiple sent messages in a batch
 */
export async function storeSentMessagesBatch(
  pool: Pool,
  messages: SentMessageData[],
  batchId?: string
): Promise<number> {
  if (messages.length === 0) return 0
  
  const actualBatchId = batchId || crypto.randomUUID()
  let stored = 0
  
  for (const msg of messages) {
    const id = await storeSentMessage(pool, { ...msg, batchId: actualBatchId })
    if (id) stored++
  }
  
  return stored
}

/**
 * Update message status from Picky Assist webhook
 */
export async function updateMessageStatus(
  pool: Pool,
  pickyAssistId: string,
  status: 'delivered' | 'read' | 'failed',
  errorMessage?: string
): Promise<boolean> {
  try {
    const timestampColumn = status === 'delivered' ? 'delivered_at' 
                          : status === 'read' ? 'read_at' 
                          : 'failed_at'
    
    const { rowCount } = await pool.query(`
      UPDATE sent_messages 
      SET 
        status = $1,
        ${timestampColumn} = NOW(),
        error_message = COALESCE($2, error_message)
      WHERE picky_assist_id = $3
    `, [status, errorMessage || null, pickyAssistId])
    
    return (rowCount || 0) > 0
  } catch (error) {
    console.error('Failed to update message status:', error)
    return false
  }
}

/**
 * Generate a batch ID for grouping messages
 */
export function generateBatchId(): string {
  return crypto.randomUUID()
}

