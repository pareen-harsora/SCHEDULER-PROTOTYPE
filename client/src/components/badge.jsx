// Badge — colored pill for classifications, statuses, violation types
// Used everywhere in the app

const COLORS = {
  "Cook":                 "bg-blue-100 text-blue-800",
  "General Help Worker":  "bg-green-100 text-green-800",
  "Baker":                "bg-yellow-100 text-yellow-800",
  "Receiver":             "bg-purple-100 text-purple-800",
  "Full Time":            "bg-slate-100 text-slate-700",
  "Part Time":            "bg-orange-100 text-orange-700",
  "open":                 "bg-red-100 text-red-700",
  "resolved":             "bg-green-100 text-green-700",
  "grieved":              "bg-orange-100 text-orange-700",
  "OK":                   "bg-green-100 text-green-700",
  "OVER":                 "bg-red-100 text-red-700",
  "UNDER":                "bg-yellow-100 text-yellow-700",
  "BOH":                  "bg-blue-100 text-blue-700",
  "FOH":                  "bg-green-100 text-green-700",
  "Specialized":          "bg-purple-100 text-purple-700",
}

export default function Badge({ label, custom }) {
  const color = custom || COLORS[label] || "bg-gray-100 text-gray-700"
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  )
}