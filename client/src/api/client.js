import axios from "axios"

// Base URL points to your Node.js server
// In development: localhost:3001
// In production: your Railway URL (we set this via environment variable)
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api"

const client = axios.create({
  baseURL: API_BASE,
  timeout: 60000,  // 15 second timeout — AI calls can take a moment
  headers: {
    "Content-Type": "application/json"
  }
})

// Response interceptor — runs on every response
// If something goes wrong, we log it and re-throw
// This is where you'd add auth token refresh logic in production
client.interceptors.response.use(
  (response) => response.data,  // unwrap the axios envelope — return just the data
  (error) => {
    const message = error.response?.data?.error || error.message || "Network error"
    console.error("API Error:", message)
    return Promise.reject(new Error(message))
  }
)

// ─── API METHODS ──────────────────────────────────────────────────────────────
// Each function maps to one backend endpoint
// This keeps all API logic in one place — not scattered across components

export const api = {

  // Health check
  health: () => client.get("/health"),

  // Employees
  employees: {
    getAll:           (params) => client.get("/employees", { params }),
    getOne:           (id)     => client.get(`/employees/${id}`),
    getHours:         (id, weekStart) => client.get(`/employees/${id}/hours/${weekStart}`),
    create:           (data)   => client.post("/employees", data),
    update:           (id, data) => client.put(`/employees/${id}`, data),
    updateAvailability: (id, data) => client.patch(`/employees/${id}/availability`, data),
    deactivate:       (id)     => client.delete(`/employees/${id}`),
  },

  // Stations
  stations: {
    getAll:           ()       => client.get("/stations"),
    getSlotsForDay:   (day, includeEvents) =>
      client.get(`/stations/slots/${day}`, { params: { include_events: includeEvents } }),
  },

  // Schedule
  schedule: {
    getWeek:          (weekStart) => client.get(`/schedule/week/${weekStart}`),
    getDay:           (date)      => client.get(`/schedule/day/${date}`),
    getHours:         (weekStart) => client.get(`/schedule/hours/${weekStart}`),
    generate:         (weekStart, eventDays) =>
      client.post("/schedule/generate", { week_start: weekStart, event_days: eventDays }),
    assign:           (data)      => client.post("/schedule/assign", data),
    removeAssignment: (id)        => client.delete(`/schedule/assignment/${id}`),
  },

  // Violations
  violations: {
    getAll:           (params)  => client.get("/violations", { params }),
    resolve:          (id)      => client.patch(`/violations/${id}/resolve`),
    grieve:           (id)      => client.patch(`/violations/${id}/grieve`),
  },

  // AI
  ai: {
    analyzeWeek:      (weekStart) =>
      client.post("/ai/analyze-week", { week_start: weekStart }),
    explainViolation: (violationId) =>
      client.post("/ai/explain-violation", { violation_id: violationId }),
  }
}