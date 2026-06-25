"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const STEPS = ["Upload", "Interval", "Ball", "Calibrate", "Analyse", "Results"];

interface NavbarProps {
  currentStep?: number; // 1–6, only shown on the analyse page
}

export default function Navbar({ currentStep }: NavbarProps) {
  const pathname = usePathname();
  const onAnalysePage = pathname === "/analyse" || pathname === "/";

  return (
    <nav style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 2rem", height: "56px",
      borderBottom: "1px solid rgba(255,255,255,0.08)",
      background: "rgba(10,10,18,0.92)",
      backdropFilter: "blur(12px)",
      position: "sticky", top: 0, zIndex: 100,
    }}>
      {/* Logo */}
      <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "10px" }}>
        <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
          <path d="M2 18 Q6 4 11 3 Q16 2 20 18" stroke="#7F77DD" strokeWidth="2" fill="none" strokeLinecap="round"/>
          <circle cx="11" cy="3.5" r="2" fill="#7F77DD"/>
        </svg>
        <span style={{ fontWeight: 700, fontSize: "15px", color: "#fff", letterSpacing: "-0.01em" }}>
          ArcLab
        </span>
      </Link>

      {/* Step tracker — only on analyse flow */}
      {onAnalysePage && currentStep && (
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {STEPS.map((label, i) => {
            const n = i + 1;
            const done = n < currentStep;
            const active = n === currentStep;
            return (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  padding: "4px 10px", borderRadius: "20px", fontSize: "12px",
                  background: active ? "rgba(127,119,221,0.2)" : done ? "rgba(93,202,165,0.1)" : "transparent",
                  border: active ? "1px solid rgba(127,119,221,0.4)" : done ? "1px solid rgba(93,202,165,0.3)" : "1px solid transparent",
                  color: active ? "#AFA9EC" : done ? "#5DCAA5" : "rgba(255,255,255,0.25)",
                }}>
                  {done && <span style={{ fontSize: "10px" }}>✓</span>}
                  {label}
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ width: "12px", height: "1px", background: "rgba(255,255,255,0.1)" }} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Nav links */}
      <div style={{ display: "flex", gap: "6px" }}>
        <NavLink href="/" label="Analyse" active={pathname === "/"} />
        <NavLink href="/info" label="About" active={pathname === "/info"} />
      </div>
    </nav>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} style={{
      textDecoration: "none", fontSize: "13px", padding: "6px 14px", borderRadius: "8px",
      color: active ? "#fff" : "rgba(255,255,255,0.45)",
      background: active ? "rgba(127,119,221,0.15)" : "transparent",
      border: active ? "1px solid rgba(127,119,221,0.3)" : "1px solid transparent",
    }}>
      {label}
    </Link>
  );
}
