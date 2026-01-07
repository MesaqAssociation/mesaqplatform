'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { showToast } from '@/lib/toast'
import { IconEdit, IconCheck } from '@tabler/icons-react'

type Account = {
  id: string
  account_name: string
  account_number: string
  bsb: string
  is_main_membership_account: boolean
}

export default function BankAccountSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mainAccount, setMainAccount] = useState<Account | null>(null)
  
  // Edit dialog state
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [accountName, setAccountName] = useState('')
  const [bsb, setBsb] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [confirmText, setConfirmText] = useState('')

  useEffect(() => {
    loadAccount()
  }, [])

  async function loadAccount() {
    try {
      const res = await fetch('/api/finance/accounts')
      if (res.ok) {
        const data = await res.json()
        const main = data.accounts?.find((a: Account) => a.is_main_membership_account)
        setMainAccount(main || null)
      }
    } catch (err) {
      console.error('Failed to load account:', err)
    } finally {
      setLoading(false)
    }
  }

  function openEditDialog() {
    if (mainAccount) {
      setAccountName(mainAccount.account_name || '')
      setBsb(mainAccount.bsb || '')
      setAccountNumber(mainAccount.account_number || '')
    }
    setConfirmText('')
    setShowEditDialog(true)
  }

  async function handleSave() {
    if (confirmText.toLowerCase() !== 'confirm') {
      showToast('Please type "confirm" to save changes', 'error')
      return
    }

    if (!accountName.trim() || !bsb.trim() || !accountNumber.trim()) {
      showToast('All fields are required', 'error')
      return
    }

    // Validate BSB format (6 digits)
    const cleanBsb = bsb.replace(/-/g, '')
    if (!/^\d{6}$/.test(cleanBsb)) {
      showToast('BSB must be 6 digits (format: XXX-XXX)', 'error')
      return
    }

    // Validate account number (typically 6-10 digits)
    const cleanAccountNumber = accountNumber.replace(/\s/g, '')
    if (!/^\d{6,10}$/.test(cleanAccountNumber)) {
      showToast('Account number must be 6-10 digits', 'error')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/finance/accounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: mainAccount?.id,
          account_name: accountName.trim(),
          bsb: cleanBsb,
          account_number: cleanAccountNumber
        })
      })

      if (res.ok) {
        showToast('Bank account updated successfully', 'success')
        setShowEditDialog(false)
        setConfirmText('')
        loadAccount()
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to update account', 'error')
      }
    } catch (err) {
      showToast('Failed to update account', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-10 bg-muted/50 rounded animate-pulse" />
        <div className="h-10 bg-muted/50 rounded animate-pulse" />
      </div>
    )
  }

  if (!mainAccount) {
    return (
      <p className="text-sm text-muted-foreground">
        No main membership account configured. Please set up an account in the Finance section.
      </p>
    )
  }

  const formatBsb = (bsb: string) => {
    const clean = bsb.replace(/-/g, '')
    if (clean.length === 6) {
      return `${clean.slice(0, 3)}-${clean.slice(3)}`
    }
    return bsb
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Account Name</p>
          <p className="font-medium">{mainAccount.account_name || 'Not set'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">BSB</p>
          <p className="font-medium font-mono">{formatBsb(mainAccount.bsb) || 'Not set'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Account Number</p>
          <p className="font-medium font-mono">{mainAccount.account_number || 'Not set'}</p>
        </div>
      </div>

      <Button onClick={openEditDialog} variant="outline" size="sm">
        <IconEdit className="size-4 mr-2" />
        Edit Bank Details
      </Button>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => {
        if (!open) {
          setShowEditDialog(false)
          setConfirmText('')
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Bank Account Details</DialogTitle>
            <DialogDescription>
              Update the main membership account details. These are shown in payment reminders.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="accountName">Account Name</Label>
              <Input
                id="accountName"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g., Mesaq Association"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bsb">BSB</Label>
                <Input
                  id="bsb"
                  value={bsb}
                  onChange={(e) => setBsb(e.target.value)}
                  placeholder="XXX-XXX"
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label htmlFor="accountNumber">Account Number</Label>
                <Input
                  id="accountNumber"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="XXXXXX"
                  className="mt-1 font-mono"
                />
              </div>
            </div>

            <div className="pt-2 border-t">
              <Label htmlFor="confirm">Type "confirm" to save changes</Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="confirm"
                autoComplete="off"
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={saving || confirmText.toLowerCase() !== 'confirm'}
            >
              <IconCheck className="size-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

