"""
TLE importer – fetches active LEO debris/satellite TLEs from CelesTrak
and converts them to ECEF positions at a given epoch using SGP4.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import List, Optional

import httpx
import numpy as np
from sgp4.api import Satrec, jday

log = logging.getLogger(__name__)

# Active LEO satellites + debris – no auth required
CELESTRAK_FEEDS = {
    "active":       "https://celestrak.org/SOCRATES/query.php",
    "active_leo":   "https://celestrak.org/pub/TLE/catalog.txt",
    "debris":       "https://celestrak.org/pub/TLE/iridium-33-debris.txt",
    "stations":     "https://celestrak.org/pub/TLE/stations.txt",
}

# Fast public catalog
CELESTRAK_GP_URL = "https://celestrak.org/SOCRATES/query.php"
CELESTRAK_ACTIVE = "https://celestrak.org/pub/TLE/active.txt"
CELESTRAK_CATALOG = "https://celestrak.org/pub/TLE/catalog.txt"


class TLERecord:
    __slots__ = ("name", "line1", "line2", "satrec")

    def __init__(self, name: str, line1: str, line2: str):
        self.name   = name.strip()
        self.line1  = line1.strip()
        self.line2  = line2.strip()
        self.satrec = Satrec.twoline2rv(self.line1, self.line2)

    def ecef_at(self, dt: datetime) -> Optional[np.ndarray]:
        """
        Return ECEF position [m] at *dt* (UTC).
        Returns None if propagation error.
        """
        jd, fr = jday(dt.year, dt.month, dt.day,
                      dt.hour, dt.minute, dt.second + dt.microsecond * 1e-6)
        err, r_teme, _ = self.satrec.sgp4(jd, fr)
        if err != 0:
            return None
        # TEME → ECEF (simplified: ignores polar wander / UT1-UTC)
        # Theta_GMST approximation
        theta = _gmst(jd + fr)
        r_ecef = _rot_z(r_teme, -theta)
        return np.array(r_ecef) * 1000.0   # km → m


def _gmst(jd_ut1: float) -> float:
    """Greenwich Mean Sidereal Time [rad] (simple polynomial)."""
    T = (jd_ut1 - 2451545.0) / 36525.0
    theta_s = (67310.54841 + (876600 * 3600 + 8640184.812866) * T
               + 0.093104 * T**2 - 6.2e-6 * T**3)
    return (theta_s % 86400.0) / 86400.0 * 2 * np.pi


def _rot_z(vec, angle):
    c, s = np.cos(angle), np.sin(angle)
    R = np.array([[c, s, 0],
                  [-s, c, 0],
                  [0,  0, 1]])
    return R @ np.array(vec)


def _parse_tle_text(text: str) -> List[TLERecord]:
    lines  = [l for l in text.splitlines() if l.strip()]
    records: List[TLERecord] = []
    i = 0
    while i < len(lines) - 2:
        name  = lines[i]
        line1 = lines[i + 1]
        line2 = lines[i + 2]
        if line1.startswith("1 ") and line2.startswith("2 "):
            try:
                records.append(TLERecord(name, line1, line2))
            except Exception as e:
                log.debug("Skip malformed TLE %s: %s", name, e)
            i += 3
        else:
            i += 1
    return records


_cache: dict = {"tles": [], "fetched_at": 0.0}
_CACHE_TTL = 3600  # seconds


def fetch_tles(max_count: int = 500) -> List[TLERecord]:
    """
    Return a list of TLERecord objects for active LEO objects.
    Results are cached for 1 hour.
    """
    now = time.time()
    if now - _cache["fetched_at"] < _CACHE_TTL and _cache["tles"]:
        return _cache["tles"][:max_count]

    urls = [
        CELESTRAK_ACTIVE,
        "https://celestrak.org/pub/TLE/tle-new.txt",
        "https://celestrak.org/pub/TLE/visual.txt",
    ]

    records: List[TLERecord] = []
    for url in urls:
        if len(records) >= max_count:
            break
        try:
            resp = httpx.get(url, timeout=15.0, follow_redirects=True)
            resp.raise_for_status()
            batch = _parse_tle_text(resp.text)
            records.extend(batch)
            log.info("Fetched %d TLEs from %s", len(batch), url)
        except Exception as e:
            log.warning("TLE fetch failed for %s: %s", url, e)

    if not records:
        log.warning("No TLEs fetched – using empty set")

    _cache["tles"]       = records
    _cache["fetched_at"] = now
    return records[:max_count]


def build_position_snapshot(
    records: List[TLERecord],
    dt: Optional[datetime] = None,
) -> List[dict]:
    """
    Propagate all *records* to *dt* and return list of
    {"name": str, "x": float, "y": float, "z": float} dicts (ECEF, metres).
    """
    if dt is None:
        dt = datetime.now(timezone.utc)

    out = []
    for rec in records:
        pos = rec.ecef_at(dt)
        if pos is not None:
            out.append({"name": rec.name, "x": float(pos[0]),
                        "y": float(pos[1]), "z": float(pos[2])})
    return out
