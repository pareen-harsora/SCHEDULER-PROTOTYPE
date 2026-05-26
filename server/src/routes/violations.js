const express = require("express")
const router = express.Router()
const { db } = require("../db/schema")

// GET /api/violations — all violations with employee names
router.get("/", (req, res) => {
  try {
    const { status, week } = req.query
    let query = `
      SELECT
        v.*,
        e1.name as senior_employee_name,
        e1.hire_date as senior_hire_date,
        e2.name as junior_employee_name,
        e2.hire_date as junior_hire_date
      FROM cba_violations v
      LEFT JOIN employees e1 ON e1.id = v.senior_employee_id
      LEFT JOIN employees e2 ON e2.id = v.junior_employee_id
      WHERE 1=1
    `
    const params = []
    if (status) { query += ` AND v.status = ?`; params.push(status) }
    if (week)   { query += ` AND v.violation_date >= ? AND v.violation_date < date(?, '+7 days')`; params.push(week, week) }
    query += ` ORDER BY v.created_at DESC`

    const violations = db.prepare(query).all(...params)
    res.json({ success: true, count: violations.length, data: violations })

  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// PATCH /api/violations/:id/resolve
router.patch("/:id/resolve", (req, res) => {
  try {
    db.prepare(`UPDATE cba_violations SET status = 'resolved' WHERE id = ?`).run(req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// PATCH /api/violations/:id/grieve
router.patch("/:id/grieve", (req, res) => {
  try {
    db.prepare(`UPDATE cba_violations SET status = 'grieved' WHERE id = ?`).run(req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router