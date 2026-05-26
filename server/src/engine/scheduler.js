const { db } = require("../db/schema")
const { v4: uuidv4 } = require("uuid")

// ─── UTILITIES ────────────────────────────────────────────────────────────────

// Get all 7 dates for a given week
// weekStart must be a Monday in format YYYY-MM-DD
function getWeekDates(weekStart) {
  const days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
  const start = new Date(weekStart + "T00:00:00")
  return days.map((day, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return {
      day,
      date: d.toISOString().split("T")[0]
    }
  })
}

// Determine shift band from start time
// am = starts before 11:00, mid = 11:00-14:59, pm = 15:00+
function getShiftBand(startTime) {
  const hour = parseInt(startTime.split(":")[0])
  if (hour < 11) return "am"
  if (hour < 15) return "mid"
  return "pm"
}

// Check if employee is available for a specific shift on a specific day
function isAvailable(employeeId, dayOfWeek, startTime) {
  const avail = db.prepare(`
    SELECT * FROM availability
    WHERE employee_id = ? AND day_of_week = ?
  `).get(employeeId, dayOfWeek)

  if (!avail) return false

  const band = getShiftBand(startTime)
  if (band === "am")  return avail.am_available  === 1
  if (band === "mid") return avail.mid_available === 1
  return avail.pm_available === 1
}

// Get total paid hours assigned to employee for the week
function getWeeklyHours(employeeId, weekStart) {
  const result = db.prepare(`
    SELECT COALESCE(SUM(paid_hours), 0) as total
    FROM assignments
    WHERE employee_id   = ?
      AND assigned_date >= ?
      AND assigned_date <  date(?, '+7 days')
      AND status        != 'vacant'
  `).get(employeeId, weekStart, weekStart)
  return result.total
}

// Check if employee already has a shift assigned on a given date
// CBA prevents double-shifting without explicit overtime authorization
function hasShiftOnDate(employeeId, date) {
  const result = db.prepare(`
    SELECT COUNT(*) as count
    FROM assignments
    WHERE employee_id   = ?
      AND assigned_date = ?
      AND status       != 'vacant'
  `).get(employeeId, date)
  return result.count > 0
}

// ─── ELIGIBILITY ENGINE ───────────────────────────────────────────────────────
// This is where the CBA rules live as code
// Art 27: Classification seniority governs scheduling
// Art 32.06: Most senior gets hours maximized first

function getEligibleEmployees(slot, dayOfWeek, date, weekStart) {

  // Determine which classifications can work this station
  // We stored allowed_classifications as comma-separated string
  const station = db.prepare(`
    SELECT * FROM stations WHERE id = ?
  `).get(slot.station_id)

  const allowed = station.allowed_classifications.split(",").map(c => c.trim())

  // Build SQL IN clause dynamically based on allowed classifications
  const placeholders = allowed.map(() => "?").join(",")

  // Fetch all active eligible employees sorted by hire_date ASC
  // hire_date ASC = most senior first (earliest hire = most seniority)
  // This implements Art 32.06 at the database query level
  const employees = db.prepare(`
    SELECT
      e.*,
      COALESCE(SUM(a.paid_hours), 0) as weekly_hours_so_far
    FROM employees e
    LEFT JOIN assignments a
      ON  a.employee_id   = e.id
      AND a.assigned_date >= ?
      AND a.assigned_date <  date(?, '+7 days')
      AND a.status       != 'vacant'
    WHERE e.is_active      = 1
      AND e.classification IN (${placeholders})
    GROUP BY e.id
    ORDER BY e.hire_date ASC
  `).all(weekStart, weekStart, ...allowed)

  // Filter by real-world constraints
  return employees.filter(emp => {
    // Rule 1: Must be available this day and shift band
    if (!isAvailable(emp.id, dayOfWeek, slot.start_time)) return false

    // Rule 2: No double shifts on same day (Art 32.04 - OT requires authorization)
    if (hasShiftOnDate(emp.id, date)) return false

    // Rule 3: Adding this shift must not exceed max weekly hours
    // Art 32.04: anything over 40hrs = overtime, needs authorization
    const projectedHours = emp.weekly_hours_so_far + slot.paid_hours
    if (projectedHours > emp.max_hours_week) return false

    return true
  })
}

// ─── VIOLATION DETECTOR ───────────────────────────────────────────────────────
// After the week is generated, scan for Art 32.06 violations
// A violation = junior employee has significantly more hours than a senior one

function detectSeniorityViolations(weekStart) {
  const hoursSummary = db.prepare(`
    SELECT
      e.id,
      e.name,
      e.hire_date,
      e.classification,
      e.max_hours_week,
      COALESCE(SUM(a.paid_hours), 0) as total_hours
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

  let violationsFound = 0

  // Compare each employee against every more-senior employee
  // If a junior has more than 7.5hrs extra (one full shift) vs a senior
  // that senior was denied hours they are entitled to under Art 32.06
  for (let i = 0; i < hoursSummary.length; i++) {
    const senior = hoursSummary[i]

    // Skip seniors who are already at max hours — no violation if they're full
    if (senior.total_hours >= senior.max_hours_week) continue

    for (let j = i + 1; j < hoursSummary.length; j++) {
      const junior = hoursSummary[j]

      // Only flag if junior has a full shift more than senior
      // and senior still had room for more hours
      const hoursDiff = junior.total_hours - senior.total_hours
      if (hoursDiff >= 7.5) {
        db.prepare(`
          INSERT INTO cba_violations
            (id, violation_date, violation_type, article_reference,
             description, senior_employee_id, junior_employee_id, hours_difference)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          uuidv4(),
          weekStart,
          "SENIORITY_HOURS_IMBALANCE",
          "Art 32.06",
          `${junior.name} (hired ${junior.hire_date}) received ${junior.total_hours}hrs ` +
          `while more senior ${senior.name} (hired ${senior.hire_date}) only received ` +
          `${senior.total_hours}hrs — a difference of ${hoursDiff.toFixed(2)}hrs`,
          senior.id,
          junior.id,
          parseFloat(hoursDiff.toFixed(2))
        )
        violationsFound++
      }
    }
  }

  return violationsFound
}

// ─── AUDIT LOGGER ─────────────────────────────────────────────────────────────

function logAudit(action, employeeId, slotId, date, reason, hoursBefore, hoursAfter, article) {
  db.prepare(`
    INSERT INTO audit_log
      (action, employee_id, shift_slot_id, assigned_date,
       reason, weekly_total_before, weekly_total_after, cba_article)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(action, employeeId, slotId, date, reason, hoursBefore || 0, hoursAfter || 0, article || "")
}

// ─── MAIN SCHEDULING ENGINE ───────────────────────────────────────────────────
// This is the core algorithm
// For each day → for each shift slot → find most senior eligible employee → assign

function runSchedulingEngine(weekStart, eventDays = []) {
  const weekDates = getWeekDates(weekStart)

  const results = {
    week_start:        weekStart,
    assignments_made:  0,
    vacant_slots:      0,
    violations_found:  0,
    gh_boh_fills:      0,   // times GH filled a BOH station (no Cook available)
    days:              []
  }

  // Step 1: Clear any previous auto-generated assignments for this week
  // Manual assignments (assigned_by = 'manager') are preserved
  db.prepare(`
    DELETE FROM assignments
    WHERE assigned_date >= ?
      AND assigned_date <  date(?, '+7 days')
      AND assigned_by   =  'system'
  `).run(weekStart, weekStart)

  // Also clear old violations for this week so we start fresh
  db.prepare(`
    DELETE FROM cba_violations
    WHERE violation_date >= ?
      AND violation_date <  date(?, '+7 days')
  `).run(weekStart, weekStart)

  // Step 2: Loop through each day of the week
  for (const { day, date } of weekDates) {
    const isEventDay = eventDays.includes(date)
    const dayResult  = { date, day, is_event_day: isEventDay, assignments: [], vacant: [] }

    // Get all shift slots active on this day
    // On event days, include event-only slots (Art 7.03)
    const slots = db.prepare(`
      SELECT
        ss.*,
        st.area,
        st.preferred_classification,
        st.allowed_classifications,
        st.name as station_name,
        st.display_order
      FROM shift_slots ss
      JOIN stations st ON st.id = ss.station_id
      WHERE ss.days_active LIKE ?
        AND (ss.is_event_only = 0 OR ? = 1)
      ORDER BY st.display_order, ss.start_time
    `).all(`%${day}%`, isEventDay ? 1 : 0)

    // Step 3: For each slot, find and assign the most senior eligible employee
    for (const slot of slots) {
      const eligible = getEligibleEmployees(slot, day, date, weekStart)

      // No one available — mark as vacant
      if (eligible.length === 0) {
        db.prepare(`
          INSERT INTO assignments
            (id, employee_id, shift_slot_id, assigned_date, paid_hours, status, assigned_by)
          VALUES (?, NULL, ?, ?, ?, 'vacant', 'system')
        `).run(uuidv4(), slot.id, date, slot.paid_hours)

        logAudit(
          "VACANT",
          null,
          slot.id,
          date,
          `No eligible employee found for ${slot.station_name} ${slot.slot_name}`,
          0, 0,
          "Art 32.06"
        )

        dayResult.vacant.push({
          slot_id:      slot.id,
          station:      slot.station_name,
          slot_name:    slot.slot_name,
          time:         `${slot.start_time}–${slot.end_time}`,
          paid_hours:   slot.paid_hours
        })
        results.vacant_slots++
        continue
      }

      // Assign the most senior eligible employee
      // eligible[0] is most senior because we sorted by hire_date ASC
      const assignee    = eligible[0]
      const hoursBefore = getWeeklyHours(assignee.id, weekStart)
      const hoursAfter  = hoursBefore + slot.paid_hours

      db.prepare(`
        INSERT INTO assignments
          (id, employee_id, shift_slot_id, assigned_date, paid_hours, status, assigned_by)
        VALUES (?, ?, ?, ?, ?, 'assigned', 'system')
      `).run(uuidv4(), assignee.id, slot.id, date, slot.paid_hours)

      logAudit(
        "ASSIGNED",
        assignee.id,
        slot.id,
        date,
        `Assigned by seniority rank — ${assignee.name} (hired ${assignee.hire_date})`,
        hoursBefore,
        hoursAfter,
        "Art 32.06"
      )

      // Flag when General Help fills a BOH Cook station
      // Not a violation — just important operational information
      if (
        slot.area === "BOH" &&
        assignee.classification === "General Help Worker"
      ) {
        results.gh_boh_fills++
        logAudit(
          "GH_BOH_FILL",
          assignee.id,
          slot.id,
          date,
          `No Cook available — General Help Worker ${assignee.name} filling BOH station ${slot.station_name}`,
          hoursBefore,
          hoursAfter,
          "Art 32.06"
        )
      }

      dayResult.assignments.push({
        employee_id:   assignee.id,
        employee_name: assignee.name,
        classification: assignee.classification,
        hire_date:     assignee.hire_date,
        slot_id:       slot.id,
        station:       slot.station_name,
        slot_name:     slot.slot_name,
        time:          `${slot.start_time}–${slot.end_time}`,
        paid_hours:    slot.paid_hours,
        weekly_total:  parseFloat(hoursAfter.toFixed(2))
      })
      results.assignments_made++
    }

    results.days.push(dayResult)
  }

  // Step 4: Detect seniority violations across the full week
  results.violations_found = detectSeniorityViolations(weekStart)

  // Step 5: Summary stats
  results.summary = {
    total_slots:       results.assignments_made + results.vacant_slots,
    fill_rate:         `${Math.round(results.assignments_made / (results.assignments_made + results.vacant_slots) * 100)}%`,
    gh_boh_fills:      results.gh_boh_fills,
    violations_found:  results.violations_found,
    message:           results.violations_found === 0
                         ? "Schedule generated with no CBA violations detected"
                         : `${results.violations_found} CBA violation(s) detected — review required`
  }

  console.log(`✓ Schedule generated for week of ${weekStart}`)
  console.log(`  Assignments: ${results.assignments_made}`)
  console.log(`  Vacant:      ${results.vacant_slots}`)
  console.log(`  Violations:  ${results.violations_found}`)
  console.log(`  GH→BOH fills: ${results.gh_boh_fills}`)

  return results
}

module.exports = { runSchedulingEngine }