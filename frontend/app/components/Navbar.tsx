"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const STEPS = ["Upload", "Interval", "Ball", "Calibrate", "Analyse", "Results"];

interface NavbarProps {
  currentStep?: number;
}

export default function Navbar({ currentStep }: NavbarProps) {
  const pathname = usePathname();
  const onAnalysePage = pathname === "/analyse" || pathname === "/";

  return (
    <nav style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 2rem", height: "60px",
      borderBottom: "1px solid #e5e7eb",
      background: "#ffffff",
      position: "sticky", top: 0, zIndex: 100,
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    }}>
      {/* Logo */}
      <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpg" alt="ArcLab" style={{ height: "36px", width: "auto" }} />
      </Link>

      {/* Step tracker */}
      {onAnalysePage && currentStep && (
        <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
          {STEPS.map((label, i) => {
            const n = i + 1;
            const done = n < currentStep;
            const active = n === currentStep;
            return (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  padding: "5px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 500,
                  background: active ? "#2563a8" : done ? "#eff6ff" : "transparent",
                  border: active ? "none" : done ? "1px solid #bfdbfe" : "1px solid transparent",
                  color: active ? "#fff" : done ? "#1d4ed8" : "#9ca3af",
                }}>
                  {done && <span style={{ fontSize: "11px" }}>✓</span>}
                  {label}
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ width: "16px", height: "1px", background: "#e5e7eb" }} />
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
      textDecoration: "none", fontSize: "13px", fontWeight: 500,
      padding: "6px 14px", borderRadius: "8px",
      color: active ? "#2563a8" : "#6b7280",
      background: active ? "#eff6ff" : "transparent",
      border: active ? "1px solid #bfdbfe" : "1px solid transparent",
    }}>
      {label}
    </Link>
  );
}
