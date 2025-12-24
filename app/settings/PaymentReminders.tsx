"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { IconSend, IconRefresh, IconAlertCircle, IconCheck, IconTestPipe } from '@tabler/icons-react'
import { showToast } from '@/lib/toast'

type Member = {
  id: string
  name: string
  memberId: string | null
  phone: string
  balance: number
}

type Account = {
  bsb: string
  account_number: string
  account_name: string
}

export default function PaymentReminders() {
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [account, setAccount] = useState<Account | null>(null)
  const [testNumber, setTestNumber] = useState<string | null>(null)
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const [testMode, setTestMode] = useState(true)

  useEffect(() => {
    loadPreview()
  }, [])

  const loadPreview = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/payment-reminders/send')
      if (res.ok) {
        const data = await res.json()
        setMembers(data.members || [])
        setAccount(data.account)
        setTestNumber(data.testNumber)
      }
    } catch (err) {
      console.error('Failed to load preview:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSendTest = async () => {
    if (!selectedMemberId) {
      showToast('Please select a member to test', 'error')
      return
    }

    if (!testNumber) {
      showToast('No test number configured. Set WHATSAPP_TEST_NUMBER in environment.', 'error')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/payment-reminders/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testMode: true,
          memberId: selectedMemberId
        })
      })

      const data = await res.json()
      
      if (res.ok && data.success) {
        showToast(data.message, 'success')
      } else {
        showToast(data.error || 'Failed to send test', 'error')
      }
    } catch (err) {
      console.error('Send test error:', err)
      showToast('Failed to send test message', 'error')
    } finally {
      setSending(false)
    }
  }

  const handleSendAll = async () => {
    if (members.length === 0) {
      showToast('No members with negative balance to remind', 'error')
      return
    }

    const confirmed = window.confirm(
      `Are you sure you want to send payment reminders to ${members.length} members with negative balance?`
    )

    if (!confirmed) return

    setSending(true)
    try {
      const res = await fetch('/api/payment-reminders/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testMode: false
        })
      })

      const data = await res.json()
      
      if (res.ok && data.success) {
        showToast(`Sent ${data.sent} reminders (${data.skipped} skipped, ${data.failed} failed)`, 'success')
      } else {
        showToast(data.error || 'Failed to send reminders', 'error')
      }
    } catch (err) {
      console.error('Send reminders error:', err)
      showToast('Failed to send reminders', 'error')
    } finally {
      setSending(false)
    }
  }

  const selectedMember = members.find(m => m.id === selectedMemberId)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <IconSend className="size-5" />
              Payment Reminders
            </CardTitle>
            <CardDescription>
              Send WhatsApp payment reminders to members with negative balance
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={loadPreview} disabled={loading}>
            <IconRefresh className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Account Info */}
        {account && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium mb-2">Payment Details (included in message):</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">BSB:</span>{' '}
                <span className="font-mono">{account.bsb}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Account:</span>{' '}
                <span className="font-mono">{account.account_number}</span>
              </div>
            </div>
          </div>
        )}

        {/* Status */}
        <div className="flex items-center gap-4">
          <Badge variant={members.length > 0 ? 'destructive' : 'secondary'}>
            {members.length} members with negative balance
          </Badge>
          {testNumber && (
            <Badge variant="outline" className="font-mono">
              Test: {testNumber}
            </Badge>
          )}
        </div>

        {/* Test Mode Section */}
        <div className="border rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2">
            <IconTestPipe className="size-5 text-yellow-500" />
            <h4 className="font-medium">Test Mode</h4>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Select a member to send their actual reminder message to your test number.
          </p>

          <div className="flex gap-3">
            <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a member to test..." />
              </SelectTrigger>
              <SelectContent>
                {members.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} (${Math.abs(m.balance).toFixed(0)} owed)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button 
              onClick={handleSendTest} 
              disabled={sending || !selectedMemberId || !testNumber}
              variant="outline"
            >
              <IconTestPipe className="size-4 mr-2" />
              {sending ? 'Sending...' : 'Send Test'}
            </Button>
          </div>

          {selectedMember && (
            <div className="text-sm p-3 bg-muted rounded-md">
              <p className="font-medium mb-1">Preview:</p>
              <p className="text-muted-foreground">
                "Hi {selectedMember.name}, your membership balance is ${Math.abs(selectedMember.balance).toFixed(0)}. 
                Please pay to BSB: {account?.bsb}, Acc: {account?.account_number}"
              </p>
            </div>
          )}
        </div>

        {/* Send to All */}
        <div className="border-t pt-4">
          <Button 
            onClick={handleSendAll}
            disabled={sending || members.length === 0}
            className="w-full"
            variant="default"
          >
            <IconSend className="size-4 mr-2" />
            {sending ? 'Sending...' : `Send Reminders to All ${members.length} Members`}
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-2">
            This will send real WhatsApp messages to all members with negative balance
          </p>
        </div>

        {/* Members List Preview */}
        {members.length > 0 && (
          <div className="border rounded-lg">
            <div className="p-3 border-b bg-muted/30">
              <h4 className="font-medium text-sm">Members to Remind</h4>
            </div>
            <div className="max-h-[200px] overflow-y-auto">
              {members.slice(0, 20).map(m => (
                <div key={m.id} className="flex items-center justify-between p-2 border-b last:border-0 text-sm">
                  <span>{m.name}</span>
                  <span className="text-red-600 font-medium">${Math.abs(m.balance).toFixed(0)}</span>
                </div>
              ))}
              {members.length > 20 && (
                <div className="p-2 text-center text-sm text-muted-foreground">
                  ... and {members.length - 20} more
                </div>
              )}
            </div>
          </div>
        )}

        {!testNumber && (
          <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md text-yellow-700 dark:text-yellow-400">
            <IconAlertCircle className="size-5 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Test number not configured</p>
              <p className="text-yellow-600 dark:text-yellow-500">
                Set WHATSAPP_TEST_NUMBER in environment variables to enable test mode
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

