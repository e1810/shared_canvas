"""共有キャンバス用 Cloudflare Python Worker と Durable Object。"""

from __future__ import annotations

import json
import time
from urllib.parse import urlparse

from js import WebSocketPair
from workers import DurableObject, Response, WorkerEntrypoint

from protocol import Cell, SnapshotMessage, cell_storage_key, parse_draw_message

GLOBAL_CANVAS_NAME = "global"
CELL_KEY_PREFIX = "cell:"


class CanvasDurableObject(DurableObject):
    """キャンバス状態と接続中の WebSocket を一つの場所で調停する。"""

    async def fetch(self, request):
        upgrade = request.headers.get("Upgrade")
        if not upgrade or upgrade.lower() != "websocket":
            return Response("Expected a WebSocket upgrade", status=426)

        client, server = WebSocketPair.new().object_values()
        self.ctx.acceptWebSocket(server)

        # Storage API の Map は workers-runtime-sdk により dict へ変換される。
        # TypeScript 版と同じキーを読むため、既存の保存状態も引き継げる。
        stored_cells = await self.ctx.storage.list({"prefix": CELL_KEY_PREFIX})
        snapshot: SnapshotMessage = {
            "type": "snapshot",
            "cells": list(stored_cells.values()),
        }
        server.send(json.dumps(snapshot, separators=(",", ":")))

        return Response(None, status=101, web_socket=client)

    async def webSocketMessage(self, _socket, message):
        if not isinstance(message, str):
            return

        incoming = parse_draw_message(message)
        if incoming is None:
            return

        updated_at = time.time_ns() // 1_000_000
        outgoing = {
            "type": "draw",
            "x": incoming["x"],
            "y": incoming["y"],
            "color": incoming["color"],
            "updatedAt": updated_at,
        }
        cell: Cell = {
            "x": outgoing["x"],
            "y": outgoing["y"],
            "color": outgoing["color"],
            "updatedAt": updated_at,
        }

        # 永続化が成功してから配信し、再接続時の snapshot と矛盾させない。
        await self.ctx.storage.put(cell_storage_key(cell["x"], cell["y"]), cell)

        payload = json.dumps(outgoing, separators=(",", ":"))
        for socket in self.ctx.getWebSockets():
            try:
                socket.send(payload)
            except Exception:
                # 一つの切断済み接続が、他クライアントへの配信を妨げないようにする。
                pass

    async def webSocketError(self, socket, _error):
        socket.close(1011, "WebSocket error")

    async def webSocketClose(self, _socket, _code, _reason, _was_clean):
        # 互換日付2026-04-07以降はruntimeがClose応答を自動化するが、
        # Python runtimeが配送するイベントの受け口としてhandlerは定義しておく。
        pass


class Default(WorkerEntrypoint):
    """HTTP リクエストを Assets または Durable Object へ振り分ける入口。"""

    async def fetch(self, request):
        if urlparse(request.url).path == "/ws":
            if request.method != "GET":
                return Response(
                    "Method Not Allowed",
                    status=405,
                    headers={"Allow": "GET"},
                )

            stub = self.env.CANVAS.getByName(GLOBAL_CANVAS_NAME)
            return await stub.fetch(request)

        return await self.env.ASSETS.fetch(request)
