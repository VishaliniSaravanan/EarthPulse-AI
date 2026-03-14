import re


def _extract_number(text: str, patterns: list[str]) -> float | None:
    for pat in patterns:
        m = re.search(pat, text, re.I)
        if m:
            raw = m.group(1).replace(",", "").replace(" ", "")
            try:
                val = float(raw)
                mult = (m.group(2) or "").lower().strip() if len(m.groups()) >= 2 else ""
                if mult in ("billion", "b"):
                    val *= 1e9
                elif mult in ("million", "m"):
                    val *= 1e6
                elif mult in ("thousand", "k"):
                    val *= 1e3
                return val
            except ValueError:
                pass
    return None


def extract_scope1(text: str) -> float | None:
    return _extract_number(text, [
        r"[Ss]cope\s*1[^0-9\n]*?(\d[\d,]*\.?\d*)\s*(tCO2|mtCO2|kt|Mt|tonnes|tons)?",
        r"[Ss]cope\s*1\s+[Ee]missions?[^0-9\n]*?(\d[\d,]*\.?\d*)",
        r"[Dd]irect\s+[Ee]missions?[^0-9\n]*?(\d[\d,]*\.?\d*)\s*(tCO2|mtCO2)?",
    ])


def extract_scope2(text: str) -> float | None:
    return _extract_number(text, [
        r"[Ss]cope\s*2[^0-9\n]*?(\d[\d,]*\.?\d*)\s*(tCO2|mtCO2|kt|Mt|tonnes|tons)?",
        r"[Ii]ndirect\s+[Ee]missions?[^0-9\n]*?(\d[\d,]*\.?\d*)",
    ])


def extract_scope3(text: str) -> float | None:
    return _extract_number(text, [
        r"[Ss]cope\s*3[^0-9\n]*?(\d[\d,]*\.?\d*)\s*(tCO2|mtCO2|kt|Mt|tonnes|tons)?",
        r"[Vv]alue\s+[Cc]hain\s+[Ee]missions?[^0-9\n]*?(\d[\d,]*\.?\d*)",
    ])


def extract_revenue(text: str) -> float | None:
    return _extract_number(text, [
        r"[Rr]evenue[^0-9\n]*?\$?\s*(\d[\d,]*\.?\d*)\s*(billion|million|B|M|b|m)?",
        r"[Tt]otal\s+[Rr]evenue[^0-9\n]*?\$?\s*(\d[\d,]*\.?\d*)\s*(billion|million|B|M)?",
        r"\$\s*(\d[\d,]*\.?\d*)\s*(billion|million|B|M)?\s+(?:in\s+)?revenue",
        r"[Nn]et\s+[Ss]ales[^0-9\n]*?\$?\s*(\d[\d,]*\.?\d*)\s*(billion|million)?",
    ])


def extract_renewable_pct(text: str) -> float | None:
    return _extract_number(text, [
        r"(\d+\.?\d*)\s*%\s+(?:of\s+)?(?:total\s+)?(?:energy|electricity|power)\s+(?:from\s+)?renewable",
        r"renewable\s+energy[^0-9\n]*?(\d+\.?\d*)\s*%",
        r"(\d+\.?\d*)\s*%\s+renewable",
    ])


def extract_water(text: str) -> float | None:
    return _extract_number(text, [
        r"water\s+(?:consumption|usage|withdrawal)[^0-9\n]*?(\d[\d,]*\.?\d*)\s*(million\s+(?:litres|liters|m3|gallons))?",
        r"(\d[\d,]*\.?\d*)\s*(?:million\s+)?(?:litres|liters|m3|gallons)\s+of\s+water",
    ])


def extract_waste(text: str) -> float | None:
    return _extract_number(text, [
        r"(?:total\s+)?waste[^0-9\n]*?(\d[\d,]*\.?\d*)\s*(tonnes|tons|kt|Mt)?",
        r"(\d[\d,]*\.?\d*)\s*(tonnes|tons)\s+of\s+waste",
    ])


def extract_energy(text: str) -> float | None:
    return _extract_number(text, [
        r"(?:total\s+)?energy\s+consumption[^0-9\n]*?(\d[\d,]*\.?\d*)\s*(GWh|MWh|TJ|PJ|GJ)?",
        r"(\d[\d,]*\.?\d*)\s*(GWh|MWh|TJ|PJ)\s+(?:of\s+)?(?:total\s+)?energy",
    ])


def extract_employees(text: str) -> int | None:
    v = _extract_number(text, [
        r"(\d[\d,]*)\s+(?:full.?time\s+)?employees",
        r"workforce\s+of\s+(\d[\d,]*)",
        r"(\d[\d,]*)\s+(?:staff|workers|headcount)",
    ])
    return int(v) if v else None


def extract_women_leadership(text: str) -> float | None:
    return _extract_number(text, [
        r"(\d+\.?\d*)\s*%\s+(?:of\s+)?(?:women|female)\s+in\s+(?:leadership|management|board)",
        r"women\s+(?:represent|make up|hold)\s+(\d+\.?\d*)\s*%",
    ])


def extract_safety_incidents(text: str) -> float | None:
    return _extract_number(text, [
        r"(?:total\s+)?(?:recordable\s+)?(?:injury|incident)\s+(?:frequency\s+)?rate[^0-9\n]*?(\d+\.?\d*)",
        r"TRIR[^0-9\n]*?(\d+\.?\d*)",
        r"LTIFR[^0-9\n]*?(\d+\.?\d*)",
    ])


def carbon_intensity(scope1: float | None, revenue: float | None) -> float | None:
    if scope1 and revenue and revenue > 0:
        return round(scope1 / (revenue / 1e6), 4)
    return None


def compute_esg_score(metrics: dict) -> dict:
    env_score = 50.0
    soc_score = 50.0
    gov_score = 50.0

    # Environmental
    if metrics.get("renewable_pct") is not None:
        env_score += min(25, metrics["renewable_pct"] * 0.25)
    if metrics.get("scope1") is not None and metrics["scope1"] < 100000:
        env_score += 10
    if metrics.get("carbon_intensity") is not None and metrics["carbon_intensity"] < 1.0:
        env_score += 15
    if metrics.get("scope3") is not None:
        env_score += 5  # reporting is good
    env_score = min(100, env_score)

    # Social
    if metrics.get("women_leadership") is not None:
        soc_score += min(20, metrics["women_leadership"] * 0.4)
    if metrics.get("safety_incidents") is not None and metrics["safety_incidents"] < 1.0:
        soc_score += 15
    soc_score = min(100, soc_score)

    # Governance — placeholder (real data needs board composition, audit, etc.)
    gov_score = 60.0

    composite = round((env_score * 0.45 + soc_score * 0.3 + gov_score * 0.25), 1)
    return {
        "composite": composite,
        "environmental": round(env_score, 1),
        "social": round(soc_score, 1),
        "governance": round(gov_score, 1),
        "rating": "AAA" if composite >= 85 else "AA" if composite >= 75 else "A" if composite >= 65 else "BBB" if composite >= 55 else "BB" if composite >= 45 else "B",
    }


def extract_all(text: str) -> dict:
    s1 = extract_scope1(text)
    s2 = extract_scope2(text)
    s3 = extract_scope3(text)
    rev = extract_revenue(text)
    ren = extract_renewable_pct(text)
    water = extract_water(text)
    waste = extract_waste(text)
    energy = extract_energy(text)
    emp = extract_employees(text)
    women = extract_women_leadership(text)
    safety = extract_safety_incidents(text)
    intensity = carbon_intensity(s1, rev)

    metrics = {
        "scope1": s1,
        "scope2": s2,
        "scope3": s3,
        "revenue": rev,
        "renewable_pct": ren,
        "water_usage": water,
        "waste": waste,
        "energy_consumption": energy,
        "employees": emp,
        "women_leadership": women,
        "safety_incidents": safety,
        "carbon_intensity": intensity,
    }
    metrics["esg_scores"] = compute_esg_score(metrics)
    return metrics
