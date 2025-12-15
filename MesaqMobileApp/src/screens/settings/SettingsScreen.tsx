import React, { useState } from 'react'
import { View, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { Text, Card, useTheme, Avatar, TextInput, Button, Divider, Surface, IconButton } from 'react-native-paper'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useAuth } from '../../context/AuthContext'
import apiClient from '../../services/api'
import { commonStyles } from '../../utils/theme'

export default function SettingsScreen() {
  const { user, logout, updateUser } = useAuth()
  const theme = useTheme()
  
  // Edit mode state
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
    household_members: user?.household_members?.toString() || '1',
  })
  
  // Password state
  const [showPasswordSection, setShowPasswordSection] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  const isAdmin = ['admin', 'board', 'manager', 'finance officer', 'logistics officer', 'public officer'].includes(
    (user?.role || '').toLowerCase()
  )

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A'
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    } catch {
      return 'N/A'
    }
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Name is required')
      return
    }

    setSaving(true)
    try {
      const updated = await apiClient.updateUser(user?.id || '', {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        household_members: parseInt(formData.household_members) || 1,
      })
      updateUser(updated)
      Alert.alert('Success', 'Profile updated successfully')
      setEditing(false)
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      address: user?.address || '',
      household_members: user?.household_members?.toString() || '1',
    })
    setEditing(false)
  }

  const handlePasswordChange = async () => {
    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match')
      return
    }

    setChangingPassword(true)
    try {
      await apiClient.changePassword('', newPassword)
      Alert.alert('Success', 'Password changed successfully')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordSection(false)
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to change password')
    } finally {
      setChangingPassword(false)
    }
  }

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout()
          },
        },
      ]
    )
  }

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <Surface style={[styles.header, { backgroundColor: theme.colors.primary }]} elevation={0}>
          <Text variant="headlineSmall" style={{ color: '#fff', fontWeight: '700' }}>
            Settings
          </Text>
        </Surface>

        {/* Profile Picture Section */}
        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Text variant="titleMedium" style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
              Profile Picture
            </Text>
            <View style={styles.profilePictureRow}>
              <Avatar.Text
                size={80}
                label={getInitials(user?.name || 'User')}
                style={{ backgroundColor: theme.colors.primary }}
              />
              <View style={styles.profilePictureInfo}>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  To change your profile picture, use the web app
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Profile Information Section */}
        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <Text variant="titleMedium" style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                Your Profile
              </Text>
              {!editing && (
                <Button mode="outlined" compact onPress={() => setEditing(true)}>
                  Edit
                </Button>
              )}
            </View>

            {editing ? (
              <View style={styles.form}>
                <TextInput
                  label="Name *"
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  mode="outlined"
                  style={styles.input}
                />
                <TextInput
                  label="Email"
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  mode="outlined"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                />
                <TextInput
                  label="Phone *"
                  value={formData.phone}
                  onChangeText={(text) => setFormData({ ...formData, phone: text })}
                  mode="outlined"
                  keyboardType="phone-pad"
                  style={styles.input}
                />
                <TextInput
                  label="Address"
                  value={formData.address}
                  onChangeText={(text) => setFormData({ ...formData, address: text })}
                  mode="outlined"
                  multiline
                  numberOfLines={3}
                  style={styles.input}
                />
                <TextInput
                  label="Household Members"
                  value={formData.household_members}
                  onChangeText={(text) => setFormData({ ...formData, household_members: text })}
                  mode="outlined"
                  keyboardType="number-pad"
                  style={styles.input}
                />

                <View style={styles.buttonRow}>
                  <Button 
                    mode="contained" 
                    onPress={handleSave} 
                    loading={saving}
                    style={{ flex: 1, marginRight: 8 }}
                  >
                    Save Changes
                  </Button>
                  <Button 
                    mode="outlined" 
                    onPress={handleCancel}
                    disabled={saving}
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </Button>
                </View>
              </View>
            ) : (
              <View style={styles.profileInfo}>
                <View style={styles.infoRow}>
                  <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>Name</Text>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>{user?.name || 'N/A'}</Text>
                </View>
                <Divider style={styles.divider} />
                
                <View style={styles.infoRow}>
                  <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>Email</Text>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>{user?.email || 'N/A'}</Text>
                </View>
                <Divider style={styles.divider} />
                
                <View style={styles.infoRow}>
                  <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>Phone</Text>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>{user?.phone || 'N/A'}</Text>
                </View>
                <Divider style={styles.divider} />
                
                <View style={styles.infoRow}>
                  <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>Address</Text>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>{user?.address || 'N/A'}</Text>
                </View>
                <Divider style={styles.divider} />
                
                <View style={styles.infoRow}>
                  <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>Household Members</Text>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>{user?.household_members || 1}</Text>
                </View>

                {/* Read-only info */}
                <View style={[styles.readOnlySection, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>
                    Account Information (Read-only)
                  </Text>
                  <View style={styles.readOnlyRow}>
                    <View style={styles.readOnlyItem}>
                      <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>Member ID</Text>
                      <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, fontFamily: 'monospace' }}>
                        #{user?.member_id || 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.readOnlyItem}>
                      <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>Role</Text>
                      <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                        {user?.role || 'Member'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Change Password Section */}
        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <Text variant="titleMedium" style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                Change Password
              </Text>
              {!showPasswordSection && (
                <Button mode="outlined" compact onPress={() => setShowPasswordSection(true)}>
                  Change
                </Button>
              )}
            </View>

            {showPasswordSection ? (
              <View style={styles.form}>
                <TextInput
                  label="New Password *"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  mode="outlined"
                  secureTextEntry={!showPassword}
                  right={
                    <TextInput.Icon 
                      icon={showPassword ? 'eye-off' : 'eye'} 
                      onPress={() => setShowPassword(!showPassword)}
                    />
                  }
                  style={styles.input}
                />
                <TextInput
                  label="Confirm Password *"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  mode="outlined"
                  secureTextEntry={!showPassword}
                  style={styles.input}
                />
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16 }}>
                  Password must be at least 8 characters
                </Text>

                <View style={styles.buttonRow}>
                  <Button 
                    mode="contained" 
                    onPress={handlePasswordChange} 
                    loading={changingPassword}
                    disabled={!newPassword || !confirmPassword}
                    style={{ flex: 1, marginRight: 8 }}
                  >
                    Update Password
                  </Button>
                  <Button 
                    mode="outlined" 
                    onPress={() => {
                      setShowPasswordSection(false)
                      setNewPassword('')
                      setConfirmPassword('')
                    }}
                    disabled={changingPassword}
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </Button>
                </View>
              </View>
            ) : (
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Click the button above to change your password.
              </Text>
            )}
          </Card.Content>
        </Card>

        {/* Admin Note */}
        {isAdmin && (
          <Card style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Card.Content style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="information" size={24} color={theme.colors.primary} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text variant="titleSmall" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                  Community Settings
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                  Membership fees, fines, and data export settings are available on the web app.
                </Text>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Logout Button */}
        <View style={styles.logoutSection}>
          <Button
            mode="contained"
            onPress={handleLogout}
            icon="logout"
            buttonColor="#dc2626"
            textColor="#fff"
            style={{ borderRadius: 12 }}
            contentStyle={{ paddingVertical: 8 }}
          >
            Logout
          </Button>
        </View>

        {/* Version */}
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: 16 }}>
          Mesaq Association v1.0.0
        </Text>

        <View style={{ height: 100 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingTop: 48,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 16,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    elevation: 2,
  },
  cardTitle: {
    fontWeight: '600',
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  profilePictureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profilePictureInfo: {
    flex: 1,
    marginLeft: 20,
  },
  profileInfo: {},
  infoRow: {
    paddingVertical: 12,
  },
  divider: {
    height: 1,
  },
  readOnlySection: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
  },
  readOnlyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  readOnlyItem: {
    flex: 1,
  },
  form: {
    marginTop: 8,
  },
  input: {
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  logoutSection: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
})
