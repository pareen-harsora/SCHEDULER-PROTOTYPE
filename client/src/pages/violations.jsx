import { useState } from "react"
import useStore from "../store"
import LoadingSpinner from "../components/LoadingSpinner"
import PageHeader from "../components/PageHeader"
import Badge from "../components/Badge"
import { api } from "../api/client"

export default function Violations() {
  const violations = useStore(s => s.violations)
  const loading    = useStore(s => s.violationsLoading)
  const weekStart  = useStore(s => s.weekStart)
  const resolveViolation = useStore(s => s.resolveViolation)
  const fetchViolations  = useStore(s => s.fetchViolations)

  const [explanations, setExplanations] = useState({})
  const [explaining,   setExplaining]   = useState({})
  const [filter,       setFilter]       = useState("all")

  const filtered = filter === "all" ? violations : violations.filter(v => v.status === filter)
  const openCount     = violations.filter(v => v.status === "open").length
  const resolvedCount = violations.filter(v => v.status === "resolved").length
  const grievedCount  = violations.filter(v => v.status === "grieved").length

  async function handleExplain(id) {
    setExplaining(p => ({ ...p, [id]: true }))
    try {
      const res = await api.ai.explainViolation(id)
      setExplanations(p => ({ ...p, [id]: res?.data?.explanation || res?.explanation }))
    } catch {
      setExplanations(p => ({ ...p, [id]: "Failed to get explanation." }))
    } finally {
      setExplaining(p => ({ ...p, [id]: false }))
    }
  }

  async function handleGrieve(id) {
    await api.violations.grieve(id)
    fetchViolations()
  }

  if (loading) return <LoadingSpinner message="Loading violations..." />

  return (
    <div>
      <PageHeader
        title="CBA Violations"
        subtitle={`Week of ${weekStart} — UNITE HERE Local 75 compliance`}
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{openCount}</p>
          <p className="text-xs text-red-700 mt-1">Open violations</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{resolvedCount}</p>
          <p className="text-xs text-green-700 mt-1">Resolved</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-orange-600">{grievedCount}</p>
          <p className="text-xs text-orange-700 mt-1">Grieved</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {["all","open","resolved","grieved"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${
              filter === f
                ? "bg-blue-600 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}>
            {f}{f === "all" ? ` (${violations.length})` : ""}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <p className="text-2xl mb-2">✅</p>
            <p className="text-slate-600 font-medium">No violations in this category</p>
          </div>
        )}
        {filtered.map(v => (
          <div key={v.id} className={`bg-white rounded-xl border overflow-hidden ${
            v.status === "open" ? "border-red-200" :
            v.status === "grieved" ? "border-orange-200" : "border-slate-200"
          }`}>
            <div className="p-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge label={v.article_reference} custom="bg-red-100 text-red-700" />
                  <Badge label={v.status} />
                </div>
                <span className="text-xs text-slate-400">{v.violation_date}</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed mb-3">{v.description}</p>

              {(v.senior_employee_name || v.junior_employee_name) && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {v.senior_employee_name && (
                    <div className="bg-blue-50 rounded-lg p-2">
                      <p className="text-xs text-blue-600 font-medium mb-0.5">Senior (under-scheduled)</p>
                      <p className="text-sm font-medium">{v.senior_employee_name}</p>
                      <p className="text-xs text-slate-500">Hired: {v.senior_hire_date}</p>
                    </div>
                  )}
                  {v.junior_employee_name && (
                    <div className="bg-orange-50 rounded-lg p-2">
                      <p className="text-xs text-orange-600 font-medium mb-0.5">Junior (over-scheduled)</p>
                      <p className="text-sm font-medium">{v.junior_employee_name}</p>
                      <p className="text-xs text-slate-500">Hired: {v.junior_hire_date}</p>
                    </div>
                  )}
                </div>
              )}

              {explanations[v.id] && (
                <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 mb-3">
                  <p className="text-xs font-medium text-purple-700 mb-1">AI Explanation</p>
                  <p className="text-xs text-purple-900 leading-relaxed">{explanations[v.id]}</p>
                </div>
              )}

              <div className="flex items-center gap-2">
                {v.status === "open" && (
                  <>
                    <button onClick={() => resolveViolation(v.id)}
                      className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700">
                      Mark Resolved
                    </button>
                    <button onClick={() => handleGrieve(v.id)}
                      className="px-3 py-1.5 bg-orange-500 text-white text-xs rounded-lg hover:bg-orange-600">
                      Mark Grieved
                    </button>
                  </>
                )}
                {!explanations[v.id] && (
                  <button onClick={() => handleExplain(v.id)} disabled={explaining[v.id]}
                    className="px-3 py-1.5 bg-purple-100 text-purple-700 text-xs rounded-lg hover:bg-purple-200">
                    {explaining[v.id] ? "Asking AI..." : "Explain this"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}