import { useEffect, useRef, useState } from "react";

const GRID_SIZE = 128;
const CANVAS_PX = 512;
const COLOR_PRESETS = [
  "#111827",
  "#f43f5e",
  "#f97316",
  "#facc15",
  "#22c55e",
  "#0ea5e9",
  "#6366f1",
  "#a855f7",
];

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
  clearedAt: number;
};

type ClearMessage = {
  type: "clear";
};

type ServerMessage = DrawMessage | SnapshotMessage;

export default function App() {
  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [color, setColor] = useState("#ff0000");
  const [connected, setConnected] = useState(false);
  const [clearedAt, setClearedAt] = useState<number>();

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

    function clearCanvas() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function drawSnapshot(cells: Cell[]) {
      clearCanvas();

      for (const cell of cells) {
        drawCell(cell.x, cell.y, cell.color);
      }
    }

    clearCanvas();

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
          setClearedAt(msg.clearedAt);
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

    const currentCell: Point = {
      x: Math.floor(px / (rect.width / GRID_SIZE)),
      y: Math.floor(py / (rect.height / GRID_SIZE))
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

  function handleReset() {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const message: ClearMessage = { type: "clear" };
    ws.send(JSON.stringify(message));
  }

  const clearedAtLabel = clearedAt === undefined
    ? "同期中"
    : new Date(clearedAt).toLocaleString("ja-JP", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

  return (
    <main className="app-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Shared Canvas ホーム">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>Shared Canvas</span>
        </a>
      </header>

      <section className="workspace" aria-label="共有キャンバス">
        <div className="toolbar">
          <div className="color-tools">
            <label className="color-picker">
              <span>カラー</span>
              <span className="color-input-wrap" style={{ "--selected-color": color } as React.CSSProperties}>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  aria-label="描画色を選択"
                />
              </span>
              <output>{color.toUpperCase()}</output>
            </label>

            <div className="preset-colors" aria-label="カラープリセット">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={color === preset ? "is-selected" : ""}
                  style={{ "--preset-color": preset } as React.CSSProperties}
                  onClick={() => setColor(preset)}
                  aria-label={`${preset}を選択`}
                  aria-pressed={color === preset}
                />
              ))}
            </div>
          </div>

          <div className="workspace-actions">
            <div
              className={`connection-status ${connected ? "is-online" : ""}`}
              role="status"
              aria-live="polite"
            >
              <span className="status-dot" aria-hidden="true" />
              {connected ? "ライブ接続中" : "接続しています"}
            </div>

            <span className="cleared-at" aria-live="polite">
              <span>最終リセット</span>
              {clearedAt === undefined ? (
                clearedAtLabel
              ) : (
                <time dateTime={new Date(clearedAt).toISOString()}>
                  {clearedAtLabel}
                </time>
              )}
            </span>

            <button
              className="reset-button"
              type="button"
              onClick={handleReset}
              disabled={!connected}
            >
              リセット
            </button>
          </div>
        </div>

        <div className="canvas-stage">
          <div className="canvas-frame">
            <canvas
              ref={canvasRef}
              width={CANVAS_PX}
              height={CANVAS_PX}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerLeave={handlePointerUp}
              aria-label="128×128ピクセルの共有描画キャンバス"
            />
          </div>
        </div>

        <footer className="canvas-meta">
          <span className="drawing-hint">
            <span className="pointer-icon" aria-hidden="true" />
            クリックまたはドラッグして描画
          </span>
          <span className="canvas-size">128 × 128 PX</span>
        </footer>
      </section>
    </main>
  );
}
