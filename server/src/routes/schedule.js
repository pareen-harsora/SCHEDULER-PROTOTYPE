const express = require("express")
const router = express.Router()
const { db } = require("../db/schema")
const { v4: uuidv4 } = require("uuid")
const { runSchedulingEngine } = require("../engine/scheduler")

// GET /api/schedule/week/:weekStart — full week schedule
router.get("/week/:weekStart", (req, res) => {
  try {
    const { weekStart } = req.params

    const assignments = db.prepare(`
      SELECT
        a.id,
        a.assigned_date,
        a.paid_hours,
        a.status,
        a.assigned_by,
        e.id             as employee_id,
        e.name           as employee_name,
        e.classification,
        e.hire_date,
        e.employment_status,
        ss.id            as slot_id,
        ss.slot_name,
        ss.start_time,
        ss.end_time,
        ss.clock_hours,
        ss.paid_hours    as slot_paid_hours,
        st.id            as station_id,
        st.name          as station_name,
        st.area,
        st.display_order
      FROM assignments a
      LEFT JOIN employees  e  ON e.id  = a.employee_id
      JOIN  shift_slots    ss ON ss.id = a.shift_slot_id
      JOIN  stations       st ON st.id = ss.station_id
      WHERE a.assigned_date >= ?
        AND a.assigned_date <  date(?, '+7 days')
      ORDER BY a.assigned_date, st.display_order, ss.start_time
    `).all(weekStart, weekStart)

    res.json({ success: true, count: assignments.length, data: assignments })

  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// GET /api/schedule/day/:date — single day schedule
router.get("/day/:date", (req, res) => {
  try {
    const assignments = db.prepare(`
      SELECT
        a.id,
        a.assigned_date,
        a.paid_hours,
        a.status,
        a.assigned_by,
        e.id             as employee_id,
        e.name           as employee_name,
        e.classification,
        e.hire_date,
        ss.id            as slot_id,
        ss.slot_name,
        ss.start_time,
        ss.end_time,
        ss.paid_hours    as slot_paid_hours,
        st.id            as station_id,
        st.name          as station_name,
        st.area,
        st.display_order
      FROM assignments a
      LEFT JOIN employees  e  ON e.id  = a.employee_id
      JOIN  shift_slots    ss ON ss.id = a.shift_slot_id
      JOIN  stations       st ON st.id = ss.station_id
      WHERE a.assigned_date = ?
      ORDER BY st.display_order, ss.start_time
    `).all(req.params.date)

    res.json({ success: true, count: assignments.length, data: assignments })

  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// GET /api/schedule/hours/:weekStart — hours summary for all employees
router.get("/hours/:weekStart", (req, res) => {
  try {
    const { weekStart } = req.params

    const summary = db.prepare(`
      SELECT
        e.id,
        e.name,
        e.classification,
        e.hire_date,
        e.employment_status,
        e.min_hours_week,
        e.max_hours_week,
        RANK() OVER (ORDER BY e.hire_date ASC)              as seniority_rank,
        ROUND(
          (julianday('now') - julianday(e.hire_date)) / 365.25
        , 1)                                                as seniority_years,
        COALESCE(SUM(a.paid_hours), 0)                      as hours_assigned,
        COUNT(CASE WHEN a.status = 'assigned' THEN 1 END)   as shifts_count,
        e.max_hours_week - COALESCE(SUM(a.paid_hours), 0)  as hours_remaining,
        CASE
          WHEN COALESCE(SUM(a.paid_hours), 0) > e.max_hours_week THEN 'OVER'
          WHEN COALESCE(SUM(a.paid_hours), 0) < e.min_hours_week THEN 'UNDER'
          ELSE 'OK'
        END                                                  as hours_status
      FROM employees e
      LEFT JOIN assignments a
        ON  a.employee_id   = e.id
        AND a.assigned_date >= ?
        AND a.assigned_date <  date(?, '+7 days')
        AND a.status       != 'vacant'
      WHERE e.is_active = 1
      GROUP BY e.id
      ORDER BY e.hire_date ASC
    `).all(weekStart, weekStart)

    res.json({ success: true, count: summary.length, data: summary })

  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /api/schedule/generate — run the auto-scheduler
router.post("/generate", (req, res) => {
  try {
    const { week_start, event_days = [] } = req.body

    if (!week_start) {
      return res.status(400).json({ success: false, error: "week_start is required (YYYY-MM-DD)" })
    }

    console.log(`Running scheduler for week of ${week_start}...`)
    const result = runSchedulingEngine(week_start, event_days)

    res.json({ success: true, data: result })

  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /api/schedule/assign — manual override assignment
router.post("/assign", (req, res) => {
  try {
    const { employee_id, shift_slot_id, assigned_date } = req.body

    const slot = db.prepare(`SELECT * FROM shift_slots WHERE id = ?`).get(shift_slot_id)
    if (!slot) return res.status(404).json({ success: false, error: "Shift slot not found" })

    // Check if assignment already exists for this slot+date
    const existing = db.prepare(`
      SELECT * FROM assignments WHERE shift_slot_id = ? AND assigned_date = ?
    `).get(shift_slot_id, assigned_date)

    if (existing) {
      db.prepare(`
        UPDATE assignments
        SET employee_id = ?, status = 'manual', assigned_by = 'manager'
        WHERE id = ?
      `).run(employee_id, existing.id)
    } else {
      db.prepare(`
        INSERT INTO assignments (id, employee_id, shift_slot_id, assigned_date, paid_hours, status, assigned_by)
        VALUES (?, ?, ?, ?, ?, 'manual', 'manager')
      `).run(uuidv4(), employee_id, shift_slot_id, assigned_date, slot.paid_hours)
    }

    // Audit every manual override
    db.prepare(`
      INSERT INTO audit_log (action, employee_id, shift_slot_id, assigned_date, reason, cba_article)
      VALUES ('MANUAL_OVERRIDE', ?, ?, ?, 'Manager manual assignment — bypasses seniority engine', 'Manager discretion')
    `).run(employee_id, shift_slot_id, assigned_date)

    res.json({ success: true, message: "Assignment saved" })

  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// DELETE /api/schedule/assignment/:id — remove an assignment
router.delete("/assignment/:id", (req, res) => {
  try {
    const result = db.prepare(`DELETE FROM assignments WHERE id = ?`).run(req.params.id)
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: "Assignment not found" })
    }
    res.json({ success: true, message: "Assignment removed" })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router