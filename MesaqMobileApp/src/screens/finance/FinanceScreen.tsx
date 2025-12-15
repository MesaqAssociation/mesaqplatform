import React, { useEffect, useState } from 'react'
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native'
import { Text, Card, useTheme, ActivityIndicator, SegmentedButtons } from 'react-native-paper'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import apiClient from '../../services/api'
import { commonStyles } from '../../utils/theme'

export default function FinanceScreen() {
  const theme = useTheme()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [accounts, setAccounts] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)

  const loadFinanceData = async () => {
    try {
      const [accountsData, transactionsData] = await Promise.all([
        apiClient.getAccounts(),
        apiClient.getTransactions(),
      ])
      setAccounts(accountsData)
      setTransactions(transactionsData)
      if (accountsData.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accountsData[0].id)
      }
    } catch (error) {
      console.error('Failed to load finance data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadFinanceData()
  }, [])

  const onRefresh = () => {
    setRefreshing(true)
    loadFinanceData()
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatCurrency = (amount: number) => {
    return `$${Math.abs(amount).toFixed(2)}`
  }

  const filteredTransactions = selectedAccountId
    ? transactions.filter((tx) => tx.account_id === selectedAccountId).slice(0, 20)
    : transactions.slice(0, 20)

  const selectedAccount = accounts.find((acc) => acc.id === selectedAccountId)

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
          Finance
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
          {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Account Cards */}
        <View style={styles.section}>
          <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
            Accounts
          </Text>
          {accounts.map((account) => (
            <Card
              key={account.id}
              style={[
                styles.accountCard,
                { backgroundColor: theme.colors.surface },
                selectedAccountId === account.id && { borderWidth: 2, borderColor: theme.colors.primary },
              ]}
              onPress={() => setSelectedAccountId(account.id)}
            >
              <Card.Content>
                <View style={styles.accountRow}>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleSmall" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                      {account.account_name}
                    </Text>
                    {account.account_number && (
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                        {account.account_number} {account.bsb && `• BSB: ${account.bsb}`}
                      </Text>
                    )}
                  </View>
                  <View style={styles.balanceSection}>
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      Balance
                    </Text>
                    <Text variant="titleMedium" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
                      {formatCurrency(account.current_balance)}
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          ))}
        </View>

        {/* Transactions */}
        {selectedAccount && (
          <View style={styles.section}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
              Recent Transactions - {selectedAccount.account_name}
            </Text>
            <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
              <Card.Content style={{ paddingVertical: 8 }}>
                {filteredTransactions.length === 0 ? (
                  <View style={styles.emptyState}>
                    <MaterialCommunityIcons 
                      name="cash-remove" 
                      size={48} 
                      color={theme.colors.onSurfaceVariant} 
                    />
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
                      No transactions yet
                    </Text>
                  </View>
                ) : (
                  filteredTransactions.map((tx, index) => (
                    <View
                      key={tx.id}
                      style={[
                        styles.transactionRow,
                        index !== 0 && { borderTopWidth: 1, borderTopColor: theme.colors.outline },
                      ]}
                    >
                      <View style={{ flex: 1, marginRight: 12 }}>
                        <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, fontWeight: '500' }} numberOfLines={1}>
                          {tx.transaction_name || tx.description || 'Transaction'}
                        </Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                          {formatDate(tx.transaction_date)}
                        </Text>
                        {tx.category && (
                          <View style={[styles.categoryBadge, { backgroundColor: theme.colors.surfaceVariant, marginTop: 4 }]}>
                            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                              {tx.category}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.amountContainer}>
                        <MaterialCommunityIcons
                          name={tx.amount < 0 ? 'arrow-down' : 'arrow-up'}
                          size={16}
                          color={tx.amount < 0 ? '#ef4444' : '#22c55e'}
                        />
                        <Text
                          variant="bodyMedium"
                          style={{
                            color: tx.amount < 0 ? '#ef4444' : '#22c55e',
                            fontWeight: '600',
                            marginLeft: 4,
                          }}
                        >
                          {tx.amount < 0 ? '-' : '+'}{formatCurrency(tx.amount)}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </Card.Content>
            </Card>
          </View>
        )}

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
    paddingBottom: commonStyles.padding.medium,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: commonStyles.padding.medium,
    marginBottom: 24,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 12,
  },
  accountCard: {
    borderRadius: commonStyles.borderRadius.medium,
    marginBottom: 12,
    elevation: 1,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceSection: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  card: {
    borderRadius: commonStyles.borderRadius.medium,
    elevation: 1,
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
})
