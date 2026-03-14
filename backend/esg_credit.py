"""
ESG Credit Assessment Model (ESG-CAM)
Components: Capital (C), Asset Quality (A), Management (M), Environmental (E), Social (S)
"""
import re


def score_capital(metrics: dict) -> dict:
    score = 50.0
    rev = metrics.get("revenue")
    if rev:
        if rev > 10e9:
            score += 30
        elif rev > 1e9:
            score += 20
        elif rev > 100e6:
            score += 10
    score = min(100, score)
    return {"score": round(score, 1), "label": "Capital Strength", "weight": 0.2}


def score_asset(metrics: dict) -> dict:
    score = 50.0
    ren = metrics.get("renewable_pct")
    if ren:
        score += min(20, ren * 0.3)
    energy = metrics.get("energy_consumption")
    if energy and energy < 1e6:
        score += 10
    score = min(100, score)
    return {"score": round(score, 1), "label": "Asset Sustainability", "weight": 0.2}


def score_management(greenwashing: dict) -> dict:
    score = 70.0
    risk = greenwashing.get("risk_score", 0)
    contradictions = greenwashing.get("contradiction_count", 0)
    score -= min(30, risk * 0.3 + contradictions * 5)
    score = max(10, min(100, score))
    return {"score": round(score, 1), "label": "Management Governance", "weight": 0.2}


def score_environmental(metrics: dict) -> dict:
    scores = metrics.get("esg_scores", {})
    score = scores.get("environmental", 50.0)
    return {"score": round(score, 1), "label": "Environmental Impact", "weight": 0.25}


def score_social(metrics: dict) -> dict:
    scores = metrics.get("esg_scores", {})
    score = scores.get("social", 50.0)
    return {"score": round(score, 1), "label": "Social Responsibility", "weight": 0.15}


def credit_rating(score: float) -> str:
    if score >= 88:
        return "AAA"
    elif score >= 80:
        return "AA+"
    elif score >= 75:
        return "AA"
    elif score >= 70:
        return "A+"
    elif score >= 65:
        return "A"
    elif score >= 60:
        return "BBB+"
    elif score >= 55:
        return "BBB"
    elif score >= 50:
        return "BB+"
    elif score >= 45:
        return "BB"
    else:
        return "B"


def compute_esg_cam(metrics: dict, greenwashing: dict) -> dict:
    C = score_capital(metrics)
    A = score_asset(metrics)
    M = score_management(greenwashing)
    E = score_environmental(metrics)
    S = score_social(metrics)

    components = [C, A, M, E, S]
    composite = sum(c["score"] * c["weight"] for c in components)
    rating = credit_rating(composite)

    outlook = "Stable"
    if greenwashing.get("risk_score", 0) > 50:
        outlook = "Negative"
    elif metrics.get("renewable_pct", 0) and metrics["renewable_pct"] > 60:
        outlook = "Positive"

    return {
        "composite_score": round(composite, 1),
        "rating": rating,
        "outlook": outlook,
        "components": {
            "capital": C,
            "asset": A,
            "management": M,
            "environmental": E,
            "social": S,
        },
        "interpretation": f"ESG-adjusted credit rating {rating} with {outlook} outlook. "
                          f"Composite ESG-CAM score: {composite:.1f}/100.",
    }


def financing_recommendations(cam: dict, metrics: dict) -> list[dict]:
    recs = []
    score = cam["composite_score"]
    ren = metrics.get("renewable_pct") or 0
    s1 = metrics.get("scope1")
    intensity = metrics.get("carbon_intensity")

    if score >= 65:
        recs.append({
            "instrument": "Green Bond",
            "eligibility": "Eligible",
            "estimated_rate_reduction_bps": 15,
            "standard": "ICMA Green Bond Principles",
            "rationale": "Strong ESG performance qualifies for green bond issuance at preferential rates.",
            "priority": "high",
        })

    if score >= 55:
        recs.append({
            "instrument": "Sustainability-Linked Loan",
            "eligibility": "Eligible",
            "estimated_rate_reduction_bps": 10,
            "standard": "LMA Sustainability-Linked Loan Principles",
            "rationale": "Company can benefit from SLL with KPIs tied to emission reduction targets.",
            "priority": "high",
        })

    if s1 and intensity and intensity > 2.0:
        recs.append({
            "instrument": "Climate Transition Finance",
            "eligibility": "Eligible",
            "estimated_rate_reduction_bps": 8,
            "standard": "ICMA Climate Transition Finance Handbook",
            "rationale": "High carbon intensity makes company eligible for transition finance instruments.",
            "priority": "medium",
        })

    if ren < 30:
        recs.append({
            "instrument": "Renewable Energy Project Finance",
            "eligibility": "Recommended",
            "estimated_rate_reduction_bps": 12,
            "standard": "GRI 302 / RE100",
            "rationale": "Low renewable % creates opportunity for dedicated renewable energy project finance.",
            "priority": "medium",
        })

    recs.append({
        "instrument": "Carbon Credit Funding",
        "eligibility": "Available",
        "estimated_rate_reduction_bps": 5,
        "standard": "Verified Carbon Standard (VCS)",
        "rationale": "Carbon credit monetization available to offset residual emissions.",
        "priority": "low",
    })

    return recs
