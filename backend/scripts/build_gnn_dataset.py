r"""
build_gnn_dataset.py
====================
⚠️ SYNTHETIC / SIMULATED. Labels ripple_simulation.py ke rule se bane hain.

Har SCENARIO = ek "news event" (1 se 3 disrupted origin nodes).
  x : har node ke features   -> (scenarios, nodes, features)
  y : har node ki delay days -> (scenarios, nodes, 3)   [30, 60, 90 din]
Graph (edge_index) sab scenarios ke liye same hai, sirf x aur y badalte hain.

Run:  python backend\scripts\build_gnn_dataset.py --scenarios 500
"""
import argparse
import json

import numpy as np

from data_loader import ROOT, load_data, read_yaml
from ripple_simulation import (HORIZONS, PARAMS, build_graph, precompute_reach,
                               sample_origins, simulate_scenario)


def static_features(nodes, edges, types, node_index):
    """Har node ke wo features jo scenario se nahi badalte (type, connections, lead time...)."""
    n = len(nodes)

    onehot = np.zeros((n, len(types)), dtype=np.float32)          # node type: 0/1 columns
    for nid, t in zip(nodes["node_id"], nodes["node_type"]):
        onehot[node_index[nid], types.index(t)] = 1.0

    in_deg, out_deg = np.zeros(n), np.zeros(n)
    lead_sum, cap_sum = np.zeros(n), np.zeros(n)
    for s, t, lt, cap in zip(edges["source"], edges["target"],
                             edges["lead_time_days"], edges["capacity"]):
        i, j = node_index[s], node_index[t]
        out_deg[i] += 1
        in_deg[j] += 1
        lead_sum[j] += lt
        cap_sum[j] += cap

    # aane wali edges ka average (jinki koi aane wali edge nahi, unka 0)
    mean_lead = np.divide(lead_sum, in_deg, out=np.zeros(n), where=in_deg > 0)
    mean_cap = np.divide(cap_sum, in_deg, out=np.zeros(n), where=in_deg > 0)
    log_cap = np.log1p(mean_cap)

    cols = [
        in_deg / max(in_deg.max(), 1.0),
        out_deg / max(out_deg.max(), 1.0),
        mean_lead / max(mean_lead.max(), 1e-9),
        log_cap / max(log_cap.max(), 1e-9),
        nodes["risk_score"].astype(float).to_numpy(),
    ]
    return np.concatenate([onehot, np.stack(cols, axis=1).astype(np.float32)], axis=1)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--scenarios", type=int, default=500)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--in-dir", default=None, help="default: data/raw")
    a = ap.parse_args()

    nodes, edges, _ = load_data(a.in_dir, save=False)             # loader ke through (clean data)
    types = read_yaml("schema.yaml")["nodes"]["node_type"]["allowed"]
    node_ids = nodes["node_id"].tolist()
    node_index = {nid: i for i, nid in enumerate(node_ids)}
    N, E = len(nodes), len(edges)

    G = build_graph(nodes, edges)
    reach = precompute_reach(G)
    static = static_features(nodes, edges, types, node_index)
    ids_by_type = nodes.groupby("node_type")["node_id"].apply(list).to_dict()
    ids_by_type["__any__"] = node_ids

    feature_names = (["origin_severity"] + [f"is_{t}" for t in types] +
                     ["in_degree_norm", "out_degree_norm", "mean_in_lead_time_norm",
                      "log_mean_in_capacity_norm", "risk_score"])
    assert len(feature_names) == 1 + static.shape[1], "feature names aur columns match nahi"

    rng = np.random.default_rng(a.seed)
    S = a.scenarios
    x = np.zeros((S, N, len(feature_names)), dtype=np.float32)
    y = np.zeros((S, N, len(HORIZONS)), dtype=np.float32)
    x[:, :, 1:] = static                                          # static features sab scenarios mein

    for s in range(S):
        origins, sev = sample_origins(rng, ids_by_type)
        for o, v in zip(origins, sev):
            x[s, node_index[o], 0] = max(x[s, node_index[o], 0], v)   # origin_severity
        y[s] = simulate_scenario(reach, origins, sev, node_index, N, rng)

    # Train / val / test split SCENARIO ke hisaab se (test ke scenarios train mein kabhi nahi)
    perm = rng.permutation(S)
    n_tr, n_va = int(0.70 * S), int(0.15 * S)
    split = np.zeros(S, dtype=np.int8)                            # 0=train 1=val 2=test
    split[perm[n_tr:n_tr + n_va]] = 1
    split[perm[n_tr + n_va:]] = 2

    edge_index = np.array([[node_index[s] for s in edges["source"]],
                           [node_index[t] for t in edges["target"]]], dtype=np.int64)
    lt = edges["lead_time_days"].to_numpy(dtype=float)
    cp = np.log1p(edges["capacity"].to_numpy(dtype=float))
    edge_attr = np.stack([lt / max(lt.max(), 1e-9), cp / max(cp.max(), 1e-9)], axis=1).astype(np.float32)

    meta = {
        "data_label": "SYNTHETIC / SIMULATED (delay labels ripple rule se bane hain)",
        "seed": a.seed, "scenarios": S, "n_nodes": N, "n_edges": E,
        "horizons_days": list(HORIZONS), "ripple_params": PARAMS,
    }
    out = ROOT / "data" / "processed" / "gnn_dataset.npz"
    out.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        out, x=x, y=y, edge_index=edge_index, edge_attr=edge_attr, split=split,
        node_ids=np.array(node_ids), node_types=np.array(nodes["node_type"].tolist()),
        feature_names=np.array(feature_names),
        target_names=np.array([f"delay_{h}d" for h in HORIZONS]),
        meta=np.array(json.dumps(meta)),
    )

    # ---- Sanity checks aur summary ----
    ok = bool((y[:, :, 0] <= y[:, :, 1] + 1e-4).all() and (y[:, :, 1] <= y[:, :, 2] + 1e-4).all())
    print("⚠️  SYNTHETIC / SIMULATED GNN dataset ban gaya")
    print(f"Saved: {out}")
    print(f"x: {x.shape}  y: {y.shape}  edge_index: {edge_index.shape}")
    print(f"Split (train/val/test scenarios): {int((split == 0).sum())}/{int((split == 1).sum())}/{int((split == 2).sum())}")
    print(f"Sanity: delay 30 <= 60 <= 90 din: {'OK' if ok else 'GADBAD, check karo'}")
    for h_idx, H in enumerate(HORIZONS):
        v = y[:, :, h_idx]
        aff = v[v > 0]
        share = 100.0 * (v > 0).mean()
        mean_aff = aff.mean() if aff.size else 0.0
        print(f"  {H}d: affected node-scenario pairs {share:.1f}% | affected nodes ki avg delay {mean_aff:.1f} din")