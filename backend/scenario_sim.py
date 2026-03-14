def _num(v, default=0):
    """Coerce to float; avoid TypeError when metrics are strings or None."""
    if v is None:
        return default
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def simulate_scenario(metrics: dict, scenario: str, params: dict) -> dict:
    """
    Simulate ESG strategy changes and predict outcomes.
    scenarios: renewable_transition, supply_chain_restructure, emissions_reduction, all
    """
    if not isinstance(metrics, dict):
        metrics = {}
    s1 = _num(metrics.get("scope1"), 0)
    s2 = _num(metrics.get("scope2"), 0)
    s3 = _num(metrics.get("scope3"), 0)
    ren = _num(metrics.get("renewable_pct"), 0)
    intensity = _num(metrics.get("carbon_intensity"), 0)
    esg_scores = metrics.get("esg_scores") if isinstance(metrics.get("esg_scores"), dict) else {}
    esg = _num(esg_scores.get("composite"), 55)

    results = {}

    if scenario in ("renewable_transition", "all"):
        target_ren = _num(params.get("target_renewable_pct", 80), 80)
        delta_ren = max(0, target_ren - ren)
        s2_reduction = s2 * (delta_ren / 100) * 0.9
        new_s2 = max(0, s2 - s2_reduction)
        new_esg = min(100, esg + delta_ren * 0.15)
        investment_m = delta_ren * 2.5  # $M per % point
        results["renewable_transition"] = {
            "scenario": "Renewable Energy Transition",
            "target_renewable_pct": target_ren,
            "scope2_reduction_tco2": round(s2_reduction),
            "new_scope2": round(new_s2),
            "esg_score_change": round(new_esg - esg, 1),
            "new_esg_score": round(new_esg, 1),
            "investment_required_m": round(investment_m, 1),
            "payback_years": round(investment_m / max(1, s2_reduction * 0.00005), 1),
            "financing_eligibility": ["Green Bond", "Renewable Energy Project Finance"],
        }

    if scenario in ("supply_chain_restructure", "all"):
        s3_reduction_pct = _num(params.get("supply_chain_reduction_pct", 20), 20)
        s3_reduction = s3 * (s3_reduction_pct / 100)
        new_s3 = max(0, s3 - s3_reduction)
        new_esg = min(100, esg + s3_reduction_pct * 0.1)
        results["supply_chain_restructure"] = {
            "scenario": "Supply Chain Restructuring",
            "scope3_reduction_tco2": round(s3_reduction),
            "new_scope3": round(new_s3),
            "reduction_pct": s3_reduction_pct,
            "esg_score_change": round(new_esg - esg, 1),
            "new_esg_score": round(new_esg, 1),
            "cost_increase_pct": 3,
            "financing_eligibility": ["Sustainability-Linked Loan"],
        }

    if scenario in ("emissions_reduction", "all"):
        target_reduction_pct = _num(params.get("emissions_reduction_pct", 30), 30)
        s1_reduction = s1 * (target_reduction_pct / 100)
        new_s1 = max(0, s1 - s1_reduction)
        new_intensity = intensity * (1 - target_reduction_pct / 100)
        new_esg = min(100, esg + target_reduction_pct * 0.2)
        results["emissions_reduction"] = {
            "scenario": "Direct Emissions Reduction",
            "scope1_reduction_tco2": round(s1_reduction),
            "new_scope1": round(new_s1),
            "new_carbon_intensity": round(new_intensity, 4),
            "reduction_pct": target_reduction_pct,
            "esg_score_change": round(new_esg - esg, 1),
            "new_esg_score": round(new_esg, 1),
            "investment_required_m": round(target_reduction_pct * 1.5, 1),
            "financing_eligibility": ["Climate Transition Finance", "Green Bond"],
        }

    # Sustainability-linked loan eligibility
    eligible_for_sll = esg >= 55 or any(
        r.get("esg_score_change", 0) > 5 for r in results.values()
    )

    recommended = None
    if results:
        try:
            recommended = max(results.keys(), key=lambda k: _num(results[k].get("esg_score_change"), 0))
        except (ValueError, TypeError):
            recommended = next(iter(results), None)

    return {
        "current_esg_score": round(esg, 1),
        "current_scope1": round(s1, 1),
        "current_scope2": round(s2, 1),
        "current_scope3": round(s3, 1),
        "scenarios": results,
        "sustainability_linked_loan_eligible": eligible_for_sll,
        "recommended_scenario": recommended,
    }
