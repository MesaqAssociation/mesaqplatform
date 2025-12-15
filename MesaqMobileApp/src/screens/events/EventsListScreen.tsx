import React, { useEffect, useState } from 'react'
import { View, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native'
import { Text, Card, useTheme, ActivityIndicator, SegmentedButtons } from 'react-native-paper'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import apiClient from '../../services/api'
import { commonStyles } from '../../utils/theme'
import { useNavigation } from '@react-navigation/native'

export default function EventsListScreen() {
  const theme = useTheme()
  const navigation = useNavigation()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [events, setEvents] = useState<any[]>([])
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming')

  const loadEvents = async () => {
    try {
      const data = await apiClient.getEvents()
      setEvents(data)
    } catch (error) {
      console.error('Failed to load events:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadEvents()
  }, [])

  const onRefresh = () => {
    setRefreshing(true)
    loadEvents()
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      weekday: 'short'
    })
  }

  const formatTime = (timeStr: string) => {
    if (!timeStr) return ''
    const [hours, minutes] = timeStr.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  const filteredEvents = events.filter((event) => {
    const eventDate = new Date(event.event_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    if (filter === 'upcoming') {
      return eventDate >= today && !event.completed
    } else {
      return eventDate < today || event.completed
    }
  })

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
          Events
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
          {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'}
        </Text>
      </View>

      <View style={styles.filterSection}>
        <SegmentedButtons
          value={filter}
          onValueChange={(value) => setFilter(value as 'upcoming' | 'past')}
          buttons={[
            {
              value: 'upcoming',
              label: 'Upcoming',
              icon: 'calendar-clock',
            },
            {
              value: 'past',
              label: 'Past',
              icon: 'history',
            },
          ]}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.eventsList}>
          {filteredEvents.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons 
                name="calendar-blank" 
                size={64} 
                color={theme.colors.onSurfaceVariant} 
              />
              <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 16 }}>
                No {filter} events
              </Text>
            </View>
          ) : (
            filteredEvents.map((event) => (
              <TouchableOpacity
                key={event.id}
                onPress={() => navigation.navigate('EventDetail' as never, { eventId: event.id } as never)}
              >
                <Card style={[styles.eventCard, { backgroundColor: theme.colors.surface }]}>
                  <Card.Content>
                    <View style={styles.eventHeader}>
                      <View style={{ flex: 1 }}>
                        <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                          {event.title}
                        </Text>
                        <View style={styles.dateTimeRow}>
                          <MaterialCommunityIcons name="calendar" size={14} color={theme.colors.onSurfaceVariant} />
                          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 4 }}>
                            {formatDate(event.event_date)}
                          </Text>
                          {event.start_time && (
                            <>
                              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginHorizontal: 8 }}>
                                •
                              </Text>
                              <MaterialCommunityIcons name="clock-outline" size={14} color={theme.colors.onSurfaceVariant} />
                              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 4 }}>
                                {formatTime(event.start_time)}
                              </Text>
                            </>
                          )}
                        </View>

                        {event.address && (
                          <View style={styles.locationRow}>
                            <MaterialCommunityIcons name="map-marker" size={14} color={theme.colors.onSurfaceVariant} />
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 4, flex: 1 }} numberOfLines={1}>
                              {event.address}
                            </Text>
                          </View>
                        )}

                        {event.estimated_cost > 0 && (
                          <View style={styles.costRow}>
                            <MaterialCommunityIcons name="cash" size={14} color={theme.colors.onSurfaceVariant} />
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 4 }}>
                              ${event.estimated_cost.toFixed(2)}
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.rightSection}>
                        {event.completed && (
                          <View style={[styles.statusBadge, { backgroundColor: '#dcfce7', marginBottom: 8 }]}>
                            <MaterialCommunityIcons name="check-circle" size={12} color="#15803d" />
                            <Text variant="labelSmall" style={{ color: '#15803d', marginLeft: 4, fontWeight: '600' }}>
                              Completed
                            </Text>
                          </View>
                        )}
                        
                        <View
                          style={[
                            styles.typeBadge,
                            {
                              backgroundColor: event.event_type === 'meeting' ? '#dbeafe' : '#f3e8ff',
                            },
                          ]}
                        >
                          <Text
                            variant="labelSmall"
                            style={{
                              color: event.event_type === 'meeting' ? '#1e40af' : '#7c3aed',
                              fontWeight: '600',
                            }}
                          >
                            {event.event_type === 'meeting' ? 'Meeting' : 'Event'}
                          </Text>
                        </View>

                        <MaterialCommunityIcons 
                          name="chevron-right" 
                          size={24} 
                          color={theme.colors.onSurfaceVariant}
                          style={{ marginTop: 8 }} 
                        />
                      </View>
                    </View>

                    {event.description && (
                      <Text 
                        variant="bodySmall" 
                        style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }} 
                        numberOfLines={2}
                      >
                        {event.description}
                      </Text>
                    )}
                  </Card.Content>
                </Card>
              </TouchableOpacity>
            ))
          )}
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
  filterSection: {
    paddingHorizontal: commonStyles.padding.medium,
    marginBottom: 16,
  },
  scrollView: {
    flex: 1,
  },
  eventsList: {
    paddingHorizontal: commonStyles.padding.medium,
  },
  eventCard: {
    borderRadius: commonStyles.borderRadius.medium,
    marginBottom: 12,
    elevation: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  rightSection: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
})
