r"""
ws_client_test.py  -  WebSocket test client.
Run (API chalu rakhke):  python backend\tests\ws_client_test.py
Phir doosre terminal se POST /events bhejo, yahan live message aayega.
"""
import asyncio
import json

import websockets


async def main():
    async with websockets.connect("ws://127.0.0.1:8000/ws") as ws:
        print("Connected:", json.loads(await ws.recv()))
        print("Ab doosre terminal se POST /events bhejo. Ctrl+C se band karo.")
        while True:
            msg = json.loads(await ws.recv())
            if msg.get("type") == "prediction":
                print(f"\nLIVE: {msg['event']['headline']!r} | origin {msg['event']['origin_name']} "
                      f"| severity {msg['event']['severity']} | {len(msg['nodes'])} nodes affected")
                for n in msg["nodes"][:3]:
                    print(f"   {n['name']}: 90d delay {n['delay_90d']} din, at_risk={n['at_risk']}")
            else:
                print(msg)


asyncio.run(main())