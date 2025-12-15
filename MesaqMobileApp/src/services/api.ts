import axios, { AxiosInstance, AxiosError } from 'axios'
import { storage } from '../utils/storage'
import { User, AuthResponse, Event, Transaction, FinancialAccount, Document, MemberGroup, DashboardStats } from '../types'

// API Base URL - Update this to your production URL
const API_BASE_URL = 'https://mesaq-association.vercel.app'

class ApiClient {
  private client: AxiosInstance
  private token: string | null = null

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      async (config) => {
        if (!this.token) {
          this.token = await storage.getItem('auth_token')
        }
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          this.clearToken()
        }
        return Promise.reject(error)
      }
    )
  }

  // Auth methods
  async login(identifier: string, password: string): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/api/login', {
      identifier,
      password,
    })
    
    if (response.data.token) {
      await this.setToken(response.data.token)
    }
    
    return response.data
  }

  async logout(): Promise<void> {
    // Just clear token locally - don't need server call
    await this.clearToken()
  }

  async setToken(token: string): Promise<void> {
    this.token = token
    await storage.setItem('auth_token', token)
  }

  async clearToken(): Promise<void> {
    this.token = null
    await storage.removeItem('auth_token')
  }

  async getToken(): Promise<string | null> {
    if (!this.token) {
      this.token = await storage.getItem('auth_token')
    }
    return this.token
  }

  // User methods
  async getCurrentUser(): Promise<User> {
    const response = await this.client.get<User>('/api/user/profile')
    return response.data
  }

  async updateUser(userId: string, data: Partial<User>): Promise<User> {
    const response = await this.client.patch<{ user: User }>(`/api/user/update`, data)
    return response.data.user
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.client.post('/api/user/change-password', {
      currentPassword,
      newPassword,
    })
  }

  // Members methods
  async getMembers(): Promise<User[]> {
    const response = await this.client.get<User[]>('/api/members')
    return response.data
  }

  async getMember(memberId: string): Promise<User> {
    const response = await this.client.get<User>(`/api/members/${memberId}`)
    return response.data
  }

  async createMember(data: Partial<User> & { password: string }): Promise<User> {
    const response = await this.client.post<{ member: User }>('/api/members/create', data)
    return response.data.member
  }

  async updateMember(memberId: string, data: Partial<User>): Promise<User> {
    const response = await this.client.put<User>(`/api/members/${memberId}`, data)
    return response.data
  }

  // Events methods
  async getEvents(): Promise<Event[]> {
    const response = await this.client.get<{ events: Event[] }>('/api/events/list')
    return response.data.events
  }

  async getEvent(eventId: string): Promise<Event> {
    const response = await this.client.get<Event>(`/api/events/${eventId}`)
    return response.data
  }

  async createEvent(data: Partial<Event>): Promise<Event> {
    const response = await this.client.post<{ event: Event }>('/api/events/create', data)
    return response.data.event
  }

  async completeEvent(eventId: string, attendees: string[]): Promise<void> {
    await this.client.post(`/api/events/${eventId}/complete`, { attendees })
  }

  // Finance methods
  async getAccounts(): Promise<FinancialAccount[]> {
    const response = await this.client.get<{ accounts: FinancialAccount[] }>('/api/finance/accounts')
    return response.data.accounts
  }

  async getTransactions(accountId?: string): Promise<Transaction[]> {
    const url = accountId ? `/api/finance/transactions?account_id=${accountId}` : '/api/finance/transactions'
    const response = await this.client.get<{ transactions: Transaction[] }>(url)
    return response.data.transactions
  }

  async getMembershipStatus(memberId: string): Promise<any> {
    const response = await this.client.get(`/api/membership/status/${memberId}`)
    return response.data
  }

  async getMembershipBalance(memberId: string): Promise<{ balance: number }> {
    const response = await this.client.get<{ balance: number }>(`/api/membership/balance/${memberId}`)
    return response.data
  }

  // Documents methods
  async getDocuments(): Promise<Document[]> {
    const response = await this.client.get<{ documents: Document[] }>('/api/documents')
    return response.data.documents
  }

  async uploadDocument(formData: FormData): Promise<Document> {
    const response = await this.client.post<{ document: Document }>('/api/documents', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data.document
  }

  // Groups methods
  async getGroups(): Promise<MemberGroup[]> {
    const response = await this.client.get<{ groups: MemberGroup[] }>('/api/groups')
    return response.data.groups
  }

  // Dashboard method for admins
  async getAdminDashboardData(): Promise<DashboardStats> {
    const [accounts, events, transactions, members] = await Promise.all([
      this.getAccounts(),
      this.getEvents(),
      this.getTransactions(),
      this.getMembers(),
    ])

    // Calculate member stats
    const families = members.length
    const totalMembers = members.reduce((sum: number, m: any) => sum + (m.household_members || 1), 0)

    // Get unpaid members
    const unpaidBalances = members
      .filter((m: any) => m.balance && m.balance < 0)
      .sort((a: any, b: any) => a.balance - b.balance)
      .slice(0, 10)

    return {
      memberStats: { families, total_members: totalMembers },
      recentTransactions: transactions.slice(0, 10),
      upcomingEvents: events.filter(e => new Date(e.event_date) >= new Date()).slice(0, 5),
      accounts,
      unpaidBalances,
    }
  }

  // Dashboard method for regular members
  async getMemberDashboardData(userId: string): Promise<any> {
    const [balanceRes, statusRes, txRes, eventsRes, profile] = await Promise.all([
      this.client.get(`/api/membership/balance/${userId}`).catch(() => ({ data: null })),
      this.client.get(`/api/membership/status/${userId}`).catch(() => ({ data: null })),
      this.client.get(`/api/finance/transactions?memberId=${userId}&limit=5`).catch(() => ({ data: { transactions: [] } })),
      this.client.get('/api/events/list').catch(() => ({ data: { events: [] } })),
      this.getCurrentUser(),
    ])

    return {
      balance: balanceRes.data,
      status: statusRes.data,
      recentPayments: txRes.data?.transactions || [],
      upcomingEvents: (eventsRes.data?.events || []).filter((e: any) => new Date(e.event_date) >= new Date()).slice(0, 5),
      profile,
    }
  }

  // Deprecated - use getAdminDashboardData or getMemberDashboardData
  async getDashboardData(): Promise<DashboardStats> {
    return this.getAdminDashboardData()
  }
}

export const apiClient = new ApiClient()
export default apiClient

