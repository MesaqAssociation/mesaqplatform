'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { IconAlertTriangle, IconChevronDown, IconHistory, IconRefresh, IconPlus } from '@tabler/icons-react'
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
  const [showRestoreDialog, setShowRestoreDialog] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null)
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

  const handleRestore = async () => {
    if (confirmText !== 'confirm') {
      showToast('Please type "confirm" to proceed', 'error')
      return
    }

    if (!selectedBackup) {
      showToast('No backup selected', 'error')
      return
    }

    setRestoring(true)
    try {
      const res = await fetch('/api/backup/r2', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: selectedBackup.key,
          confirmText
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to restore backup')
      }

      showToast('Backup restored successfully! Page will reload...', 'success')
      setShowRestoreDialog(false)
      
      // Reload the page after a short delay
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (err: any) {
      console.error('Restore error:', err)
      showToast(err.message || 'Failed to restore backup', 'error')
    } finally {
      setRestoring(false)
    }
  }

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
        You can also create a backup manually or restore from any previous backup.
      </p>

      {/* Create Backup Button */}
      <Button onClick={handleCreateBackup} disabled={creating}>
        <IconPlus className="size-4 mr-2" />
        {creating ? 'Creating Backup...' : 'Create Backup Now'}
      </Button>

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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedBackup(backup)
                      setShowRestoreDialog(true)
                    }}
                  >
                    <IconRefresh className="size-4 mr-1" />
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Restore Confirmation Dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={(open) => {
        if (!open) {
          setConfirmText('')
          setSelectedBackup(null)
        }
        setShowRestoreDialog(open)
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <IconAlertTriangle className="size-5" />
              Restore Backup
            </DialogTitle>
            <DialogDescription>
              This action will replace ALL current data with the backup data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {selectedBackup && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium">Backup Details:</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Period:</span>
                  <span>{selectedBackup.month} {selectedBackup.year}</span>
                  <span className="text-muted-foreground">Created:</span>
                  <span>{formatDate(selectedBackup.lastModified)}</span>
                  <span className="text-muted-foreground">Size:</span>
                  <span>{formatSize(selectedBackup.size)}</span>
                </div>
              </div>

              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm text-destructive font-medium mb-2">⚠️ Warning</p>
                <p className="text-sm text-muted-foreground">
                  All current data will be permanently replaced. Make sure you want to restore to this backup.
                </p>
              </div>

              <div>
                <Label htmlFor="confirm">Type "confirm" to proceed:</Label>
                <Input
                  id="confirm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="confirm"
                  className="mt-2"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowRestoreDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleRestore}
                  disabled={restoring || confirmText !== 'confirm'}
                >
                  {restoring ? 'Restoring...' : 'Restore Backup'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
