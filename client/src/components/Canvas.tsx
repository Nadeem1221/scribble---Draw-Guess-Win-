import { useEffect, useRef, useState } from "react";
import { useSocket } from "../context/SocketContext";
import type { Stroke } from "../types";

type Props = {
  isDrawer:       boolean;
  initialStrokes?: Stroke[]; // replay these when a spectator joins mid-game
};

const COLORS = [
  "#222222","#ff7d45","#f9c846","#6bcb77",
  "#4d96ff","#ff6b9d","#c77dff","#ffffff",
];
const SIZES = [2, 4, 8, 14];

export default function Canvas({ isDrawer, initialStrokes = [] }: Props) {
  const socket    = useSocket();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing   = useRef(false);

  const [color, setColor] = useState("#222222");
  const [size,  setSize]  = useState(4);

  function getCtx() {
    return canvasRef.current?.getContext("2d") ?? null;
  }

  function applyStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
    if (stroke.type === "clear") {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      return;
    }
    if (stroke.type === "start") {
      ctx.beginPath();
      ctx.moveTo(stroke.x!, stroke.y!);
      ctx.strokeStyle = stroke.color!;
      ctx.lineWidth   = stroke.size!;
      ctx.lineCap     = "round";
      ctx.lineJoin    = "round";
    }
    if (stroke.type === "move") {
      ctx.lineTo(stroke.x!, stroke.y!);
      ctx.stroke();
    }
    if (stroke.type === "end") {
      ctx.closePath();
    }
  }

  function replayStrokes(strokes: Stroke[]) {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    strokes.forEach(s => applyStroke(ctx, s));
  }

  function getPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect   = canvasRef.current!.getBoundingClientRect();
    const scaleX = canvasRef.current!.width  / rect.width;
    const scaleY = canvasRef.current!.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    };
  }

  // Replay initial strokes when component mounts (spectator join mid-game)
  useEffect(() => {
    if (initialStrokes.length > 0) {
      // Small delay so canvas has rendered
      setTimeout(() => replayStrokes(initialStrokes), 100);
    }
  }, []);

  useEffect(() => {
    const ctx = getCtx();
    if (!ctx) return;

    socket.on("draw_data",     (stroke: Stroke) => applyStroke(ctx, stroke));
    socket.on("canvas_redraw", ({ strokes }: { strokes: Stroke[] }) => replayStrokes(strokes));
    socket.on("new_round",     () => ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height));

    return () => {
      socket.off("draw_data");
      socket.off("canvas_redraw");
      socket.off("new_round");
    };
  }, []);

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawer) return;
    drawing.current = true;
    const { x, y } = getPos(e);
    const ctx = getCtx();
    if (!ctx) return;
    applyStroke(ctx, { type:"start", x, y, color, size });
    socket.emit("draw_start", { x, y, color, size });
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawer || !drawing.current) return;
    const { x, y } = getPos(e);
    const ctx = getCtx();
    if (!ctx) return;
    applyStroke(ctx, { type:"move", x, y, color, size });
    socket.emit("draw_move", { x, y });
  }

  function onMouseUp() {
    if (!isDrawer || !drawing.current) return;
    drawing.current = false;
    const ctx = getCtx();
    if (ctx) applyStroke(ctx, { type:"end" });
    socket.emit("draw_end");
  }

  return (
    <div className="canvas-area">
      <div className="canvas-box">
        <canvas
          ref={canvasRef}
          width={600}
          height={400}
          className="canvas-el"
          style={{ cursor: isDrawer ? "crosshair" : "default" }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        />
      </div>

      {isDrawer && (
        <div className="toolbar">
          <div className="color-row">
            {COLORS.map(c => (
              <button key={c} className={`color-dot ${c===color?"active":""}`}
                style={{ background:c, outline:c==="#ffffff"?"1.5px solid #ddd":"none" }}
                onClick={() => setColor(c)} />
            ))}
          </div>
          <div className="size-row">
            {SIZES.map(s => (
              <button key={s} className={`size-dot ${s===size?"active":""}`}
                style={{ width:s*2+4, height:s*2+4 }}
                onClick={() => setSize(s)} />
            ))}
          </div>
          <div className="action-btns">
            <button className="tool-btn" title="Undo"  onClick={() => socket.emit("draw_undo")}>↩️</button>
            <button className="tool-btn" title="Clear" onClick={() => socket.emit("canvas_clear")}>🗑️</button>
          </div>
        </div>
      )}
    </div>
  );
}