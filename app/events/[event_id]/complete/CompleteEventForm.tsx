"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { useRouter } from 'next/navigation'
import { IconX, IconUpload, IconCheck } from '@tabler/icons-react'

type Props = {
  eventId: string
  eventType: string
}

type FileWithProgress = {
  file: File
  progress: number
  uploaded: boolean
  url?: string
}

export default function CompleteEventForm({ eventId, eventType }: Props) {
  const router = useRouter()
  const [summary, setSummary] = useState('')
  const [finalCost, setFinalCost] = useState('')
  const [files, setFiles] = useState<FileWithProgress[]>([])
  const [submitting, setSubmitting] = useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFilesToAdd = Array.from(e.target.files).map(file => ({
        file,
        progress: 0,
        uploaded: false
      }))
      
      // Add files to state first
      const startIndex = files.length
      setFiles(prev => [...prev, ...newFilesToAdd])
      
      // Upload each new file
      for (let i = 0; i < newFilesToAdd.length; i++) {
        uploadFile(startIndex + i, newFilesToAdd[i].file)
      }
    }
  }

  const uploadFile = async (index: number, file: File) => {
    try {
      // Create FormData for upload
      const formData = new FormData()
      formData.append('file', file)

      // Start progress
      setFiles(prev => {
        const updated = [...prev]
        if (updated[index]) {
          updated[index] = { ...updated[index], progress: 10 }
        }
        return updated
      })

      // Upload to R2 via our API
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      // Update progress to 70%
      setFiles(prev => {
        const updated = [...prev]
        if (updated[index]) {
          updated[index] = { ...updated[index], progress: 70 }
        }
        return updated
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const { url } = await response.json()

      // Complete upload
      setFiles(prev => {
        const updated = [...prev]
        if (updated[index]) {
          updated[index] = { ...updated[index], progress: 100, uploaded: true, url }
        }
        return updated
      })
    } catch (error) {
      console.error('Upload error:', error)
      // Mark as failed
      setFiles(prev => {
        const updated = [...prev]
        if (updated[index]) {
          updated[index] = { ...updated[index], progress: 0, uploaded: false }
        }
        return updated
      })
    }
  }

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      // Get uploaded file URLs
      const fileUrls = files.filter(f => f.uploaded).map(f => f.url || '')

      // Submit completion data
      const response = await fetch(`/api/events/${eventId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary,
          finalCost: finalCost ? parseFloat(finalCost) : null,
          files: fileUrls,
        }),
      })

      if (response.ok) {
        const backUrl = eventType === 'Meeting' ? '/meetings' : '/events'
        router.push(`${backUrl}?success=Event marked as completed`)
      } else {
        alert('Failed to mark event as completed')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const allFilesUploaded = files.length === 0 || files.every(f => f.uploaded)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Summary */}
      <div className="space-y-2">
        <Label htmlFor="summary">Summary</Label>
        <Textarea
          id="summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Provide a summary of what happened during this event..."
          rows={6}
          required
          autoComplete="off"
        />
      </div>

      {/* Final Cost */}
      <div className="space-y-2">
        <Label htmlFor="finalCost">Final Cost</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <Input
            id="finalCost"
            type="text"
            value={finalCost}
            onChange={(e) => {
              const value = e.target.value
              if (/^\d*\.?\d{0,2}$/.test(value)) {
                setFinalCost(value)
              }
            }}
            placeholder="0.00"
            className="pl-7"
            autoComplete="off"
          />
        </div>
        <p className="text-xs text-muted-foreground">Enter the actual final cost of the event</p>
      </div>

      {/* Related Images/Documents */}
      <div className="space-y-2">
        <Label htmlFor="files">Related Images/Documents</Label>
        <div className="border-2 border-dashed rounded-lg p-6 text-center">
          <input
            id="files"
            type="file"
            multiple
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx"
          />
          <label htmlFor="files" className="cursor-pointer">
            <IconUpload className="size-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Click to upload images or documents
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Supports: Images, PDF, Word documents
            </p>
          </label>
        </div>

        {files.length > 0 && (
          <div className="space-y-3 mt-4">
            <p className="text-sm font-medium">{files.length} file(s):</p>
            {files.map((fileItem, index) => (
              <div key={index} className="space-y-2 p-3 border rounded">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {fileItem.uploaded ? (
                      <IconCheck className="size-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <IconUpload className="size-4 text-blue-600 flex-shrink-0 animate-pulse" />
                    )}
                    <span className="text-sm truncate">{fileItem.file.name}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                  >
                    <IconX className="size-4" />
                  </Button>
                </div>
                {!fileItem.uploaded && (
                  <div className="space-y-1">
                    <Progress value={fileItem.progress} />
                    <p className="text-xs text-muted-foreground">
                      Uploading... {fileItem.progress}%
                    </p>
                  </div>
                )}
                {fileItem.uploaded && (
                  <p className="text-xs text-green-600">Upload complete</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={submitting || !allFilesUploaded}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={submitting || !allFilesUploaded}
          className="flex-1"
        >
          {!allFilesUploaded 
            ? 'Uploading files...' 
            : submitting 
              ? 'Completing...' 
              : 'Mark as Completed'}
        </Button>
      </div>
    </form>
  )
}

