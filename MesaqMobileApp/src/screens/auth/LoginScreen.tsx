import React, { useState } from 'react'
import { View, StyleSheet, Image, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native'
import { TextInput, Button, Text, Card } from 'react-native-paper'
import { useAuth } from '../../context/AuthContext'
import { commonStyles } from '../../utils/theme'

export default function LoginScreen() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { login } = useAuth()

  const handleLogin = async () => {
    if (!identifier || !password) {
      Alert.alert('Error', 'Please enter both phone/name and password')
      return
    }

    setLoading(true)
    try {
      await login(identifier, password)
    } catch (error: any) {
      Alert.alert('Login Failed', error.response?.data?.error || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.logoContainer}>
          <Image
            source={{ uri: 'https://mesaq-association.vercel.app/full-logo.webp' }}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text variant="headlineMedium" style={styles.title}>
            Mesaq Association
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Community Management
          </Text>
        </View>

        <Card style={styles.card}>
          <Card.Content>
            <TextInput
              label="Phone or Name"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              left={<TextInput.Icon icon="account" />}
            />

            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              style={styles.input}
              left={<TextInput.Icon icon="lock" />}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
            />

            <Button
              mode="contained"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              style={styles.button}
            >
              Login
            </Button>

            <Text variant="bodySmall" style={styles.helpText}>
              Use your phone number or full name to login
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: commonStyles.padding.large,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: commonStyles.spacing.xl,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: commonStyles.spacing.md,
  },
  title: {
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: commonStyles.spacing.xs,
  },
  subtitle: {
    color: '#64748b',
  },
  card: {
    elevation: 4,
  },
  input: {
    marginBottom: commonStyles.spacing.md,
  },
  button: {
    marginTop: commonStyles.spacing.md,
    marginBottom: commonStyles.spacing.md,
  },
  helpText: {
    textAlign: 'center',
    color: '#64748b',
  },
})

