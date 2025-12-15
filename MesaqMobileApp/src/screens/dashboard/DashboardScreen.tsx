import React, { useEffect, useState, useCallback } from 'react'
import { View, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native'
import { Text, Card, useTheme, ActivityIndicator, Surface, Divider } from 'react-native-paper'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useAuth } from '../../context/AuthContext'
import apiClient from '../../services/api'
import { commonStyles } from '../../utils/theme'
import { useNavigation } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'

export default function DashboardScreen() {
  const { user } = useAuth()
  const theme = useTheme()
  const navigation = useNavigation()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [memberData, setMemberData] = useState<any>(null)

  const isAdmin = ['admin', 'board', 'manager', 'finance officer', 'logistics officer', 'public officer'].includes(
    (user?.role || '').toLowerCase()
  )

  const loadDashboardData = useCallback(async () => {
    try {
      if (isAdmin) {
        const data = await apiClient.getAdminDashboardData()
        setDashboardData(data)
      } else if (user?.id) {
        const data = await apiClient.getMemberDashboardData(user.id)
        setMemberData(data)
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [isAdmin, user?.id])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  const onRefresh = () => {
    setRefreshing(true)
    loadDashboardData()
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatTime = (timeStr: string) => {
    if (!timeStr) return ''
    const [hours, minutes] = timeStr.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  const formatCurrency = (amount: number) => {
    return `$${Math.abs(amount).toFixed(2)}`
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 16 }}>
          Loading dashboard...
        </Text>
      </View>
    )
  }

  // Member Dashboard
  if (!isAdmin && memberData) {
    const balance = memberData.balance?.membershipBalance?.currentBalance ?? 0
    const status = memberData.status?.paymentSummary?.isUpToDate ? 'PAID' : 'UNPAID'
    const profile = memberData.profile || user

    return (
      <ScrollView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Welcome Header */}
        <Surface style={[styles.welcomeHeader, { backgroundColor: theme.colors.primary }]} elevation={0}>
          <Text variant="headlineSmall" style={{ color: '#fff', fontWeight: '700' }}>
            Welcome, {profile?.name?.split(' ')[0] || 'Member'}!
          </Text>
          {profile?.member_id && (
            <Text variant="bodyMedium" style={{ color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
              Member #{profile.member_id}
            </Text>
          )}
        </Surface>

        {/* Balance & Status Cards */}
        <View style={styles.statsRow}>
          <Card style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content style={styles.statContent}>
              <View style={[styles.iconCircle, { backgroundColor: balance < 0 ? '#fef2f2' : '#f0fdf4' }]}>
                <MaterialCommunityIcons 
                  name="wallet" 
                  size={24} 
                  color={balance < 0 ? '#dc2626' : '#16a34a'} 
                />
              </View>
              <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
                Balance
              </Text>
              <Text 
                variant="headlineSmall" 
                style={{ 
                  color: balance < 0 ? '#dc2626' : '#16a34a', 
                  fontWeight: '700',
                  marginTop: 4 
                }}
              >
                {balance < 0 ? '-' : '+'}{formatCurrency(balance)}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                {balance < 0 ? 'Outstanding' : 'Credit'}
              </Text>
            </Card.Content>
          </Card>

          <Card style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content style={styles.statContent}>
              <View style={[styles.iconCircle, { backgroundColor: status === 'PAID' ? '#f0fdf4' : '#fef2f2' }]}>
                <MaterialCommunityIcons 
                  name={status === 'PAID' ? 'check-circle' : 'alert-circle'} 
                  size={24} 
                  color={status === 'PAID' ? '#16a34a' : '#dc2626'} 
                />
              </View>
              <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
                Status
              </Text>
              <Text 
                variant="headlineSmall" 
                style={{ 
                  color: status === 'PAID' ? '#16a34a' : '#dc2626', 
                  fontWeight: '700',
                  marginTop: 4 
                }}
              >
                {status}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                Membership
              </Text>
            </Card.Content>
          </Card>
        </View>

        {/* Household Card */}
        <Card style={[styles.fullCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.horizontalCard}>
            <View style={[styles.iconCircle, { backgroundColor: `${theme.colors.primary}15` }]}>
              <MaterialCommunityIcons name="home-account" size={24} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Household Size
              </Text>
              <Text variant="titleLarge" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                {profile?.household_members || 1} {(profile?.household_members || 1) === 1 ? 'member' : 'members'}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Recent Payments */}
        <View style={styles.section}>
          <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
            Recent Payments
          </Text>
          <Card style={[styles.listCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content style={{ paddingVertical: 8 }}>
              {memberData.recentPayments?.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="cash-remove" size={40} color={theme.colors.onSurfaceVariant} />
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
                    No recent payments
                  </Text>
                </View>
              ) : (
                memberData.recentPayments?.slice(0, 5).map((tx: any, index: number) => (
                  <View
                    key={tx.id}
                    style={[
                      styles.listItem,
                      index !== 0 && { borderTopWidth: 1, borderTopColor: theme.colors.outline },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, fontWeight: '500' }}>
                        {tx.description || tx.transaction_name || 'Payment'}
                      </Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                        {formatDate(tx.transaction_date)}
                      </Text>
                    </View>
                    <Text
                      variant="bodyMedium"
                      style={{
                        color: tx.transaction_type === 'credit' ? '#16a34a' : '#dc2626',
                        fontWeight: '600',
                      }}
                    >
                      {tx.transaction_type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </Text>
                  </View>
                ))
              )}
            </Card.Content>
          </Card>
        </View>

        {/* Upcoming Events */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
              Upcoming Events
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Events' as never)}>
              <Text variant="labelMedium" style={{ color: theme.colors.primary }}>View All</Text>
            </TouchableOpacity>
          </View>
          <Card style={[styles.listCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content style={{ paddingVertical: 8 }}>
              {memberData.upcomingEvents?.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="calendar-blank" size={40} color={theme.colors.onSurfaceVariant} />
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
                    No upcoming events
                  </Text>
                </View>
              ) : (
                memberData.upcomingEvents?.slice(0, 5).map((event: any, index: number) => (
                  <TouchableOpacity
                    key={event.id}
                    style={[
                      styles.listItem,
                      index !== 0 && { borderTopWidth: 1, borderTopColor: theme.colors.outline },
                    ]}
                    onPress={() => navigation.navigate('EventDetail' as never, { eventId: event.id } as never)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, fontWeight: '500' }}>
                        {event.title}
                      </Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                        {formatDate(event.event_date)}
                        {event.start_time && ` • ${formatTime(event.start_time)}`}
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
                  </TouchableOpacity>
                ))
              )}
            </Card.Content>
          </Card>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    )
  }

  // Admin Dashboard
  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Welcome Header */}
      <Surface style={[styles.welcomeHeader, { backgroundColor: theme.colors.primary }]} elevation={0}>
        <Text variant="headlineSmall" style={{ color: '#fff', fontWeight: '700' }}>
          Dashboard
        </Text>
        <Text variant="bodyMedium" style={{ color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
          Welcome back, {user?.name?.split(' ')[0] || 'Admin'}!
        </Text>
      </Surface>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <Card style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.statContent}>
            <View style={[styles.iconCircle, { backgroundColor: `${theme.colors.primary}15` }]}>
              <MaterialCommunityIcons name="account-group" size={24} color={theme.colors.primary} />
            </View>
            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
              Families
            </Text>
            <Text variant="headlineMedium" style={{ color: theme.colors.onSurface, fontWeight: '700', marginTop: 4 }}>
              {dashboardData?.memberStats?.families || 0}
            </Text>
          </Card.Content>
        </Card>

        <Card style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.statContent}>
            <View style={[styles.iconCircle, { backgroundColor: `${theme.colors.primary}15` }]}>
              <MaterialCommunityIcons name="account-multiple" size={24} color={theme.colors.primary} />
            </View>
            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
              Total Members
            </Text>
            <Text variant="headlineMedium" style={{ color: theme.colors.onSurface, fontWeight: '700', marginTop: 4 }}>
              {dashboardData?.memberStats?.total_members || 0}
            </Text>
          </Card.Content>
        </Card>
      </View>

      {/* Account Balances */}
      {dashboardData?.accounts?.length > 0 && (
        <View style={styles.section}>
          <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
            Accounts
          </Text>
          {dashboardData.accounts.map((account: any) => (
            <Card key={account.id} style={[styles.fullCard, { backgroundColor: theme.colors.surface }]}>
              <Card.Content style={styles.horizontalCard}>
                <View style={[styles.iconCircle, { backgroundColor: `${theme.colors.primary}15` }]}>
                  <MaterialCommunityIcons name="bank" size={24} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text variant="titleSmall" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                    {account.account_name}
                  </Text>
                  {account.account_number && (
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                      {account.account_number}
                    </Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>Balance</Text>
                  <Text variant="titleMedium" style={{ color: theme.colors.primary, fontWeight: '700' }}>
                    {formatCurrency(account.current_balance)}
                  </Text>
                </View>
              </Card.Content>
            </Card>
          ))}
        </View>
      )}

      {/* Recent Transactions */}
      {dashboardData?.recentTransactions?.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
              Recent Transactions
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Finance' as never)}>
              <Text variant="labelMedium" style={{ color: theme.colors.primary }}>View All</Text>
            </TouchableOpacity>
          </View>
          <Card style={[styles.listCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content style={{ paddingVertical: 8 }}>
              {dashboardData.recentTransactions.slice(0, 5).map((tx: any, index: number) => (
                <View
                  key={tx.id}
                  style={[
                    styles.listItem,
                    index !== 0 && { borderTopWidth: 1, borderTopColor: theme.colors.outline },
                  ]}
                >
                  <View style={styles.txIcon}>
                    <MaterialCommunityIcons
                      name={tx.amount < 0 ? 'arrow-down' : 'arrow-up'}
                      size={16}
                      color={tx.amount < 0 ? '#dc2626' : '#16a34a'}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, fontWeight: '500' }} numberOfLines={1}>
                      {tx.transaction_name || tx.description || 'Transaction'}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                      {formatDate(tx.transaction_date)}
                    </Text>
                  </View>
                  <Text
                    variant="bodyMedium"
                    style={{
                      color: tx.amount < 0 ? '#dc2626' : '#16a34a',
                      fontWeight: '600',
                    }}
                  >
                    {tx.amount < 0 ? '-' : '+'}{formatCurrency(tx.amount)}
                  </Text>
                </View>
              ))}
            </Card.Content>
          </Card>
        </View>
      )}

      {/* Outstanding Balances */}
      {dashboardData?.unpaidBalances?.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
              Outstanding Balances
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Members' as never)}>
              <Text variant="labelMedium" style={{ color: theme.colors.primary }}>View All</Text>
            </TouchableOpacity>
          </View>
          <Card style={[styles.listCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content style={{ paddingVertical: 8 }}>
              {dashboardData.unpaidBalances.slice(0, 5).map((member: any, index: number) => (
                <TouchableOpacity
                  key={member.id}
                  style={[
                    styles.listItem,
                    index !== 0 && { borderTopWidth: 1, borderTopColor: theme.colors.outline },
                  ]}
                  onPress={() => navigation.navigate('MemberDetail' as never, { memberId: member.id } as never)}
                >
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, fontWeight: '500' }}>
                      {member.name}
                    </Text>
                    {member.member_id && (
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                        ID: {member.member_id}
                      </Text>
                    )}
                  </View>
                  <Text variant="bodyMedium" style={{ color: '#dc2626', fontWeight: '600' }}>
                    -{formatCurrency(member.balance)}
                  </Text>
                </TouchableOpacity>
              ))}
            </Card.Content>
          </Card>
        </View>
      )}

      {/* Upcoming Events */}
      {dashboardData?.upcomingEvents?.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
              Upcoming Events
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Events' as never)}>
              <Text variant="labelMedium" style={{ color: theme.colors.primary }}>View All</Text>
            </TouchableOpacity>
          </View>
          <Card style={[styles.listCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content style={{ paddingVertical: 8 }}>
              {dashboardData.upcomingEvents.slice(0, 3).map((event: any, index: number) => (
                <TouchableOpacity
                  key={event.id}
                  style={[
                    styles.listItem,
                    index !== 0 && { borderTopWidth: 1, borderTopColor: theme.colors.outline },
                  ]}
                  onPress={() => navigation.navigate('EventDetail' as never, { eventId: event.id } as never)}
                >
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, fontWeight: '500' }}>
                      {event.title}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                      {formatDate(event.event_date)}
                      {event.start_time && ` • ${formatTime(event.start_time)}`}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.eventBadge,
                      { backgroundColor: event.event_type === 'meeting' ? '#dbeafe' : '#f3e8ff' },
                    ]}
                  >
                    <Text
                      variant="labelSmall"
                      style={{ color: event.event_type === 'meeting' ? '#1e40af' : '#7c3aed', fontWeight: '600' }}
                    >
                      {event.event_type === 'meeting' ? 'Meeting' : 'Event'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
        </Card.Content>
      </Card>
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  welcomeHeader: {
    padding: 24,
    paddingTop: 48,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    elevation: 2,
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    elevation: 2,
  },
  horizontalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  section: {
    marginTop: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 12,
  },
  listCard: {
    borderRadius: 16,
    elevation: 2,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  txIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
})
