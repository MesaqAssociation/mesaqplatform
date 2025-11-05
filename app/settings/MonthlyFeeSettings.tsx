"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  initialFee: string
}

export default function MonthlyFeeSettings({ initialFee }: Props) {
  const [fee, setFee] = useState(initialFee)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    
    try {
      const response = await fetch('/api/settings/monthly-fee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fee, oldFee: initialFee }),
      })

      if (response.ok) {
        const data = await response.json()
        setFee(data.fee)
        setIsEditing(false)
        // Show success message
        alert(`Monthly membership fee updated to $${data.fee}`)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to update fee')
      }
    } catch (error) {
      console.error('Error updating fee:', error)
      alert('An error occurred while updating the fee')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setFee(initialFee)
    setIsEditing(false)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="monthlyFee">Monthly Membership Fee (AUD)</Label>
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              id="monthlyFee"
              type="text"
              value={fee}
              onChange={(e) => {
                const value = e.target.value
                if (/^\d*\.?\d{0,2}$/.test(value)) {
                  setFee(value)
                  if (!isEditing) setIsEditing(true)
                }
              }}
              placeholder="0.00"
              className="pl-7"
              autoComplete="off"
              disabled={isSaving}
            />
          </div>
          
          {isEditing && (
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={isSaving || !fee || parseFloat(fee) <= 0}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          This fee applies to all Community Members. Board Members and Head Board Member are exempt.
        </p>
        <p className="text-xs text-muted-foreground">
          Members must pay before the last day of each month.
        </p>
      </div>

      <div className="pt-4 border-t">
        <h3 className="text-sm font-medium mb-2">Payment Detection</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Payments are automatically detected from bank statements by matching:
        </p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>Member's phone number (10 digits starting with 04) in transaction description</li>
          <li>Transaction amount matching the monthly fee</li>
          <li>Credit transactions only</li>
        </ul>
      </div>
    </div>
  )
}

