"""
calculator.py
-------------
Pure physics and maths — no OpenCV, no HTTP, no file I/O.
Stateless functions, easy to unit test.
"""

import math
import os
from typing import Optional
import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import least_squares
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
    bootstrap_samples: int | None = None,
    random_seed: int | None = 42,
) -> dict:
    """
    Same as compute_physics but fits a drag model:
        dvx/dt = -b * |v| * vx
        dvy/dt = -g - b * |v| * vy
    Uses bounded nonlinear least squares and solve_ivp, then estimates
    parameter uncertainty with a residual bootstrap.
    """
    if len(detections) < 8:
        raise ValueError(
            f"Only {len(detections)} frames detected — need at least 8 "
            "for a stable drag fit."
        )
    if fps <= 0 or px_per_metre <= 0:
        raise ValueError("fps and px_per_metre must be positive.")

    frames = np.array([d[0] for d in detections], dtype=float)
    px_x   = np.array([d[1] for d in detections], dtype=float)
    px_y   = np.array([d[2] for d in detections], dtype=float)

    x_m = px_x / px_per_metre
    y_m = -(px_y / px_per_metre)
    timestamps = (frames - frames[0]) / fps
    if np.any(np.diff(timestamps) <= 0):
        raise ValueError("Detection frame indices must be strictly increasing.")

    # Smooth first (same as before)
    window   = _safe_window(len(x_m))
    x_smooth = savgol_filter(x_m, window_length=window, polyorder=3)
    y_smooth = savgol_filter(y_m, window_length=window, polyorder=3)

    # Initial guesses for vx0, vy0 from finite difference
    dt = timestamps[1] - timestamps[0]
    vx0_guess = (x_smooth[1] - x_smooth[0]) / dt
    vy0_guess = (y_smooth[1] - y_smooth[0]) / dt

    x0_fixed = float(x_smooth[0])
    y0_fixed = float(y_smooth[0])
    observed = np.column_stack([x_smooth, y_smooth])
    initial_guess = np.array([9.81, 0.025, vx0_guess, vy0_guess])
    lower_bounds = np.array([5.0, 0.0, -100.0, -100.0])
    upper_bounds = np.array([15.0, 1.0, 100.0, 100.0])

    fit = _fit_drag_parameters(
        timestamps, observed, x0_fixed, y0_fixed, initial_guess,
        lower_bounds, upper_bounds,
    )
    g_fit, b_fit, vx0_fit, vy0_fit = fit.x

    states = _solve_drag_trajectory(
        timestamps, x0_fixed, y0_fixed, g_fit, b_fit, vx0_fit, vy0_fit
    )
    x_fit, y_fit, vx_fit, vy_fit = states
    ax_fit = np.gradient(vx_fit, timestamps)
    ay_fit = np.gradient(vy_fit, timestamps)

    initial_speed    = float(math.sqrt(vx0_fit**2 + vy0_fit**2))
    launch_angle_deg = float(math.degrees(math.atan2(vy0_fit, vx0_fit)))
    residual_xy = observed - np.column_stack([x_fit, y_fit])
    rmse = float(np.sqrt(np.mean(np.sum(residual_xy**2, axis=1))))
    ss_res = float(np.sum(residual_xy**2))
    centred = observed - np.mean(observed, axis=0)
    ss_tot = float(np.sum(centred**2))
    r_squared = float(1.0 - ss_res / ss_tot) if ss_tot > 1e-15 else 1.0

    if bootstrap_samples is None:
        bootstrap_samples = int(os.environ.get("ARCLAB_BOOTSTRAP_SAMPLES", "500"))
    confidence_intervals, successful_bootstraps = _bootstrap_drag_fit(
        timestamps=timestamps,
        fitted_xy=np.column_stack([x_fit, y_fit]),
        residual_xy=residual_xy,
        x0=x0_fixed,
        y0=y0_fixed,
        initial_guess=fit.x,
        lower_bounds=lower_bounds,
        upper_bounds=upper_bounds,
        samples=max(0, bootstrap_samples),
        random_seed=random_seed,
    )

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
        "confidence_intervals":  confidence_intervals,
        "fit_quality": {
            "converged": bool(fit.success),
            "message": str(fit.message),
            "rmse_m": round(rmse, 6),
            "r_squared": round(r_squared, 6),
            "cost": round(float(fit.cost), 8),
            "optimality": round(float(fit.optimality), 8),
            "function_evaluations": int(fit.nfev),
            "bootstrap_samples": int(bootstrap_samples),
            "successful_bootstraps": successful_bootstraps,
        },
        "predicted_trajectory":  predicted,
    }


def _drag_ode(_t, state, g, drag_coeff):
    _x, _y, vx, vy = state
    speed = math.hypot(vx, vy)
    return [vx, vy, -drag_coeff * speed * vx, -g - drag_coeff * speed * vy]


def _solve_drag_trajectory(timestamps, x0, y0, g, drag_coeff, vx0, vy0):
    sol = solve_ivp(
        _drag_ode,
        (float(timestamps[0]), float(timestamps[-1])),
        [x0, y0, vx0, vy0],
        t_eval=timestamps,
        args=(g, drag_coeff),
        method="RK45",
        rtol=1e-7,
        atol=1e-9,
    )
    if not sol.success or sol.y.shape[1] != len(timestamps):
        raise ValueError(f"Trajectory solver failed: {sol.message}")
    return sol.y


def _fit_drag_parameters(
    timestamps, observed_xy, x0, y0, initial_guess,
    lower_bounds, upper_bounds,
):
    def residual_vector(params):
        g, drag_coeff, vx0, vy0 = params
        try:
            states = _solve_drag_trajectory(
                timestamps, x0, y0, g, drag_coeff, vx0, vy0
            )
            return (states[:2].T - observed_xy).ravel()
        except (ValueError, FloatingPointError):
            return np.full(observed_xy.size, 1e6)

    result = least_squares(
        residual_vector,
        np.clip(initial_guess, lower_bounds, upper_bounds),
        bounds=(lower_bounds, upper_bounds),
        method="trf",
        x_scale="jac",
        max_nfev=2000,
        ftol=1e-10,
        xtol=1e-10,
        gtol=1e-10,
    )
    if not result.success or not np.all(np.isfinite(result.x)):
        raise ValueError(f"Drag fit did not converge: {result.message}")
    return result


def _bootstrap_drag_fit(
    timestamps, fitted_xy, residual_xy, x0, y0, initial_guess,
    lower_bounds, upper_bounds, samples, random_seed,
):
    parameter_names = (
        "estimated_gravity_ms2",
        "drag_coefficient",
        "initial_velocity_ms",
        "launch_angle_deg",
    )
    if samples == 0:
        return {}, 0

    rng = np.random.default_rng(random_seed)
    centred_residuals = residual_xy - np.mean(residual_xy, axis=0)
    estimates = []
    for _ in range(samples):
        indices = rng.integers(0, len(centred_residuals), len(centred_residuals))
        boot_observed = fitted_xy + centred_residuals[indices]
        try:
            boot_fit = _fit_drag_parameters(
                timestamps, boot_observed, x0, y0, initial_guess,
                lower_bounds, upper_bounds,
            )
        except ValueError:
            continue
        g, drag_coeff, vx0, vy0 = boot_fit.x
        estimates.append([
            g,
            drag_coeff,
            math.hypot(vx0, vy0),
            math.degrees(math.atan2(vy0, vx0)),
        ])

    minimum_successes = max(10, int(samples * 0.5))
    if len(estimates) < minimum_successes:
        raise ValueError(
            f"Bootstrap uncertainty estimation failed: only {len(estimates)} "
            f"of {samples} fits converged."
        )
    values = np.asarray(estimates)
    lower = np.percentile(values, 2.5, axis=0)
    upper = np.percentile(values, 97.5, axis=0)
    intervals = {
        name: {"lower": round(float(lower[i]), 6), "upper": round(float(upper[i]), 6)}
        for i, name in enumerate(parameter_names)
    }
    return intervals, len(estimates)


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
    y_end: Optional[float] = None,
    dt: float = 0.01,
    max_t: float = 10.0,
) -> dict:
    """
    Simulates a full projectile flight from launch until it reaches y_end,
    given only launch conditions — unlike predict_trajectory(), which
    requires a pre-built timestamps array to overlay onto an existing real
    trajectory.

    Used by Sandbox Mode: user picks v0/angle/g/drag via sliders, this
    figures out the flight on its own and returns it for plotting, either
    standalone or alongside a real tracked trajectory.

    y_end: height at which to stop the flight. Defaults to y0 (lands back
    at launch height) when not given — this is standalone Sandbox Mode's
    behaviour, with nothing else to compare against. When overlaid on a
    real trajectory, the frontend passes that trajectory's LAST tracked
    y-position instead, so the sandbox curve's endpoint lines up with
    where the real footage actually stopped, rather than assuming it
    returned to launch height.

    The landing check only takes effect once the ball is past its peak
    (vy < 0) — this avoids stopping instantly at launch in the edge case
    where y_end happens to equal y0.

    max_t is a safety cap for edge cases like g very close to 0.
    """
    if y_end is None:
        y_end = y0

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

        if vy < 0 and y <= y_end:
            break

    return {"timestamps": timestamps, "x_positions_m": xs, "y_positions_m": ys}
