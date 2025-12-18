import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number as currency with commas (e.g., 2,190.45)
 * @param amount - The amount to format
 * @param includeDollarSign - Whether to include $ sign (default: true)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, includeDollarSign = true): string {
  const formatted = new Intl.NumberFormat('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))
  
  return includeDollarSign ? `$${formatted}` : formatted
}

/**
 * Get initials from a name (first letter of first name + first letter of last name)
 * @param name - Full name (e.g., "John Doe")
 * @returns Initials (e.g., "JD") or fallback character
 */
export function getInitials(name?: string | null): string {
  if (!name || name.trim().length === 0) {
    return 'U'
  }
  
  const nameParts = name.trim().split(/\s+/)
  
  if (nameParts.length === 1) {
    // Single name - return first two letters if available
    return nameParts[0].slice(0, 2).toUpperCase()
  }
  
  // Multiple names - return first letter of first and last name
  const firstInitial = nameParts[0][0]
  const lastInitial = nameParts[nameParts.length - 1][0]
  return (firstInitial + lastInitial).toUpperCase()
}
