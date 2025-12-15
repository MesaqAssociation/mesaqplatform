import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Text } from 'react-native-paper'

export default function CreateEventScreen() {
  return (
    <View style={styles.container}>
      <Text>Create Event</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
})
