// Core Types matching the web platform

export interface User {
  id: string
  name: string
  email?: string | null
  phone: string
  role: string
  image?: string | null
  address?: string | null
  banking_name?: string | null
  date_joined?: string | null
  household_members?: number | null
  member_id?: string | null
  current_balance?: number | null
  group_name?: string | null
}

export interface Event {
  id: string
  title: string
  description?: string | null
  address?: string | null
  event_date: string
  start_time: string
  end_time: string
  estimated_cost?: number | null
  organizing_group?: string | null
  attendees?: string[]
  created_at?: string
}

export interface Transaction {
  id: string
  account_id: string
  transaction_date: string
  transaction_name: string
  description?: string | null
  amount: number
  transaction_type: 'credit' | 'debit'
  balance_after: number
  source?: string | null
  reference?: string | null
  category?: string | null
  matched_member_id?: string | null
  statement_id?: string | null
  created_at?: string
}

export interface FinancialAccount {
  id: string
  account_name: string
  account_type: string
  current_balance: number
  account_number?: string | null
  bsb?: string | null
  created_at?: string
  updated_at?: string
}

export interface MembershipPayment {
  id: string
  member_id: string
  transaction_id: string
  amount: number
  month_year: string
  payment_date: string
  status: 'paid' | 'pending' | 'late'
  created_at?: string
}

export interface Document {
  id: string
  title: string
  description?: string | null
  file_url: string
  file_type: string
  file_size: number
  uploaded_by: string
  uploaded_at: string
  category?: string | null
}

export interface MemberGroup {
  id: string
  name: string
  description?: string | null
  created_at?: string
  member_count?: number
}

export interface AuthResponse {
  ok: boolean
  token: string
  user: User
}

export interface ApiError {
  error: string
  details?: string
}

export interface DashboardStats {
  memberStats: {
    families: number
    total_members: number
  }
  recentTransactions: Transaction[]
  upcomingEvents: Event[]
  accounts: FinancialAccount[]
  unpaidBalances: Array<{
    id: string
    member_id: string | null
    name: string
    current_balance: number
  }>
}

export type RootStackParamList = {
  Login: undefined
  Main: undefined
  Dashboard: undefined
  Members: undefined
  MemberDetail: { memberId: string }
  CreateMember: undefined
  Events: undefined
  EventDetail: { eventId: string }
  CreateEvent: undefined
  Finance: undefined
  Documents: undefined
  Settings: undefined
  Profile: undefined
}

