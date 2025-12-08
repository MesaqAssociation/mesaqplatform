"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

type Transaction = {
  id: string
  transaction_date: string
  transaction_name: string
  description: string
  amount: number
  transaction_type: string
  category: string | null
  source: string | null
}

export default function PaymentsClient({ transactions }: { transactions: Transaction[] }) {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Payments</h1>
        <p className="text-muted-foreground mt-1">View-only list of your payments</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments found.</p>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div key={tx.id} className="py-2">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tx.description || tx.transaction_name || 'Payment'}</p>
                      <p className="text-xs text-muted-foreground">
                        {tx.transaction_date} • {tx.category || 'Uncategorized'} • {tx.source || 'Bank'}
                      </p>
                    </div>
                    <div className="text-sm font-semibold">
                      {tx.transaction_type === 'credit' ? (
                        <span className="text-green-600">+${Math.abs(Number(tx.amount) || 0).toFixed(2)}</span>
                      ) : (
                        <span className="text-red-600">-${Math.abs(Number(tx.amount) || 0).toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                  <Separator className="mt-2" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

