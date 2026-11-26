r"""
ripple_simulation.py
====================
⚠️ SYNTHETIC / SIMULATED.
Ye ek simple RULE-BASED simulation hai, real supply chain ka model nahi.
GNN ke delay labels isi rule se bante hain, isliye metrics ka matlab hai
"GNN is rule ko kitna seekh paya", real-world accuracy nahi.

Rule:
  delay(v, H) = max over origins o of  d0(o) * attenuation(path o -> v)
  (sirf tab jab disruption ke pahunchne ka time <= H din)
  path = sabse kam lead time wala raasta.

Run demo:  python backend\scripts\ripple_simulation.py
"""
import networkx as nx
import numpy as np

from data_loader import load_data

# ---- Simulation ke parameters (sab ek jagah: report mein yahi likhna) ----
MAX_ORIGIN_DELAY_DAYS = 60.0          # severity 1.0 par origin par itne din ki delay
HOP_TRANSMISSION = 0.85               # har edge par disruption 85% aage jaati hai
TARGET_BUFFER = {                     # node type kitna absorb karta hai (1.0 = bilkul nahi)
    "Supplier": 0.90, "Manufacturer": 0.90, "Port": 0.95,
    "Warehouse": 0.70, "Retailer": 0.80,
}
HORIZONS = (30, 60, 90)               # din
NOISE_SIGMA = 0.05                    # chhota random noise (lognormal)
ORIGIN_TYPE_WEIGHTS = {"Port": 0.40, "Supplier": 0.35, "Manufacturer": 0.25}

PARAMS = {
    "max_origin_delay_days": MAX_ORIGIN_DELAY_DAYS,
    "hop_transmission": HOP_TRANSMISSION,
    "target_buffer": TARGET_BUFFER,
    "horizons_days": list(HORIZONS),
    "noise_sigma": NOISE_SIGMA,
    "origin_type_weights": ORIGIN_TYPE_WEIGHTS,
    "rule": "delay(v,H)=max_o d0(o)*attenuation(shortest-lead-time path o->v) if arrival<=H",
}


def build_graph(nodes, edges):
    """DataFrame se NetworkX directed graph (supplier -> customer)."""
    G = nx.DiGraph()
    for r in nodes.itertuples(index=False):
        G.add_node(r.node_id, node_type=r.node_type)
    for r in edges.itertuples(index=False):
        G.add_edge(r.source, r.target,
                   lead_time_days=float(r.lead_time_days), capacity=float(r.capacity))
    return G


def precompute_reach(G):
    """
    Har node ko origin maanke: baaki nodes tak pahunchne ka time aur kamzori (attenuation).
    Ek baar nikal lete hain, phir har scenario mein dobara nahi nikalna padta (tez).
    reach[origin][node] = (arrival_days, attenuation)
    """
    reach = {}
    for origin in G.nodes:
        # Dijkstra: lead_time ke hisaab se sabse jaldi pahunchne wala raasta
        dist, paths = nx.single_source_dijkstra(G, origin, weight="lead_time_days")
        info = {}
        for v, path in paths.items():
            atten = 1.0
            for _, w in zip(path[:-1], path[1:]):          # path ke har edge (u -> w) par
                atten *= HOP_TRANSMISSION * TARGET_BUFFER.get(G.nodes[w]["node_type"], 0.90)
            info[v] = (dist[v], atten)
        reach[origin] = info
    return reach


def sample_origins(rng, ids_by_type):
    """1 se 3 random origin nodes aur unki severity (0.3 se 1.0)."""
    available = {t: w for t, w in ORIGIN_TYPE_WEIGHTS.items() if ids_by_type.get(t)}
    if not available:                                      # dusre dataset (types alag) ke liye
        available = {"__any__": 1.0}
    types = list(available)
    p = np.array([available[t] for t in types], dtype=float)
    p = p / p.sum()

    k = int(rng.choice([1, 2, 3], p=[0.6, 0.3, 0.1]))
    origins = []
    for _ in range(50):                                    # duplicate se bachne ke liye retry
        if len(origins) == k:
            break
        t = str(rng.choice(types, p=p))
        cand = str(rng.choice(ids_by_type[t]))
        if cand not in origins:
            origins.append(cand)
    severities = [float(rng.uniform(0.3, 1.0)) for _ in origins]
    return origins, severities


def simulate_scenario(reach, origins, severities, node_index, n_nodes, rng):
    """Ek scenario ke liye har node ki delay (days) 30/60/90 horizon par. Shape: (N, 3)."""
    y = np.zeros((n_nodes, len(HORIZONS)), dtype=np.float32)
    for origin, sev in zip(origins, severities):
        d0 = sev * MAX_ORIGIN_DELAY_DAYS
        for v, (arrival, atten) in reach[origin].items():
            delay = d0 * atten
            i = node_index[v]
            for h_idx, H in enumerate(HORIZONS):
                if arrival <= H and delay > y[i, h_idx]:   # sabse badi delay rakho
                    y[i, h_idx] = delay
    # Ek node ka noise teeno horizons par same, taaki 30 <= 60 <= 90 bana rahe
    noise = rng.lognormal(0.0, NOISE_SIGMA, size=(n_nodes, 1)).astype(np.float32)
    return y * noise


if __name__ == "__main__":
    nodes, edges, _ = load_data(save=False)                # data\raw se, loader ke through
    G = build_graph(nodes, edges)
    reach = precompute_reach(G)

    node_ids = nodes["node_id"].tolist()
    node_index = {nid: i for i, nid in enumerate(node_ids)}
    names = nodes.set_index("node_id")["name"]
    ports = nodes.loc[nodes["node_type"] == "Port", "node_id"].tolist()
    origin = ports[0] if ports else node_ids[0]

    rng = np.random.default_rng(0)
    y = simulate_scenario(reach, [origin], [0.8], node_index, len(node_ids), rng)

    print("⚠️  SYNTHETIC / SIMULATED ripple demo")
    print(f"Origin: {origin} ({names[origin]}), severity 0.8")
    for h_idx, H in enumerate(HORIZONS):
        print(f"  {H} din ke andar: {int((y[:, h_idx] > 0).sum())} nodes affected")
    print("90 din par sabse zyada delay wale 5 nodes:")
    for i in np.argsort(-y[:, 2])[:5]:
        print(f"  {node_ids[i]}  {names[node_ids[i]]:<40} {y[i, 2]:.1f} din")