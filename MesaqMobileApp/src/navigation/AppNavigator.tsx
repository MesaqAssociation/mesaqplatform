import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { RootStackParamList } from '../types'
import { DashboardIcon, MembersIcon, CalendarIcon, SettingsIcon } from '../components/icons'

// Screens
import LoginScreen from '../screens/auth/LoginScreen'
import DashboardScreen from '../screens/dashboard/DashboardScreen'
import MembersListScreen from '../screens/members/MembersListScreen'
import MemberDetailScreen from '../screens/members/MemberDetailScreen'
import CreateMemberScreen from '../screens/members/CreateMemberScreen'
import EventsListScreen from '../screens/events/EventsListScreen'
import EventDetailScreen from '../screens/events/EventDetailScreen'
import CreateEventScreen from '../screens/events/CreateEventScreen'
import FinanceScreen from '../screens/finance/FinanceScreen'
import DocumentsScreen from '../screens/documents/DocumentsScreen'
import SettingsScreen from '../screens/settings/SettingsScreen'
import ProfileScreen from '../screens/settings/ProfileScreen'

const Stack = createStackNavigator<RootStackParamList>()
const Tab = createBottomTabNavigator()

const MainTabs = () => {
  const { user } = useAuth()
  const isAdmin = ['admin', 'board', 'manager', 'finance officer', 'logistics officer', 'public officer'].includes(
    (user?.role || '').toLowerCase()
  )

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          // Use custom SVG icons from public/icons
          if (route.name === 'Dashboard') {
            return <DashboardIcon size={size} color={color} />
          } else if (route.name === 'Members') {
            return <MembersIcon size={size} color={color} />
          } else if (route.name === 'Events') {
            return <CalendarIcon size={size} color={color} />
          } else if (route.name === 'Settings') {
            return <SettingsIcon size={size} color={color} />
          } else if (route.name === 'Finance') {
            return <MaterialCommunityIcons name="cash" size={size} color={color} />
          } else if (route.name === 'Documents') {
            return <MaterialCommunityIcons name="file-document" size={size} color={color} />
          }
          return <MaterialCommunityIcons name="home" size={size} color={color} />
        },
        tabBarActiveTintColor: 'rgb(23, 23, 23)', // Match primary color
        tabBarInactiveTintColor: 'rgb(115, 115, 115)', // Match muted-foreground
        tabBarStyle: {
          backgroundColor: 'rgb(255, 255, 255)',
          borderTopColor: 'rgb(229, 229, 229)',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Members" component={MembersListScreen} />
      {isAdmin ? (
        <>
          <Tab.Screen name="Events" component={EventsListScreen} />
          <Tab.Screen name="Finance" component={FinanceScreen} />
          <Tab.Screen name="Documents" component={DocumentsScreen} />
        </>
      ) : (
        <Tab.Screen name="Events" component={EventsListScreen} />
      )}
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  )
}

export const AppNavigator = () => {
  const { isAuthenticated, isLoading } = useAuth()

  console.log('AppNavigator render - isAuthenticated:', isAuthenticated, 'isLoading:', isLoading)

  if (isLoading) {
    return null // Or a loading screen
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen 
            name="Login" 
            component={LoginScreen}
            options={{ animationEnabled: false }}
          />
        ) : (
          <>
            <Stack.Screen 
              name="Main" 
              component={MainTabs}
              options={{ animationEnabled: false }}
            />
            <Stack.Screen
              name="MemberDetail"
              component={MemberDetailScreen}
              options={{ headerShown: true, title: 'Member Details' }}
            />
            <Stack.Screen
              name="CreateMember"
              component={CreateMemberScreen}
              options={{ headerShown: true, title: 'Create Member' }}
            />
            <Stack.Screen
              name="EventDetail"
              component={EventDetailScreen}
              options={{ headerShown: true, title: 'Event Details' }}
            />
            <Stack.Screen
              name="CreateEvent"
              component={CreateEventScreen}
              options={{ headerShown: true, title: 'Create Event' }}
            />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ headerShown: true, title: 'Profile' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}

