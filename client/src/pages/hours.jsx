import useStore from "../store"
import LoadingSpinner from "../components/LoadingSpinner"
import PageHeader from "../components/PageHeader"
import Badge from "../components/Badge"
import StatCard from "../components/StatCard"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"

export default function Hours() {
  const hoursSummary = useStore(s => s.hoursSummary)
  const loading = useStore(s => s.hoursSummaryLoading)
  const weekStart = useStore(s => s.weekStart)

  const totalHours  = hoursSummary.reduce((s, e) => s + (e.hours_assigned || 0), 0)
  const overCount   = hoursSummary.filter(e => e.hours_status === "OVER").length
  const underCount  = hoursSummary.filter(e => e.hours_status === "UNDER").length
  const okCount     = hoursSummary.filter(e => e.hours_status === "OK").length

  const chartData = hoursSummary.slice(0, 20).map(e => ({
    name:     e.name.split(" ")[0],
    assigned: parseFloat((e.hours_assigned || 0).toFixed(1)),
    status:   e.hours_status
  }))

  const barColor = (status) => {
    if (status === "OVER")  return "#ef4444"
    if (status === "UNDER") return "#f59e0b"
    return "#22c55e"
  }

  if (loading) return <LoadingSpinner message="Loading hours..." />

  if (!hoursSummary.length) return (
    <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
      <p className="text-3xl mb-3">⏱️</p>
      <p className="text-slate-600 font-medium">No hours data yet</p>
      <p className="text-sm text-slate-500 mt-1">Generate a schedule from the Dashboard first</p>
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Hours Report"
        subtitle={`Week of ${weekStart} — sorted by seniority (most senior first)`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Hours" value={totalHours.toFixed(0)}
          sub="across all employees" color="blue" icon="⏱️" />
        <StatCard label="On Target" value={okCount}
          sub="employees" color="green" icon="✅" />
        <StatCard label="Under Min" value={underCount}
          sub="may have seniority claim" color="amber" icon="⚠️" />
        <StatCard label="Over Max" value={overCount}
          sub="needs OT authorization" color="red" icon="🔴" />
      </div>

      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">
            Hours by Employee — Top 20 by Seniority
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Green = OK · Amber = under minimum · Red = over maximum
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barSize={16}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} domain={[0, 45]} />
              <Tooltip formatter={(val) => [`${val}hrs`, "Assigned"]} />
              <Bar dataKey="assigned" radius={[3,3,0,0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={barColor(entry.status)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
          <p className="text-sm font-semibold text-slate-900">
            Full Seniority Hour Report — {hoursSummary.length} employees
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Rank</th>
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-left">Classification</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Hired</th>
                <th className="px-4 py-3 text-right">Assigned</th>
                <th className="px-4 py-3 text-right">Max</th>
                <th className="px-4 py-3 text-right">Remaining</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hoursSummary.map(emp => (
                <tr key={emp.id} className={`hover:bg-slate-50 ${
                  emp.hours_status === "OVER"  ? "bg-red-50" :
                  emp.hours_status === "UNDER" ? "bg-amber-50" : ""
                }`}>
                  <td className="px-4 py-3 text-xs text-slate-500">#{emp.seniority_rank}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{emp.name}</td>
                  <td className="px-4 py-3"><Badge label={emp.classification} /></td>
                  <td className="px-4 py-3"><Badge label={emp.employment_status} /></td>
                  <td className="px-4 py-3 text-xs text-slate-500">{emp.hire_date}</td>
                  <td className="px-4 py-3 text-right font-medium">{(emp.hours_assigned || 0).toFixed(1)}h</td>
                  <td className="px-4 py-3 text-right text-slate-500">{emp.max_hours_week}h</td>
                  <td className="px-4 py-3 text-right text-slate-500">{(emp.hours_remaining || 0).toFixed(1)}h</td>
                  <td className="px-4 py-3 text-center"><Badge label={emp.hours_status || "OK"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}