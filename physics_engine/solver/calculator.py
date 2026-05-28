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

    res = minimize(residuals, x0_guess, method="Nelder-Mead",
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
    }


# ── Ghost trajectory stub — Feature 5, uncomment in M2 ───────────────────────
#
# def predict_trajectory(
#     v0: float, angle_deg: float,
#     g: float = 9.81, drag_coeff: float = 0.0,
#     dt: float = 0.01, max_t: float = 5.0,
# ) -> dict:
#     """
#     Predict path from launch conditions.
#     drag_coeff=0.0 → no air resistance (Feature 5 checkbox off)
#     drag_coeff>0.0 → with air resistance (Feature 5 checkbox on)
#     """
#     angle_rad = math.radians(angle_deg)
#     vx = v0 * math.cos(angle_rad)
#     vy = v0 * math.sin(angle_rad)
#     xs, ys, ts = [], [], []
#     t, x, y = 0.0, 0.0, 0.0
#     while y >= 0 and t <= max_t:
#         speed = math.sqrt(vx**2 + vy**2)
#         vx += -drag_coeff * speed * vx * dt
#         vy += (-g - drag_coeff * speed * vy) * dt
#         x  += vx * dt
#         y  += vy * dt
#         t  += dt
#         xs.append(round(x, 4))
#         ys.append(round(y, 4))
#         ts.append(round(t, 4))
#     return {"timestamps": ts, "x_positions_m": xs, "y_positions_m": ys}