'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { IconDownload, IconUpload, IconAlertTriangle } from '@tabler/icons-react'
import { showToast } from '@/lib/toast'

export default function BackupRestore() {
  const [downloading, setDownloading] = useState(false)
  const [showRestoreDialog, setShowRestoreDialog] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [backupPreview, setBackupPreview] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDownloadBackup = async () => {
    setDownloading(true)
    try {
      const res = await fetch('/api/backup')
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create backup')
      }
      
      const blob = await res.blob()
      const contentDisposition = res.headers.get('Content-Disposition')
      const filename = contentDisposition?.split('filename="')[1]?.replace('"', '') || 'MesaqBackup.json'
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      showToast('Backup downloaded successfully!', 'success')
    } catch (err: any) {
      console.error('Backup error:', err)
      showToast(err.message || 'Failed to create backup', 'error')
    } finally {
      setDownloading(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.json')) {
      showToast('Please select a valid backup file (.json)', 'error')
      return
    }

    try {
      const text = await file.text()
      const backup = JSON.parse(text)
      
      if (!backup.version || !backup.tables) {
        throw new Error('Invalid backup file format')
      }

      setSelectedFile(file)
      setBackupPreview(backup)
      setShowRestoreDialog(true)
    } catch (err: any) {
      showToast('Invalid backup file: ' + err.message, 'error')
    }
  }

  const handleRestore = async () => {
    if (confirmText !== 'confirm') {
      showToast('Please type "confirm" to proceed', 'error')
      return
    }

    if (!backupPreview) {
      showToast('No backup file selected', 'error')
      return
    }

    setRestoring(true)
    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backup: backupPreview,
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

  return (
    <div className="space-y-4">
      {/* Download Backup */}
      <div>
        <Label className="text-sm font-medium">Download Backup</Label>
        <p className="text-sm text-muted-foreground mb-3">
          Download a complete backup of all your data including members, events, transactions, and settings.
        </p>
        <Button onClick={handleDownloadBackup} disabled={downloading}>
          <IconDownload className="mr-2 size-4" />
          {downloading ? 'Creating Backup...' : 'Download Backup'}
        </Button>
      </div>

      {/* Restore from Backup */}
      <div className="pt-4 border-t">
        <Label className="text-sm font-medium">Restore from Backup</Label>
        <p className="text-sm text-muted-foreground mb-3">
          Upload a previous backup file to restore your data. This will replace all current data.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          <IconUpload className="mr-2 size-4" />
          Select Backup File
        </Button>
      </div>

      {/* Restore Confirmation Dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={(open) => {
        if (!open) {
          setConfirmText('')
          setBackupPreview(null)
          setSelectedFile(null)
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

          {backupPreview && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium">Backup Details:</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Created:</span>
                  <span>{new Date(backupPreview.created_at).toLocaleString()}</span>
                  <span className="text-muted-foreground">Users:</span>
                  <span>{backupPreview.counts?.users || 0}</span>
                  <span className="text-muted-foreground">Events:</span>
                  <span>{backupPreview.counts?.events || 0}</span>
                  <span className="text-muted-foreground">Transactions:</span>
                  <span>{backupPreview.counts?.transactions || 0}</span>
                  <span className="text-muted-foreground">Payments:</span>
                  <span>{backupPreview.counts?.membership_payments || 0}</span>
                </div>
              </div>

              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm text-destructive font-medium mb-2">⚠️ Warning</p>
                <p className="text-sm text-muted-foreground">
                  All current data will be permanently replaced. Make sure you have a current backup before proceeding.
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
