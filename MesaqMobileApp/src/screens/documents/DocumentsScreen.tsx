import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Text, useTheme } from 'react-native-paper'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { commonStyles } from '../../utils/theme'

export default function DocumentsScreen() {
  const theme = useTheme()

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={{ fontWeight: 'bold', color: theme.colors.onBackground }}>
          Documents
        </Text>
      </View>

      <View style={styles.emptyState}>
        <MaterialCommunityIcons name="file-document-outline" size={64} color={theme.colors.onSurfaceVariant} />
        <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 16 }}>
          No documents yet
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8, textAlign: 'center' }}>
          Community documents will appear here
        </Text>
      </View>
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: commonStyles.padding.large,
  },
})
