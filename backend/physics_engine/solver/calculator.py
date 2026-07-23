"""
calculator.py
-------------
Pure physics and maths — no OpenCV, no HTTP, no file I/O.
Stateless functions, easy to unit test.
"""

import math
import numpy as np
from scipy.signal import savgol_filter


# ── Calibration ───────────────────────────────────────────────────────────────

def compute_px_per_metre(
    x1: float, y1: float,
    x2: float, y2: float,
    real_world_distance_m: float,
) -> float:
    """
    Two pixel points + known real-world distance → px/m ratio.
    Used to convert all pixel measurements to metres.
    """
    if real_world_distance_m <= 0:
        raise ValueError("Real-world distance must be positive (metres).")
    pixel_dist = math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
    if pixel_dist < 1:
        raise ValueError("Calibration points too close — choose two distinct points.")
    return pixel_dist / real_world_distance_m


# ── Smoothing helper ──────────────────────────────────────────────────────────

def _safe_window(n: int, desired: int = 11) -> int:
    """
    Savitzky-Golay requires: window < n, window is odd, window >= polyorder+1.
    Returns largest valid odd window <= desired.
    """
    window = min(desired, n)
    if window % 2 == 0:
        window -= 1
    return max(window, 5)


# ── Core physics ──────────────────────────────────────────────────────────────

def compute_physics(
    detections: list[tuple[int, float, float]],
    fps: float,
    px_per_metre: float,
) -> dict:
    """
    Raw pixel detections → full physical trajectory parameters.

    Pipeline:
        pixel coords
        → metres (invert y so up is positive)
        → Savitzky-Golay smooth (removes pixel quantisation noise)
        → finite differences → velocity, acceleration
        → scalar summaries (gravity, launch angle, initial speed)

    Args:
        detections:   [(frame_index, cx_px, cy_px), ...]  from tracker
        fps:          frames per second of the source video
        px_per_metre: ratio from compute_px_per_metre()

    Returns dict matching PhysicsResult schema.
    """
    if len(detections) < 5:
        raise ValueError(
            f"Only {len(detections)} frames detected — need at least 5. "
            "Try widening the frame range or re-clicking the ball."
        )

    frames = np.array([d[0] for d in detections], dtype=float)
    px_x   = np.array([d[1] for d in detections], dtype=float)
    px_y   = np.array([d[2] for d in detections], dtype=float)

    # Pixel → metres; invert y (screen y grows downward, physics y grows upward)
    x_m = px_x / px_per_metre
    y_m = -(px_y / px_per_metre)

    timestamps = (frames - frames[0]) / fps  # seconds from t=0

    # Smooth
    window   = _safe_window(len(x_m))
    x_smooth = savgol_filter(x_m, window_length=window, polyorder=3)
    y_smooth = savgol_filter(y_m, window_length=window, polyorder=3)

    dt = 1.0 / fps

    # Velocity (m/s)
    vx = np.gradient(x_smooth, dt)
    vy = np.gradient(y_smooth, dt)

    # Acceleration (m/s²)
    ax = np.gradient(vx, dt)
    ay = np.gradient(vy, dt)

    # Scalar summaries
    coeffs = np.polyfit(timestamps, y_smooth, 2)
    estimated_gravity = float(abs(-2 * coeffs[0]))
    initial_speed     = float(math.sqrt(float(vx[0])**2 + float(vy[0])**2))
    launch_angle_deg  = float(math.degrees(math.atan2(float(vy[0]), float(vx[0]))))

    # Ideal (no-drag) ghost from the same launch point, using THIS clip's
    # estimated gravity (not 9.81) so the vertical scale matches the data.
    # Extended ~1.5x the tracked window so it visibly projects farther than
    # the (drag-slowed) real path.
    t_track = float(timestamps[-1]) if len(timestamps) > 1 else 1.0
    ghost_ts = np.arange(0.0, t_track * 1.5 + 1e-9, 1.0 / fps)
    predicted = predict_trajectory(
        x0=float(x_smooth[0]), y0=float(y_smooth[0]),
        vx0=float(vx[0]), vy0=float(vy[0]),
        timestamps=ghost_ts, g=estimated_gravity, drag_coeff=0.0,
    )

    return {
        "timestamps":            timestamps.tolist(),
        "x_positions_m":         x_smooth.tolist(),
        "y_positions_m":         y_smooth.tolist(),
        "velocities_x_ms":       vx.tolist(),
        "velocities_y_ms":       vy.tolist(),
        "accelerations_x_ms2":   ax.tolist(),
        "accelerations_y_ms2":   ay.tolist(),
        "estimated_gravity_ms2": round(estimated_gravity, 3),
        "initial_velocity_ms":   round(initial_speed, 3),
        "launch_angle_deg":      round(launch_angle_deg, 2),
        "px_per_metre":          round(px_per_metre, 4),
        "predicted_trajectory":  predicted,
    }

def compute_physics_with_drag(
    detections: list[tuple[int, float, float]],
    fps: float,
    px_per_metre: float,
) -> dict:
    """
    Same as compute_physics but fits a drag model:
        dvx/dt = -b * vx
        dvy/dt = -g - b * vy
    Uses scipy.optimize.minimize to find best-fit g and b.
    """
    from scipy.integrate import odeint
    from scipy.optimize import minimize

    if len(detections) < 5:
        raise ValueError(
            f"Only {len(detections)} frames detected — need at least 5."
        )

    frames = np.array([d[0] for d in detections], dtype=float)
    px_x   = np.array([d[1] for d in detections], dtype=float)
    px_y   = np.array([d[2] for d in detections], dtype=float)

    x_m = px_x / px_per_metre
    y_m = -(px_y / px_per_metre)
    timestamps = (frames - frames[0]) / fps

    # Smooth first (same as before)
    window   = _safe_window(len(x_m))
    x_smooth = savgol_filter(x_m, window_length=window, polyorder=3)
    y_smooth = savgol_filter(y_m, window_length=window, polyorder=3)

    # Initial guesses for vx0, vy0 from finite difference
    dt = timestamps[1] - timestamps[0]
    vx0_guess = (x_smooth[1] - x_smooth[0]) / dt
    vy0_guess = (y_smooth[1] - y_smooth[0]) / dt

    def ode(state, t, g, b):
        _, _, vx, vy = state
        speed = np.sqrt(vx**2 + vy**2)
        return [vx, vy, -b * speed * vx, -g - b * speed * vy]

    def simulate(params):
        g, b, x0, y0, vx0, vy0 = params
        if g < 0 or b < 0:
            return np.full(len(timestamps) * 2, 1e6)
        state0 = [x0, y0, vx0, vy0]
        try:
            sol = odeint(ode, state0, timestamps, args=(g, b))
            return np.concatenate([sol[:, 0], sol[:, 1]])
        except Exception:
            return np.full(len(timestamps) * 2, 1e6)

    observed = np.concatenate([x_smooth, y_smooth])
    
    def residuals(params):
        g, b, vx0, vy0 = params
        state0 = [x0_fixed, y0_fixed, vx0, vy0]
        try:
            sol = odeint(ode, state0, timestamps, args=(g, b))
            predicted = np.concatenate([sol[:, 0], sol[:, 1]])
            return np.sum((predicted - observed) ** 2)
        except Exception:
            return 1e6

    x0_fixed = float(x_smooth[0])
    y0_fixed = float(y_smooth[0])

    x0_guess = [9.81, 0.025, vx0_guess, vy0_guess]
    bounds = [(5, 15), (0.01, 0.1), (None, None), (None, None)]

    res = minimize(residuals, x0_guess, method="Nelder-Mead", bounds=bounds,
            options={"xatol": 1e-6, "fatol": 1e-6, "maxiter": 5000})

    g_fit, b_fit, vx0_fit, vy0_fit = res.x

    # Reconstruct full trajectory from fitted params
    sol = odeint(ode, [x0_fixed, y0_fixed, vx0_fit, vy0_fit], timestamps, args=(g_fit, b_fit))
    x_fit = sol[:, 0]
    y_fit = sol[:, 1]
    vx_fit = sol[:, 2]
    vy_fit = sol[:, 3]

    dt_arr = np.gradient(timestamps)
    ax_fit = np.gradient(vx_fit, timestamps)
    ay_fit = np.gradient(vy_fit, timestamps)

    initial_speed    = float(math.sqrt(vx0_fit**2 + vy0_fit**2))
    launch_angle_deg = float(math.degrees(math.atan2(vy0_fit, vx0_fit)))

    # Ideal (no-drag) ghost using the fitted launch conditions and the fitted
    # gravity g_fit (matched vertical scale), extended ~1.5x so it visibly
    # projects farther than the drag-fitted real path.
    t_track = float(timestamps[-1]) if len(timestamps) > 1 else 1.0
    ghost_ts = np.arange(0.0, t_track * 1.5 + 1e-9, 1.0 / fps)
    predicted = predict_trajectory(
        x0=float(x0_fixed), y0=float(y0_fixed),
        vx0=float(vx0_fit), vy0=float(vy0_fit),
        timestamps=ghost_ts, g=float(g_fit), drag_coeff=0.0,
    )

    return {
        "timestamps":            timestamps.tolist(),
        "x_positions_m":         x_fit.tolist(),
        "y_positions_m":         y_fit.tolist(),
        "velocities_x_ms":       vx_fit.tolist(),
        "velocities_y_ms":       vy_fit.tolist(),
        "accelerations_x_ms2":   ax_fit.tolist(),
        "accelerations_y_ms2":   ay_fit.tolist(),
        "estimated_gravity_ms2": round(float(g_fit), 3),
        "initial_velocity_ms":   round(initial_speed, 3),
        "launch_angle_deg":      round(launch_angle_deg, 2),
        "px_per_metre":          round(px_per_metre, 4),
        "drag_coefficient":      round(float(b_fit), 4),
        "predicted_trajectory":  predicted,
    }


# ── Ghost trajectory — Feature 5 ─────────────────────────────────────────────

def predict_trajectory(
    x0: float, y0: float,
    vx0: float, vy0: float,
    timestamps,
    g: float,
    drag_coeff: float = 0.0,
) -> dict:
    """
    Predicted (no-drag) path from the launch point, sampled at the given
    timestamps so it overlays on the tracked path.

    IMPORTANT: pass the data's own estimated gravity as `g`, NOT a hard-coded
    9.81. The tracked positions are in calibrated "metres" whose scale depends
    on px/m; using the estimated g keeps the ghost's vertical timescale matched
    to the data, so at equal height the no-drag ghost correctly reaches farther.

    drag_coeff == 0.0 → ideal parabola:
        x(t) = x0 + vx0*t
        y(t) = y0 + vy0*t - 0.5*g*t^2
    drag_coeff  > 0.0 → quadratic drag, integrated numerically.
    """
    ts = list(timestamps)
    xs: list[float] = []
    ys: list[float] = []

    if drag_coeff == 0.0:
        for t in ts:
            xs.append(round(x0 + vx0 * t, 4))
            ys.append(round(y0 + vy0 * t - 0.5 * g * t * t, 4))
        return {"x_positions_m": xs, "y_positions_m": ys}

    x, y, vx, vy = x0, y0, vx0, vy0
    t_cur, step = 0.0, 0.002
    for t in ts:
        while t_cur < t:
            speed = math.sqrt(vx * vx + vy * vy)
            vx += -drag_coeff * speed * vx * step
            vy += (-g - drag_coeff * speed * vy) * step
            x  += vx * step
            y  += vy * step
            t_cur += step
        xs.append(round(x, 4))
        ys.append(round(y, 4))
    return {"x_positions_m": xs, "y_positions_m": ys}

# ── Sandbox Mode — freestanding trajectory simulation ────────────────────────

def simulate_trajectory(
    v0: float,
    angle_deg: float,
    g: float,
    drag_coeff: float = 0.0,
    x0: float = 0.0,
    y0: float = 0.0,
    dt: float = 0.01,
    max_t: float = 10.0,
) -> dict:
    """
    Simulates a full projectile flight from launch to landing, given only
    launch conditions — unlike predict_trajectory(), which requires a
    pre-built timestamps array to overlay onto an existing real trajectory.

    Used by Sandbox Mode: user picks v0/angle/g/drag via sliders, this
    figures out the flight on its own and returns it for plotting, either
    standalone or alongside a real tracked trajectory.

    Stops when the ball returns to y0 (landing) or max_t is reached
    (safety cap for edge cases like g very close to 0).
    """
    angle_rad = math.radians(angle_deg)
    vx = v0 * math.cos(angle_rad)
    vy = v0 * math.sin(angle_rad)

    x, y, t = x0, y0, 0.0
    timestamps = [0.0]
    xs = [round(x0, 4)]
    ys = [round(y0, 4)]

    while t < max_t:
        speed = math.sqrt(vx * vx + vy * vy)
        ax = -drag_coeff * speed * vx
        ay = -g - drag_coeff * speed * vy
        vx += ax * dt
        vy += ay * dt
        x  += vx * dt
        y  += vy * dt
        t  += dt

        timestamps.append(round(t, 4))
        xs.append(round(x, 4))
        ys.append(round(y, 4))

        if y < y0:
            break

    return {"timestamps": timestamps, "x_positions_m": xs, "y_positions_m": ys}
