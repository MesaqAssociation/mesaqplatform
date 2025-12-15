"use client"

import { useState, useEffect } from 'react'
import { IconRotate } from '@tabler/icons-react'

export default function LandscapeCheck({ children }: { children: React.ReactNode }) {
  const [isPortrait, setIsPortrait] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkOrientation = () => {
      const mobile = window.innerWidth < 768
      const portrait = window.innerHeight > window.innerWidth
      setIsMobile(mobile)
      setIsPortrait(mobile && portrait)
    }

    checkOrientation()
    window.addEventListener('resize', checkOrientation)
    window.addEventListener('orientationchange', checkOrientation)

    return () => {
      window.removeEventListener('resize', checkOrientation)
      window.removeEventListener('orientationchange', checkOrientation)
    }
  }, [])

  if (isPortrait) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex flex-col items-center justify-center p-6 text-center">
        <IconRotate className="size-16 text-muted-foreground mb-6 animate-pulse" />
        <h2 className="text-xl font-semibold mb-2">Please Rotate Your Device</h2>
        <p className="text-muted-foreground max-w-sm">
          The Finance page is best viewed in landscape mode. Please rotate your device to continue.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
