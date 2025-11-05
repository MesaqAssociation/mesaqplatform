"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { useRouter } from 'next/navigation'
import { IconX, IconUpload } from '@tabler/icons-react'

type Props = {
  eventId: string
  eventType: string
}

export default function CompleteEventForm({ eventId, eventType }: Props) {
  const router = useRouter()
  const [summary, setSummary] = useState('')
  const [finalCost, setFinalCost] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
    }
  }

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      // Upload files first if any
      let fileUrls: string[] = []
      if (files.length > 0) {
        setUploading(true)
        const formData = new FormData()
        files.forEach(file => formData.append('files', file))
        
        // Simulate upload progress
        for (let i = 0; i <= 100; i += 10) {
          setUploadProgress(i)
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        
        // TODO: Implement actual file upload to R2 or similar
        // For now, just use placeholder URLs
        fileUrls = files.map(f => `/uploads/${f.name}`)
        setUploading(false)
      }

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
          <div className="space-y-2 mt-4">
            <p className="text-sm font-medium">{files.length} file(s) selected:</p>
            {files.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-2 border rounded">
                <span className="text-sm truncate flex-1">{file.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                >
                  <IconX className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {uploading && (
          <div className="space-y-2">
            <Progress value={uploadProgress} />
            <p className="text-xs text-center text-muted-foreground">
              Uploading files... {uploadProgress}%
            </p>
          </div>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={submitting || uploading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={submitting || uploading}
          className="flex-1"
        >
          {submitting ? 'Completing...' : 'Mark as Completed'}
        </Button>
      </div>
    </form>
  )
}

