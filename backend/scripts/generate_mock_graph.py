r"""
generate_mock_graph.py
======================
⚠️  SYNTHETIC / SIMULATED DATA.
Ye graph asli nahi hai. Real global supply chain data public nahi hota.
Company ke naam jaanbujhkar fictional rakhe gaye hain (shehar + generic word + ID).

Layers (flow ki direction):
Supplier -> Manufacturer -> Port -> Warehouse -> Retailer

Run:  python backend\scripts\generate_mock_graph.py --n 300
"""
import argparse
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]

LAYERS = ["Supplier", "Manufacturer", "Port", "Warehouse", "Retailer"]
PREFIX = {"Supplier": "S", "Manufacturer": "M", "Port": "P", "Warehouse": "W", "Retailer": "R"}
NAME_WORD = {
    "Supplier": ["Components", "Materials", "Metals", "Textiles", "Chemicals", "Plastics"],
    "Manufacturer": ["Assembly Works", "Manufacturing", "Industries", "Fabrication"],
    "Warehouse": ["Distribution Hub", "Storage Centre", "Logistics Park"],
    "Retailer": ["Retail Group", "Stores", "Mart", "Trading"],
}
INDUSTRIES = ["Consumer Electronics", "Automotive", "Pharmaceuticals",
              "Apparel", "Food & Beverage", "Industrial Machinery"]

# country -> (region, [cities])
COUNTRIES = {
    "China": ("Asia", ["Shenzhen", "Shanghai", "Guangzhou", "Suzhou"]),
    "Vietnam": ("Asia", ["Hanoi", "Ho Chi Minh City"]),
    "India": ("Asia", ["Mumbai", "Chennai", "Pune"]),
    "Japan": ("Asia", ["Osaka", "Nagoya"]),
    "South Korea": ("Asia", ["Seoul", "Busan"]),
    "Taiwan": ("Asia", ["Taipei", "Hsinchu"]),
    "Malaysia": ("Asia", ["Penang", "Port Klang"]),
    "Thailand": ("Asia", ["Bangkok", "Laem Chabang"]),
    "Singapore": ("Asia", ["Singapore"]),
    "Sri Lanka": ("Asia", ["Colombo"]),
    "Germany": ("Europe", ["Munich", "Stuttgart", "Hamburg"]),
    "Netherlands": ("Europe", ["Eindhoven", "Rotterdam"]),
    "Belgium": ("Europe", ["Antwerp"]),
    "Poland": ("Europe", ["Warsaw"]),
    "UK": ("Europe", ["Birmingham", "Felixstowe"]),
    "France": ("Europe", ["Lyon", "Le Havre"]),
    "Italy": ("Europe", ["Milan", "Genoa"]),
    "Spain": ("Europe", ["Barcelona", "Valencia"]),
    "Greece": ("Europe", ["Athens", "Piraeus"]),
    "USA": ("North America", ["Chicago", "Detroit", "Dallas", "Atlanta"]),
    "Canada": ("North America", ["Toronto", "Vancouver"]),
    "Mexico": ("North America", ["Monterrey", "Manzanillo"]),
    "Brazil": ("South America", ["Sao Paulo", "Santos"]),
    "UAE": ("Middle East", ["Dubai", "Jebel Ali"]),
    "South Africa": ("Africa", ["Johannesburg", "Durban"]),
    "Australia": ("Oceania", ["Melbourne", "Sydney"]),
}

# Real port ke naam (NER matching ke kaam aayenge) -> country
PORTS = [
    ("Rotterdam", "Netherlands"), ("Hamburg", "Germany"), ("Antwerp", "Belgium"),
    ("Shanghai", "China"), ("Shenzhen", "China"), ("Ningbo", "China"),
    ("Singapore", "Singapore"), ("Busan", "South Korea"), ("Tokyo", "Japan"),
    ("Los Angeles", "USA"), ("Long Beach", "USA"), ("New York", "USA"),
    ("Savannah", "USA"), ("Vancouver", "Canada"), ("Santos", "Brazil"),
    ("Mumbai", "India"), ("Chennai", "India"), ("Jebel Ali", "UAE"),
    ("Felixstowe", "UK"), ("Valencia", "Spain"), ("Piraeus", "Greece"),
    ("Colombo", "Sri Lanka"), ("Port Klang", "Malaysia"), ("Laem Chabang", "Thailand"),
    ("Durban", "South Africa"), ("Sydney", "Australia"), ("Manzanillo", "Mexico"),
    ("Genoa", "Italy"), ("Le Havre", "France"), ("Ho Chi Minh City", "Vietnam"),
]

# Kis layer ke nodes kis region mein zyada hote hain (relative weights)
REGION_WEIGHTS = {
    "Supplier": {"Asia": 6, "Europe": 2, "North America": 1, "South America": 1,
                 "Africa": 0.5, "Middle East": 0.5, "Oceania": 0.2},
    "Manufacturer": {"Asia": 5, "Europe": 3, "North America": 2, "South America": 0.5,
                     "Middle East": 0.3, "Africa": 0.2, "Oceania": 0.2},
    "Warehouse": {"North America": 4, "Europe": 4, "Asia": 3, "Middle East": 1,
                  "South America": 1, "Oceania": 0.5, "Africa": 0.5},
    "Retailer": {"North America": 5, "Europe": 4, "Asia": 3, "South America": 1,
                 "Oceania": 1, "Middle East": 0.5, "Africa": 0.5},
}

LEAD_RANGE = {"sea": (10, 35), "air": (2, 6), "rail": (4, 14), "road": (1, 7)}  # din


def make_nodes(n, rng):
    """n nodes banao: Supplier 30%, Manufacturer 20%, Port 10%, Warehouse 17%, baaki Retailer."""
    counts = {"Supplier": int(n * 0.30), "Manufacturer": int(n * 0.20),
              "Port": int(n * 0.10), "Warehouse": int(n * 0.17)}
    counts["Retailer"] = n - sum(counts.values())

    rows = []
    for t in LAYERS:
        for i in range(1, counts[t] + 1):
            node_id = f"{PREFIX[t]}{i:04d}"
            if t == "Port":
                port, country = PORTS[(i - 1) % len(PORTS)]
                round_no = (i - 1) // len(PORTS) + 1          # n bada ho to port repeat hote hain
                name = f"Port of {port}" + (f" T{round_no}" if round_no > 1 else "")
                region = COUNTRIES[country][0]
                industry = "Logistics"
            else:
                w = REGION_WEIGHTS[t]
                regions = list(w)
                p = np.array([w[r] for r in regions], dtype=float)
                region = str(rng.choice(regions, p=p / p.sum()))
                country = str(rng.choice([c for c, (r, _) in COUNTRIES.items() if r == region]))
                city = str(rng.choice(COUNTRIES[country][1]))
                name = f"{city} {rng.choice(NAME_WORD[t])} {node_id}"
                industry = str(rng.choice(INDUSTRIES))
            rows.append({
                "node_id": node_id, "name": name, "node_type": t,
                "country": country, "region": region, "industry": industry,
                "risk_score": 0.0,                 # NLP (Stage 6) isse update karega
                "data_source": "SYNTHETIC",
            })
    return pd.DataFrame(rows)


def pick_route(a, b, rng):
    """Route type: sea / air / rail / road (simple rules)."""
    same_country = a["country"] == b["country"]
    same_region = a["region"] == b["region"]
    if a["node_type"] == "Port" and b["node_type"] == "Port":
        return "sea"
    if "Port" in (a["node_type"], b["node_type"]) and not same_region:
        return "sea" if rng.random() < 0.85 else "air"
    if same_country:
        return "road" if rng.random() < 0.7 else "rail"
    if same_region:
        return "road" if rng.random() < 0.5 else "rail"
    return "sea" if rng.random() < 0.6 else "air"


def make_edges(nodes, rng):
    """Har layer ke nodes agli layer ke 1-3 nodes se judte hain + kuch port-to-port edges."""
    recs = {t: nodes[nodes["node_type"] == t].to_dict("records") for t in LAYERS}
    pairs, edges = set(), []

    def add(a, b):
        key = (a["node_id"], b["node_id"])
        if a["node_id"] == b["node_id"] or key in pairs:
            return
        pairs.add(key)
        route = pick_route(a, b, rng)
        lo, hi = LEAD_RANGE[route]
        edges.append({
            "source": a["node_id"], "target": b["node_id"], "route_type": route,
            "lead_time_days": round(float(rng.uniform(lo, hi)), 1),
            "capacity": max(50, int(rng.lognormal(6.5, 0.6))),   # units per week
            "data_source": "SYNTHETIC",
        })

    for upper, lower in zip(LAYERS[:-1], LAYERS[1:]):
        parents, children = recs[upper], recs[lower]
        for p in parents:                                   # har parent 1-3 children se
            k = min(int(rng.integers(1, 4)), len(children))
            for idx in rng.choice(len(children), size=k, replace=False):
                add(p, children[idx])
        has_parent = {b for (_, b) in pairs}                # koi child orphan na rahe
        for c in children:
            if c["node_id"] not in has_parent:
                add(parents[int(rng.integers(len(parents)))], c)

    ports = recs["Port"]                                     # transshipment: port -> port
    for idx in rng.choice(len(ports), size=max(1, len(ports) // 6), replace=False):
        add(ports[idx], ports[int(rng.integers(len(ports)))])

    return pd.DataFrame(edges)


def make_dirty(nodes, edges, rng):
    """DEMO ke liye jaanbujhkar kharaab data: nulls, duplicates, ghost edges."""
    nodes, edges = nodes.copy(), edges.copy()
    for col in ["country", "industry"]:
        idx = rng.choice(nodes.index, size=max(1, int(len(nodes) * 0.03)), replace=False)
        nodes.loc[idx, col] = np.nan
    for col in ["lead_time_days", "capacity"]:
        idx = rng.choice(edges.index, size=max(1, int(len(edges) * 0.03)), replace=False)
        edges.loc[idx, col] = np.nan
    bad_node = pd.DataFrame([{"node_id": np.nan, "name": "No ID", "node_type": "Port"}])
    nodes = pd.concat([nodes, nodes.sample(2, random_state=1), bad_node], ignore_index=True)
    ghost = pd.DataFrame([{"source": "S0001", "target": "X9999", "route_type": "sea"}])
    edges = pd.concat([edges, ghost, edges.sample(2, random_state=1)], ignore_index=True)
    return nodes, edges


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=300, help="total nodes (50 se upar)")
    ap.add_argument("--seed", type=int, default=42, help="same seed = same graph")
    ap.add_argument("--out-dir", default=None, help="default: data/raw")
    ap.add_argument("--dirty", action="store_true", help="nulls/duplicates daalo (cleaning demo)")
    a = ap.parse_args()
    if a.n < 50:
        raise SystemExit("--n kam se kam 50 rakho")

    rng = np.random.default_rng(a.seed)
    nodes = make_nodes(a.n, rng)
    edges = make_edges(nodes, rng)
    if a.dirty:
        nodes, edges = make_dirty(nodes, edges, rng)

    out = Path(a.out_dir) if a.out_dir else ROOT / "data" / "raw"
    out.mkdir(parents=True, exist_ok=True)
    nodes.to_csv(out / "nodes.csv", index=False)
    edges.to_csv(out / "edges.csv", index=False)

    print("⚠️  SYNTHETIC / SIMULATED graph generated")
    print(f"Saved in: {out}")
    print(f"Nodes: {len(nodes)}  |  Edges: {len(edges)}")
    print(nodes["node_type"].value_counts().to_string())
    print(edges["route_type"].value_counts().to_string())