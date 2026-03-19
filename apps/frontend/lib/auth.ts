'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getToken } from './session'

export function useAuthGuard(redirectTo: string) {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const existing = getToken()
    if (!existing) {
      router.push(redirectTo)
    } else {
      setToken(existing)
    }
  }, [redirectTo, router])

  return token
}
