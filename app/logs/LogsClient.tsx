"use client"

import { IconUser, IconClock, IconActivity } from '@tabler/icons-react'

type AuditLog = {
  id: string
  user_id: string | null
  user_name: string | null
  action: string
  entity_type: string
  entity_id: string | null
  details: any
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export default function LogsClient({ initial }: { initial: AuditLog[] }) {
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const getActionColor = (action: string) => {
    if (action.includes('create') || action.includes('add')) return 'text-green-600 dark:text-green-400'
    if (action.includes('delete') || action.includes('remove')) return 'text-red-600 dark:text-red-400'
    if (action.includes('update') || action.includes('edit')) return 'text-blue-600 dark:text-blue-400'
    return 'text-gray-600 dark:text-gray-400'
  }

  return (
    <div className="space-y-2">
      {initial.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <IconActivity className="size-12 mx-auto mb-4 opacity-50" />
          <p>No activity logs yet</p>
        </div>
      ) : (
        initial.map(log => (
          <div 
            key={log.id} 
            className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <IconActivity className={`size-4 ${getActionColor(log.action)}`} />
                  <span className="font-medium capitalize">{log.action.replace(/_/g, ' ')}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-sm text-muted-foreground capitalize">{log.entity_type}</span>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground pl-6">
                  {log.user_name && (
                    <div className="flex items-center gap-1.5">
                      <IconUser className="size-4" />
                      <span className="font-medium">{log.user_name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <IconClock className="size-4" />
                    <span>{formatTimestamp(log.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

