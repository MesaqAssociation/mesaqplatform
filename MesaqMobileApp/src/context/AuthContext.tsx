import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react'
import { User, AuthResponse } from '../types'
import apiClient from '../services/api'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (identifier: string, password: string) => Promise<void>
  logout: () => Promise<void>
  updateUser: (data: Partial<User>) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const token = await apiClient.getToken()
      if (token) {
        const currentUser = await apiClient.getCurrentUser()
        setUser(currentUser)
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      await apiClient.clearToken()
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (identifier: string, password: string) => {
    const response: AuthResponse = await apiClient.login(identifier, password)
    setUser(response.user)
  }

  const logout = useCallback(async () => {
    console.log('Logout called - clearing user state')
    // Clear token first
    await apiClient.clearToken()
    // Then clear user state
    setUser(null)
    console.log('User state cleared')
  }, [])

  const updateUser = useCallback((data: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...data } : null)
  }, [])

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    updateUser,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

