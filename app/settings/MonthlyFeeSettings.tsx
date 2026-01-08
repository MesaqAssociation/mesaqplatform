"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { showToast } from '@/lib/toast'

type Props = {
  initialFee: string
}

export default function MonthlyFeeSettings({ initialFee }: Props) {
  const [fee, setFee] = useState(initialFee)
  const [pendingFee, setPendingFee] = useState<string | null>(null)
  const [effectiveDate, setEffectiveDate] = useState<string | null>(null)
  
  // Load pending fee info
  useEffect(() => {
    const loadPendingFee = async () => {
      try {
        const res = await fetch('/api/settings/monthly-fee')
        if (res.ok) {
          const data = await res.json()
          if (data.pendingFee) {
            setPendingFee(data.pendingFee.toFixed(2))
            setEffectiveDate(data.effectiveDate)
          }
        }
      } catch (err) {
        console.error('Failed to load pending fee:', err)
      }
    }
    loadPendingFee()
  }, [])
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const handleSaveClick = () => {
    if (fee === initialFee) {
      showToast('No changes to save', 'info')
      return
    }
    setShowConfirmDialog(true)
    setConfirmText('')
  }

  const handleConfirmSave = async () => {
    if (confirmText.toLowerCase() !== 'confirm') {
      showToast('Please type "confirm" to proceed', 'error')
      return
    }

    setIsSaving(true)
    setShowConfirmDialog(false)
    
    try {
      const response = await fetch('/api/settings/monthly-fee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fee, oldFee: initialFee }),
      })

      if (response.ok) {
        const data = await response.json()
        setPendingFee(data.fee)
        setEffectiveDate(data.effectiveDate)
        setIsEditing(false)
        showToast(`Fee will change to $${data.fee} on ${data.effectiveDate}`, 'success')
      } else {
        const error = await response.json()
        showToast(error.error || 'Failed to update fee', 'error')
      }
    } catch (error) {
      console.error('Error updating fee:', error)
      showToast('An error occurred while updating the fee', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setFee(initialFee)
    setIsEditing(false)
  }

  const handleCancelPending = async () => {
    if (!confirm('Cancel the pending fee change?')) return
    
    setIsSaving(true)
    try {
      const response = await fetch('/api/settings/monthly-fee', {
        method: 'DELETE',
      })

      if (response.ok) {
        setPendingFee(null)
        setEffectiveDate(null)
        showToast('Pending fee change cancelled', 'success')
      } else {
        const error = await response.json()
        showToast(error.error || 'Failed to cancel pending change', 'error')
      }
    } catch (error) {
      console.error('Error cancelling pending fee:', error)
      showToast('An error occurred', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
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
          </div>
          <p className="text-xs text-muted-foreground">
            💡 Fee changes will apply from the 1st of next month. Past months remain unchanged.
          </p>
          {pendingFee && effectiveDate && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md flex items-center justify-between gap-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⏳ Pending change: <strong>${pendingFee}</strong> starting {new Date(effectiveDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCancelPending}
                disabled={isSaving}
                className="shrink-0"
              >
                Cancel Change
              </Button>
            </div>
          )}
        </div>

        {isEditing && (
          <div className="flex gap-2">
            <Button
              onClick={handleSaveClick}
              disabled={isSaving || !fee || parseFloat(fee) <= 0}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
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

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Fee Change</DialogTitle>
            <DialogDescription>
              You are about to change the monthly membership fee from ${initialFee} to ${fee}.
              This will affect all members. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2">
            <Label htmlFor="confirm">Type "confirm" to proceed</Label>
            <Input
              id="confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="confirm"
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSave}
              disabled={confirmText.toLowerCase() !== 'confirm'}
            >
              Confirm Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

