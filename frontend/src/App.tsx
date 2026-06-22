import { useEffect, useRef, useState } from "react";

const GRID_SIZE = 32;
const CANVAS_PX = 512;

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
    const ws = new WebSocket("ws://localhost:8080/ws");
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
  

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function drawSnapshot(cells: Cell[]) {
    clearCanvas();

    for (const cell of cells) {
      drawCell(cell.x, cell.y, cell.color);
    }
  }

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

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ws = wsRef.current;

    if (!canvas || !ws) return;
    if (ws.readyState !== WebSocket.OPEN) return;

    const rect = canvas.getBoundingClientRect();

    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const cellSize = CANVAS_PX / GRID_SIZE;

    const x = Math.floor(px / cellSize);
    const y = Math.floor(py / cellSize);

    const msg: DrawMessage = {
      type: "draw",
      x,
      y,
      color,
    };

    ws.send(JSON.stringify(msg));
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
          onClick={handleCanvasClick}
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