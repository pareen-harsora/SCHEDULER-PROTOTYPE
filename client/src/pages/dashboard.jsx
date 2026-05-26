import { useState } from "react"
import useStore from "../store"
import StatCard from "../components/StatCard"
import LoadingSpinner from "../components/LoadingSpinner"
import PageHeader from "../components/PageHeader"
import Badge from "../components/Badge"

export default function Dashboard() {
  const {
    weekStart, weekDates, setWeekStart,
    schedule, scheduleLoading,
    hoursSummary,
    violations,
    generateSchedule,
    runAiAnalysis, aiAnalysis, aiLoading, aiError,
    eventDays, toggleEventDay
  } = useStore()

  const [generating, setGenerating]   = useState(false)
  const [genResult,  setGenResult]    = useState(null)
  const [genError,   setGenError]     = useState(null)

  // ─── DERIVED STATS ──────────────────────────────────────────────────────────
  const totalSlots      = schedule.length
  const filledSlots     = schedule.filter(a => a.status === "assigned" || a.status === "manual").length
  const vacantSlots     = schedule.filter(a => a.status === "vacant").length
  const openViolations  = violations.filter(v => v.status === "open").length
  const fillRate        = totalSlots > 0 ? Math.round(filledSlots / totalSlots * 100) : 0

  const underScheduled  = hoursSummary.filter(e =>
    e.hours_assigned < e.min_hours_week && e.hours_assigned > 0
  ).length

  const overScheduled   = hoursSummary.filter(e =>
    e.hours_assigned > e.max_hours_week
  ).length

  // ─── HANDLERS ───────────────────────────────────────────────────────────────
  async function handleGenerate() {
    setGenerating(true)
    setGenResult(null)
    setGenError(null)
    try {
      const result = await generateSchedule()
      setGenResult(result)
    } catch (err) {
      setGenError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  // ─── WEEK NAVIGATION ────────────────────────────────────────────────────────
  function shiftWeek(direction) {
    const current = new Date(weekStart + "T00:00:00")
    current.setDate(current.getDate() + direction * 7)
    setWeekStart(current.toISOString().split("T")[0])
  }

  // Format week label
  const weekLabel = (() => {
    const start = new Date(weekStart + "T00:00:00")
    const end   = new Date(weekStart + "T00:00:00")
    end.setDate(end.getDate() + 6)
    return `${start.toLocaleDateString("en-CA", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}`
  })()

  return (
    <div>
      {/* Header */}
      <PageHeader
        title="Schedule Dashboard"
        subtitle="Aramark Canada — UTSC Campus | UNITE HERE Local 75"
      />

      {/* Week Selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => shiftWeek(-1)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
          >
            ←
          </button>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Week</p>
            <p className="font-semibold text-slate-900">{weekLabel}</p>
          </div>
          <button
            onClick={() => shiftWeek(1)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
          >
            →
          </button>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={generating || scheduleLoading}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            generating || scheduleLoading
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {generating ? "Generating..." : "⚡ Generate Schedule"}
        </button>
      </div>

      {/* Generation Result */}
      {genResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
          <p className="text-sm font-medium text-green-800 mb-1">
            ✓ Schedule generated successfully
          </p>
          <p className="text-xs text-green-700">
            {genResult.assignments_made} shifts assigned ·{" "}
            {genResult.vacant_slots} vacant ·{" "}
            {genResult.violations_found} CBA violations detected ·{" "}
            {genResult.gh_boh_fills} General Help → BOH fills
          </p>
        </div>
      )}

      {genError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-red-700">Error: {genError}</p>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Fill Rate"
          value={`${fillRate}%`}
          sub={`${filledSlots} of ${totalSlots} shifts`}
          color={fillRate >= 90 ? "green" : fillRate >= 70 ? "amber" : "red"}
          icon="📋"
        />
        <StatCard
          label="Vacant Shifts"
          value={vacantSlots}
          sub="Need coverage"
          color={vacantSlots === 0 ? "green" : vacantSlots < 5 ? "amber" : "red"}
          icon="🔴"
        />
        <StatCard
          label="CBA Violations"
          value={openViolations}
          sub="Open this week"
          color={openViolations === 0 ? "green" : "red"}
          icon="⚠️"
        />
        <StatCard
          label="Hour Issues"
          value={underScheduled + overScheduled}
          sub={`${underScheduled} under · ${overScheduled} over`}
          color={underScheduled + overScheduled === 0 ? "green" : "amber"}
          icon="⏱️"
        />
      </div>

      {/* Event Days + AI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

        {/* Event Day Toggles */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">
            Event Days This Week
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Toggle event days to add extra shift slots (Art 7.03)
          </p>
          <div className="grid grid-cols-7 gap-1">
            {weekDates.map(({ day, date, label }) => {
              const isEvent = eventDays.includes(date)
              return (
                <button
                  key={date}
                  onClick={() => toggleEventDay(date)}
                  className={`flex flex-col items-center p-2 rounded-lg text-xs transition-colors ${
                    isEvent
                      ? "bg-blue-600 text-white"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className="font-medium">{day.slice(0, 3)}</span>
                  <span className="opacity-75">{label}</span>
                  {isEvent && <span className="mt-0.5">★</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* AI Analysis */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                AI Compliance Report
              </h2>
              <p className="text-xs text-slate-500">
                Claude analyzes CBA compliance + grievance risk
              </p>
            </div>
            {!aiAnalysis && (
              <button
                onClick={runAiAnalysis}
                disabled={aiLoading || filledSlots === 0}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  aiLoading || filledSlots === 0
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-purple-600 text-white hover:bg-purple-700"
                }`}
              >
                {aiLoading ? "Analyzing..." : "🤖 Analyze"}
              </button>
            )}
          </div>

          {aiLoading && (
            <LoadingSpinner message="Claude is reading the schedule..." />
          )}

          {aiError && (
            <p className="text-xs text-red-500">{aiError}</p>
          )}

          {aiAnalysis && (
            <div className="space-y-3">
              {/* Score */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-bold ${
                    aiAnalysis.compliance_score >= 80 ? "text-green-600" :
                    aiAnalysis.compliance_score >= 60 ? "text-amber-600" : "text-red-600"
                  }`}>
                    {aiAnalysis.compliance_score}
                  </span>
                  <span className="text-xs text-slate-500">/ 100 compliance</span>
                </div>
                <div className="flex gap-2">
                  <Badge label={aiAnalysis.overall_health} custom={
                    aiAnalysis.overall_health === "Good" ? "bg-green-100 text-green-700" :
                    aiAnalysis.overall_health === "Fair" ? "bg-amber-100 text-amber-700" :
                    "bg-red-100 text-red-700"
                  } />
                  <Badge label={`${aiAnalysis.grievance_risk_level} Risk`} custom={
                    aiAnalysis.grievance_risk_level === "Low"    ? "bg-green-100 text-green-700" :
                    aiAnalysis.grievance_risk_level === "Medium" ? "bg-amber-100 text-amber-700" :
                    "bg-red-100 text-red-700"
                  } />
                </div>
              </div>

              {/* Summary */}
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 rounded-lg p-3">
                {aiAnalysis.executive_summary}
              </p>

              {/* Immediate Actions */}
              {aiAnalysis.immediate_actions?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-700 mb-1">
                    Immediate Actions
                  </p>
                  {aiAnalysis.immediate_actions.map((action, i) => (
                    <div key={i} className="flex gap-2 text-xs text-amber-800 bg-amber-50 rounded p-2 mb-1">
                      <span>→</span>
                      <span>{action}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Grievance Risk */}
              <div className="bg-red-50 rounded-lg p-2">
                <p className="text-xs font-medium text-red-700 mb-0.5">
                  Grievance Risk
                </p>
                <p className="text-xs text-red-600">
                  {aiAnalysis.grievance_risk_reason}
                </p>
              </div>

              <button
                onClick={() => useStore.setState({ aiAnalysis: null })}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Refresh analysis
              </button>
            </div>
          )}

          {!aiAnalysis && !aiLoading && filledSlots === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">
              Generate a schedule first to enable AI analysis
            </p>
          )}
        </div>
      </div>

      {/* Recent Violations Preview */}
      {violations.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">
            CBA Violations This Week
          </h2>
          <div className="space-y-2">
            {violations.slice(0, 3).map(v => (
              <div
                key={v.id}
                className="flex items-start justify-between gap-4 p-3 bg-red-50 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge label={v.article_reference} custom="bg-red-100 text-red-700" />
                    <Badge label={v.status} />
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {v.description}
                  </p>
                </div>
              </div>
            ))}
            {violations.length > 3 && (
              <p className="text-xs text-slate-500 text-center pt-1">
                +{violations.length - 3} more — view all in Violations tab
              </p>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {filledSlots === 0 && !scheduleLoading && !generating && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-3xl mb-3">📅</p>
          <p className="text-slate-700 font-medium mb-1">No schedule generated yet</p>
          <p className="text-sm text-slate-500 mb-4">
            Click "Generate Schedule" to auto-assign employees by seniority
          </p>
          <button
            onClick={handleGenerate}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            ⚡ Generate Schedule
          </button>
        </div>
      )}

    </div>
  )
}