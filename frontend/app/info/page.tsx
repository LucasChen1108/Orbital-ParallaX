"use client";
import Navbar from "../components/Navbar";

const G = "#2563a8";
const GLIGHT = "#eff6ff";
const GBORDER = "#bfdbfe";

const MEMBERS = [
  {
    name: "Chen Letao",
    nickname: "Lucas",
    photo: "/letao.jpg",
    github: "https://github.com/LucasChen1108",
    linkedin: "https://www.linkedin.com/in/lucas-letao-chen/",
    role: "Frontend, UI/UX & Architecture Lead",
    colour: "#2563a8",
    bg: "#eff6ff",
    border: "#bfdbfe",
    skills: ["Next.js / React", "FastAPI", "System Architecture", "UI/UX Design", "CI/CD"],
    note: "Designed and built the full system architecture, backend API, database layer, frontend UI/UX, and CI/CD pipeline for ArcLab. Previously contributed to Source Academy as part of CP3108.",
  },
  {
    name: "Liu Keming",
    nickname: "Andy",
    photo: "/keming.jpg",
    github: "https://github.com/lkeming43",
    linkedin: "https://www.linkedin.com/in/keming-liu-3360013a4/",
    role: "Physics & Computer Vision Lead",
    colour: "#18c451",
    bg: "#f0f4ff",
    border: "#c7d2fe",
    skills: ["Physics modelling", "NumPy / SciPy", "YOLOv8", "Kinematics solver"],
    note: "Physics major specialising in inverse physics solvers and computer vision pipelines. Built the entire algorithm layer — CV tracker, kinematics solver, and drag model. Previously built a data analysis pipeline for DESI cosmological results.",
  },
];

const SWE_PRACTICES = [
  { label: "Decoupled architecture", desc: "physics_engine is fully independent from the HTTP layer — swap any component without touching the rest." },
  { label: "Four-layer testing", desc: "Unit tests for every physics function, integration tests for every API endpoint, E2E Playwright suite for the full user flow, and SUS usability scoring." },
  { label: "CI on every PR", desc: "GitHub Actions runs Flake8, ESLint, pytest, and Playwright automatically before anything merges to main." },
  { label: "Conventional commits", desc: "feat / fix / refactor / test / ci — a clean, readable git history that makes PRs easy to review." },
];

const FEATURES = [
  { label: "YOLOv8 tracking", desc: "State-of-the-art object detection replaces manual HSV colour picking. Works on any ball, any background, at 15fps+." },
  { label: "Ghost trajectory", desc: "As the ball leaves the recorded frames, ArcLab draws the predicted path — the part yet to happen. We call this the ghost trajectory." },
  { label: "Air resistance model", desc: "Optional quadratic drag model fits both gravity and a drag coefficient to your trajectory via least-squares." },
  { label: "Strobe view", desc: "Renders ghost ball images at equal time intervals — just like a physics stroboscope — revealing how spacing encodes velocity." },
  { label: "PDF & CSV export", desc: "Download a full experiment report with trajectory chart and physics parameters, ready for your lab write-up." },
  { label: "Sandbox mode", desc: "Drag sliders to modify gravity, velocity, angle, and drag in real time and compare the modified trajectory against the original, either as a chart or overlaid on your own video." },
];

const GithubIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
  </svg>
);

const LinkedInIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

export default function InfoPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", color: "#111827", fontFamily: "system-ui, sans-serif" }}>
      <Navbar />

      {/* Hero */}
      <section style={{
        maxWidth: "820px", margin: "0 auto",
        paddingTop: "clamp(44px,10vw,72px)", paddingBottom: "clamp(36px,7vw,56px)",
        paddingLeft: "clamp(18px,5vw,32px)", paddingRight: "clamp(18px,5vw,32px)",
        textAlign: "center",
      }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="ArcLab" style={{ height: "clamp(48px,11vw,64px)", width: "auto" }} />
        </div>

        <div style={{
          display: "inline-flex", alignItems: "center", gap: "6px",
          background: GLIGHT, border: `1px solid ${GBORDER}`,
          borderRadius: "20px", padding: "4px 14px", marginBottom: "20px",
        }}>
          <span style={{ fontSize: "11px", color: G, letterSpacing: "0.05em", fontWeight: 500 }}>
            Team ParallaX · NUS Orbital 2026 · Apollo
          </span>
        </div>

        <h1 style={{ fontSize: "clamp(28px,8vw,40px)", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "16px", color: "#111827" }}>
          ArcLab
        </h1>
        <p style={{ fontSize: "clamp(13px,3.6vw,16px)", color: "#6b7280", lineHeight: 1.75, maxWidth: "520px", margin: "0 auto" }}>
          Built by team ParallaX for NUS Orbital 2026, ArcLab is a web-based physics analysis platform
          that uses computer vision to extract real physical parameters from any projectile video —
          gravity, velocity, launch angle, full trajectory. No carbon paper. No manual frame clicking.
          Just upload and analyse.
        </p>
      </section>

      {/* Problem vs Solution */}
      <section style={{ borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb", background: "#f8f9fa" }}>
        <div className="problem-solution-grid" style={{
          maxWidth: "820px", margin: "0 auto",
          paddingTop: "clamp(36px,8vw,56px)", paddingBottom: "clamp(36px,8vw,56px)",
          paddingLeft: "clamp(18px,5vw,32px)", paddingRight: "clamp(18px,5vw,32px)",
        }}>
          <div>
            <div style={{ fontSize: "11px", color: "#dc2626", letterSpacing: "0.1em", marginBottom: "10px", fontWeight: 600 }}>THE PROBLEM</div>
            <h2 style={{ fontSize: "clamp(17px,4.5vw,20px)", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "14px", lineHeight: 1.35, color: "#111827" }}>
              Physics experiments are tedious and error-prone
            </h2>
            <p style={{ fontSize: "14px", color: "#6b7280", lineHeight: 1.75 }}>
              Rolling a steel ball off a ramp requires precise alignment and accumulates errors at every step.
              Existing tools like Tracker still demand manual frame-by-frame clicking — in a 40-minute lesson,
              5 minutes can be lost just selecting frames. Students lack a simple link between what they learn
              in lectures and what they observe in the real world.
            </p>
          </div>
          <div>
            <div style={{ fontSize: "11px", color: G, letterSpacing: "0.1em", marginBottom: "10px", fontWeight: 600 }}>OUR SOLUTION</div>
            <h2 style={{ fontSize: "clamp(17px,4.5vw,20px)", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "14px", lineHeight: 1.35, color: "#111827" }}>
              ArcLab automates the entire analysis pipeline
            </h2>
            <p style={{ fontSize: "14px", color: "#6b7280", lineHeight: 1.75 }}>
              Upload any video of a projectile — a basketball throw, a water jet, a coin toss. Click the ball once.
              Draw two calibration points. In under a minute you get gravity, initial velocity, launch angle,
              and a full trajectory chart — ready to export as a PDF lab report or CSV for further analysis.
            </p>
          </div>
        </div>
      </section>

      {/* Team */}
      <section style={{
        maxWidth: "820px", margin: "0 auto",
        paddingTop: "clamp(44px,8vw,64px)", paddingBottom: "clamp(44px,8vw,64px)",
        paddingLeft: "clamp(18px,5vw,32px)", paddingRight: "clamp(18px,5vw,32px)",
      }}>
        <div style={{ fontSize: "11px", color: G, letterSpacing: "0.1em", marginBottom: "10px", fontWeight: 600 }}>THE TEAM</div>
        <h2 style={{ fontSize: "clamp(20px,5.5vw,24px)", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "8px", color: "#111827" }}>Team ParallaX</h2>
        <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "28px", lineHeight: 1.7 }}>
          ParallaX is a two-person NUS team combining software engineering and physics expertise to build ArcLab.
          We believe physics education should be hands-on, visual, and accessible to anyone with a phone and a ball.
        </p>
        <div className="team-grid">
          {MEMBERS.map(({ name, nickname, photo, github, linkedin, role, colour, bg, border, skills, note }) => (
            <div key={name} style={{
              background: "#fff", border: "1px solid #e5e7eb",
              borderRadius: "14px", padding: "clamp(18px,4.5vw,24px)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt={name} style={{
                    width: "60px", height: "60px", borderRadius: "50%",
                    objectFit: "cover", border: `2px solid ${border}`, flexShrink: 0,
                  }}
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.style.display = "none";
                    const next = target.nextSibling as HTMLElement;
                    if (next) next.style.display = "flex";
                  }} />
                ) : null}
                <div style={{
                  width: "60px", height: "60px", borderRadius: "50%", background: bg,
                  border: `2px solid ${border}`, alignItems: "center", justifyContent: "center",
                  fontSize: "16px", fontWeight: 700, color: colour, flexShrink: 0,
                  display: photo ? "none" : "flex",
                }}>
                  {nickname.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: "15px", fontWeight: 600, color: "#14154c" }}>{name}</div>
                  <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "1px" }}>{nickname}</div>
                  <div style={{ fontSize: "12px", color: colour, marginTop: "3px", fontWeight: 500 }}>{role}</div>
                </div>
              </div>

              <p style={{ fontSize: "13px", color: "#6b7280", lineHeight: 1.65, marginBottom: "14px" }}>{note}</p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
                {skills.map(s => (
                  <span key={s} style={{
                    fontSize: "11px", padding: "3px 8px", borderRadius: "6px",
                    background: bg, color: colour, border: `1px solid ${border}`, fontWeight: 500,
                  }}>{s}</span>
                ))}
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", paddingTop: "14px", borderTop: "1px solid #e5e7eb" }}>
                <a href={github} target="_blank" rel="noopener noreferrer" style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  fontSize: "12px", color: "#041404", fontWeight: 500,
                  background: "#f9fafb", border: "1px solid #e5e7eb",
                  borderRadius: "8px", padding: "8px 12px", textDecoration: "none",
                }}>
                  <GithubIcon /> GitHub
                </a>
                <a href={linkedin} target="_blank" rel="noopener noreferrer" style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  fontSize: "12px", color: "#1f54a9", fontWeight: 500,
                  background: "#f9fafb", border: "1px solid #e5e7eb",
                  borderRadius: "8px", padding: "8px 12px", textDecoration: "none",
                }}>
                  <LinkedInIcon /> LinkedIn
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ background: "#f8f9fa", borderTop: "1px solid #e5e7eb" }}>
        <div style={{
          maxWidth: "820px", margin: "0 auto",
          paddingTop: "clamp(44px,8vw,64px)", paddingBottom: "clamp(44px,8vw,64px)",
          paddingLeft: "clamp(18px,5vw,32px)", paddingRight: "clamp(18px,5vw,32px)",
        }}>
          <div style={{ fontSize: "11px", color: G, letterSpacing: "0.1em", marginBottom: "10px", fontWeight: 600 }}>FEATURES</div>
          <h2 style={{ fontSize: "clamp(20px,5.5vw,24px)", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "28px", color: "#111827" }}>What ArcLab does</h2>
          <div className="features-grid">
            {FEATURES.map(({ label, desc }) => (
              <div key={label} style={{
                background: "#f9fafb", border: "1px solid #e5e7eb",
                borderRadius: "12px", padding: "20px",
              }}>
                <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px", color: "#111827" }}>{label}</div>
                <div style={{ fontSize: "12px", color: "#6b7280", lineHeight: 1.65 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SWE practices */}
      <section style={{
        maxWidth: "820px", margin: "0 auto",
        paddingTop: "clamp(44px,8vw,64px)", paddingBottom: "clamp(44px,8vw,64px)",
        paddingLeft: "clamp(18px,5vw,32px)", paddingRight: "clamp(18px,5vw,32px)",
      }}>
        <div style={{ fontSize: "11px", color: G, letterSpacing: "0.1em", marginBottom: "10px", fontWeight: 600 }}>HOW WE BUILD</div>
        <h2 style={{ fontSize: "clamp(20px,5.5vw,24px)", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "28px", color: "#111827" }}>Software engineering practices</h2>
        <div className="swe-grid">
          {SWE_PRACTICES.map(({ label, desc }) => (
            <div key={label} style={{ borderLeft: `3px solid ${G}`, paddingLeft: "16px" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "6px", color: "#111827" }}>{label}</div>
              <div style={{ fontSize: "13px", color: "#6b7280", lineHeight: 1.65 }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      <footer style={{ borderTop: "1px solid #e5e7eb", padding: "24px 2rem", textAlign: "center", background: "#fff" }}>
        <span style={{ fontSize: "12px", color: "#9ca3af" }}>ArcLab · Team ParallaX · NUS Orbital 2026</span>
      </footer>

      <style jsx>{`
        .problem-solution-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
        }
        .team-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .features-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 14px;
        }
        .swe-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        @media (max-width: 900px) {
          .features-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
        @media (max-width: 700px) {
          .problem-solution-grid {
            grid-template-columns: 1fr;
            gap: 28px;
          }
        }
        @media (max-width: 600px) {
          .team-grid {
            grid-template-columns: 1fr;
          }
          .swe-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }
        }
        @media (max-width: 560px) {
          .features-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
