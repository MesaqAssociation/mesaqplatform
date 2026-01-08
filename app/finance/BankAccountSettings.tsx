'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
      <div className="grid grid-cols-1 gap-4 p-4 bg-muted/30 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Account Name</span>
          <span className="font-medium">{mainAccount.account_name || 'Not set'}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">BSB</span>
          <span className="font-medium font-mono">{formatBsb(mainAccount.bsb) || 'Not set'}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Account Number</span>
          <span className="font-medium font-mono">{mainAccount.account_number || 'Not set'}</span>
        </div>
      </div>

      {!showEditDialog ? (
        <Button onClick={openEditDialog} className="w-full">
          <IconEdit className="size-4 mr-2" />
          Edit Details
        </Button>
      ) : (
        <div className="space-y-4 pt-4 border-t">
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

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowEditDialog(false)} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={saving || confirmText.toLowerCase() !== 'confirm'}
              className="flex-1"
            >
              <IconCheck className="size-4 mr-2" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

