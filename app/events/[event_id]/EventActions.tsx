"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { IconTrash } from '@tabler/icons-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  eventId: string
  eventTitle: string
  backUrl: string
}

export default function EventActions({ eventId, eventTitle, backUrl }: Props) {
  const router = useRouter()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (confirmText.toLowerCase() !== 'confirm') return

    setDeleting(true)
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        router.push(`${backUrl}?success=Event deleted successfully`)
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to delete event')
        setDeleting(false)
      }
    } catch (err) {
      console.error('Delete error:', err)
      alert('Failed to delete event')
      setDeleting(false)
    }
  }

  return (
    <>
      <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
        <IconTrash className="size-4 mr-1" />
        Delete
      </Button>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>
              This will permanently delete "{eventTitle}" and all associated data.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2 py-4">
            <Label htmlFor="confirm">Type "confirm" to delete</Label>
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
              onClick={() => {
                setShowDeleteDialog(false)
                setConfirmText('')
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={confirmText.toLowerCase() !== 'confirm' || deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

