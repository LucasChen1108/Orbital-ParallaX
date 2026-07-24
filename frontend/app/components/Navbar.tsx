"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useIsMobile } from "../hook/useIsMobile";

const STEPS = ["Upload", "Interval", "Calibrate", "Analyse", "Results"];

interface NavbarProps {
  currentStep?: number;
  onLogoClick?: () => void;
}

export default function Navbar({ currentStep, onLogoClick }: NavbarProps) {
  const pathname = usePathname();
  const onAnalysePage = pathname === "/analyse" || pathname === "/";
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setDrawerOpen(false);
  }

  function handleLogoClick() {
    setDrawerOpen(false);
    onLogoClick?.();
  }

  return (
    <>
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: isMobile ? "0 1rem" : "0 2rem", height: "60px",
        borderBottom: "1px solid #e5e7eb",
        background: "#ffffff",
        position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}>
        {/* Logo */}
        <Link href="/" onClick={handleLogoClick} style={{ textDecoration: "none", display: "flex", alignItems: "center", flexShrink: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="ArcLab" style={{ height: isMobile ? "30px" : "36px", width: "auto" }} />
        </Link>

        {/* Step tracker */}
        {onAnalysePage && currentStep && (
          isMobile ? (
            <div style={{
              fontSize: "12px", fontWeight: 600, color: "#2563a8",
              background: "#eff6ff", border: "1px solid #bfdbfe",
              borderRadius: "20px", padding: "5px 12px", whiteSpace: "nowrap",
            }}>
              Step {currentStep}/6 · {STEPS[currentStep - 1]}
            </div>
          ) : (
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
          )
        )}

        {/* Nav links (desktop) / Hamburger (mobile) */}
        {isMobile ? (
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              display: "flex", flexDirection: "column", gap: "4px",
              padding: "10px 8px", flexShrink: 0,
            }}
          >
            <span style={{ width: "20px", height: "2px", background: "#374151", borderRadius: "2px" }} />
            <span style={{ width: "20px", height: "2px", background: "#374151", borderRadius: "2px" }} />
            <span style={{ width: "20px", height: "2px", background: "#374151", borderRadius: "2px" }} />
          </button>
        ) : (
          <div style={{ display: "flex", gap: "6px" }}>
            <NavLink href="/" label="Analyse" active={pathname === "/"} />
            <NavLink href="/library" label="Library" active={pathname === "/library"} />
            <NavLink href="/sandbox" label="Sandbox" active={pathname === "/sandbox"} />
            <NavLink href="/info" label="About" active={pathname === "/info"} />
          </div>
        )}
      </nav>

      {/* Mobile drawer */}
      {isMobile && (
        <>
          <div
            onClick={() => setDrawerOpen(false)}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
              zIndex: 200,
              opacity: drawerOpen ? 1 : 0,
              pointerEvents: drawerOpen ? "auto" : "none",
              transition: "opacity 0.2s",
            }}
          />
          <div style={{
            position: "fixed", top: 0, left: 0, bottom: 0, width: "240px",
            background: "#fff", zIndex: 201,
            boxShadow: "2px 0 16px rgba(0,0,0,0.15)",
            transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 0.25s ease",
            display: "flex", flexDirection: "column", padding: "18px 14px",
            gap: "4px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", padding: "0 4px" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.jpg" alt="ArcLab" style={{ height: "28px", width: "auto" }} />
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                style={{ background: "transparent", border: "none", fontSize: "22px", lineHeight: 1, cursor: "pointer", color: "#6b7280", padding: "6px" }}
              >
                ×
              </button>
            </div>
            <DrawerLink href="/" label="Analyse" active={pathname === "/"} />
            <DrawerLink href="/library" label="Library" active={pathname === "/library"} />
            <DrawerLink href="/sandbox" label="Sandbox" active={pathname === "/sandbox"} />
            <DrawerLink href="/info" label="About" active={pathname === "/info"} />
          </div>
        </>
      )}
    </>
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

function DrawerLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} style={{
      textDecoration: "none", fontSize: "15px", fontWeight: 500,
      padding: "14px 12px", borderRadius: "10px", display: "block",
      color: active ? "#2563a8" : "#374151",
      background: active ? "#eff6ff" : "transparent",
    }}>
      {label}
    </Link>
  );
}
