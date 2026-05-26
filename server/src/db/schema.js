const Database = require("better-sqlite3")
const path = require("path")

// Create or open the database file
// __dirname = the folder this file lives in
// We go two levels up to put the .db file at server root
const db = new Database(path.join(__dirname, "../../scheduler.db"), {
  verbose: process.env.NODE_ENV === "development" ? console.log : null
})

// PRAGMA = SQLite configuration commands
// foreign_keys = ON means SQLite will enforce relationships between tables
// Without this, SQLite ignores foreign key constraints by default
db.pragma("journal_mode = WAL")  // WAL = Write-Ahead Logging, faster concurrent reads
db.pragma("foreign_keys = ON")

function initializeDatabase() {
  // We use a transaction so either ALL tables are created or NONE
  // This prevents a half-initialized database if something fails midway
  const migrate = db.transaction(() => {

    // STATIONS — the fixed template (10 stations, never changes)
    db.exec(`
      CREATE TABLE IF NOT EXISTS stations (
        id                       TEXT PRIMARY KEY,
        name                     TEXT NOT NULL UNIQUE,
        area                     TEXT NOT NULL CHECK(area IN ('BOH','FOH','Specialized')),
        preferred_classification TEXT,
        allowed_classifications  TEXT NOT NULL,
        display_order            INTEGER NOT NULL DEFAULT 0
      );
    `)

    // SHIFT_SLOTS — the fixed shifts per station per day
    // days_active is stored as comma-separated string: "Monday,Tuesday,Wednesday"
    // paid_hours = clock_hours - 0.5 (unpaid meal break per Art 32.03)
    db.exec(`
      CREATE TABLE IF NOT EXISTS shift_slots (
        id              TEXT PRIMARY KEY,
        station_id      TEXT NOT NULL REFERENCES stations(id),
        slot_name       TEXT NOT NULL,
        start_time      TEXT NOT NULL,
        end_time        TEXT NOT NULL,
        clock_hours     REAL NOT NULL,
        paid_hours      REAL NOT NULL,
        days_active     TEXT NOT NULL DEFAULT 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday',
        is_event_only   INTEGER NOT NULL DEFAULT 0
      );
    `)

    // EMPLOYEES — the 100 person workforce
    // hire_date IS the seniority date per Art 27.01
    // classification seniority for Cooks+GH = one combined list per your confirmation
    db.exec(`
      CREATE TABLE IF NOT EXISTS employees (
        id                  TEXT PRIMARY KEY,
        name                TEXT NOT NULL,
        hire_date           TEXT NOT NULL,
        employment_status   TEXT NOT NULL CHECK(employment_status IN ('Full Time','Part Time')),
        classification      TEXT NOT NULL CHECK(classification IN (
                              'Cook','General Help Worker','Baker','Receiver'
                            )),
        min_hours_week      REAL NOT NULL DEFAULT 24,
        max_hours_week      REAL NOT NULL DEFAULT 40,
        is_active           INTEGER NOT NULL DEFAULT 1,
        notes               TEXT DEFAULT ''
      );
    `)

    // AVAILABILITY — which days and shift bands each employee can work
    // am = before 12pm, mid = 11am-4pm, pm = after 3pm
    // One row per employee per day = 7 rows per employee = 700 rows total
    db.exec(`
      CREATE TABLE IF NOT EXISTS availability (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id   TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        day_of_week   TEXT NOT NULL CHECK(day_of_week IN (
                        'Monday','Tuesday','Wednesday','Thursday',
                        'Friday','Saturday','Sunday'
                      )),
        am_available  INTEGER NOT NULL DEFAULT 1,
        mid_available INTEGER NOT NULL DEFAULT 1,
        pm_available  INTEGER NOT NULL DEFAULT 1,
        UNIQUE(employee_id, day_of_week)
      );
    `)

    // ASSIGNMENTS — who works which shift on which day
    // This is the core operational table — generated fresh each week
    db.exec(`
      CREATE TABLE IF NOT EXISTS assignments (
        id              TEXT PRIMARY KEY,
        employee_id     TEXT REFERENCES employees(id),
        shift_slot_id   TEXT NOT NULL REFERENCES shift_slots(id),
        assigned_date   TEXT NOT NULL,
        paid_hours      REAL NOT NULL,
        status          TEXT NOT NULL DEFAULT 'assigned'
                          CHECK(status IN ('assigned','vacant','manual')),
        assigned_by     TEXT NOT NULL DEFAULT 'system',
        assigned_at     TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(shift_slot_id, assigned_date)
      );
    `)

    // AUDIT_LOG — every scheduling decision recorded with reasoning
    // This is what makes the system legally defensible
    // If a grievance is filed, you have a timestamped record of why every decision was made
    db.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id                    INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp             TEXT NOT NULL DEFAULT (datetime('now')),
        action                TEXT NOT NULL,
        employee_id           TEXT REFERENCES employees(id),
        shift_slot_id         TEXT REFERENCES shift_slots(id),
        assigned_date         TEXT,
        reason                TEXT,
        weekly_total_before   REAL DEFAULT 0,
        weekly_total_after    REAL DEFAULT 0,
        cba_article           TEXT
      );
    `)

    // CBA_VIOLATIONS — detected breaches of the collective agreement
    // senior_employee_id = who was skipped / under-scheduled
    // junior_employee_id = who incorrectly got more hours
    db.exec(`
      CREATE TABLE IF NOT EXISTS cba_violations (
        id                    TEXT PRIMARY KEY,
        violation_date        TEXT NOT NULL,
        violation_type        TEXT NOT NULL,
        article_reference     TEXT NOT NULL,
        description           TEXT NOT NULL,
        senior_employee_id    TEXT REFERENCES employees(id),
        junior_employee_id    TEXT REFERENCES employees(id),
        hours_difference      REAL DEFAULT 0,
        status                TEXT NOT NULL DEFAULT 'open'
                                CHECK(status IN ('open','resolved','grieved')),
        created_at            TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `)

  })

  // Execute the transaction
  migrate()
  console.log("✓ Database schema initialized")
}

// Export both db connection and init function
// db is used by every route file
// initializeDatabase is called once when server starts
module.exports = { db, initializeDatabase }