'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { IconChevronDown, IconHistory, IconPlus, IconDownload } from '@tabler/icons-react'
import { showToast } from '@/lib/toast'

type Backup = {
  key: string
  name: string
  size: number
  lastModified: string
  url: string
  month: string
  year: number
  timestamp: number
}

export default function BackupRestore() {
  const [backups, setBackups] = useState<Backup[]>([])
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  // Create a new backup
  const handleCreateBackup = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/backup/r2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      
      const data = await res.json()
      if (res.ok) {
        showToast(`Backup created: ${data.filename || 'Success'}`, 'success')
        // Reload backups list
        loadBackups()
      } else {
        console.error('Backup creation failed:', data)
        showToast(data.error || 'Failed to create backup', 'error')
      }
    } catch (err) {
      console.error('Failed to create backup', err)
      showToast('Failed to create backup', 'error')
    } finally {
      setCreating(false)
    }
  }

  // Load backups from R2
  const loadBackups = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/backup/r2')
      const data = await res.json()
      console.log('Backup list response:', data)
      if (res.ok) {
        setBackups(data.backups || [])
      } else {
        if (data.error !== 'R2 storage not configured') {
          showToast(data.error || 'Failed to load backups', 'error')
        }
      }
    } catch (err) {
      console.error('Failed to load backups', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBackups()
  }, [])

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Backups are automatically created on the last day of every month and stored securely.
        You can also create a backup manually. Contact the development team if you need to restore a backup.
      </p>

      {/* Create Backup Button */}
      <div className="flex gap-2 flex-wrap">
        <Button onClick={handleCreateBackup} disabled={creating}>
          <IconPlus className="size-4 mr-2" />
          {creating ? 'Creating Backup...' : 'Create Backup Now'}
        </Button>
      </div>

      {/* My Backups - Collapsible */}
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <IconHistory className="size-4" />
              My Backups ({backups.length})
            </span>
            <IconChevronDown className={`size-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          {loading ? (
            <div className="text-center py-4 text-sm text-muted-foreground">
              Loading backups...
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-4 text-sm text-muted-foreground">
              No backups found. Backups are created automatically at the end of each month.
            </div>
          ) : (
            <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
              {backups.map((backup) => (
                <div key={backup.key} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30">
                  <div>
                    <p className="font-medium">{backup.month} {backup.year}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(backup.lastModified)} • {formatSize(backup.size)}
                    </p>
                  </div>
                  <a href={backup.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">
                      <IconDownload className="size-4 mr-1" />
                      Download
                    </Button>
                  </a>
                </div>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
