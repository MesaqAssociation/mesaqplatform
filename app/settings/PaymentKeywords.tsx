"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { showToast } from '@/lib/toast'

type Keyword = {
  id: string
  keyword: string
  description: string | null
  created_at: string
  created_by_name: string | null
}

export default function PaymentKeywords() {
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [loading, setLoading] = useState(true)
  const [newKeyword, setNewKeyword] = useState('')
  const [newDescription, setNewDescription] = useState('')
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
          description: newDescription.trim() || null,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        showToast('Keyword added successfully', 'success')
        setKeywords([...keywords, data.keyword])
        setNewKeyword('')
        setNewDescription('')
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
          it will automatically be classified as a "Special Payment" (not counted toward membership fees).
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
          <Label htmlFor="description">Description (optional)</Label>
          <Input
            id="description"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="e.g., Payment for meals"
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
          />
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
                <p className="font-medium">{kw.keyword}</p>
                {kw.description && (
                  <p className="text-sm text-muted-foreground">{kw.description}</p>
                )}
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

