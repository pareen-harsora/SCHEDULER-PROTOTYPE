// StatCard — the summary numbers at top of dashboard and hours page

export default function StatCard({ label, value, sub, color = "blue", icon }) {
  const colors = {
    blue:   "bg-blue-50 border-blue-100 text-blue-600",
    green:  "bg-green-50 border-green-100 text-green-600",
    red:    "bg-red-50 border-red-100 text-red-600",
    amber:  "bg-amber-50 border-amber-100 text-amber-600",
    purple: "bg-purple-50 border-purple-100 text-purple-600",
  }

  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium opacity-80">{label}</p>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <p className="text-3xl font-bold">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-70">{sub}</p>}
    </div>
  )
}