"use client";
import { PhysicsResult } from "../types/analysis";

interface Props {
  result: PhysicsResult;
}

export default function ResultsPanel({ result }: Props) {
  return (
    <div>
      <h2>Step 5 — Physics Results</h2>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <tbody>
          {[
            ["Estimated Gravity", `${result.estimated_gravity_ms2} m/s²`],
            ["Initial Velocity", `${result.initial_velocity_ms} m/s`],
            ["Launch Angle", `${result.launch_angle_deg}°`],
            ["Calibration Ratio", `${result.px_per_metre} px/m`],
            ["Frames Analysed", `${result.timestamps.length}`],
          ].map(([label, value]) => (
            <tr key={label} style={{ borderBottom: "1px solid #ccc" }}>
              <td style={{ padding: "8px", fontWeight: "bold" }}>{label}</td>
              <td style={{ padding: "8px" }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}