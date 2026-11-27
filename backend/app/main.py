r"""
main.py  -  AtmoGraph FastAPI backend
=====================================
⚠️ Data SYNTHETIC / SIMULATED. Predictions "pre-computed" hain (Colab mein GNN se).

Run:   cd D:\AtmoGraph
       uvicorn backend.app.main:app --reload --port 8000
Docs:  http://127.0.0.1:8000/docs
"""
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend" / "scripts"))          # ripple_simulation import ke liye
from ripple_simulation import (HORIZONS, MAX_ORIGIN_DELAY_DAYS,   # noqa: E402
                               build_graph, precompute_reach)

load_dotenv(ROOT / "backend" / ".env")
DATA_LABEL = "SYNTHETIC / SIMULATED"
AT_RISK_DAYS = 10.0        # delay_90d is se zyada ho to "at_risk" (sirf display ka threshold)

# ---------- Data (loader ne jo clean CSV banayi, wahi padhte hain) ----------
nodes = pd.read_csv(ROOT / "data" / "processed" / "nodes_clean.csv")
edges = pd.read_csv(ROOT / "data" / "processed" / "edges_clean.csv")
node_ids = nodes["node_id"].tolist()
idx = {n: i for i, n in enumerate(node_ids)}
N = len(node_ids)
node_info = nodes.set_index("node_id")[["name", "node_type"]].to_dict("index")

reach = precompute_reach(build_graph(nodes, edges))             # rule-based ripple ke liye

# ---------- Pre-computed GNN predictions ----------
PRE_PATH = ROOT / "backend" / "models" / "precomputed_predictions.npz"
pre = None
if PRE_PATH.exists():
    _d = np.load(PRE_PATH)
    pre = {"pred": _d["pred"], "grid": np.concatenate([[0.0], _d["severities"]]),
           "origins": [str(o) for o in _d["origin_ids"]],
           "meta": json.loads(str(_d["meta"]))}
    if [str(n) for n in _d["node_ids"]] != node_ids:
        raise RuntimeError("Node order match nahi: data_loader.py aur build_gnn_dataset.py "
                           "dobara chalao, phir Colab Cell 9 dobara.")
    origin_index = {o: i for i, o in enumerate(pre["origins"])}


def records(df):
    return json.loads(df.to_json(orient="records"))             # numpy types se bachne ke liye


def to_nodes(y, min_delay=0.5):
    """(N,3) delay array -> sirf affected nodes ki list (sabse zyada delay pehle)."""
    out = []
    for i in np.where(y.max(axis=1) >= min_delay)[0]:
        nid = node_ids[i]
        out.append({"node_id": nid, "name": node_info[nid]["name"],
                    "node_type": node_info[nid]["node_type"],
                    "delay_30d": round(float(y[i, 0]), 1), "delay_60d": round(float(y[i, 1]), 1),
                    "delay_90d": round(float(y[i, 2]), 1), "at_risk": bool(y[i, 2] >= AT_RISK_DAYS)})
    out.sort(key=lambda r: -r["delay_90d"])
    return out


def rule_based(origins, severities):
    """Ripple rule seedha chalao (noise ke bina). GNN nahi, exact rule."""
    y = np.zeros((N, len(HORIZONS)), dtype=np.float32)
    for o, sev in zip(origins, severities):
        d0 = sev * MAX_ORIGIN_DELAY_DAYS
        for v, (arrival, atten) in reach[o].items():
            for h, H in enumerate(HORIZONS):
                if arrival <= H:
                    y[idx[v], h] = max(y[idx[v], h], d0 * atten)
    return y


def gnn_lookup(origin, severity):
    """Severity grid ke beech linear interpolation (0 par delay 0 maanke)."""
    arr = pre["pred"][origin_index[origin]]                     # (n_sev, N, 3)
    arr = np.concatenate([np.zeros((1,) + arr.shape[1:], dtype=arr.dtype), arr], axis=0)
    g = pre["grid"]
    k = min(int(np.searchsorted(g, severity, side="right")) - 1, len(g) - 2)
    t = (severity - g[k]) / (g[k + 1] - g[k])
    return arr[k] * (1 - t) + arr[k + 1] * t


def make_prediction(origin, severity, headline="", min_delay=0.5):
    if origin not in idx:
        raise HTTPException(404, f"Unknown node_id: {origin}")
    if not 0.0 <= severity <= 1.0:
        raise HTTPException(422, "severity 0 se 1 ke beech honi chahiye")
    if pre is None:
        raise HTTPException(503, "backend/models/precomputed_predictions.npz nahi mili")
    return {"type": "prediction", "data_label": DATA_LABEL,
            "source": "pre-computed GNN predictions (severity grid par interpolation)",
            "model": pre["meta"].get("model_name"),
            "event": {"origin": origin, "origin_name": node_info[origin]["name"],
                      "severity": severity, "headline": headline,
                      "time": datetime.now(timezone.utc).isoformat()},
            "horizons_days": list(HORIZONS),
            "nodes": to_nodes(gnn_lookup(origin, severity), min_delay)}


# ---------- Request ke models (Pydantic) ----------
class Origin(BaseModel):
    node_id: str
    severity: float = Field(0.7, ge=0.0, le=1.0)


class RippleRequest(BaseModel):
    origins: list[Origin] = Field(min_length=1, max_length=3)


class EventRequest(BaseModel):
    origin: str
    severity: float = Field(0.7, ge=0.0, le=1.0)
    headline: str = ""


# ---------- WebSocket manager: kaun-kaun connected hai ----------
class Manager:
    def __init__(self):
        self.active = []

    async def connect(self, ws):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, message):
        for ws in list(self.active):
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(ws)


manager = Manager()
app = FastAPI(title="AtmoGraph API (SYNTHETIC / SIMULATED data)")
origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])


# ---------- REST endpoints ----------
@app.get("/health")
def health():
    return {"status": "ok", "data_label": DATA_LABEL, "n_nodes": N, "n_edges": len(edges),
            "mode": "precomputed", "predictions_loaded": pre is not None}


@app.get("/nodes")
def get_nodes(node_type: str | None = None):
    df = nodes if node_type is None else nodes[nodes["node_type"] == node_type]
    return records(df)


@app.get("/edges")
def get_edges():
    return records(edges[["source", "target", "route_type", "lead_time_days", "capacity"]])


@app.get("/predict")
def predict(origin: str, severity: float = Query(0.7, ge=0.0, le=1.0),
            min_delay_days: float = 0.5):
    return make_prediction(origin, severity, min_delay=min_delay_days)


@app.post("/simulate-ripple")
def simulate_ripple(req: RippleRequest):
    for o in req.origins:
        if o.node_id not in idx:
            raise HTTPException(404, f"Unknown node_id: {o.node_id}")
    y = rule_based([o.node_id for o in req.origins], [o.severity for o in req.origins])
    return {"type": "ripple", "data_label": DATA_LABEL,
            "source": "rule-based ripple simulation (GNN nahi)",
            "event": {"origins": [o.model_dump() for o in req.origins]},
            "horizons_days": list(HORIZONS), "nodes": to_nodes(y)}


@app.post("/events")
async def post_event(ev: EventRequest):
    """NLP module yahan news ka event bhejega -> sab dashboards ko live push."""
    payload = make_prediction(ev.origin, ev.severity, ev.headline)
    await manager.broadcast(payload)
    return {"broadcast_to": len(manager.active), "affected_nodes": len(payload["nodes"])}


# ---------- WebSocket ----------
@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        await ws.send_json({"type": "hello", "data_label": DATA_LABEL, "message": "connected"})
        while True:
            msg = await ws.receive_json()
            if msg.get("action") == "ping":
                await ws.send_json({"type": "pong"})
            elif msg.get("action") == "predict":
                try:
                    payload = make_prediction(str(msg.get("origin")),
                                              float(msg.get("severity", 0.7)),
                                              str(msg.get("headline", "")))
                except (HTTPException, ValueError) as e:
                    await ws.send_json({"type": "error", "detail": getattr(e, "detail", str(e))})
                    continue
                await manager.broadcast(payload)                # sab connected clients ko
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception:
        manager.disconnect(ws)