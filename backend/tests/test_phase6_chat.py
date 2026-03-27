"""Phase 6 – Chat smoke test"""
import asyncio
import json
import uuid
import httpx
import websockets

BASE = "http://localhost:8000/api/v1"

USERS = [
    {"username": "railfan_chat1", "email": "chat1@test.com", "password": "Test1234!", "display_name": "Chatter One"},
    {"username": "railfan_chat2", "email": "chat2@test.com", "password": "Test1234!", "display_name": "Chatter Two"},
]


async def register_or_login(client: httpx.AsyncClient, u: dict) -> str:
    r = await client.post(f"{BASE}/auth/register", json=u)
    if r.status_code in (200, 201, 409):
        r2 = await client.post(f"{BASE}/auth/login", json={"email": u["email"], "password": u["password"]})
        r2.raise_for_status()
        return r2.json()["access_token"]
    r.raise_for_status()
    return r.json()["access_token"]


async def main():
    async with httpx.AsyncClient() as client:
        tokens = []
        for u in USERS:
            tok = await register_or_login(client, u)
            tokens.append(tok)
            print(f"  Logged in {u['username']}")

        headers1 = {"Authorization": f"Bearer {tokens[0]}"}
        headers2 = {"Authorization": f"Bearer {tokens[1]}"}

        # 1 ── Create DM
        r = await client.post(
            f"{BASE}/conversations",
            params={"target_username": USERS[1]["username"]},
            headers=headers1,
        )
        r.raise_for_status()
        conv = r.json()
        conv_id = conv["id"]
        print(f"  DM created: conv_id={conv_id}")

        # 2 ── List conversations
        r = await client.get(f"{BASE}/conversations", headers=headers1)
        r.raise_for_status()
        convs = r.json()
        assert len(convs) >= 1, f"Expected >=1 conv, got {len(convs)}"
        print(f"  List conversations OK: {len(convs)} found")

        # 3 ── Send a REST message
        r = await client.post(
            f"{BASE}/conversations/{conv_id}/messages",
            json={"msg_type": "text", "body": "Hello from REST!"},
            headers=headers1,
        )
        r.raise_for_status()
        msg = r.json()
        assert msg["body"] == "Hello from REST!"
        print(f"  Send REST message OK: msg_id={msg['id']}")

        # 4 ── Fetch message history
        r = await client.get(
            f"{BASE}/conversations/{conv_id}/messages",
            headers=headers1,
        )
        r.raise_for_status()
        history = r.json()
        assert len(history["messages"]) >= 1
        print(f"  Get messages OK: {len(history['messages'])} messages")

        # 5 ── Mark as read
        r = await client.post(f"{BASE}/conversations/{conv_id}/read", headers=headers2)
        assert r.status_code == 204
        print(f"  Mark read OK")

        # 6 ── WebSocket round-trip
        ws_url = f"ws://localhost:8000/api/v1/ws/conversations/{conv_id}?token={tokens[1]}"
        async with websockets.connect(ws_url) as ws1:
            # Send ping → expect pong
            await ws1.send(json.dumps({"type": "ping"}))
            pong = json.loads(await asyncio.wait_for(ws1.recv(), timeout=5))
            assert pong["type"] == "pong", f"unexpected: {pong}"
            print(f"  WS ping/pong OK")

            # Send a message via WS with second client connected on same conv
            ws_url2 = f"ws://localhost:8000/api/v1/ws/conversations/{conv_id}?token={tokens[0]}"
            async with websockets.connect(ws_url2) as ws2:
                await ws2.send(json.dumps({"type": "message", "msg_type": "text", "body": "Hello from WebSocket!"}))
                # Both sockets should receive it
                msg1 = json.loads(await asyncio.wait_for(ws1.recv(), timeout=5))
                msg2 = json.loads(await asyncio.wait_for(ws2.recv(), timeout=5))
                assert msg1["type"] == "message"
                assert msg1["data"]["body"] == "Hello from WebSocket!"
                assert msg2["type"] == "message"
                print(f"  WS broadcast OK (both clients received message)")

    print("\n✅ Phase 6 smoke tests PASSED")


if __name__ == "__main__":
    asyncio.run(main())
