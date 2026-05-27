import { NavLink } from "react-router-dom"
import useStore from "../store"

export default function Navbar() {
  const violations = useStore(s => s.violations)
  const openCount = violations.filter(v => v.status === "open").length

  const links = [
    { to: "/",           label: "Dashboard"  },
    { to: "/schedule",   label: "Schedule"   },
    { to: "/hours",      label: "Hours"      },
    { to: "/violations", label: "Violations" },
    { to: "/staff",      label: "Staff"      },
  ]

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <span className="font-semibold text-slate-900">Shift Scheduling Application </span>
          <div className="flex items-center gap-1">
            {links.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`
                }
              >
                {link.label}
                {link.to === "/violations" && openCount > 0 && (
                  <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5">
                    {openCount}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}