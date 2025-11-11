/**
 * Test Time Acceleration for Payment Reminders
 * 
 * When WHATSAPP_TEST_ACCELERATION=true:
 * - 1 minute in real time = 1 day in system time
 * - Allows testing full month cycles in 30 minutes
 * 
 * Example:
 * - Minute 7 of test = 7th day of month (first reminder)
 * - Minute 14 of test = 14th day of month (second reminder)
 * - Minute 37 of test = 7th day of next month (fine or continue reminders)
 */

/**
 * Get the accelerated date for testing
 * Returns current date in production, or accelerated date in test mode
 */
export function getAcceleratedDate(): Date {
  const isTestMode = process.env.WHATSAPP_TEST_ACCELERATION === 'true'
  
  if (!isTestMode) {
    return new Date()
  }

  // In test mode: use TEST_START_TIME as reference point
  // Each minute after start = 1 day in system time
  const testStartTime = process.env.TEST_START_TIME
  
  if (!testStartTime) {
    console.warn('⚠️ TEST_START_TIME not set, using current time as start')
    // Set it for subsequent calls
    process.env.TEST_START_TIME = new Date().toISOString()
    return new Date()
  }

  const startDate = new Date(testStartTime)
  const now = new Date()
  
  // Calculate minutes elapsed since test start
  const minutesElapsed = Math.floor((now.getTime() - startDate.getTime()) / 1000 / 60)
  
  // Add that many days to the start date
  const acceleratedDate = new Date(startDate)
  acceleratedDate.setDate(acceleratedDate.getDate() + minutesElapsed)
  
  console.log(`⏱️ Test Acceleration: Real time +${minutesElapsed}min = System time +${minutesElapsed}days`)
  console.log(`   Start: ${startDate.toISOString()}`)
  console.log(`   Now (accelerated): ${acceleratedDate.toISOString()}`)
  
  return acceleratedDate
}

/**
 * Get the day of month (1-31) for the accelerated date
 */
export function getAcceleratedDayOfMonth(): number {
  return getAcceleratedDate().getDate()
}

/**
 * Get the first day of current month (accelerated)
 */
export function getAcceleratedMonthStart(): Date {
  const date = getAcceleratedDate()
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/**
 * Get the first day of previous month (accelerated)
 */
export function getAcceleratedPreviousMonthStart(): Date {
  const date = getAcceleratedDate()
  const prevMonth = new Date(date.getFullYear(), date.getMonth() - 1, 1)
  return prevMonth
}

/**
 * Check if we should run the reminder check based on accelerated time
 * In test mode: run every minute (since 1 min = 1 day)
 * In production: run daily
 */
export function shouldRunReminderCheck(): boolean {
  const isTestMode = process.env.WHATSAPP_TEST_ACCELERATION === 'true'
  return isTestMode // In test mode, always run (cron will handle frequency)
}

/**
 * Reset the test acceleration (useful for starting a new test)
 */
export function resetTestAcceleration(): void {
  if (process.env.WHATSAPP_TEST_ACCELERATION === 'true') {
    process.env.TEST_START_TIME = new Date().toISOString()
    console.log(`✅ Test acceleration reset. Start time: ${process.env.TEST_START_TIME}`)
  }
}

/**
 * Get human-readable test info
 */
export function getTestInfo(): string | null {
  const isTestMode = process.env.WHATSAPP_TEST_ACCELERATION === 'true'
  
  if (!isTestMode) {
    return null
  }

  const startTime = process.env.TEST_START_TIME
  if (!startTime) {
    return '⏱️ Test Mode: Active (no start time set yet)'
  }

  const startDate = new Date(startTime)
  const now = new Date()
  const minutesElapsed = Math.floor((now.getTime() - startDate.getTime()) / 1000 / 60)
  const acceleratedDate = getAcceleratedDate()

  return `⏱️ Test Mode Active
Real elapsed: ${minutesElapsed} minutes
System date: ${acceleratedDate.toLocaleDateString()} (Day ${acceleratedDate.getDate()})
1 real minute = 1 system day`
}

