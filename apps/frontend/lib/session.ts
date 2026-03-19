export function saveToken(token: string) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem('access_token', token)
}

export function getToken(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  return window.localStorage.getItem('access_token')
}

export function saveSession(data: {
  token: string
  role?: string
  default_warehouse?: string | null
  source_warehouse?: string | null
}) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem('access_token', data.token)
  if (data.role) {
    window.localStorage.setItem('role', data.role)
  }
  if (typeof data.default_warehouse !== 'undefined') {
    window.localStorage.setItem('default_warehouse', data.default_warehouse || '')
  }
  if (typeof data.source_warehouse !== 'undefined') {
    window.localStorage.setItem('source_warehouse', data.source_warehouse || '')
  }
}

export function getRole(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  return window.localStorage.getItem('role')
}

export function getDefaultWarehouse(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  return window.localStorage.getItem('default_warehouse')
}

export function getSourceWarehouse(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  return window.localStorage.getItem('source_warehouse')
}

export function clearToken() {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.removeItem('access_token')
  window.localStorage.removeItem('role')
  window.localStorage.removeItem('default_warehouse')
  window.localStorage.removeItem('source_warehouse')
}
