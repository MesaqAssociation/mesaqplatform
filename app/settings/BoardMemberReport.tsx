'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function BoardMemberReport() {
    const [isGenerating, setIsGenerating] = useState(false)

    const handleDownload = async () => {
        setIsGenerating(true)

        try {
            const response = await fetch('/api/reports/board-members', {
                method: 'GET',
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to generate report')
            }

            // Get the blob from the response
            const blob = await response.blob()

            // Create a download link
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url

            // Extract filename from Content-Disposition header or use default
            const contentDisposition = response.headers.get('Content-Disposition')
            const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
            const filename = filenameMatch ? filenameMatch[1] : 'Board-Member-Report.docx'

            a.download = filename
            document.body.appendChild(a)
            a.click()

            // Cleanup
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)

            toast.success('Report downloaded successfully')
        } catch (error: any) {
            console.error('Download error:', error)
            toast.error(error.message || 'Failed to download report')
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <div className="border rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">Annual Financial Report</h2>
            <p className="text-sm text-muted-foreground mb-4">
                Generate a comprehensive annual report (January 1 to present) with member ID, name, membership payments, event payments (excludes donations), total sum, and current balance.
            </p>
            <Button
                onClick={handleDownload}
                disabled={isGenerating}
                className="gap-2"
            >
                {isGenerating ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating Report...
                    </>
                ) : (
                    <>
                        <Download className="h-4 w-4" />
                        Download Annual Report
                    </>
                )}
            </Button>
        </div>
    )
}
