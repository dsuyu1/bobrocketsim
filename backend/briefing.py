"""
Natural-language mission briefing generator.

Uses IBM watsonx / Granite to produce a concise plain-English mission summary
from the optimization result dict.  Falls back to a template-based briefing
when no API credentials are configured.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

log = logging.getLogger(__name__)


# ── watsonx client (optional) ────────────────────────────────────────────────
def _get_watsonx_client():
    """Lazily construct ibm_watsonx_ai client if credentials are present."""
    api_key    = os.getenv("WATSONX_API_KEY", "")
    project_id = os.getenv("WATSONX_PROJECT_ID", "")
    url        = os.getenv("WATSONX_URL", "https://us-south.ml.cloud.ibm.com")

    if not api_key or api_key.startswith("your_"):
        return None, None

    try:
        from ibm_watsonx_ai import APIClient, Credentials
        from ibm_watsonx_ai.foundation_models import ModelInference

        creds  = Credentials(url=url, api_key=api_key)
        client = APIClient(credentials=creds, project_id=project_id)
        model  = ModelInference(
            model_id="ibm/granite-13b-chat-v2",
            api_client=client,
            params={
                "max_new_tokens": 400,
                "temperature":    0.4,
                "repetition_penalty": 1.1,
            },
        )
        return client, model
    except ImportError:
        log.warning("ibm-watsonx-ai package not installed – using template briefing")
        return None, None
    except Exception as e:
        log.warning("watsonx client init failed: %s", e)
        return None, None


_PROMPT_TEMPLATE = """\
You are RocketSims by Bob, an AI mission briefing officer for space launch operations.

Generate a concise, professional GO/NO-GO mission briefing (3–5 sentences) based on
the following launch optimization data. Use clear language suitable for a mission
controller audience.

Optimization Data:
- Nominal T0: {nominal_t0}
- Recommended T0: {optimal_t0}
- T0 offset: {offset_min:+d} minutes
- Risk Index: {risk_index:.1f} / 100
- Decision: {go_nogo}
- Active conjunctions: {conjunctions}
- Trajectory points computed: {trajectory_points}

Briefing:
"""


def generate_briefing(optimization_result: dict, nominal_t0: str = "") -> str:
    """
    Return a natural-language mission briefing string.

    Parameters
    ----------
    optimization_result : dict
        Output from optimizer.optimize_launch_window().
    nominal_t0 : str
        ISO-format string of the originally requested T0.
    """
    if "error" in optimization_result:
        return f"⚠ Briefing unavailable: {optimization_result['error']}"

    optimal_t0  = optimization_result.get("optimal_t0", "unknown")
    risk        = optimization_result.get("risk_index", 0.0)
    go_nogo     = optimization_result.get("go_nogo", "UNKNOWN")
    conjunctions = optimization_result.get("conjunctions", 0)
    traj_pts    = optimization_result.get("trajectory_points", 0)

    # Compute offset
    offset_min  = 0
    if nominal_t0 and optimal_t0 != "unknown":
        from datetime import datetime, timezone
        try:
            t_nom = datetime.fromisoformat(nominal_t0)
            t_opt = datetime.fromisoformat(optimal_t0)
            offset_min = int((t_opt - t_nom).total_seconds() / 60)
        except Exception:
            pass

    prompt = _PROMPT_TEMPLATE.format(
        nominal_t0=nominal_t0 or "N/A",
        optimal_t0=optimal_t0,
        offset_min=offset_min,
        risk_index=risk,
        go_nogo=go_nogo,
        conjunctions=conjunctions,
        trajectory_points=traj_pts,
    )

    # Try watsonx
    _, model = _get_watsonx_client()
    if model is not None:
        try:
            response = model.generate_text(prompt=prompt)
            return response.strip()
        except Exception as e:
            log.warning("watsonx generate failed: %s – using template", e)

    # Template fallback
    return _template_briefing(
        nominal_t0, optimal_t0, offset_min, risk, go_nogo, conjunctions
    )


def _template_briefing(
    nominal_t0: str,
    optimal_t0: str,
    offset_min: int,
    risk: float,
    go_nogo: str,
    conjunctions: int,
) -> str:
    offset_str = (f"{abs(offset_min)} minutes {'earlier' if offset_min < 0 else 'later'}"
                  if offset_min != 0 else "no change to nominal T0")

    conj_str   = (f"{conjunctions} active conjunction event{'s' if conjunctions != 1 else ''}"
                  if conjunctions else "no conjunction events detected")

    decision_color = "[GO]" if go_nogo == "GO" else "[NO-GO]"

    return (
        f"{decision_color} **RocketSims by Bob Mission Briefing — {go_nogo}**\n\n"
        f"Optimization analysis across the ±30-minute launch window identified "
        f"an optimal T0 of **{optimal_t0}** ({offset_str} from nominal). "
        f"The flight risk index is **{risk:.1f}/100**, with {conj_str} flagged "
        f"within the 20 km safety corridor during the simulated ascent profile. "
        f"{'All trajectory constraints are within acceptable bounds. The vehicle is cleared for launch.' if go_nogo == 'GO' else 'Risk thresholds are exceeded. Launch is NOT recommended at this time. A revised T0 or trajectory adjustment is required before proceed.'}"
    )
