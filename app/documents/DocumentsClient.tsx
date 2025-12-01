"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { IconFileText, IconDownload, IconTrash, IconPlus, IconUpload } from '@tabler/icons-react'
import { showToast } from '@/lib/toast'

type Document = {
  id: string
  title: string
  description: string | null
  file_name: string
  file_url: string
  file_size: number | null
  uploaded_at: string
  uploaded_by_name: string | null
}

type User = {
  id: string
  name: string
  role: string
}

export default function DocumentsClient({ user }: { user: User | null }) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  // Upload form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadComplete, setUploadComplete] = useState(false)

  const isAdmin = user && ['admin', 'board', 'Manager'].includes(user.role)

  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    try {
      const res = await fetch('/api/documents')
      if (res.ok) {
        const data = await res.json()
        setDocuments(data.documents)
      }
    } catch (err) {
      console.error('Failed to load documents:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile)
    setUploading(true)
    setUploadProgress(0)
    setUploadComplete(false)

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) return prev
        return prev + 10
      })
    }, 200)

    // Simulate file processing time
    await new Promise(resolve => setTimeout(resolve, 1500))

    clearInterval(progressInterval)
    setUploadProgress(100)
    setUploadComplete(true)
    setUploading(false)
  }

  const handleUpload = async () => {
    if (!title || !file) {
      showToast('Please provide a title and file', 'error')
      return
    }

    if (!uploadComplete) {
      showToast('Please wait for file upload to complete', 'error')
      return
    }

    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('title', title)
      formData.append('description', description)
      formData.append('file', file)

      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        showToast('Document uploaded successfully!', 'success')
        setShowUploadDialog(false)
        setTitle('')
        setDescription('')
        setFile(null)
        setUploadProgress(0)
        setUploadComplete(false)
        loadDocuments()
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to upload document', 'error')
        // Reset upload state on error
        setUploadProgress(0)
        setUploadComplete(false)
        setFile(null)
      }
    } catch (err) {
      console.error('Upload error:', err)
      showToast('Failed to upload document', 'error')
      // Reset upload state on error
      setUploadProgress(0)
      setUploadComplete(false)
      setFile(null)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string, docTitle: string) => {
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        showToast('Document deleted successfully', 'success')
        loadDocuments()
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to delete document', 'error')
      }
    } catch (err) {
      console.error('Delete error:', err)
      showToast('Failed to delete document', 'error')
    }
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Community Documents</h1>
          <p className="text-muted-foreground mt-1">
            Shared documents and files for all members
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowUploadDialog(true)}>
            <IconPlus className="mr-2 size-4" />
            Upload Document
          </Button>
        )}
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Loading documents...
          </CardContent>
        </Card>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <IconFileText className="mx-auto size-12 mb-4 opacity-50" />
            <p>No documents available yet.</p>
            {isAdmin && (
              <p className="mt-2 text-sm">Upload your first document to get started.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <Card key={doc.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg flex items-start gap-2">
                  <IconFileText className="size-5 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-2">{doc.title}</span>
                </CardTitle>
                {doc.description && (
                  <CardDescription className="line-clamp-3">
                    {doc.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>File: {doc.file_name}</p>
                  <p>Size: {formatFileSize(doc.file_size)}</p>
                  <p>Uploaded: {formatDate(doc.uploaded_at)}</p>
                  {doc.uploaded_by_name && (
                    <p>By: {doc.uploaded_by_name}</p>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.open(doc.file_url, '_blank')}
                  >
                    <IconDownload className="mr-2 size-4" />
                    Download
                  </Button>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (confirm(`Delete "${doc.title}"?`)) {
                          handleDelete(doc.id, doc.title)
                        }
                      }}
                    >
                      <IconTrash className="size-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Share a document with all community members
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Document title"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the document"
                className="mt-1"
                rows={3}
              />
            </div>
            <div>
              <Label>File *</Label>
              <div className="mt-1">
                <input
                  id="file-upload"
                  type="file"
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0]
                    if (selectedFile) {
                      handleFileSelect(selectedFile)
                    }
                  }}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png"
                  disabled={uploading}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('file-upload')?.click()}
                  disabled={uploading}
                  className="w-full"
                >
                  <IconUpload className="mr-2 size-4" />
                  {file ? 'Change File' : 'Upload'}
                </Button>
              </div>
              {file && (
                <p className="text-xs text-muted-foreground mt-1">
                  Selected: {file.name} ({formatFileSize(file.size)})
                </p>
              )}
            </div>
            {uploading && (
              <Progress value={uploadProgress} />
            )}
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowUploadDialog(false)
                  setTitle('')
                  setDescription('')
                  setFile(null)
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUpload} 
                disabled={!title || !file || uploading || !uploadComplete && uploadProgress > 0}
              >
                {uploading ? (
                  uploadComplete ? (
                    <>
                      <IconUpload className="mr-2 size-4" />
                      Complete!
                    </>
                  ) : (
                    <>
                      <IconUpload className="mr-2 size-4 animate-pulse" />
                      Uploading...
                    </>
                  )
                ) : (
                  <>
                    <IconUpload className="mr-2 size-4" />
                    Upload
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

