r"""
disruption.py  -  headline disruption hai ya nahi, type, severity.
⚠️ Ye KEYWORD RULES hain (heuristic). Severity ek andaza hai, real measurement nahi.
Optional: --hf se HuggingFace zero-shot classifier (heavy, deploy mein nahi).
"""
import re

EVENT_KEYWORDS = {      # dict ka order = tie hone par priority
    "strike": ["strike", "strikes", "walkout", "industrial action", "work stoppage", "lockout"],
    "weather": ["typhoon", "hurricane", "storm", "flood", "flooding", "cyclone", "earthquake",
                "tsunami", "drought", "snow", "fog"],
    "congestion": ["congestion", "backlog", "backlogs", "bottleneck", "bottlenecks"],
    "accident": ["fire", "explosion", "collision", "accident", "grounded", "spill", "blockage"],
    "cyber": ["cyberattack", "cyber attack", "ransomware", "hacked", "hackers", "system outage"],
    "geopolitical": ["sanction", "sanctions", "embargo", "war", "blockade", "tariff", "tariffs",
                     "export restriction", "export restrictions", "military", "unrest"],
    "shortage": ["shortage", "shortages", "scarcity", "stockout"],
}
STRONG = ["indefinite", "indefinitely", "halt", "halted", "halting", "shut", "shutdown", "closed",
          "closure", "suspend", "suspended", "suspends", "severe", "massive", "paralysed",
          "paralyzed", "blockade", "week", "weeks"]
MILD = ["brief", "briefly", "minor", "slight", "partial", "some", "limited", "short"]

HF_LABELS = {"strike": "labour strike", "weather": "extreme weather", "congestion": "port congestion",
             "accident": "accident or fire", "cyber": "cyberattack",
             "geopolitical": "sanctions or conflict", "shortage": "supply shortage",
             "none": "not a supply chain disruption"}
_hf = None


def _count(words, low):
    # \b = poora shabd match (taaki "war" ya "warehouse" mein na mile)
    return sum(1 for w in words if re.search(rf"\b{re.escape(w)}\b", low))


def classify_hf(text):
    global _hf
    if _hf is None:
        from transformers import pipeline          # lazy import: sirf --hf par chahiye
        _hf = pipeline("zero-shot-classification", model="typeform/distilbert-base-uncased-mnli")
    out = _hf(text, candidate_labels=list(HF_LABELS.values()))
    inv = {v: k for k, v in HF_LABELS.items()}
    return inv[out["labels"][0]], float(out["scores"][0])


def analyze(text, use_hf=False):
    low = text.lower()
    counts = {t: _count(kws, low) for t, kws in EVENT_KEYWORDS.items()}
    best = max(counts, key=counts.get)
    etype = best if counts[best] > 0 else None

    if use_hf:                                      # HF confident ho to uska type
        hf_type, score = classify_hf(text)
        if score >= 0.5:
            etype = None if hf_type == "none" else hf_type

    if etype is None:
        return {"is_disruption": False, "event_type": None, "severity": 0.0}
    sev = 0.5 + 0.15 * _count(STRONG, low) - 0.15 * _count(MILD, low)
    return {"is_disruption": True, "event_type": etype,
            "severity": round(min(1.0, max(0.3, sev)), 2)}