"use client";
import Navbar from "../components/Navbar";

const MEMBERS = [
  {
    name: "Chen Letao",
    nickname: "Lucas",
    photo: "/letao.jpg",
    github: "https://github.com/LucasChen1108",
    linkedin: "https://www.linkedin.com/in/lucas-letao-chen/",
    role: "Frontend, UI/UX & Architecture Lead",
    colour: "#5DCAA5",
    bg: "rgba(93,202,165,0.12)",
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
    colour: "#7F77DD",
    bg: "rgba(127,119,221,0.12)",
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
  { label: "Sandbox mode (coming)", desc: "Drag sliders to modify gravity, velocity, and drag in real time and compare the modified ghost trajectory against the original." },
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
    <div style={{ minHeight: "100vh", background: "#0a0a12", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
      <Navbar />

      {/* Hero */}
      <section style={{ maxWidth: "820px", margin: "0 auto", padding: "72px 2rem 56px", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "28px" }}>
          <svg viewBox="0 0 72 72" width="64" height="64">
            <circle cx="36" cy="36" r="34" stroke="rgba(127,119,221,0.2)" strokeWidth="1" fill="none"/>
            <circle cx="36" cy="36" r="22" stroke="rgba(127,119,221,0.1)" strokeWidth="1" fill="none"/>
            <path d="M 10 54 Q 36 8 62 54" stroke="#7F77DD" strokeWidth="2" fill="none" strokeLinecap="round"/>
            <path d="M 62 54 Q 68 44 72 54" stroke="rgba(127,119,221,0.35)" strokeWidth="1.5" fill="none" strokeDasharray="3 2"/>
            <circle cx="36" cy="12" r="4" fill="#7F77DD"/>
            <circle cx="10" cy="54" r="2.5" fill="rgba(127,119,221,0.4)"/>
            <circle cx="62" cy="54" r="2.5" fill="rgba(127,119,221,0.4)"/>
          </svg>
        </div>

        <div style={{
          display: "inline-flex", alignItems: "center", gap: "6px",
          background: "rgba(127,119,221,0.1)", border: "1px solid rgba(127,119,221,0.2)",
          borderRadius: "20px", padding: "4px 14px", marginBottom: "20px",
        }}>
          <span style={{ fontSize: "12px", color: "#AFA9EC", letterSpacing: "0.05em" }}>Team ParallaX · NUS Orbital 2026 · Apollo</span>
        </div>

        <h1 style={{ fontSize: "40px", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "16px" }}>ArcLab</h1>
        <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.5)", lineHeight: 1.75, maxWidth: "520px", margin: "0 auto" }}>
          Built by team ParallaX for NUS Orbital 2026, ArcLab is a web-based physics analysis platform
          that uses computer vision to extract real physical parameters from any projectile video —
          gravity, velocity, launch angle, full trajectory. No carbon paper. No manual frame clicking.
          Just upload and analyse.
        </p>
      </section>

      {/* Problem vs Solution */}
      <section style={{ borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: "820px", margin: "0 auto", padding: "56px 2rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px" }}>
          <div>
            <div style={{ fontSize: "11px", color: "#FF8080", letterSpacing: "0.1em", marginBottom: "10px" }}>THE PROBLEM</div>
            <h2 style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "14px", lineHeight: 1.35 }}>
              Physics experiments are tedious and error-prone
            </h2>
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", lineHeight: 1.75 }}>
              Rolling a steel ball off a ramp requires precise alignment and accumulates errors at every step.
              Existing tools like Tracker still demand manual frame-by-frame clicking — in a 40-minute lesson,
              5 minutes can be lost just selecting frames. Students lack a simple link between what they learn
              in lectures and what they observe in the real world.
            </p>
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "#5DCAA5", letterSpacing: "0.1em", marginBottom: "10px" }}>OUR SOLUTION</div>
            <h2 style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "14px", lineHeight: 1.35 }}>
              ArcLab automates the entire analysis pipeline
            </h2>
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", lineHeight: 1.75 }}>
              Upload any video of a projectile — a basketball throw, a water jet, a coin toss. Click the ball once.
              Draw two calibration points. In under a minute you get gravity, initial velocity, launch angle,
              and a full trajectory chart — ready to export as a PDF lab report or CSV for further analysis.
            </p>
          </div>
        </div>
      </section>

      {/* Team */}
      <section style={{ maxWidth: "820px", margin: "0 auto", padding: "64px 2rem" }}>
        <div style={{ fontSize: "11px", color: "#7F77DD", letterSpacing: "0.1em", marginBottom: "10px" }}>THE TEAM</div>
        <h2 style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "8px" }}>Team ParallaX</h2>
        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", marginBottom: "28px", lineHeight: 1.7 }}>
          ParallaX is a two-person NUS team combining software engineering and physics expertise to build ArcLab.
          We believe physics education should be hands-on, visual, and accessible to anyone with a phone and a ball.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {MEMBERS.map(({ name, nickname, photo, github, linkedin, role, colour, bg, skills, note }) => (
            <div key={name} style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "14px", padding: "24px",
            }}>
              {/* Photo + name row */}
              <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo}
                    alt={name}
                    style={{
                      width: "60px", height: "60px", borderRadius: "50%",
                      objectFit: "cover", border: `2px solid ${colour}50`, flexShrink: 0,
                    }}
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = "none";
                      const next = target.nextSibling as HTMLElement;
                      if (next) next.style.display = "flex";
                    }}
                  />
                ) : null}
                {/* Initials fallback */}
                <div style={{
                  width: "60px", height: "60px", borderRadius: "50%", background: bg,
                  border: `2px solid ${colour}50`, alignItems: "center", justifyContent: "center",
                  fontSize: "16px", fontWeight: 700, color: colour, flexShrink: 0,
                  display: photo ? "none" : "flex",
                }}>
                  {nickname.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: "15px", fontWeight: 600 }}>{name}</div>
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", marginTop: "1px" }}>{nickname}</div>
                  <div style={{ fontSize: "12px", color: colour, marginTop: "3px" }}>{role}</div>
                </div>
              </div>

              {/* Note */}
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: 1.65, marginBottom: "14px" }}>
                {note}
              </p>

              {/* Skills */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
                {skills.map(s => (
                  <span key={s} style={{
                    fontSize: "11px", padding: "3px 8px", borderRadius: "6px",
                    background: bg, color: colour, border: `1px solid ${colour}30`,
                  }}>{s}</span>
                ))}
              </div>

              {/* Links */}
              <div style={{ display: "flex", gap: "8px", paddingTop: "14px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <a href={github} target="_blank" rel="noopener noreferrer" style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  fontSize: "12px", color: "rgba(255,255,255,0.5)",
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "8px", padding: "6px 12px", textDecoration: "none",
                }}>
                  <GithubIcon /> GitHub
                </a>
                <a href={linkedin} target="_blank" rel="noopener noreferrer" style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  fontSize: "12px", color: "rgba(255,255,255,0.5)",
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "8px", padding: "6px 12px", textDecoration: "none",
                }}>
                  <LinkedInIcon /> LinkedIn
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ background: "rgba(127,119,221,0.03)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: "820px", margin: "0 auto", padding: "64px 2rem" }}>
          <div style={{ fontSize: "11px", color: "#7F77DD", letterSpacing: "0.1em", marginBottom: "10px" }}>FEATURES</div>
          <h2 style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "28px" }}>What ArcLab does</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
            {FEATURES.map(({ label, desc }) => (
              <div key={label} style={{
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "12px", padding: "20px",
              }}>
                <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px", color: "#fff" }}>{label}</div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", lineHeight: 1.65 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SWE practices */}
      <section style={{ maxWidth: "820px", margin: "0 auto", padding: "64px 2rem" }}>
        <div style={{ fontSize: "11px", color: "#7F77DD", letterSpacing: "0.1em", marginBottom: "10px" }}>HOW WE BUILD</div>
        <h2 style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "28px" }}>Software engineering practices</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          {SWE_PRACTICES.map(({ label, desc }) => (
            <div key={label} style={{ borderLeft: "2px solid rgba(127,119,221,0.4)", paddingLeft: "16px" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>{label}</div>
              <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: 1.65 }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "24px 2rem", textAlign: "center" }}>
        <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.2)" }}>ArcLab · Team ParallaX · NUS Orbital 2026</span>
      </footer>
    </div>
  );
}
