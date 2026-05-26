const express = require("express")
const router = express.Router()
const { db } = require("../db/schema")
const Anthropic = require("@anthropic-ai/sdk")

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

// POST /api/ai/analyze-week
router.post("/analyze-week", async (req, res) => {
  try {
    const { week_start } = req.body

    // Get top 15 employees by seniority with their hours
    const hoursSummary = db.prepare(`
      SELECT
        e.name,
        e.classification,
        e.hire_date,
        e.employment_status,
        e.max_hours_week,
        COALESCE(SUM(a.paid_hours), 0) as hours_assigned,
        COUNT(CASE WHEN a.status = 'assigned' THEN 1 END) as shifts_count,
        RANK() OVER (ORDER BY e.hire_date ASC) as seniority_rank
      FROM employees e
      LEFT JOIN assignments a
        ON  a.employee_id   = e.id
        AND a.assigned_date >= ?
        AND a.assigned_date <  date(?, '+7 days')
        AND a.status       != 'vacant'
      WHERE e.is_active = 1
      GROUP BY e.id
      ORDER BY e.hire_date ASC
      LIMIT 15
    `).all(week_start, week_start)

    // Get violation count and just top 5 examples
    const allViolations = db.prepare(`
      SELECT v.*, e1.name as senior_name, e2.name as junior_name
      FROM cba_violations v
      LEFT JOIN employees e1 ON e1.id = v.senior_employee_id
      LEFT JOIN employees e2 ON e2.id = v.junior_employee_id
      WHERE v.violation_date >= ? AND v.violation_date < date(?, '+7 days')
    `).all(week_start, week_start)

    const vacantSlots = db.prepare(`
      SELECT COUNT(*) as count
      FROM assignments a
      WHERE a.status = 'vacant'
        AND a.assigned_date >= ?
        AND a.assigned_date <  date(?, '+7 days')
    `).get(week_start, week_start)

    const totalSlots = db.prepare(`
      SELECT COUNT(*) as count
      FROM assignments a
      WHERE a.assigned_date >= ?
        AND a.assigned_date <  date(?, '+7 days')
    `).get(week_start, week_start)

    // Build concise prompt
    const prompt = `
You are a labour scheduling compliance expert for Aramark Canada Ltd at UTSC.
Employees are covered by UNITE HERE Local 75 Collective Agreement.

Analyze this week's schedule and provide a compliance report.

WEEK: ${week_start}

HOURS SUMMARY (top 15 by seniority — most senior first):
${hoursSummary.map(e =>
  `#${e.seniority_rank} ${e.name} | ${e.classification} | Hired: ${e.hire_date} | ${e.hours_assigned}h of ${e.max_hours_week}h max`
).join("\n")}

SCHEDULE STATS:
- Total shifts: ${totalSlots.count}
- Vacant shifts: ${vacantSlots.count}
- Fill rate: ${Math.round((totalSlots.count - vacantSlots.count) / totalSlots.count * 100)}%

CBA VIOLATIONS: ${allViolations.length} total detected
Top examples:
${allViolations.slice(0, 5).map(v =>
  `- ${v.description}`
).join("\n")}
${allViolations.length > 5 ? `...and ${allViolations.length - 5} more similar violations` : ""}

KEY CBA RULE:
- Art 32.06: Most senior employees must have hours maximized to 40hrs/week before junior employees receive shifts

Return ONLY this JSON, no markdown, no backticks:
{
  "overall_health": "Good" or "Fair" or "Poor",
  "compliance_score": 0-100,
  "executive_summary": "2-3 sentence overview",
  "seniority_issues": ["specific issue"],
  "immediate_actions": ["specific action"],
  "vacant_shift_risk": "one sentence",
  "positive_observations": ["what went well"],
  "grievance_risk_level": "Low" or "Medium" or "High",
  "grievance_risk_reason": "one sentence explanation"
}
`

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }]
    })

    const raw = response.content[0].text.trim()
    const clean = raw.replace(/```json|```/g, "").trim()
    const analysis = JSON.parse(clean)

    // Log to audit trail
    db.prepare(`
      INSERT INTO audit_log (action, assigned_date, reason, cba_article)
      VALUES ('AI_ANALYSIS', ?, ?, 'Multiple')
    `).run(
      week_start,
      `AI compliance score: ${analysis.compliance_score}/100 | Risk: ${analysis.grievance_risk_level}`
    )

    res.json({ success: true, data: analysis })

  } catch (err) {
    console.error("AI analysis error:", err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /api/ai/explain-violation
router.post("/explain-violation", async (req, res) => {
  try {
    const { violation_id } = req.body

    const violation = db.prepare(`
      SELECT v.*,
        e1.name as senior_name, e1.hire_date as senior_hire,
        e2.name as junior_name, e2.hire_date as junior_hire
      FROM cba_violations v
      LEFT JOIN employees e1 ON e1.id = v.senior_employee_id
      LEFT JOIN employees e2 ON e2.id = v.junior_employee_id
      WHERE v.id = ?
    `).get(violation_id)

    if (!violation) {
      return res.status(404).json({ success: false, error: "Violation not found" })
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `Explain this CBA violation in plain English for a manager. Maximum 2 sentences. Be specific about names and hours.

Violation: ${violation.description}
Article: ${violation.article_reference}
Senior employee: ${violation.senior_name} (hired ${violation.senior_hire})
Junior employee: ${violation.junior_name} (hired ${violation.junior_hire})
Hours difference: ${violation.hours_difference}hrs

Respond with just the plain English explanation, no formatting.`
      }]
    })

    res.json({
      success: true,
      data: { explanation: response.content[0].text.trim() }
    })

  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router