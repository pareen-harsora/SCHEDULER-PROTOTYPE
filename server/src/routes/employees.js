const express = require("express")
const router = express.Router()
const { db } = require("../db/schema")

// ─── GET /api/employees ───────────────────────────────────────────────────────
// Returns all active employees sorted by seniority (most senior first)
// seniority_years calculated on the fly using SQLite's julianday function
router.get("/", (req, res) => {
  try {
    const { classification, status, search } = req.query

    let query = `
      SELECT
        e.*,
        ROUND((julianday('now') - julianday(e.hire_date)) / 365.25, 1) as seniority_years,
        RANK() OVER (ORDER BY e.hire_date ASC) as seniority_rank
      FROM employees e
      WHERE e.is_active = 1
    `
    const params = []

    // Optional filters — the frontend can call /api/employees?classification=Cook
    if (classification) {
      query += ` AND e.classification = ?`
      params.push(classification)
    }
    if (status) {
      query += ` AND e.employment_status = ?`
      params.push(status)
    }
    if (search) {
      query += ` AND e.name LIKE ?`
      params.push(`%${search}%`)
    }

    query += ` ORDER BY e.hire_date ASC`

    const employees = db.prepare(query).all(...params)
    res.json({ success: true, count: employees.length, data: employees })

  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ─── GET /api/employees/:id ───────────────────────────────────────────────────
// Returns one employee with their full availability schedule
router.get("/:id", (req, res) => {
  try {
    const employee = db.prepare(`
      SELECT
        e.*,
        ROUND((julianday('now') - julianday(e.hire_date)) / 365.25, 1) as seniority_years,
        RANK() OVER (ORDER BY e.hire_date ASC) as seniority_rank
      FROM employees e
      WHERE e.id = ? AND e.is_active = 1
    `).get(req.params.id)

    if (!employee) {
      return res.status(404).json({ success: false, error: "Employee not found" })
    }

    const availability = db.prepare(`
      SELECT * FROM availability
      WHERE employee_id = ?
      ORDER BY CASE day_of_week
        WHEN 'Monday'    THEN 1
        WHEN 'Tuesday'   THEN 2
        WHEN 'Wednesday' THEN 3
        WHEN 'Thursday'  THEN 4
        WHEN 'Friday'    THEN 5
        WHEN 'Saturday'  THEN 6
        WHEN 'Sunday'    THEN 7
      END
    `).all(req.params.id)

    res.json({ success: true, data: { ...employee, availability } })

  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ─── GET /api/employees/:id/hours/:weekStart ──────────────────────────────────
// Returns weekly hours summary for one employee
// weekStart format: YYYY-MM-DD (Monday of the week)
router.get("/:id/hours/:weekStart", (req, res) => {
  try {
    const { id, weekStart } = req.params

    const summary = db.prepare(`
      SELECT
        e.id,
        e.name,
        e.classification,
        e.hire_date,
        e.employment_status,
        e.min_hours_week,
        e.max_hours_week,
        COALESCE(SUM(a.paid_hours), 0)                            as hours_assigned,
        COUNT(a.id)                                               as shifts_count,
        e.max_hours_week - COALESCE(SUM(a.paid_hours), 0)        as hours_remaining,
        ROUND(
          COALESCE(SUM(a.paid_hours), 0) / e.max_hours_week * 100
        , 1)                                                      as utilization_pct
      FROM employees e
      LEFT JOIN assignments a
        ON  a.employee_id   = e.id
        AND a.assigned_date >= ?
        AND a.assigned_date <  date(?, '+7 days')
        AND a.status        != 'vacant'
      WHERE e.id = ?
      GROUP BY e.id
    `).get(weekStart, weekStart, id)

    if (!summary) {
      return res.status(404).json({ success: false, error: "Employee not found" })
    }

    // Also return day-by-day breakdown
    const dailyBreakdown = db.prepare(`
      SELECT
        a.assigned_date,
        a.paid_hours,
        ss.start_time,
        ss.end_time,
        ss.slot_name,
        st.name as station_name
      FROM assignments a
      JOIN shift_slots ss ON ss.id = a.shift_slot_id
      JOIN stations st    ON st.id = ss.station_id
      WHERE a.employee_id   = ?
        AND a.assigned_date >= ?
        AND a.assigned_date <  date(?, '+7 days')
        AND a.status        != 'vacant'
      ORDER BY a.assigned_date
    `).all(id, weekStart, weekStart)

    res.json({
      success: true,
      data: { ...summary, daily_breakdown: dailyBreakdown }
    })

  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ─── POST /api/employees ──────────────────────────────────────────────────────
// Create a new employee
router.post("/", (req, res) => {
  try {
    const {
      id, name, hire_date, employment_status,
      classification, min_hours_week, max_hours_week, notes
    } = req.body

    // Input validation — never trust data from the frontend
    if (!id || !name || !hire_date || !employment_status || !classification) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: id, name, hire_date, employment_status, classification"
      })
    }

    // Insert employee
    db.prepare(`
      INSERT INTO employees
        (id, name, hire_date, employment_status, classification, min_hours_week, max_hours_week, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, name, hire_date, employment_status, classification,
      min_hours_week || (employment_status === "Full Time" ? 24 : 8),
      max_hours_week || (employment_status === "Full Time" ? 40 : 24),
      notes || ""
    )

    // Create default availability (available all days all shifts)
    const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
    const insertAvail = db.prepare(`
      INSERT OR IGNORE INTO availability (employee_id, day_of_week, am_available, mid_available, pm_available)
      VALUES (?, ?, 1, 1, 1)
    `)
    const insertAllDays = db.transaction(() => {
      for (const day of DAYS) insertAvail.run(id, day)
    })
    insertAllDays()

    res.status(201).json({ success: true, message: `Employee ${name} created`, id })

  } catch (err) {
    if (err.message.includes("UNIQUE constraint")) {
      return res.status(409).json({ success: false, error: "Employee ID already exists" })
    }
    res.status(500).json({ success: false, error: err.message })
  }
})

// ─── PUT /api/employees/:id ───────────────────────────────────────────────────
// Update employee details
router.put("/:id", (req, res) => {
  try {
    const { name, employment_status, classification, min_hours_week, max_hours_week, notes } = req.body

    const result = db.prepare(`
      UPDATE employees SET
        name               = COALESCE(?, name),
        employment_status  = COALESCE(?, employment_status),
        classification     = COALESCE(?, classification),
        min_hours_week     = COALESCE(?, min_hours_week),
        max_hours_week     = COALESCE(?, max_hours_week),
        notes              = COALESCE(?, notes)
      WHERE id = ?
    `).run(name, employment_status, classification, min_hours_week, max_hours_week, notes, req.params.id)

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: "Employee not found" })
    }

    res.json({ success: true, message: "Employee updated" })

  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ─── PATCH /api/employees/:id/availability ────────────────────────────────────
// Update availability for one employee
// Body: { Monday: { am: true, mid: false, pm: true }, Tuesday: {...}, ... }
router.patch("/:id/availability", (req, res) => {
  try {
    const { id } = req.params
    const availabilityData = req.body

    const update = db.prepare(`
      UPDATE availability SET
        am_available  = ?,
        mid_available = ?,
        pm_available  = ?
      WHERE employee_id = ? AND day_of_week = ?
    `)

    const updateAll = db.transaction(() => {
      for (const [day, slots] of Object.entries(availabilityData)) {
        update.run(
          slots.am  ? 1 : 0,
          slots.mid ? 1 : 0,
          slots.pm  ? 1 : 0,
          id,
          day
        )
      }
    })

    updateAll()
    res.json({ success: true, message: "Availability updated" })

  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ─── DELETE /api/employees/:id ────────────────────────────────────────────────
// Soft delete — we never truly delete employees because of audit history
router.delete("/:id", (req, res) => {
  try {
    const result = db.prepare(`
      UPDATE employees SET is_active = 0 WHERE id = ?
    `).run(req.params.id)

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: "Employee not found" })
    }

    res.json({ success: true, message: "Employee deactivated" })

  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router