"""
In-memory benchmark registry. When companies are analyzed they are
registered here so sector comparisons are possible.
"""
from typing import Optional

REGISTRY: dict[str, dict] = {}

SECTOR_BENCHMARKS = {
    "Energy": {"scope1": 500000, "scope2": 100000, "renewable_pct": 25, "carbon_intensity": 8.0, "esg_score": 52},
    "Technology": {"scope1": 50000, "scope2": 80000, "renewable_pct": 55, "carbon_intensity": 1.2, "esg_score": 68},
    "Manufacturing": {"scope1": 300000, "scope2": 150000, "renewable_pct": 20, "carbon_intensity": 5.0, "esg_score": 55},
    "Finance": {"scope1": 15000, "scope2": 30000, "renewable_pct": 45, "carbon_intensity": 0.5, "esg_score": 65},
    "Healthcare": {"scope1": 80000, "scope2": 60000, "renewable_pct": 35, "carbon_intensity": 2.0, "esg_score": 63},
    "Consumer": {"scope1": 120000, "scope2": 90000, "renewable_pct": 30, "carbon_intensity": 3.0, "esg_score": 58},
    "Utilities": {"scope1": 800000, "scope2": 50000, "renewable_pct": 35, "carbon_intensity": 10.0, "esg_score": 48},
    "Real Estate": {"scope1": 60000, "scope2": 80000, "renewable_pct": 28, "carbon_intensity": 2.5, "esg_score": 60},
    "Other": {"scope1": 100000, "scope2": 70000, "renewable_pct": 30, "carbon_intensity": 3.5, "esg_score": 58},
}


def register_company(company: str, sector: str, metrics: dict, scores: dict):
    REGISTRY[company] = {
        "company": company,
        "sector": sector,
        "scope1": metrics.get("scope1"),
        "scope2": metrics.get("scope2"),
        "scope3": metrics.get("scope3"),
        "renewable_pct": metrics.get("renewable_pct"),
        "carbon_intensity": metrics.get("carbon_intensity"),
        "esg_score": scores.get("composite"),
        "env_score": scores.get("environmental"),
        "soc_score": scores.get("social"),
        "gov_score": scores.get("governance"),
    }


def get_benchmark_comparison(company: str) -> dict:
    if company not in REGISTRY:
        return {"error": "Company not registered"}
    entry = REGISTRY[company]
    sector = entry.get("sector", "Other")
    sector_bench = SECTOR_BENCHMARKS.get(sector, SECTOR_BENCHMARKS["Other"])

    peers = [v for k, v in REGISTRY.items() if v.get("sector") == sector and k != company]
    all_companies = list(REGISTRY.values())

    def rank_metric(val, metric, lower_is_better=False):
        if val is None:
            return None
        vals = [v.get(metric) for v in all_companies if v.get(metric) is not None]
        if not vals:
            return None
        if lower_is_better:
            ranked = sorted(vals)
        else:
            ranked = sorted(vals, reverse=True)
        pos = ranked.index(val) if val in ranked else len(ranked)
        return {"rank": pos + 1, "total": len(vals), "percentile": round((1 - pos / len(vals)) * 100, 1)}

    comparisons = {}
    for metric, bench_val in sector_bench.items():
        company_val = entry.get(metric)
        lower_better = metric in ("scope1", "scope2", "scope3", "carbon_intensity")
        if company_val is not None:
            if lower_better:
                vs_benchmark = "better" if company_val < bench_val else "worse"
                pct_diff = round((bench_val - company_val) / max(1, bench_val) * 100, 1)
            else:
                vs_benchmark = "better" if company_val > bench_val else "worse"
                pct_diff = round((company_val - bench_val) / max(1, bench_val) * 100, 1)
            comparisons[metric] = {
                "company_value": company_val,
                "sector_benchmark": bench_val,
                "vs_benchmark": vs_benchmark,
                "pct_difference": pct_diff,
                "rank": rank_metric(company_val, metric, lower_better),
            }

    return {
        "company": company,
        "sector": sector,
        "comparisons": comparisons,
        "peers": peers[:10],
        "sector_rank": rank_metric(entry.get("esg_score"), "esg_score"),
        "all_companies": all_companies,
    }
