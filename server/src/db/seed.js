const { db, initializeDatabase } = require("./schema")
const { v4: uuidv4 } = require("uuid")

const ALL_DAYS = "Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday"

// ─── UTILITY: Calculate paid hours from start/end time strings ───────────────
// This enforces Art 32.03: 30-minute unpaid meal deducted from shifts ≥5 hours
function calcHours(start, end) {
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  let clockMins = eh * 60 + em - (sh * 60 + sm)
  if (clockMins < 0) clockMins += 24 * 60  // handles overnight shifts
  const clockHours = clockMins / 60
  // Art 32.03: unpaid 30-min meal if shift >= 5 hours
  const paidHours = clockHours >= 5 ? clockHours - 0.5 : clockHours
  return {
    clock_hours: Math.round(clockHours * 100) / 100,
    paid_hours:  Math.round(paidHours  * 100) / 100
  }
}

// ─── STATIONS ────────────────────────────────────────────────────────────────
function seedStations() {
  const stations = [
    // BOH — Cook preferred, but Cook OR General Help can work here
    {
      id: "entree",
      name: "Entree",
      area: "BOH",
      preferred_classification: "Cook",
      allowed_classifications: "Cook,General Help Worker",
      display_order: 1
    },
    {
      id: "pizza",
      name: "Pizza",
      area: "BOH",
      preferred_classification: "Cook",
      allowed_classifications: "Cook,General Help Worker",
      display_order: 2
    },
    {
      id: "pho",
      name: "Pho",
      area: "BOH",
      preferred_classification: "Cook",
      allowed_classifications: "Cook,General Help Worker",
      display_order: 3
    },
    {
      id: "omelette_pasta",
      name: "Omelette/Pasta",
      area: "BOH",
      preferred_classification: "Cook",
      allowed_classifications: "Cook,General Help Worker",
      display_order: 4
    },
    {
      id: "salad_deli",
      name: "Salad/Deli",
      area: "BOH",
      preferred_classification: "Cook",
      allowed_classifications: "Cook,General Help Worker",
      display_order: 5
    },
    // FOH — General Help only
    {
      id: "foh",
      name: "FOH",
      area: "FOH",
      preferred_classification: "General Help Worker",
      allowed_classifications: "General Help Worker",
      display_order: 6
    },
    {
      id: "cashier_foh",
      name: "Cashier/FOH",
      area: "FOH",
      preferred_classification: "General Help Worker",
      allowed_classifications: "General Help Worker",
      display_order: 7
    },
    {
      id: "dish_area",
      name: "Dish Area",
      area: "FOH",
      preferred_classification: "General Help Worker",
      allowed_classifications: "General Help Worker",
      display_order: 8
    },
    // GH Bakery — Baker preferred, General Help fills
    {
      id: "gh_bakery",
      name: "GH Bakery",
      area: "FOH",
      preferred_classification: "Baker",
      allowed_classifications: "Baker,General Help Worker",
      display_order: 9
    },
    // Specialized — Receiver only, no substitution
    {
      id: "receiver",
      name: "Receiver",
      area: "Specialized",
      preferred_classification: "Receiver",
      allowed_classifications: "Receiver",
      display_order: 10
    },
  ]

  const insert = db.prepare(`
    INSERT OR IGNORE INTO stations
      (id, name, area, preferred_classification, allowed_classifications, display_order)
    VALUES
      (@id, @name, @area, @preferred_classification, @allowed_classifications, @display_order)
  `)

  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(row)
  })

  insertMany(stations)
  console.log(`✓ Seeded ${stations.length} stations`)
}

// ─── SHIFT SLOTS ─────────────────────────────────────────────────────────────
function seedShiftSlots() {
  const rawSlots = [
    // ENTREE
    { id: "entree_am",       station_id: "entree",         slot_name: "am",            start: "06:15", end: "14:00" },
    { id: "entree_pm",       station_id: "entree",         slot_name: "pm",            start: "14:30", end: "23:00" },
    // PIZZA
    { id: "pizza_am",        station_id: "pizza",          slot_name: "am",            start: "09:30", end: "16:30" },
    { id: "pizza_pm",        station_id: "pizza",          slot_name: "pm",            start: "16:30", end: "23:15" },
    // PHO
    { id: "pho_am",          station_id: "pho",            slot_name: "am",            start: "09:30", end: "16:00" },
    { id: "pho_mid",         station_id: "pho",            slot_name: "mid",           start: "13:00", end: "19:00" },
    { id: "pho_pm",          station_id: "pho",            slot_name: "pm",            start: "16:00", end: "22:30" },
    // OMELETTE/PASTA
    { id: "op_am",           station_id: "omelette_pasta", slot_name: "am",            start: "06:30", end: "14:00" },
    { id: "op_am2",          station_id: "omelette_pasta", slot_name: "am2",           start: "09:00", end: "14:30" },
    { id: "op_mid",          station_id: "omelette_pasta", slot_name: "mid",           start: "12:30", end: "19:00" },
    { id: "op_pm",           station_id: "omelette_pasta", slot_name: "pm",            start: "15:30", end: "22:00" },
    { id: "op_pm2",          station_id: "omelette_pasta", slot_name: "pm2",           start: "17:00", end: "23:15" },
    // SALAD/DELI
    { id: "sd_am",           station_id: "salad_deli",     slot_name: "am",            start: "06:00", end: "13:00" },
    { id: "sd_support",      station_id: "salad_deli",     slot_name: "support",       start: "08:00", end: "16:00" },
    { id: "sd_support2",     station_id: "salad_deli",     slot_name: "support2",      start: "11:00", end: "16:00" },
    { id: "sd_pm",           station_id: "salad_deli",     slot_name: "pm",            start: "16:00", end: "23:15" },
    // FOH
    { id: "foh_am",          station_id: "foh",            slot_name: "am",            start: "06:00", end: "13:00" },
    { id: "foh_am2",         station_id: "foh",            slot_name: "am2",           start: "06:15", end: "13:30" },
    { id: "foh_mid",         station_id: "foh",            slot_name: "mid",           start: "12:30", end: "19:00" },
    { id: "foh_pm",          station_id: "foh",            slot_name: "pm",            start: "15:30", end: "23:15" },
    { id: "foh_pm2",         station_id: "foh",            slot_name: "pm2",           start: "17:00", end: "23:15" },
    // CASHIER/FOH
    { id: "cash_am",         station_id: "cashier_foh",    slot_name: "am",            start: "06:30", end: "13:30" },
    { id: "cash_cover",      station_id: "cashier_foh",    slot_name: "cover",         start: "11:00", end: "15:00" },
    { id: "cash_pm",         station_id: "cashier_foh",    slot_name: "pm",            start: "15:30", end: "23:15" },
    { id: "cash_cover2",     station_id: "cashier_foh",    slot_name: "cover2",        start: "17:15", end: "23:15" },
    // DISH AREA
    { id: "dish_am",         station_id: "dish_area",      slot_name: "am",            start: "06:45", end: "14:00" },
    { id: "dish_am2",        station_id: "dish_area",      slot_name: "am2",           start: "09:00", end: "14:00" },
    { id: "dish_mid",        station_id: "dish_area",      slot_name: "mid",           start: "10:00", end: "18:00" },
    { id: "dish_mid2",       station_id: "dish_area",      slot_name: "mid2",          start: "12:30", end: "19:00" },
    { id: "dish_pm",         station_id: "dish_area",      slot_name: "pm",            start: "15:00", end: "22:00" },
    { id: "dish_pm2",        station_id: "dish_area",      slot_name: "pm2",           start: "17:00", end: "22:00" },
    { id: "dish_pm3",        station_id: "dish_area",      slot_name: "pm3",           start: "16:30", end: "23:30" },
    { id: "dish_pm4",        station_id: "dish_area",      slot_name: "pm4",           start: "17:00", end: "23:30" },
    { id: "dish_pm5",        station_id: "dish_area",      slot_name: "pm5",           start: "18:00", end: "23:30" },
    // GH BAKERY
    { id: "bak_am",          station_id: "gh_bakery",      slot_name: "am",            start: "05:45", end: "12:00" },
    { id: "bak_am2",         station_id: "gh_bakery",      slot_name: "am2",           start: "07:45", end: "14:00" },
    { id: "bak_mid",         station_id: "gh_bakery",      slot_name: "mid",           start: "10:00", end: "15:00" },
    { id: "bak_pm",          station_id: "gh_bakery",      slot_name: "pm",            start: "14:00", end: "22:30" },
    // RECEIVER
    { id: "recv_am",         station_id: "receiver",       slot_name: "am",            start: "06:45", end: "14:30" },
    { id: "recv_mid",        station_id: "receiver",       slot_name: "mid",           start: "09:30", end: "17:30" },
    // EVENT ONLY SLOTS
    { id: "event_sushi",     station_id: "salad_deli",     slot_name: "sushi_support", start: "09:00", end: "16:00", event_only: true },
    { id: "event_pizza_sup", station_id: "pizza",          slot_name: "event_support", start: "10:00", end: "14:00", event_only: true },
    { id: "event_salad_sup", station_id: "salad_deli",     slot_name: "event_support", start: "10:00", end: "14:00", event_only: true },
  ]

  const insert = db.prepare(`
    INSERT OR IGNORE INTO shift_slots
      (id, station_id, slot_name, start_time, end_time,
       clock_hours, paid_hours, days_active, is_event_only)
    VALUES
      (@id, @station_id, @slot_name, @start_time, @end_time,
       @clock_hours, @paid_hours, @days_active, @is_event_only)
  `)

  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(row)
  })

  const slots = rawSlots.map(s => {
    const { clock_hours, paid_hours } = calcHours(s.start, s.end)
    return {
      id:            s.id,
      station_id:    s.station_id,
      slot_name:     s.slot_name,
      start_time:    s.start,
      end_time:      s.end,
      clock_hours,
      paid_hours,
      days_active:   ALL_DAYS,
      is_event_only: s.event_only ? 1 : 0
    }
  })

  insertMany(slots)
  console.log(`✓ Seeded ${slots.length} shift slots`)

  // Log paid vs clock hours for verification
  console.log("\n  Paid hours verification (Art 32.03 compliance):")
  slots.slice(0, 5).forEach(s => {
    console.log(`  ${s.id}: clock=${s.clock_hours}hrs → paid=${s.paid_hours}hrs`)
  })
  console.log("  ...")
}

// ─── EMPLOYEES ───────────────────────────────────────────────────────────────
function seedEmployees() {
  // Using the 100-employee dataset we generated earlier
  // Top 10 most senior (1995-2000), rest random 1995-today
  // 60 FT, 40 PT | 4 Receivers, 10 Bakers, 25 Cooks, 61 GH
  const employees = [
    // TOP 10 SENIOR (hired 1995-2000)
    { id:"EMP001", name:"Edward Adams",         hire_date:"1995-01-10", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP002", name:"David Diaz",           hire_date:"1995-02-23", employment_status:"Part Time",  classification:"General Help Worker", min_hours_week:8,  max_hours_week:24 },
    { id:"EMP003", name:"Benjamin Richardson",  hire_date:"1995-07-08", employment_status:"Part Time",  classification:"General Help Worker", min_hours_week:8,  max_hours_week:24 },
    { id:"EMP004", name:"Stephanie Rivera",     hire_date:"1995-11-16", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP005", name:"Margaret Thompson",    hire_date:"1996-07-25", employment_status:"Full Time",  classification:"Cook",                min_hours_week:24, max_hours_week:40 },
    { id:"EMP006", name:"Robert Garcia",        hire_date:"1996-08-08", employment_status:"Full Time",  classification:"Cook",                min_hours_week:24, max_hours_week:40 },
    { id:"EMP007", name:"Patricia Martinez",    hire_date:"1997-02-10", employment_status:"Full Time",  classification:"Baker",               min_hours_week:24, max_hours_week:40 },
    { id:"EMP008", name:"James Wilson",         hire_date:"1997-05-14", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP009", name:"Linda Anderson",       hire_date:"1997-05-20", employment_status:"Full Time",  classification:"Cook",                min_hours_week:24, max_hours_week:40 },
    { id:"EMP010", name:"Michael Brown",        hire_date:"1997-08-07", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    // RECEIVERS (4 total)
    { id:"EMP011", name:"Sandra Lee",           hire_date:"1999-03-15", employment_status:"Full Time",  classification:"Receiver",            min_hours_week:24, max_hours_week:40 },
    { id:"EMP012", name:"Kevin Harris",         hire_date:"2003-07-22", employment_status:"Full Time",  classification:"Receiver",            min_hours_week:24, max_hours_week:40 },
    { id:"EMP013", name:"Angela White",         hire_date:"2010-11-30", employment_status:"Part Time",  classification:"Receiver",            min_hours_week:8,  max_hours_week:24 },
    { id:"EMP014", name:"Brian Jackson",        hire_date:"2018-04-12", employment_status:"Part Time",  classification:"Receiver",            min_hours_week:8,  max_hours_week:24 },
    // BAKERS (10 total - 7 remaining after EMP007)
    { id:"EMP015", name:"Nancy Taylor",         hire_date:"2000-06-14", employment_status:"Full Time",  classification:"Baker",               min_hours_week:24, max_hours_week:40 },
    { id:"EMP016", name:"George Moore",         hire_date:"2002-09-03", employment_status:"Full Time",  classification:"Baker",               min_hours_week:24, max_hours_week:40 },
    { id:"EMP017", name:"Karen Thomas",         hire_date:"2005-01-17", employment_status:"Part Time",  classification:"Baker",               min_hours_week:8,  max_hours_week:24 },
    { id:"EMP018", name:"Donald Martin",        hire_date:"2008-08-25", employment_status:"Full Time",  classification:"Baker",               min_hours_week:24, max_hours_week:40 },
    { id:"EMP019", name:"Lisa Johnson",         hire_date:"2011-03-10", employment_status:"Part Time",  classification:"Baker",               min_hours_week:8,  max_hours_week:24 },
    { id:"EMP020", name:"Charles Davis",        hire_date:"2014-06-28", employment_status:"Full Time",  classification:"Baker",               min_hours_week:24, max_hours_week:40 },
    { id:"EMP021", name:"Betty Miller",         hire_date:"2017-09-14", employment_status:"Part Time",  classification:"Baker",               min_hours_week:8,  max_hours_week:24 },
    { id:"EMP022", name:"Paul Wilson",          hire_date:"2020-02-03", employment_status:"Full Time",  classification:"Baker",               min_hours_week:24, max_hours_week:40 },
    { id:"EMP023", name:"Dorothy Garcia",       hire_date:"2022-07-19", employment_status:"Part Time",  classification:"Baker",               min_hours_week:8,  max_hours_week:24 },
    // COOKS (25 total - 3 used above as EMP005, EMP006, EMP009)
    { id:"EMP024", name:"Steven Martinez",      hire_date:"1998-04-12", employment_status:"Full Time",  classification:"Cook",                min_hours_week:24, max_hours_week:40 },
    { id:"EMP025", name:"Deborah Robinson",     hire_date:"2000-11-08", employment_status:"Full Time",  classification:"Cook",                min_hours_week:24, max_hours_week:40 },
    { id:"EMP026", name:"Ronald Clark",         hire_date:"2002-03-25", employment_status:"Full Time",  classification:"Cook",                min_hours_week:24, max_hours_week:40 },
    { id:"EMP027", name:"Sharon Rodriguez",     hire_date:"2003-08-14", employment_status:"Full Time",  classification:"Cook",                min_hours_week:24, max_hours_week:40 },
    { id:"EMP028", name:"Timothy Lewis",        hire_date:"2004-12-01", employment_status:"Part Time",  classification:"Cook",                min_hours_week:8,  max_hours_week:24 },
    { id:"EMP029", name:"Cynthia Walker",       hire_date:"2006-05-18", employment_status:"Full Time",  classification:"Cook",                min_hours_week:24, max_hours_week:40 },
    { id:"EMP030", name:"Jason Hall",           hire_date:"2007-09-07", employment_status:"Full Time",  classification:"Cook",                min_hours_week:24, max_hours_week:40 },
    { id:"EMP031", name:"Rebecca Young",        hire_date:"2008-02-22", employment_status:"Part Time",  classification:"Cook",                min_hours_week:8,  max_hours_week:24 },
    { id:"EMP032", name:"Jeffrey Allen",        hire_date:"2009-06-11", employment_status:"Full Time",  classification:"Cook",                min_hours_week:24, max_hours_week:40 },
    { id:"EMP033", name:"Laura King",           hire_date:"2010-10-30", employment_status:"Full Time",  classification:"Cook",                min_hours_week:24, max_hours_week:40 },
    { id:"EMP034", name:"Ryan Wright",          hire_date:"2011-04-15", employment_status:"Part Time",  classification:"Cook",                min_hours_week:8,  max_hours_week:24 },
    { id:"EMP035", name:"Kimberly Scott",       hire_date:"2012-08-04", employment_status:"Full Time",  classification:"Cook",                min_hours_week:24, max_hours_week:40 },
    { id:"EMP036", name:"Jacob Torres",         hire_date:"2013-12-19", employment_status:"Full Time",  classification:"Cook",                min_hours_week:24, max_hours_week:40 },
    { id:"EMP037", name:"Emily Nguyen",         hire_date:"2014-03-08", employment_status:"Part Time",  classification:"Cook",                min_hours_week:8,  max_hours_week:24 },
    { id:"EMP038", name:"Gary Hill",            hire_date:"2015-07-23", employment_status:"Full Time",  classification:"Cook",                min_hours_week:24, max_hours_week:40 },
    { id:"EMP039", name:"Nicole Flores",        hire_date:"2016-11-12", employment_status:"Full Time",  classification:"Cook",                min_hours_week:24, max_hours_week:40 },
    { id:"EMP040", name:"Eric Green",           hire_date:"2017-04-28", employment_status:"Part Time",  classification:"Cook",                min_hours_week:8,  max_hours_week:24 },
    { id:"EMP041", name:"Jonathan Adams",       hire_date:"2018-08-17", employment_status:"Full Time",  classification:"Cook",                min_hours_week:24, max_hours_week:40 },
    { id:"EMP042", name:"Stephanie Baker",      hire_date:"2019-01-06", employment_status:"Full Time",  classification:"Cook",                min_hours_week:24, max_hours_week:40 },
    { id:"EMP043", name:"Brandon Hall",         hire_date:"2019-06-25", employment_status:"Part Time",  classification:"Cook",                min_hours_week:8,  max_hours_week:24 },
    { id:"EMP044", name:"Melissa Nelson",       hire_date:"2020-10-14", employment_status:"Full Time",  classification:"Cook",                min_hours_week:24, max_hours_week:40 },
    { id:"EMP045", name:"Edward Carter",        hire_date:"2021-03-03", employment_status:"Full Time",  classification:"Cook",                min_hours_week:24, max_hours_week:40 },
    { id:"EMP046", name:"Debra Mitchell",       hire_date:"2021-08-22", employment_status:"Part Time",  classification:"Cook",                min_hours_week:8,  max_hours_week:24 },
    { id:"EMP047", name:"Samuel Perez",         hire_date:"2022-02-11", employment_status:"Full Time",  classification:"Cook",                min_hours_week:24, max_hours_week:40 },
    { id:"EMP048", name:"Katherine Roberts",    hire_date:"2023-05-01", employment_status:"Full Time",  classification:"Cook",                min_hours_week:24, max_hours_week:40 },
    // GENERAL HELP WORKERS (remaining to reach 61 total)
    { id:"EMP049", name:"Christine Phillips",   hire_date:"1998-09-18", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP050", name:"Raymond Evans",        hire_date:"1999-12-07", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP051", name:"Gregory Turner",       hire_date:"2001-04-26", employment_status:"Part Time",  classification:"General Help Worker", min_hours_week:8,  max_hours_week:24 },
    { id:"EMP052", name:"Carolyn Torres",       hire_date:"2002-08-15", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP053", name:"Frank Parker",         hire_date:"2003-01-04", employment_status:"Part Time",  classification:"General Help Worker", min_hours_week:8,  max_hours_week:24 },
    { id:"EMP054", name:"Rachel Collins",       hire_date:"2004-05-23", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP055", name:"Alexander Edwards",    hire_date:"2005-09-11", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP056", name:"Janet Stewart",        hire_date:"2006-02-28", employment_status:"Part Time",  classification:"General Help Worker", min_hours_week:8,  max_hours_week:24 },
    { id:"EMP057", name:"Patrick Flores",       hire_date:"2006-07-17", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP058", name:"Jack Morris",          hire_date:"2007-11-06", employment_status:"Part Time",  classification:"General Help Worker", min_hours_week:8,  max_hours_week:24 },
    { id:"EMP059", name:"Maria Nguyen",         hire_date:"2008-04-25", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP060", name:"Benjamin Murphy",      hire_date:"2008-09-14", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP061", name:"Samuel Rivera",        hire_date:"2009-02-03", employment_status:"Part Time",  classification:"General Help Worker", min_hours_week:8,  max_hours_week:24 },
    { id:"EMP062", name:"Katherine Cook",       hire_date:"2009-06-22", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP063", name:"Christine Rogers",     hire_date:"2010-01-11", employment_status:"Part Time",  classification:"General Help Worker", min_hours_week:8,  max_hours_week:24 },
    { id:"EMP064", name:"Raymond Morgan",       hire_date:"2010-05-30", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP065", name:"Gregory Peterson",     hire_date:"2011-09-18", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP066", name:"Carolyn Cooper",       hire_date:"2012-02-07", employment_status:"Part Time",  classification:"General Help Worker", min_hours_week:8,  max_hours_week:24 },
    { id:"EMP067", name:"Frank Reed",           hire_date:"2012-06-26", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP068", name:"Rachel Bailey",        hire_date:"2013-11-14", employment_status:"Part Time",  classification:"General Help Worker", min_hours_week:8,  max_hours_week:24 },
    { id:"EMP069", name:"Alexander Bell",       hire_date:"2014-04-03", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP070", name:"Janet Gomez",          hire_date:"2014-08-22", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP071", name:"Patrick Kelly",        hire_date:"2015-01-10", employment_status:"Part Time",  classification:"General Help Worker", min_hours_week:8,  max_hours_week:24 },
    { id:"EMP072", name:"Jack Howard",          hire_date:"2015-06-29", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP073", name:"Maria Ward",           hire_date:"2015-11-17", employment_status:"Part Time",  classification:"General Help Worker", min_hours_week:8,  max_hours_week:24 },
    { id:"EMP074", name:"Benjamin Cox",         hire_date:"2016-04-06", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP075", name:"Samuel Diaz",          hire_date:"2016-08-25", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP076", name:"Katherine Richardson", hire_date:"2017-01-13", employment_status:"Part Time",  classification:"General Help Worker", min_hours_week:8,  max_hours_week:24 },
    { id:"EMP077", name:"Christine Wood",       hire_date:"2017-06-02", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP078", name:"Raymond Watson",       hire_date:"2017-10-21", employment_status:"Part Time",  classification:"General Help Worker", min_hours_week:8,  max_hours_week:24 },
    { id:"EMP079", name:"Gregory Brooks",       hire_date:"2018-03-11", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP080", name:"Carolyn Bennett",      hire_date:"2018-07-30", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP081", name:"Frank Gray",           hire_date:"2019-12-18", employment_status:"Part Time",  classification:"General Help Worker", min_hours_week:8,  max_hours_week:24 },
    { id:"EMP082", name:"Rachel James",         hire_date:"2020-05-07", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP083", name:"Alexander Reyes",      hire_date:"2020-09-26", employment_status:"Part Time",  classification:"General Help Worker", min_hours_week:8,  max_hours_week:24 },
    { id:"EMP084", name:"Janet Cruz",           hire_date:"2021-02-14", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP085", name:"Patrick Hughes",       hire_date:"2021-07-03", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP086", name:"Jack Price",           hire_date:"2021-11-22", employment_status:"Part Time",  classification:"General Help Worker", min_hours_week:8,  max_hours_week:24 },
    { id:"EMP087", name:"Maria Myers",          hire_date:"2022-04-12", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP088", name:"Benjamin Long",        hire_date:"2022-09-01", employment_status:"Part Time",  classification:"General Help Worker", min_hours_week:8,  max_hours_week:24 },
    { id:"EMP089", name:"Samuel Foster",        hire_date:"2022-12-20", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP090", name:"Katherine Sanders",    hire_date:"2023-04-09", employment_status:"Part Time",  classification:"General Help Worker", min_hours_week:8,  max_hours_week:24 },
    { id:"EMP091", name:"Christine Ross",       hire_date:"2023-07-28", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP092", name:"Raymond Morales",      hire_date:"2023-12-16", employment_status:"Part Time",  classification:"General Help Worker", min_hours_week:8,  max_hours_week:24 },
    { id:"EMP093", name:"Gregory Powell",       hire_date:"2024-03-05", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP094", name:"Carolyn Sullivan",     hire_date:"2024-06-24", employment_status:"Part Time",  classification:"General Help Worker", min_hours_week:8,  max_hours_week:24 },
    { id:"EMP095", name:"Frank Russell",        hire_date:"2024-08-12", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP096", name:"Rachel Ortiz",         hire_date:"2024-09-01", employment_status:"Part Time",  classification:"General Help Worker", min_hours_week:8,  max_hours_week:24 },
    { id:"EMP097", name:"Alexander Jenkins",    hire_date:"2024-10-15", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP098", name:"Janet Gutierrez",      hire_date:"2024-11-04", employment_status:"Part Time",  classification:"General Help Worker", min_hours_week:8,  max_hours_week:24 },
    { id:"EMP099", name:"Patrick Perry",        hire_date:"2024-12-23", employment_status:"Full Time",  classification:"General Help Worker", min_hours_week:24, max_hours_week:40 },
    { id:"EMP100", name:"Jack Butler",          hire_date:"2025-02-11", employment_status:"Part Time",  classification:"General Help Worker", min_hours_week:8,  max_hours_week:24 },
  ]

  const insertEmp = db.prepare(`
    INSERT OR IGNORE INTO employees
      (id, name, hire_date, employment_status, classification, min_hours_week, max_hours_week)
    VALUES
      (@id, @name, @hire_date, @employment_status, @classification, @min_hours_week, @max_hours_week)
  `)

  // Seed default availability — all employees available all days all shifts
  // Manager will override per employee as needed
  const insertAvail = db.prepare(`
    INSERT OR IGNORE INTO availability
      (employee_id, day_of_week, am_available, mid_available, pm_available)
    VALUES (?, ?, 1, 1, 1)
  `)

  const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]

  const seedAll = db.transaction(() => {
    for (const emp of employees) {
      insertEmp.run(emp)
      for (const day of DAYS) {
        insertAvail.run(emp.id, day)
      }
    }
  })

  seedAll()
  console.log(`✓ Seeded ${employees.length} employees with default availability`)
}

// ─── RUN ALL SEEDS ───────────────────────────────────────────────────────────
function runSeed() {
  initializeDatabase()
  seedStations()
  seedShiftSlots()
  seedEmployees()
  console.log("\n✓ All seed data loaded. Database ready.")
  console.log("  Run: npm run dev  to start the server")
}

runSeed()