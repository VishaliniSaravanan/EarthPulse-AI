import re

SECTOR_CLIMATE_RISK = {
    "Energy": {"physical": 80, "transition": 90, "flood": 60, "drought": 70, "extreme_weather": 75},
    "Manufacturing": {"physical": 60, "transition": 70, "flood": 50, "drought": 45, "extreme_weather": 55},
    "Finance": {"physical": 30, "transition": 50, "flood": 25, "drought": 20, "extreme_weather": 30},
    "Technology": {"physical": 40, "transition": 35, "flood": 35, "drought": 40, "extreme_weather": 45},
    "Healthcare": {"physical": 45, "transition": 30, "flood": 40, "drought": 35, "extreme_weather": 50},
    "Consumer": {"physical": 55, "transition": 60, "flood": 50, "drought": 60, "extreme_weather": 55},
    "Utilities": {"physical": 75, "transition": 85, "flood": 70, "drought": 65, "extreme_weather": 80},
    "Real Estate": {"physical": 70, "transition": 55, "flood": 80, "drought": 50, "extreme_weather": 65},
    "Agriculture": {"physical": 85, "transition": 60, "flood": 75, "drought": 90, "extreme_weather": 85},
    "Other": {"physical": 50, "transition": 50, "flood": 45, "drought": 45, "extreme_weather": 50},
}

TCFD_KEYWORDS = {
    "physical_risk": ["flood", "drought", "hurricane", "sea level", "wildfire", "extreme heat", "physical risk"],
    "transition_risk": ["carbon price", "carbon tax", "stranded asset", "regulatory risk", "transition risk", "policy risk"],
    "scenario": ["1.5°c", "2°c", "rcp", "scenario analysis", "climate scenario", "ssp"],
    "metrics_targets": ["climate target", "net zero", "science based target", "sbti"],
}


def analyze_climate_risk(text: str, sector: str, metrics: dict) -> dict:
    lower = text.lower()
    base = SECTOR_CLIMATE_RISK.get(sector, SECTOR_CLIMATE_RISK["Other"])

    # Adjust based on text signals
    adjustments = {}
    for category, keywords in TCFD_KEYWORDS.items():
        matches = sum(1 for kw in keywords if kw in lower)
        adjustments[category] = matches

    # Physical risk
    flood_risk = base["flood"]
    if "flood" in lower or "coastal" in lower:
        flood_risk = min(100, flood_risk + 15)
    
    drought_risk = base["drought"]
    if "drought" in lower or "water stress" in lower:
        drought_risk = min(100, drought_risk + 10)

    # Transition risk modified by emissions performance
    transition_risk = base["transition"]
    intensity = metrics.get("carbon_intensity")
    if intensity:
        if intensity > 5:
            transition_risk = min(100, transition_risk + 20)
        elif intensity < 1:
            transition_risk = max(10, transition_risk - 15)

    ren = metrics.get("renewable_pct") or 0
    if ren > 50:
        transition_risk = max(10, transition_risk - 10)

    # TCFD disclosure quality
    tcfd_score = min(100, sum(adjustments.values()) * 12)

    overall = round(
        base["physical"] * 0.3
        + transition_risk * 0.4
        + base["extreme_weather"] * 0.3, 1
    )

    scenarios = [
        {
            "name": "1.5°C Scenario (Paris Aligned)",
            "emissions_reduction_required": "45% by 2030, 100% by 2050",
            "transition_cost_pct_revenue": 3.5,
            "stranded_asset_risk": "High" if sector in ("Energy", "Utilities") else "Low",
            "feasibility": "Achievable with aggressive investment",
        },
        {
            "name": "2°C Scenario",
            "emissions_reduction_required": "25% by 2030, 70% by 2050",
            "transition_cost_pct_revenue": 1.8,
            "stranded_asset_risk": "Medium" if sector in ("Energy", "Utilities") else "Low",
            "feasibility": "Achievable with moderate investment",
        },
        {
            "name": "Business as Usual (3°C+)",
            "emissions_reduction_required": "None planned",
            "transition_cost_pct_revenue": 8.0,
            "stranded_asset_risk": "Very High",
            "feasibility": "High regulatory and reputational risk",
        },
    ]

    hazards = [
        {"hazard": "Flood Risk", "score": flood_risk, "level": "high" if flood_risk > 60 else "medium" if flood_risk > 35 else "low"},
        {"hazard": "Drought Risk", "score": drought_risk, "level": "high" if drought_risk > 60 else "medium" if drought_risk > 35 else "low"},
        {"hazard": "Extreme Weather", "score": base["extreme_weather"], "level": "high" if base["extreme_weather"] > 60 else "medium" if base["extreme_weather"] > 35 else "low"},
        {"hazard": "Transition Risk", "score": transition_risk, "level": "high" if transition_risk > 65 else "medium" if transition_risk > 40 else "low"},
        {"hazard": "Policy/Regulatory", "score": base["transition"] - 10, "level": "high" if base["transition"] > 70 else "medium"},
    ]

    return {
        "overall_risk_score": overall,
        "risk_level": "HIGH" if overall > 65 else "MEDIUM" if overall > 40 else "LOW",
        "physical_risk": base["physical"],
        "transition_risk": transition_risk,
        "flood_risk": flood_risk,
        "drought_risk": drought_risk,
        "tcfd_disclosure_score": tcfd_score,
        "hazards": hazards,
        "scenarios": scenarios,
        "sector": sector,
    }
