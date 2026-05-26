import { useState } from "react"
import useStore from "../store"
import LoadingSpinner from "../components/LoadingSpinner"
import PageHeader from "../components/PageHeader"
import Badge from "../components/Badge"

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]

export default function Staff() {
  const employees = useStore(s => s.employees)
  const loading   = useStore(s => s.employeesLoading)

  const [search,       setSearch]       = useState("")
  const [classFilter,  setClassFilter]  = useState("All")
  const [statusFilter, setStatusFilter] = useState("All")
  const [selectedEmp,  setSelectedEmp]  = useState(null)

  const filtered = employees.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase())
    const matchClass  = classFilter  === "All" || e.classification    === classFilter
    const matchStatus = statusFilter === "All" || e.employment_status === statusFilter
    return matchSearch && matchClass && matchStatus
  })

  if (loading) return <LoadingSpinner message="Loading staff..." />

  return (
    <div>
      <PageHeader
        title="Staff Management"
        subtitle={`${employees.length} employees — sorted by seniority`}
      />

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search employee..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
        <select value={classFilter} onChange={e => setClassFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none">
          {["All","Cook","General Help Worker","Baker","Receiver"].map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none">
          {["All","Full Time","Part Time"].map(s => <option key={s}>{s}</option>)}
        </select>
        <span className="text-xs text-slate-500 self-center">
          {filtered.length} of {employees.length} shown
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Rank</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Classification</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Hired</th>
                <th className="px-4 py-3 text-right">Max Hrs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(emp => (
                <tr key={emp.id}
                  onClick={() => setSelectedEmp(emp)}
                  className={`hover:bg-blue-50 cursor-pointer transition-colors ${
                    selectedEmp?.id === emp.id ? "bg-blue-50" : ""
                  }`}>
                  <td className="px-4 py-3 text-xs text-slate-500">#{emp.seniority_rank}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{emp.name}</td>
                  <td className="px-4 py-3"><Badge label={emp.classification} /></td>
                  <td className="px-4 py-3"><Badge label={emp.employment_status} /></td>
                  <td className="px-4 py-3 text-xs text-slate-500">{emp.hire_date}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{emp.max_hours_week}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          {!selectedEmp ? (
            <div className="text-center py-12">
              <p className="text-2xl mb-2">👆</p>
              <p className="text-sm text-slate-500">Click an employee to see details</p>
            </div>
          ) : (
            <div>
              <h2 className="font-semibold text-slate-900 mb-1">{selectedEmp.name}</h2>
              <p className="text-xs text-slate-500 mb-4">{selectedEmp.id}</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Classification</span>
                  <Badge label={selectedEmp.classification} />
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status</span>
                  <Badge label={selectedEmp.employment_status} />
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Hire Date</span>
                  <span className="font-medium">{selectedEmp.hire_date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Seniority</span>
                  <span className="font-medium">{selectedEmp.seniority_years} yrs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Rank</span>
                  <span className="font-medium text-blue-600">#{selectedEmp.seniority_rank}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Min Hours</span>
                  <span className="font-medium">{selectedEmp.min_hours_week}h/week</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Max Hours</span>
                  <span className="font-medium">{selectedEmp.max_hours_week}h/week</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}