"use client"

import { useState } from 'react'
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
        setFee(data.fee)
        setIsEditing(false)
        showToast(`Monthly membership fee updated to $${data.fee}`, 'success')
        // Reload page to update the fee everywhere
        setTimeout(() => window.location.reload(), 1500)
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
              This will affect all community members. This action cannot be undone.
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

