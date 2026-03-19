export default function StatCard({
  label,
  value,
  accent = false
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div
      className={`card p-5 ${accent ? 'border-spice/40 bg-white' : ''}`}
    >
      <p className="label">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}
