import { BrowserRouter, Routes, Route } from "react-router-dom"
import { useEffect } from "react"
import useStore from "./store"
import Navbar     from "./components/Navbar"
import Dashboard  from "./pages/Dashboard"
import Schedule   from "./pages/Schedule"
import Hours      from "./pages/Hours"
import Violations from "./pages/Violations"
import Staff      from "./pages/Staff"

export default function App() {
  const { fetchSchedule, fetchHoursSummary, fetchViolations, fetchStations, fetchEmployees } = useStore()

  useEffect(() => {
    fetchStations()
    fetchEmployees()
    fetchSchedule()
    fetchHoursSummary()
    fetchViolations()
  }, [])

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-6">
          <Routes>
            <Route path="/"            element={<Dashboard />}  />
            <Route path="/schedule"    element={<Schedule />}   />
            <Route path="/hours"       element={<Hours />}      />
            <Route path="/violations"  element={<Violations />} />
            <Route path="/staff"       element={<Staff />}      />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}