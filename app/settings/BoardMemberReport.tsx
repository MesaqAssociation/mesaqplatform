'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Download, Loader2 } from 'lucide-react'
import { showToast } from '@/lib/toast'

export default function BoardMemberReport() {
    const [isGenerating, setIsGenerating] = useState(false)
    const currentYear = new Date().getFullYear()
    
    // Default to current year (Jan 1 to today)
    const [startDate, setStartDate] = useState(`${currentYear}-01-01`)
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])

    const handleDownload = async () => {
        setIsGenerating(true)

        try {
            const params = new URLSearchParams()
            if (startDate) params.set('startDate', startDate)
            if (endDate) params.set('endDate', endDate)
            
            const response = await fetch(`/api/reports/board-members?${params.toString()}`, {
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
            const filename = filenameMatch ? filenameMatch[1] : 'Financial-Report.docx'

            a.download = filename
            document.body.appendChild(a)
            a.click()

            // Cleanup
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)

            showToast('Report downloaded successfully', 'success')
        } catch (error: any) {
            console.error('Download error:', error)
            showToast(error.message || 'Failed to download report', 'error')
        } finally {
            setIsGenerating(false)
        }
    }

    // Quick date range setters
    const setThisYear = () => {
        setStartDate(`${currentYear}-01-01`)
        setEndDate(new Date().toISOString().split('T')[0])
    }

    const setLastYear = () => {
        const lastYear = currentYear - 1
        setStartDate(`${lastYear}-01-01`)
        setEndDate(`${lastYear}-12-31`)
    }

    const setLastMonth = () => {
        const now = new Date()
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
        setStartDate(lastMonth.toISOString().split('T')[0])
        setEndDate(lastMonthEnd.toISOString().split('T')[0])
    }

    return (
        <div className="border rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">Financial Report</h2>
            <p className="text-sm text-muted-foreground mb-4">
                Generate a comprehensive financial report with member ID, name, membership payments, event payments (excludes donations), total sum, and current balance.
            </p>
            
            <div className="space-y-4">
                {/* Quick date range buttons */}
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={setThisYear}>
                        This Year
                    </Button>
                    <Button variant="outline" size="sm" onClick={setLastYear}>
                        Last Year
                    </Button>
                    <Button variant="outline" size="sm" onClick={setLastMonth}>
                        Last Month
                    </Button>
                </div>

                {/* Custom date range */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="startDate">Start Date</Label>
                        <Input
                            id="startDate"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="endDate">End Date</Label>
                        <Input
                            id="endDate"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                </div>

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
                            Download Report
                        </>
                    )}
                </Button>
            </div>
        </div>
    )
}
