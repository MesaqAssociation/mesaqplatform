import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Text } from 'react-native-paper'
import { useAuth } from '../../context/AuthContext'

export default function ProfileScreen() {
  const { user } = useAuth()

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium">{user?.name}</Text>
      <Text>{user?.phone}</Text>
      <Text>{user?.role}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },
})
