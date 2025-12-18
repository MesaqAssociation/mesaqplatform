'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import MonthlyFeeSettings from './MonthlyFeeSettings'
import FineSettings from './FineSettings'
import UserSettings from './UserSettings'
import ExportData from './ExportData'
import PaymentKeywords from './PaymentKeywords'
import BoardMemberReport from './BoardMemberReport'
import BackupRestore from './BackupRestore'

export default function SettingsClient({
  user,
  fullUserData,
  currentFee,
  finesEnabled,
  fineAmount
}: {
  user: any
  fullUserData: any
  currentFee: string
  finesEnabled: boolean
  fineAmount: string
}) {
  // Allow board members and admin roles to access settings
  const isAdmin = user?.role === 'board' || user?.role === 'admin' || user?.role === 'Manager'

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>

      <Tabs defaultValue="personal" className="max-w-4xl">
        <TabsList>
          <TabsTrigger value="personal">Personal Settings</TabsTrigger>
          {isAdmin && <TabsTrigger value="community">Community Settings</TabsTrigger>}
        </TabsList>

        {/* Personal Settings Tab - Available to Everyone */}
        <TabsContent value="personal" className="space-y-6 mt-6">
          {fullUserData && fullUserData.id ? (
            <UserSettings user={fullUserData} />
          ) : (
            <div className="border rounded-lg p-6 shadow-md">
              <p className="text-sm text-muted-foreground">Unable to load user profile. Please try refreshing the page.</p>
            </div>
          )}
        </TabsContent>

        {/* Community Settings Tab - Admin Only */}
        {isAdmin && (
          <TabsContent value="community" className="space-y-6 mt-6">
            <div className="border rounded-lg p-6 shadow-md">
              <h2 className="text-lg font-medium mb-4">Membership Fee</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Set the monthly membership fee for all members
              </p>
              <MonthlyFeeSettings initialFee={currentFee} />
            </div>

            <div className="border rounded-lg p-6 shadow-md">
              <h2 className="text-lg font-medium mb-4">Late Payment Fines</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Configure automatic fines for late payments
              </p>
              <FineSettings
                initialEnabled={finesEnabled}
                initialAmount={fineAmount}
              />
            </div>

            <div className="border rounded-lg p-6 shadow-md">
              <h2 className="text-lg font-medium mb-4">Payment Keywords</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Manage keywords for automatic payment classification. Payments with these keywords in their description will be marked as "Special Payment"
              </p>
              <PaymentKeywords />
            </div>

            <div className="border rounded-lg p-6 shadow-md">
              <h2 className="text-lg font-medium mb-4">Export Data</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Export member, event, or finance data to CSV or Excel format
              </p>
              <ExportData />
            </div>

            <div className="border rounded-lg p-6 shadow-md">
              <h2 className="text-lg font-medium mb-4">Backup & Restore</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Create a backup of all your data or restore from a previous backup
              </p>
              <BackupRestore />
            </div>

            <BoardMemberReport />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

