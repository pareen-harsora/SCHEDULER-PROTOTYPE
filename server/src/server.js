const express = require("express")
const cors = require("cors")
const path = require("path")
require("dotenv").config({ path: path.join(__dirname, "../.env") })

const { initializeDatabase } = require("./db/schema")

// ─── APP SETUP ───────────────────────────────────────────────────────────────
const app = express()

// MIDDLEWARE CHAIN — every request passes through these in order
// Think of middleware as a pipeline: request → cors → json parser → your route → response

// cors() allows your React frontend (port 5173) to call this API (port 3001)
// Without this, browsers block cross-origin requests for security
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}))

// express.json() parses incoming request bodies as JSON
// Without this, req.body would be undefined in your POST routes
app.use(express.json())

// Request logger — in production this would be replaced by a proper
// logging library like Winston or Pino, but this is perfect for development
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`)
  next() // next() means "pass this request to the next middleware"
})

// ─── ROUTES ──────────────────────────────────────────────────────────────────
// Each route file handles a specific resource
// This pattern is called "resource-based routing" — industry standard REST design

app.use("/api/employees",   require("./routes/employees"))
app.use("/api/stations",    require("./routes/stations"))
app.use("/api/schedule",    require("./routes/schedule"))
app.use("/api/violations",  require("./routes/violations"))
app.use("/api/ai",          require("./routes/ai"))

// Health check — used by deployment platforms to verify the server is alive
// Railway, Vercel, AWS all ping this endpoint to check if your app crashed
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    database: "connected"
  })
})

// ─── GLOBAL ERROR HANDLER ────────────────────────────────────────────────────
// Any route that calls next(error) lands here
// This prevents unhandled errors from crashing the server
// In production you'd log this to a service like Sentry or Datadog
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message)
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    path: req.path
  })
})

// 404 handler — catches any route that didn't match above
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` })
})

// ─── START ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001

initializeDatabase()

app.listen(PORT, () => {
  console.log(`\n🚀 Aramark Scheduler API`)
  console.log(`   Running on http://localhost:${PORT}`)
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}`)
  console.log(`   Health: http://localhost:${PORT}/api/health\n`)
})