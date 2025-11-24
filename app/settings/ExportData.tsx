"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { IconDownload } from '@tabler/icons-react'

export default function ExportData() {
  const [exportType, setExportType] = useState<'members' | 'events' | 'finance'>('members')
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx'>('csv')
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch(`/api/export?type=${exportType}&format=${exportFormat}`)
      
      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Failed to export data')
        return
      }

      if (exportFormat === 'csv') {
        // Download CSV directly
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${exportType}_export_${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        // For XLSX, we get JSON and convert client-side
        const jsonData = await res.json()
        
        // Use XLSX library if available
        if (typeof window !== 'undefined' && (window as any).XLSX) {
          const XLSX = (window as any).XLSX
          const worksheet = XLSX.utils.json_to_sheet(jsonData.data)
          const workbook = XLSX.utils.book_new()
          XLSX.utils.book_append_sheet(workbook, worksheet, exportType)
          XLSX.writeFile(workbook, jsonData.filename)
        } else {
          // Fallback to CSV if XLSX not loaded
          alert('XLSX library not loaded. Downloading as CSV instead.')
          const csv = convertToCSV(jsonData.data, jsonData.headers)
          const blob = new Blob([csv], { type: 'text/csv' })
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${exportType}_export_${new Date().toISOString().split('T')[0]}.csv`
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
        }
      }
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export data')
    } finally {
      setExporting(false)
    }
  }

  const convertToCSV = (data: any[], headers: string[]): string => {
    const rows = [headers.join(',')]
    data.forEach(item => {
      const row = headers.map(header => {
        const value = item[header]
        if (value === null || value === undefined) return ''
        const stringValue = String(value).replace(/"/g, '""')
        return stringValue.includes(',') ? `"${stringValue}"` : stringValue
      })
      rows.push(row.join(','))
    })
    return rows.join('\n')
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="export-type">Data Type</Label>
        <Select value={exportType} onValueChange={(value: any) => setExportType(value)}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="members">Members</SelectItem>
            <SelectItem value="events">Events</SelectItem>
            <SelectItem value="finance">Finance (Transactions)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          {exportType === 'members' && 'Export all member information including payment status'}
          {exportType === 'events' && 'Export all events and meetings'}
          {exportType === 'finance' && 'Export all transactions from all accounts (last 10,000)'}
        </p>
      </div>

      <div>
        <Label htmlFor="export-format">Format</Label>
        <Select value={exportFormat} onValueChange={(value: any) => setExportFormat(value)}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="csv">CSV (Comma Separated Values)</SelectItem>
            <SelectItem value="xlsx">XLSX (Excel Spreadsheet)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          {exportFormat === 'csv' && 'Compatible with Excel, Google Sheets, and most spreadsheet apps'}
          {exportFormat === 'xlsx' && 'Native Excel format with better formatting support'}
        </p>
      </div>

      <Button onClick={handleExport} disabled={exporting} className="w-full">
        <IconDownload className="mr-2 size-4" />
        {exporting ? 'Exporting...' : `Export ${exportType.charAt(0).toUpperCase() + exportType.slice(1)}`}
      </Button>

      {exportFormat === 'xlsx' && (
        <p className="text-xs text-muted-foreground text-center">
          Note: XLSX export requires the SheetJS library. If unavailable, will fallback to CSV.
        </p>
      )}
    </div>
  )
}

