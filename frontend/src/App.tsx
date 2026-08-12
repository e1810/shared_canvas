import { useEffect, useRef, useState } from "react";

const GRID_SIZE = 128;
const CANVAS_PX = 512;

type Point = {
  x: number;
  y: number;
};

type Cell = {
  x: number;
  y: number;
  color: string;
  updatedAt: number;
};

type DrawMessage = {
  type: "draw";
  x: number;
  y: number;
  color: string;
  updatedAt?: number;
};

type SnapshotMessage = {
  type: "snapshot";
  cells: Cell[];
};

type ServerMessage = DrawMessage | SnapshotMessage;



export default function App() {
  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [color, setColor] = useState("#ff0000");
  const [, setConnected] = useState(false);

  useEffect(() => {
    function drawCell(x: number, y: number, color: string) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const cellSize = CANVAS_PX / GRID_SIZE;

      ctx.fillStyle = color;
      ctx.fillRect(
        x * cellSize,
        y * cellSize,
        cellSize,
        cellSize
      );
    }

    function drawSnapshot(cells: Cell[]) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const cell of cells) {
        drawCell(cell.x, cell.y, cell.color);
      }
    }

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected");
      setConnected(true);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data) as ServerMessage;

      switch (msg.type) {
        case "snapshot":
          drawSnapshot(msg.cells);
          break;

        case "draw":
          drawCell(msg.x, msg.y, msg.color);
          break;
      }
    };

    ws.onclose = () => {
      console.log("WebSocket closed");
      setConnected(false);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      ws.close();
    };
  }, []);

  // カーソル操作からメッセージ送信する関数
  const isDrawingRef = useRef(false);
  const lastCellRef = useRef<Point| null>(null);

  function linePoints(from: Point, to: Point): Point[] {
    const points: Point[] = [];

    let x0 = from.x;
    let y0 = from.y;
    const x1 = to.x;
    const y1 = to.y;

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;

    let err = dx - dy;

    while (true) {
      points.push({ x: x0, y: y0 });

      if (x0 === x1 && y0 === y1) {
        break;
      }

      const e2 = 2 * err;

      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }

      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }

    return points;
  }

  function drawAtPointer(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ws = wsRef.current;

    if (!canvas) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const rect = canvas.getBoundingClientRect();

    // セルの座標を計算
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    if (px < 0 || px >= rect.width || py < 0 || py >= rect.height) {
      return;
    }

    const cellSize = CANVAS_PX / GRID_SIZE;

    const currentCell: Point = {
      x: Math.floor(px / cellSize),
      y: Math.floor(py / cellSize)
    };

    // 同じセルならメッセージは送らない
    const lastCell = lastCellRef.current;
    if (lastCell && lastCell.x === currentCell.x && lastCell.y === currentCell.y) {
      return;
    }

    const points =
      lastCell === null ?
        [currentCell] : linePoints(lastCell, currentCell);

    for (const point of points) {
      const msg: DrawMessage = {
        type: "draw",
        x: point.x,
        y: point.y,
        color,
      };

      ws.send(JSON.stringify(msg));
    }
    lastCellRef.current = currentCell;
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    isDrawingRef.current = true;
    lastCellRef.current = null;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawAtPointer(e);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;
    drawAtPointer(e);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    isDrawingRef.current = false;
    lastCellRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  return (
    <div>
      <h1>Shared Canvas</h1>

      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
      />

      <div style={{ marginTop: 12 }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_PX}
          height={CANVAS_PX}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{
            border: "1px solid black",
            imageRendering: "pixelated",
            cursor: "crosshair",
          }}
        />
      </div>
    </div>
  );
}
