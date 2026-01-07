'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { showToast } from '@/lib/toast'
import { IconPlus } from '@tabler/icons-react'

export default function CustomMemberFields() {
  const [fieldName, setFieldName] = useState('')
  const [creating, setCreating] = useState(false)

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
        showToast(`Custom field "${cleanName}" created successfully`, 'success')
        setFieldName('')
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
            placeholder="Enter field name (e.g., Occupation, Skills)"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreate()
              }
            }}
          />
        </div>
        <Button onClick={handleCreate} disabled={creating || !fieldName.trim()}>
          <IconPlus className="size-4 mr-2" />
          {creating ? 'Creating...' : 'Create'}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Note: Previously added fields are not shown here but are active in member profiles.
      </p>
    </div>
  )
}

