"""WebSocket メッセージの検証と Durable Object の保存キー生成。"""

from __future__ import annotations

import json
from typing import Literal, TypedDict

GRID_SIZE = 128


class Cell(TypedDict):
    x: int
    y: int
    color: str
    updatedAt: int


class DrawMessage(TypedDict):
    type: Literal["draw"]
    x: int
    y: int
    color: str


class ClearMessage(TypedDict):
    type: Literal["clear"]


class SnapshotMessage(TypedDict):
    type: Literal["snapshot"]
    cells: list[Cell]
    clearedAt: int


ClientMessage = DrawMessage | ClearMessage


def parse_client_message(value: str) -> ClientMessage | None:
    """正しいクライアントメッセージだけを返し、その他の入力は捨てる。"""

    try:
        candidate = json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return None

    if not isinstance(candidate, dict):
        return None

    message_type = candidate.get("type")
    if message_type == "clear":
        return {"type": "clear"}
    if message_type != "draw":
        return None

    x = candidate.get("x")
    y = candidate.get("y")
    color = candidate.get("color")

    # bool は int の派生型なので、JS の Number.isInteger と同じになるよう除外する。
    if type(x) is not int or type(y) is not int:
        return None
    if not (0 <= x < GRID_SIZE and 0 <= y < GRID_SIZE):
        return None
    if not isinstance(color, str) or not color:
        return None

    return {"type": "draw", "x": x, "y": y, "color": color}


def cell_storage_key(x: int, y: int) -> str:
    """行、列の順で辞書順にも並ぶセル保存キーを返す。"""

    return f"cell:{y:03d}:{x:03d}"
