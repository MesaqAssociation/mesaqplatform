"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { showToast } from '@/lib/toast'

type Keyword = {
  id: string
  keyword: string
  payment_type: 'Special Payment' | 'Membership Payment'
  created_at: string
  created_by_name: string | null
}

export default function PaymentKeywords() {
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [loading, setLoading] = useState(true)
  const [newKeyword, setNewKeyword] = useState('')
  const [newPaymentType, setNewPaymentType] = useState<'Special Payment' | 'Membership Payment'>('Special Payment')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    loadKeywords()
  }, [])

  const loadKeywords = async () => {
    try {
      const res = await fetch('/api/finance/keywords')
      if (res.ok) {
        const data = await res.json()
        setKeywords(data.keywords || [])
      }
    } catch (err) {
      console.error('Failed to load keywords:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!newKeyword.trim()) {
      showToast('Please enter a keyword', 'error')
      return
    }

    setAdding(true)
    try {
      const res = await fetch('/api/finance/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: newKeyword.trim(),
          paymentType: newPaymentType,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        showToast('Keyword added successfully', 'success')
        setKeywords([...keywords, data.keyword])
        setNewKeyword('')
        setNewPaymentType('Special Payment')
      } else {
        showToast(data.error || 'Failed to add keyword', 'error')
      }
    } catch (err) {
      console.error('Failed to add keyword:', err)
      showToast('Failed to add keyword', 'error')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: string, keyword: string) => {
    if (!confirm(`Are you sure you want to delete the keyword "${keyword}"?`)) {
      return
    }

    try {
      const res = await fetch(`/api/finance/keywords?id=${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        showToast('Keyword deleted successfully', 'success')
        setKeywords(keywords.filter(k => k.id !== id))
      } else {
        showToast('Failed to delete keyword', 'error')
      }
    } catch (err) {
      console.error('Failed to delete keyword:', err)
      showToast('Failed to delete keyword', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-blue-900 dark:text-blue-100">
          <strong>How it works:</strong> When a payment description contains any of these keywords, 
          it will automatically be classified based on the selected type.
        </p>
        <p className="text-xs text-blue-700 dark:text-blue-200 mt-2">
          • <strong>Special Payment:</strong> Not counted toward membership fees (meals, events, donations)
          <br />
          • <strong>Membership Payment:</strong> Counted toward membership fees (membership, monthly, dues)
        </p>
      </div>

      {/* Add New Keyword */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Label htmlFor="keyword">Keyword</Label>
          <Input
            id="keyword"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="e.g., meal, event, donation"
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
          />
        </div>
        <div className="flex-1">
          <Label htmlFor="payment-type">Payment Type</Label>
          <Select value={newPaymentType} onValueChange={(val) => setNewPaymentType(val as 'Special Payment' | 'Membership Payment')}>
            <SelectTrigger id="payment-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Special Payment">Special Payment</SelectItem>
              <SelectItem value="Membership Payment">Membership Payment</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button onClick={handleAdd} disabled={adding || !newKeyword.trim()}>
            <IconPlus className="mr-2 size-4" />
            Add
          </Button>
        </div>
      </div>

      {/* Keywords List */}
      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading keywords...</p>
        ) : keywords.length === 0 ? (
          <p className="text-sm text-muted-foreground">No keywords yet. Add one above.</p>
        ) : (
          keywords.map((kw) => (
            <div
              key={kw.id}
              className="flex items-center justify-between p-3 border border-border rounded-lg"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{kw.keyword}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    kw.payment_type === 'Special Payment' 
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                      : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                  }`}>
                    {kw.payment_type}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(kw.id, kw.keyword)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <IconTrash className="size-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

