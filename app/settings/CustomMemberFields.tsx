'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { showToast } from '@/lib/toast'
import { IconPlus, IconTrash } from '@tabler/icons-react'

type CustomField = {
  key: string
  name: string
  type: string
  createdAt: string
}

export default function CustomMemberFields() {
  const [fieldName, setFieldName] = useState('')
  const [creating, setCreating] = useState(false)
  const [fields, setFields] = useState<CustomField[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)

  // Load existing fields
  useEffect(() => {
    async function loadFields() {
      try {
        const res = await fetch('/api/settings/custom-fields')
        if (res.ok) {
          const data = await res.json()
          setFields(data.fields || [])
        }
      } catch (err) {
        console.error('Failed to load custom fields', err)
      } finally {
        setLoading(false)
      }
    }
    loadFields()
  }, [])

  async function handleCreate() {
    if (!fieldName.trim()) {
      showToast('Please enter a field name', 'error')
      return
    }

    // Validate field name (alphanumeric and spaces only)
    const cleanName = fieldName.trim()
    if (!/^[a-zA-Z0-9\s]+$/.test(cleanName)) {
      showToast('Field name can only contain letters, numbers, and spaces', 'error')
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/settings/custom-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldName: cleanName })
      })

      if (res.ok) {
        const data = await res.json()
        showToast(`Custom field "${cleanName}" created successfully`, 'success')
        setFieldName('')
        setFields([...fields, data.field])
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to create custom field', 'error')
      }
    } catch (err) {
      showToast('Failed to create custom field', 'error')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(fieldKey: string, fieldName: string) {
    if (!confirm(`Are you sure you want to delete "${fieldName}"? This will remove this field from all members.`)) {
      return
    }

    setDeletingKey(fieldKey)
    try {
      const res = await fetch('/api/settings/custom-fields', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldKey })
      })

      if (res.ok) {
        showToast(`Field "${fieldName}" deleted`, 'success')
        setFields(fields.filter(f => f.key !== fieldKey))
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to delete field', 'error')
      }
    } catch (err) {
      showToast('Failed to delete field', 'error')
    } finally {
      setDeletingKey(null)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Add custom fields to store additional information about members. 
        These fields will appear in member creation, member profiles, and the member portal.
      </p>

      <div className="flex gap-2">
        <div className="flex-1">
          <Label htmlFor="fieldName" className="sr-only">Field Name</Label>
          <Input
            id="fieldName"
            value={fieldName}
            onChange={(e) => setFieldName(e.target.value)}
            placeholder="Enter field name (e.g., Skills, Languages)"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreate()
              }
            }}
          />
        </div>
        <Button onClick={handleCreate} disabled={creating || !fieldName.trim()}>
          <IconPlus className="size-4 mr-2" />
          {creating ? 'Creating...' : 'Add Field'}
        </Button>
      </div>

      {/* Existing Fields */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading fields...</p>
      ) : fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">No custom fields added yet.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium">Existing Fields:</p>
          <div className="border rounded-lg divide-y">
            {fields.map((field) => (
              <div key={field.key} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium">{field.name}</p>
                  <p className="text-xs text-muted-foreground">Key: {field.key}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(field.key, field.name)}
                  disabled={deletingKey === field.key}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  <IconTrash className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
