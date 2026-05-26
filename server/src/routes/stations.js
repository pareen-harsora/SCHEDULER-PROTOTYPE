const express = require("express")
const router = express.Router()
const { db } = require("../db/schema")

// GET /api/stations — all stations with their shift slots
router.get("/", (req, res) => {
  try {
    const stations = db.prepare(`
      SELECT * FROM stations ORDER BY display_order
    `).all()

    const slots = db.prepare(`
      SELECT * FROM shift_slots
      WHERE is_event_only = 0
      ORDER BY station_id, start_time
    `).all()

    const data = stations.map(s => ({
      ...s,
      allowed_classifications: s.allowed_classifications.split(","),
      shift_slots: slots.filter(sl => sl.station_id === s.id)
    }))

    res.json({ success: true, data })

  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// GET /api/stations/slots/:dayOfWeek — slots for a specific day
router.get("/slots/:dayOfWeek", (req, res) => {
  try {
    const { dayOfWeek } = req.params
    const { include_events } = req.query

    let query = `
      SELECT
        ss.*,
        st.name              as station_name,
        st.area,
        st.display_order,
        st.preferred_classification,
        st.allowed_classifications
      FROM shift_slots ss
      JOIN stations st ON st.id = ss.station_id
      WHERE ss.days_active LIKE ?
    `
    if (!include_events || include_events === "false") {
      query += ` AND ss.is_event_only = 0`
    }
    query += ` ORDER BY st.display_order, ss.start_time`

    const slots = db.prepare(query).all(`%${dayOfWeek}%`)
    res.json({ success: true, count: slots.length, data: slots })

  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router