import { create } from "zustand"
import { api } from "../api/client"

function getCurrentWeekStart() {
  const today = new Date()
  const day = today.getDay()
  const diff = today.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(today)
  monday.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1))
  return monday.toISOString().split("T")[0]
}

function getWeekDates(weekStart) {
  const days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
  const start = new Date(weekStart + "T00:00:00")
  return days.map((day, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return {
      day,
      date: d.toISOString().split("T")[0],
      label: d.toLocaleDateString("en-CA", { month: "short", day: "numeric" })
    }
  })
}

const useStore = create((set, get) => ({

  // ─── WEEK STATE ─────────────────────────────────────────────────────────────
  weekStart: getCurrentWeekStart(),
  weekDates: getWeekDates(getCurrentWeekStart()),
  eventDays: [],

  setWeekStart: (date) => {
    set({ weekStart: date, weekDates: getWeekDates(date) })
    get().fetchSchedule()
    get().fetchHoursSummary()
    get().fetchViolations()
  },

  toggleEventDay: (date) => {
    const { eventDays } = get()
    const updated = eventDays.includes(date)
      ? eventDays.filter(d => d !== date)
      : [...eventDays, date]
    set({ eventDays: updated })
  },

  // ─── SCHEDULE STATE ──────────────────────────────────────────────────────────
  schedule:        [],
  scheduleLoading: false,
  scheduleError:   null,

  fetchSchedule: async () => {
    const { weekStart } = get()
    set({ scheduleLoading: true, scheduleError: null })
    try {
      const res = await api.schedule.getWeek(weekStart)
      console.log("SCHEDULE:", res)
      // Handle both {data:[]} and direct array responses
      const data = Array.isArray(res) ? res : (res?.data || [])
      set({ schedule: data, scheduleLoading: false })
    } catch (err) {
      console.error("SCHEDULE ERROR:", err)
      set({ scheduleError: err.message, scheduleLoading: false })
    }
  },

  generateSchedule: async () => {
    const { weekStart, eventDays } = get()
    set({ scheduleLoading: true, scheduleError: null })
    try {
      const res = await api.schedule.generate(weekStart, eventDays)
      console.log("GENERATE RESULT:", res)
      set({ scheduleLoading: false })
      get().fetchSchedule()
      get().fetchHoursSummary()
      get().fetchViolations()
      return Array.isArray(res) ? res : (res?.data || res)
    } catch (err) {
      console.error("GENERATE ERROR:", err)
      set({ scheduleError: err.message, scheduleLoading: false })
      throw err
    }
  },

  // ─── HOURS STATE ─────────────────────────────────────────────────────────────
  hoursSummary:        [],
  hoursSummaryLoading: false,

  fetchHoursSummary: async () => {
    const { weekStart } = get()
    set({ hoursSummaryLoading: true })
    try {
      const res = await api.schedule.getHours(weekStart)
      console.log("HOURS:", res)
      const data = Array.isArray(res) ? res : (res?.data || [])
      set({ hoursSummary: data, hoursSummaryLoading: false })
    } catch (err) {
      console.error("HOURS ERROR:", err)
      set({ hoursSummaryLoading: false })
    }
  },

  // ─── VIOLATIONS STATE ─────────────────────────────────────────────────────────
  violations:        [],
  violationsLoading: false,

  fetchViolations: async () => {
    const { weekStart } = get()
    set({ violationsLoading: true })
    try {
      const res = await api.violations.getAll({ week: weekStart })
      console.log("VIOLATIONS:", res)
      const data = Array.isArray(res) ? res : (res?.data || [])
      set({ violations: data, violationsLoading: false })
    } catch (err) {
      console.error("VIOLATIONS ERROR:", err)
      set({ violationsLoading: false })
    }
  },

  resolveViolation: async (id) => {
    await api.violations.resolve(id)
    get().fetchViolations()
  },

  // ─── EMPLOYEES STATE ──────────────────────────────────────────────────────────
  employees:        [],
  employeesLoading: false,

  fetchEmployees: async (params) => {
    set({ employeesLoading: true })
    try {
      const res = await api.employees.getAll(params)
      console.log("EMPLOYEES:", res)
      const data = Array.isArray(res) ? res : (res?.data || [])
      set({ employees: data, employeesLoading: false })
    } catch (err) {
      console.error("EMPLOYEES ERROR:", err)
      set({ employeesLoading: false })
    }
  },

  // ─── STATIONS STATE ───────────────────────────────────────────────────────────
  stations: [],

  fetchStations: async () => {
    try {
      const res = await api.stations.getAll()
      console.log("STATIONS:", res)
      const data = Array.isArray(res) ? res : (res?.data || [])
      set({ stations: data })
    } catch (err) {
      console.error("STATIONS ERROR:", err)
    }
  },

  // ─── AI STATE ─────────────────────────────────────────────────────────────────
  aiAnalysis: null,
  aiLoading:  false,
  aiError:    null,

  runAiAnalysis: async () => {
    const { weekStart } = get()
    set({ aiLoading: true, aiError: null, aiAnalysis: null })
    try {
      const res = await api.ai.analyzeWeek(weekStart)
      console.log("AI ANALYSIS:", res)
      const data = res?.data || res
      set({ aiAnalysis: data, aiLoading: false })
    } catch (err) {
      console.error("AI ERROR:", err)
      set({ aiError: err.message, aiLoading: false })
    }
  },

}))

export default useStore
export { getWeekDates, getCurrentWeekStart }