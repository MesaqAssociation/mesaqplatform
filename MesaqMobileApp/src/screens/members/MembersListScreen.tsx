import React, { useEffect, useState } from 'react'
import { View, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native'
import { Text, Card, useTheme, ActivityIndicator, Searchbar, Chip } from 'react-native-paper'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useAuth } from '../../context/AuthContext'
import apiClient from '../../services/api'
import { commonStyles } from '../../utils/theme'
import { useNavigation } from '@react-navigation/native'

export default function MembersListScreen() {
  const { user } = useAuth()
  const theme = useTheme()
  const navigation = useNavigation()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [members, setMembers] = useState<any[]>([])
  const [filteredMembers, setFilteredMembers] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PAID' | 'UNPAID'>('ALL')

  const isAdmin = ['admin', 'board', 'manager', 'finance officer', 'logistics officer', 'public officer'].includes(
    (user?.role || '').toLowerCase()
  )

  const loadMembers = async () => {
    try {
      const data = await apiClient.getMembers()
      setMembers(data)
      setFilteredMembers(data)
    } catch (error) {
      console.error('Failed to load members:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadMembers()
  }, [])

  useEffect(() => {
    let filtered = members

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (m) =>
          m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.member_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.phone?.includes(searchQuery)
      )
    }

    // Apply status filter
    if (filterStatus !== 'ALL' && isAdmin) {
      filtered = filtered.filter((m) => m.payment_status === filterStatus)
    }

    setFilteredMembers(filtered)
  }, [searchQuery, filterStatus, members])

  const onRefresh = () => {
    setRefreshing(true)
    loadMembers()
  }

  const formatBalance = (balance: number) => {
    const absBalance = Math.abs(balance)
    return `$${absBalance.toFixed(2)}`
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={{ fontWeight: 'bold', color: theme.colors.onBackground }}>
          Members
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
          {filteredMembers.length} {filteredMembers.length === 1 ? 'member' : 'members'}
        </Text>
      </View>

      <View style={styles.searchSection}>
        <Searchbar
          placeholder="Search by name, ID, or phone"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={{ backgroundColor: theme.colors.surface }}
        />

        {isAdmin && (
          <View style={styles.filterChips}>
            <Chip
              selected={filterStatus === 'ALL'}
              onPress={() => setFilterStatus('ALL')}
              style={{ marginRight: 8 }}
            >
              All
            </Chip>
            <Chip
              selected={filterStatus === 'PAID'}
              onPress={() => setFilterStatus('PAID')}
              style={{ marginRight: 8 }}
              icon="check-circle"
            >
              Paid
            </Chip>
            <Chip
              selected={filterStatus === 'UNPAID'}
              onPress={() => setFilterStatus('UNPAID')}
              icon="alert-circle"
            >
              Unpaid
            </Chip>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.membersList}>
          {filteredMembers.map((member) => (
            <TouchableOpacity
              key={member.id}
              onPress={() => navigation.navigate('MemberDetail' as never, { memberId: member.id } as never)}
            >
              <Card style={[styles.memberCard, { backgroundColor: theme.colors.surface }]}>
                <Card.Content>
                  <View style={styles.memberRow}>
                    <View style={styles.memberInfo}>
                      <View style={styles.memberHeader}>
                        <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                          {member.name}
                        </Text>
                        {member.payment_status && (
                          <View
                            style={[
                              styles.statusBadge,
                              {
                                backgroundColor: member.payment_status === 'PAID' ? '#dcfce7' : '#fee2e2',
                              },
                            ]}
                          >
                            <Text
                              variant="labelSmall"
                              style={{
                                color: member.payment_status === 'PAID' ? '#15803d' : '#dc2626',
                                fontWeight: '600',
                              }}
                            >
                              {member.payment_status === 'PAID' ? 'Paid' : 'Unpaid'}
                            </Text>
                          </View>
                        )}
                      </View>

                      {member.member_id && (
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                          ID: {member.member_id}
                        </Text>
                      )}

                      {isAdmin && member.phone && (
                        <View style={styles.contactRow}>
                          <MaterialCommunityIcons name="phone" size={14} color={theme.colors.onSurfaceVariant} />
                          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 4 }}>
                            {member.phone}
                          </Text>
                        </View>
                      )}

                      {isAdmin && member.household_members && (
                        <View style={styles.contactRow}>
                          <MaterialCommunityIcons name="home-account" size={14} color={theme.colors.onSurfaceVariant} />
                          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 4 }}>
                            {member.household_members} {member.household_members === 1 ? 'member' : 'members'}
                          </Text>
                        </View>
                      )}
                    </View>

                    {isAdmin && member.balance !== null && member.balance !== undefined && (
                      <View style={styles.balanceContainer}>
                        <Text
                          variant="titleSmall"
                          style={{
                            color: member.balance < 0 ? '#dc2626' : '#15803d',
                            fontWeight: 'bold',
                          }}
                        >
                          {member.balance < 0 ? '-' : '+'}{formatBalance(member.balance)}
                        </Text>
                      </View>
                    )}

                    <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.onSurfaceVariant} />
                  </View>
                </Card.Content>
              </Card>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: commonStyles.padding.medium,
    paddingTop: commonStyles.padding.large,
    paddingBottom: commonStyles.padding.small,
  },
  searchSection: {
    paddingHorizontal: commonStyles.padding.medium,
    marginBottom: 16,
  },
  filterChips: {
    flexDirection: 'row',
    marginTop: 12,
  },
  scrollView: {
    flex: 1,
  },
  membersList: {
    paddingHorizontal: commonStyles.padding.medium,
  },
  memberCard: {
    borderRadius: commonStyles.borderRadius.medium,
    marginBottom: 12,
    elevation: 1,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberInfo: {
    flex: 1,
    marginRight: 12,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  balanceContainer: {
    marginRight: 8,
  },
})
