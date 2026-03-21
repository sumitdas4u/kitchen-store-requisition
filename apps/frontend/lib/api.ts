const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export async function apiRequest<T>(
  path: string,
  method: HttpMethod,
  body?: unknown,
  token?: string
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  })

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth/') && token) {
      const role = window.localStorage.getItem('role')
      window.localStorage.removeItem('access_token')
      window.localStorage.removeItem('role')
      window.localStorage.removeItem('default_warehouse')
      window.localStorage.removeItem('source_warehouse')
      window.localStorage.removeItem('warehouses')
      const loginPath = role === 'Store User' ? '/store/login' : role === 'Admin' ? '/admin/login' : '/kitchen/login'
      window.location.href = loginPath
    }
    const message = await response.text()
    throw new Error(message || 'Request failed')
  }

  return (await response.json()) as T
}

export async function apiUploadFiles(
  path: string,
  files: File[],
  token?: string
): Promise<{ uploaded: number; urls: string[] }> {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: formData
  })

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      const role = window.localStorage.getItem('role')
      window.localStorage.removeItem('access_token')
      window.localStorage.removeItem('role')
      window.localStorage.removeItem('default_warehouse')
      window.localStorage.removeItem('source_warehouse')
      window.localStorage.removeItem('warehouses')
      const loginPath = role === 'Store User' ? '/store/login' : role === 'Admin' ? '/admin/login' : '/kitchen/login'
      window.location.href = loginPath
    }
    const message = await response.text()
    throw new Error(message || 'Upload failed')
  }

  return (await response.json()) as { uploaded: number; urls: string[] }
}
