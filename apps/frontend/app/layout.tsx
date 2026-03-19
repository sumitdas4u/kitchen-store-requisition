import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Restaurant Inventory Requisition',
  description: 'Kitchen to Store requisition workflow'
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
