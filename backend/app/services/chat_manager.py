"""
WebSocket connection manager with Redis pub/sub fan-out.

Design
──────
- When a message arrives (REST or WS), broadcast() is called.
- broadcast() does TWO things:
  1. Direct fan-out to all WebSocket clients on THIS worker (same process).
  2. PUBLISH to Redis with a worker_id tag, so OTHER workers can fan out
     to their local clients.
- _listen() ignores publishes that originated from this worker (already
  delivered directly), preventing double-send.

This makes the system both fast for single-worker development AND correct
for multi-worker production.
"""
import asyncio
import json
import logging
import os
import uuid
from collections import defaultdict
from typing import Optional

import redis.asyncio as aioredis
from fastapi import WebSocket

from app.core.config import get_settings

logger = logging.getLogger("railgram.chat")
settings = get_settings()

# Channel prefix
_CHAN = "chat:"

# Unique ID for this worker process – used to skip our own Redis echoes.
_WORKER_ID = str(uuid.uuid4())


class ChatManager:
    def __init__(self) -> None:
        # local_connections[conv_id] = set of WebSocket objects (this worker only)
        self.local_connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._pubsub: Optional[aioredis.client.PubSub] = None
        self._listener_task: Optional[asyncio.Task] = None
        self._redis: Optional[aioredis.Redis] = None

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    async def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(settings.redis_url, decode_responses=True)
        return self._redis

    async def _ensure_listener(self) -> None:
        """Start the cross-worker Redis subscriber task, once per worker."""
        if self._listener_task and not self._listener_task.done():
            return
        # Must be called AFTER subscribe() so _pubsub.subscribed is True when
        # the task starts – otherwise the `while self.subscribed:` loop in
        # listen() exits immediately.
        self._listener_task = asyncio.create_task(self._listen())
        await asyncio.sleep(0)  # yield so task reaches its first blocking await

    async def _listen(self) -> None:
        """Relay Redis pub/sub messages from OTHER workers to local WS clients."""
        assert self._pubsub
        try:
            async for raw in self._pubsub.listen():
                if raw["type"] != "message":
                    continue
                channel: str = raw["channel"]
                conv_id = channel[len(_CHAN):]
                try:
                    envelope = json.loads(raw["data"])
                    if envelope.get("_wid") == _WORKER_ID:
                        # Already delivered directly – skip to avoid duplicate.
                        continue
                    data = json.dumps(envelope.get("payload", envelope), default=str)
                except Exception:
                    data = raw["data"]

                clients = self.local_connections.get(conv_id, set())
                dead: list[WebSocket] = []
                for ws in list(clients):
                    try:
                        await ws.send_text(data)
                    except Exception:
                        dead.append(ws)
                for ws in dead:
                    clients.discard(ws)
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.warning("chat _listen() crashed: %s", exc)

    async def close(self) -> None:
        if self._listener_task:
            self._listener_task.cancel()
        if self._pubsub:
            await self._pubsub.aclose()
        if self._redis:
            await self._redis.aclose()

    # ── Public API ────────────────────────────────────────────────────────────

    async def connect(self, ws: WebSocket, conv_id: str) -> None:
        """Accept WebSocket and subscribe the worker to the conversation channel."""
        await ws.accept()
        r = await self._get_redis()
        channel = f"{_CHAN}{conv_id}"
        if self._pubsub is None:
            self._pubsub = r.pubsub()
        # Subscribe on first local connection for this conv
        if not self.local_connections[conv_id]:
            await self._pubsub.subscribe(channel)
        self.local_connections[conv_id].add(ws)
        # Start cross-worker listener AFTER subscribing so subscribed == True
        await self._ensure_listener()
        logger.debug("WS connect conv=%s total=%d", conv_id, len(self.local_connections[conv_id]))

    def disconnect(self, ws: WebSocket, conv_id: str) -> None:
        self.local_connections[conv_id].discard(ws)
        logger.debug("WS disconnect conv=%s remaining=%d", conv_id, len(self.local_connections[conv_id]))

    async def broadcast_except(self, conv_id: str, exclude_ws: WebSocket, payload: dict) -> None:
        """Broadcast to all local clients EXCEPT the given WebSocket (no Redis cross-worker for typing)."""
        serialized = json.dumps(payload, default=str)
        clients = self.local_connections.get(conv_id, set())
        dead: list[WebSocket] = []
        for ws in list(clients):
            if ws is exclude_ws:
                continue
            try:
                await ws.send_text(serialized)
            except Exception:
                dead.append(ws)
        for ws in dead:
            clients.discard(ws)

    async def broadcast(self, conv_id: str, payload: dict) -> None:
        """
        Deliver payload to all connected clients.

        Strategy:
        - Direct send to every WebSocket on THIS worker (fast, no latency).
        - Also publish to Redis so OTHER workers relay it to their own clients.
          The envelope includes _wid (worker ID) so receivers skip it if the
          message was already delivered directly above.
        """
        serialized = json.dumps(payload, default=str)

        # 1. Direct fan-out to same-worker connections
        clients = self.local_connections.get(conv_id, set())
        dead: list[WebSocket] = []
        for ws in list(clients):
            try:
                await ws.send_text(serialized)
            except Exception:
                dead.append(ws)
        for ws in dead:
            clients.discard(ws)

        # 2. Cross-worker publish (envelope carries worker ID to avoid re-delivery)
        r = await self._get_redis()
        envelope = json.dumps({"_wid": _WORKER_ID, "payload": payload}, default=str)
        await r.publish(f"{_CHAN}{conv_id}", envelope)



# Module-level singleton — shared across the process
chat_manager = ChatManager()
