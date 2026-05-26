import { useState } from "react"
import useStore from "../store"
import LoadingSpinner from "../components/LoadingSpinner"
import PageHeader from "../components/PageHeader"
import Badge from "../components/Badge"

const CLASS_COLORS = {
  "Cook":                "bg-blue-100 text-blue-800 border-blue-200",
  "General Help Worker": "bg-green-100 text-green-800 border-green-200",
  "Baker":               "bg-yellow-100 text-yellow-800 border-yellow-200",
  "Receiver":            "bg-purple-100 text-purple-800 border-purple-200",
}

export default function Schedule() {
  const schedule = useStore(s => s.schedule)
  const loading  = useStore(s => s.scheduleLoading)
  const weekDates = useStore(s => s.weekDates)
  const [selectedDay, setSelectedDay] = useState(null)

  const activeDay = selectedDay || weekDates[0]?.date

  const dayAssignments = schedule.filter(a => a.assigned_date === activeDay)

  const byStation = {}
  dayAssignments.forEach(a => {
    if (!byStation[a.station_name]) {
      byStation[a.station_name] = {
        area: a.area,
        display_order: a.display_order,
        slots: []
      }
    }
    byStation[a.station_name].slots.push(a)
  })

  const stations = Object.entries(byStation)
    .sort((a, b) => a[1].display_order - b[1].display_order)

  if (loading) return <LoadingSpinner message="Loading schedule..." />

  return (
    <div>
      <PageHeader
        title="Weekly Schedule"
        subtitle="Bulletin board view — organized by station and shift"
      />

      {/* Day Tabs */}
      <div className="flex gap-1 mb-6 bg-white border border-slate-200 rounded-xl p-1">
        {weekDates.map(({ day, date, label }) => {
          const vacant = schedule.filter(a => a.assigned_date === date && a.status === "vacant").length
          return (
            <button
              key={date}
              onClick={() => setSelectedDay(date)}
              className={`flex-1 flex flex-col items-center py-2 px-1 rounded-lg text-xs transition-colors ${
                activeDay === date
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span className="font-medium">{day.slice(0,3)}</span>
              <span className="opacity-75">{label}</span>
              {vacant > 0 && (
                <span className="mt-0.5 bg-red-500 text-white text-xs px-1 rounded-full">
                  {vacant}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {dayAssignments.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-3xl mb-3">📋</p>
          <p className="text-slate-600 font-medium">No schedule for this day</p>
          <p className="text-sm text-slate-500 mt-1">Go to Dashboard and click Generate Schedule</p>
        </div>
      )}

      {stations.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-slate-500">Key:</span>
            {Object.entries(CLASS_COLORS).map(([cls, color]) => (
              <span key={cls} className={`text-xs px-2 py-0.5 rounded border ${color}`}>{cls}</span>
            ))}
            <span className="text-xs px-2 py-0.5 rounded border bg-red-50 text-red-400 border-red-200">Vacant</span>
          </div>

          {stations.map(([name, data]) => (
            <div key={name} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800 text-sm">{name}</span>
                  <Badge label={data.area} />
                </div>
                <span className="text-xs text-slate-500">{data.slots.length} shifts</span>
              </div>
              <div className="divide-y divide-slate-100">
                {data.slots
                  .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""))
                  .map(slot => {
                    const isVacant = slot.status === "vacant"
                    const colorClass = isVacant
                      ? "bg-red-50 text-red-400 border-red-200 italic"
                      : CLASS_COLORS[slot.classification] || "bg-gray-50 text-gray-700 border-gray-200"
                    return (
                      <div key={slot.id} className="flex items-center gap-4 px-4 py-3">
                        <div className="w-40 flex-shrink-0">
                          <p className="text-xs font-medium text-slate-700">{slot.slot_name?.toUpperCase()}</p>
                          <p className="text-xs text-slate-500">{slot.start_time} – {slot.end_time}</p>
                          <p className="text-xs text-slate-400">{slot.slot_paid_hours}h paid</p>
                        </div>
                        <div className={`flex-1 px-3 py-1.5 rounded-lg border text-sm font-medium ${colorClass}`}>
                          {isVacant ? "VACANT — needs coverage" : slot.employee_name}
                        </div>
                        {!isVacant && (
                          <div className="text-right flex-shrink-0">
                            <Badge label={slot.classification} />
                            <p className="text-xs text-slate-400 mt-1">{slot.hire_date}</p>
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}