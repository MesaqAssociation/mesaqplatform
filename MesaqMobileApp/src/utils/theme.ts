import { MD3LightTheme, MD3DarkTheme, configureFonts } from 'react-native-paper'

const fontConfig = {
  ...MD3LightTheme.fonts,
}

// Matching the web platform's design system
export const lightTheme = {
  ...MD3LightTheme,
  fonts: configureFonts({ config: fontConfig }),
  colors: {
    ...MD3LightTheme.colors,
    primary: 'rgb(23, 23, 23)', // --primary: 0 0% 9%
    onPrimary: 'rgb(250, 250, 250)', // --primary-foreground: 0 0% 98%
    primaryContainer: 'rgb(245, 245, 245)', // --secondary: 0 0% 96.1%
    onPrimaryContainer: 'rgb(23, 23, 23)',
    secondary: 'rgb(245, 245, 245)', // --secondary: 0 0% 96.1%
    onSecondary: 'rgb(23, 23, 23)',
    secondaryContainer: 'rgb(245, 245, 245)',
    onSecondaryContainer: 'rgb(23, 23, 23)',
    background: 'rgb(255, 255, 255)', // --background: 0 0% 100%
    onBackground: 'rgb(10, 10, 10)', // --foreground: 0 0% 3.9%
    surface: 'rgb(255, 255, 255)', // --card: 0 0% 100%
    onSurface: 'rgb(10, 10, 10)',
    surfaceVariant: 'rgb(245, 245, 245)', // --muted: 0 0% 96.1%
    onSurfaceVariant: 'rgb(115, 115, 115)', // --muted-foreground: 0 0% 45.1%
    outline: 'rgb(229, 229, 229)', // --border: 0 0% 89.8%
    error: 'rgb(239, 68, 68)',
    onError: 'rgb(255, 255, 255)',
    tertiary: 'rgb(34, 197, 94)', // green for positive numbers
  },
  roundness: 8, // --radius: 0.5rem
}

export const darkTheme = {
  ...MD3DarkTheme,
  fonts: configureFonts({ config: fontConfig }),
  colors: {
    ...MD3DarkTheme.colors,
    primary: 'rgb(250, 250, 250)', // --primary: 0 0% 98%
    onPrimary: 'rgb(23, 23, 23)', // --primary-foreground: 0 0% 9%
    primaryContainer: 'rgb(38, 38, 38)', // --secondary: 0 0% 14.9%
    onPrimaryContainer: 'rgb(250, 250, 250)',
    secondary: 'rgb(38, 38, 38)', // --secondary: 0 0% 14.9%
    onSecondary: 'rgb(250, 250, 250)',
    secondaryContainer: 'rgb(38, 38, 38)',
    onSecondaryContainer: 'rgb(250, 250, 250)',
    background: 'rgb(10, 10, 10)', // --background: 0 0% 3.9%
    onBackground: 'rgb(250, 250, 250)', // --foreground: 0 0% 98%
    surface: 'rgb(10, 10, 10)', // --card: 0 0% 3.9%
    onSurface: 'rgb(250, 250, 250)',
    surfaceVariant: 'rgb(38, 38, 38)', // --muted: 0 0% 14.9%
    onSurfaceVariant: 'rgb(163, 163, 163)', // --muted-foreground: 0 0% 63.9%
    outline: 'rgb(38, 38, 38)', // --border: 0 0% 14.9%
    error: 'rgb(248, 113, 113)',
    onError: 'rgb(255, 255, 255)',
    tertiary: 'rgb(34, 197, 94)',
  },
  roundness: 8,
}

// Common styles
export const commonStyles = {
  container: {
    flex: 1,
  },
  padding: {
    small: 8,
    medium: 16,
    large: 24,
  },
  borderRadius: {
    small: 4,
    medium: 8,
    large: 16,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
}
