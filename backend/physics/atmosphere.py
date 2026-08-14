"""
US Standard Atmosphere 1976 (US76) simplified model.
Returns density [kg/m³], pressure [Pa], temperature [K], and speed-of-sound [m/s]
for altitudes from 0 to 86 000 m.  Above 86 km a simple exponential fall-off is used.
"""
import math

# Layer table: (base_alt_m, base_temp_K, lapse_rate_K/m, base_pressure_Pa)
_LAYERS = [
    (0,      288.15, -0.0065, 101325.0),
    (11000,  216.65,  0.0,     22632.1),
    (20000,  216.65,  0.001,    5474.89),
    (32000,  228.65,  0.0028,   868.019),
    (47000,  270.65,  0.0,      110.906),
    (51000,  270.65, -0.0028,    66.9389),
    (71000,  214.65, -0.002,      3.95642),
]

_R   = 287.058   # specific gas constant for dry air [J/(kg·K)]
_g0  = 9.80665   # standard gravity [m/s²]
_M   = 0.0289644 # molar mass of air [kg/mol]
_Ru  = 8.31446   # universal gas constant [J/(mol·K)]
_GAMMA = 1.4


def _layer_for(alt_m: float):
    layer = _LAYERS[0]
    for L in _LAYERS:
        if alt_m >= L[0]:
            layer = L
        else:
            break
    return layer


def us76(alt_m: float) -> dict:
    """Return atmospheric properties at *alt_m* metres above MSL."""
    alt_m = max(0.0, alt_m)

    if alt_m > 86_000:
        # Simple exponential above 86 km
        scale_height = 7_500.0   # m
        rho = 0.000064 * math.exp(-(alt_m - 86_000) / scale_height)
        T   = 186.87
        P   = rho * _R * T
        a   = math.sqrt(_GAMMA * _R * T)
        return {"altitude_m": alt_m, "temperature_K": T,
                "pressure_Pa": P, "density_kg_m3": rho,
                "speed_of_sound_m_s": a}

    b_alt, T_b, L, P_b = _layer_for(alt_m)
    dh = alt_m - b_alt

    if abs(L) < 1e-12:   # isothermal layer
        T = T_b
        P = P_b * math.exp(-_g0 * _M * dh / (_Ru * T_b))
    else:
        T = T_b + L * dh
        P = P_b * (T / T_b) ** (-_g0 * _M / (_Ru * L))

    rho = P / (_R * T)
    a   = math.sqrt(_GAMMA * _R * T)

    return {
        "altitude_m":       alt_m,
        "temperature_K":    T,
        "pressure_Pa":      P,
        "density_kg_m3":    rho,
        "speed_of_sound_m_s": a,
    }


def density(alt_m: float) -> float:
    """Convenience: air density [kg/m³] at altitude *alt_m*."""
    return us76(alt_m)["density_kg_m3"]
