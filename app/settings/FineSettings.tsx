"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { showToast } from '@/lib/toast'

type FineSettingsProps = {
  initialEnabled: boolean
  initialAmount: string
}

export default function FineSettings({ initialEnabled, initialAmount }: FineSettingsProps) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [amount, setAmount] = useState(initialAmount)
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    if (!amount || parseFloat(amount) < 0) {
      showToast('Please enter a valid fine amount', 'error')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/settings/fines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          amount: parseFloat(amount)
        })
      })

      if (res.ok) {
        showToast('Fine settings updated successfully', 'success')
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to update settings', 'error')
      }
    } catch (err) {
      console.error('Failed to update fine settings:', err)
      showToast('Failed to update settings', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="fines-enabled" className="text-base">
            Enable Late Payment Fines
          </Label>
          <p className="text-sm text-muted-foreground">
            Apply fines to members who haven't paid after multiple reminders
          </p>
        </div>
        <Switch
          id="fines-enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="fine-amount">
          Fine Amount (AUD)
        </Label>
        <Input
          id="fine-amount"
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={!enabled}
          placeholder="10.00"
        />
        <p className="text-sm text-muted-foreground">
          This amount will be added to unpaid fees after the final reminder
        </p>
      </div>

      <div className="bg-muted p-4 rounded-lg space-y-2">
        <h4 className="text-sm font-medium">How it works:</h4>
        <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
          <li>Day 7: First reminder sent to unpaid members</li>
          <li>Day 14: Second reminder (if still unpaid)</li>
          <li>Next month, Day 7: {enabled ? 'Fine applied and notice sent' : 'Continued reminder sent'}</li>
        </ul>
      </div>

      <Button onClick={handleSave} disabled={loading}>
        {loading ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  )
}

