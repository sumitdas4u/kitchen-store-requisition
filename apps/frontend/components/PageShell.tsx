import Link from 'next/link'

export default function PageShell({
  title,
  subtitle,
  children
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="page">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="label">Kitchen Store Requisition</p>
            <h1 className="font-display text-3xl font-semibold">{title}</h1>
            {subtitle ? (
              <p className="text-sm text-black/60">{subtitle}</p>
            ) : null}
          </div>
          <nav className="flex flex-wrap gap-3 text-sm">
            <Link href="/kitchen/dashboard">Kitchen</Link>
            <Link href="/store/dashboard">Store</Link>
            <Link href="/admin/dashboard">Admin</Link>
          </nav>
        </header>
        {children}
      </div>
    </div>
  )
}
