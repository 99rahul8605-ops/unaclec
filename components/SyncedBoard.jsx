"use client";

import { useEffect, useRef } from "react";

const W = 1280;
const H = 720;
const PDF_W = 0.60;
const PEN = 3;

function flatten(value, out) {
  if (Array.isArray(value)) {
    for (const item of value) flatten(item, out);
  } else if (value && typeof value === "object") {
    if ("plugin" in value && "p_time" in value) {
      out.push(value);
    } else {
      for (const item of Object.values(value)) {
        if (item && typeof item === "object") {
          flatten(item, out);
        }
      }
    }
  }
}

function assetKey(url) {
  if (!url) return null;

  const text = String(url);
  const page = text.match(/[?&]page=(\d+)/);

  if (page) {
    return `slide_${page[1].padStart(3, "0")}.jpg`;
  }

  try {
    return decodeURIComponent(
      text.split("?")[0].split("/").pop()
    ).toLowerCase();
  } catch {
    return text.split("?")[0].split("/").pop().toLowerCase();
  }
}

function point(p) {
  if (!p) return null;

  const x = Number(p.x);
  const y = Number(p.y);

  return Number.isFinite(x) && Number.isFinite(y)
    ? [x, y]
    : null;
}

function drawStroke(ctx, op) {
  const pts = op.points || [];
  if (!pts.length) return;

  ctx.save();

  if (op.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
  }

  ctx.strokeStyle = op.color;
  ctx.fillStyle = op.color;

  ctx.lineWidth =
    op.tool === "eraser" ? 12 : PEN;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const first = pts[0];
  const last = pts[pts.length - 1];

  const ax = first[0] * W;
  const ay = first[1] * H;
  const bx = last[0] * W;
  const by = last[1] * H;

  ctx.beginPath();

  if (op.tool === "circle" && pts.length > 1) {
    const rx = Math.abs(bx - ax) / 2;
    const ry = Math.abs(by - ay) / 2;

    if (rx > 0.5 && ry > 0.5) {
      ctx.ellipse(
        (ax + bx) / 2,
        (ay + by) / 2,
        rx,
        ry,
        0,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
  } else if (op.tool === "rectangle" && pts.length > 1) {
    ctx.rect(
      Math.min(ax, bx),
      Math.min(ay, by),
      Math.abs(bx - ax),
      Math.abs(by - ay)
    );
    ctx.stroke();
  } else if (op.tool === "line" && pts.length > 1) {
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  } else if (pts.length === 1) {
    ctx.arc(ax, ay, 1.8, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.moveTo(ax, ay);

    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i][0] * W, pts[i][1] * H);
    }

    ctx.stroke();
  }

  ctx.restore();
}

function createEngine(events, images) {
  let assets = [];
  let selected = 1;
  let color = "#EB3C24";
  let tool = "marker";

  let layers = new Map();
  let histories = new Map();
  let active = new Map();

  let pos = 0;
  let previous = -1;

  function layer(id) {
    if (!layers.has(id)) {
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      layers.set(id, canvas);
    }

    return layers.get(id);
  }

  function history(id) {
    if (!histories.has(id)) histories.set(id, []);
    return histories.get(id);
  }

  function reset() {
    assets = [];
    selected = 1;
    color = "#EB3C24";
    tool = "marker";

    layers = new Map();
    histories = new Map();
    active = new Map();

    pos = 0;
    previous = -1;
  }

  function rebuild(id) {
    const ctx = layer(id).getContext("2d");
    ctx.clearRect(0, 0, W, H);

    for (const op of history(id)) {
      drawStroke(ctx, op);
    }
  }

  function process(ev) {
    const d = ev.data || {};

    if (ev.plugin === "dcn") {
      switch (d.e) {
        case "as": {
          const raw = Number(d.i);
          const index = Number.isFinite(raw)
            ? Math.max(
                0,
                Math.min(raw - 1, assets.length)
              )
            : assets.length;

          assets.splice(index, 0, {
            key: assetKey(d.u),
            bg: d.bc || (d.u ? "#202022" : "#FFFFFF"),
          });
          break;
        }

        case "sc":
          if (Number.isFinite(Number(d.s))) {
            selected = Number(d.s);
          }
          break;

        case "cc":
          if (typeof d.c === "string") color = d.c;
          break;

        case "mc":
          if (typeof d.m === "string") tool = d.m;
          break;
      }

      return;
    }

    if (ev.plugin !== "cw") return;

    const inner = d.data || {};
    const id = d.id;

    if (id == null) return;

    const kind = inner.e;
    const p = point(inner.p);

    if (kind === "ea") {
      histories.set(id, []);
      active.delete(id);

      const old = layers.get(id);
      if (old) {
        old.getContext("2d").clearRect(0, 0, W, H);
      }
      return;
    }

    if (kind === "un") {
      const list = history(id);
      if (list.length) list.pop();
      active.delete(id);
      rebuild(id);
      return;
    }

    if (kind === "d") {
      if (p) {
        active.set(id, {
          tool,
          color,
          points: [p],
        });
      }
      return;
    }

    if (kind === "m") {
      const stroke = active.get(id);
      if (stroke && p) stroke.points.push(p);
      return;
    }

    if (kind === "u") {
      const stroke = active.get(id);

      if (stroke) {
        if (p) {
          const last = stroke.points[stroke.points.length - 1];

          if (
            !last ||
            last[0] !== p[0] ||
            last[1] !== p[1]
          ) {
            stroke.points.push(p);
          }
        }

        if (stroke.points.length) {
          history(id).push(stroke);
          drawStroke(
            layer(id).getContext("2d"),
            stroke
          );
        }

        active.delete(id);
      }
    }
  }

  function advance(seconds) {
    const t = Math.max(0, Number(seconds) || 0);
    const target = Math.round(t * 1000000);

    if (t < previous - 0.05) {
      reset();
    }

    while (
      pos < events.length &&
      Number(events[pos].p_time) <= target
    ) {
      process(events[pos]);
      pos++;
    }

    previous = t;
  }

  function render(ctx) {
    const asset = assets[selected - 1];
    const key = asset?.key || null;
    const pdf = /^slide_\d+\.(jpg|jpeg|png|webp)$/i.test(
      key || ""
    );

    const bg = asset?.bg || "#FFFFFF";

    ctx.fillStyle = /^#[0-9a-f]{6}$/i.test(bg)
      ? bg
      : (pdf ? "#202022" : "#FFFFFF");

    ctx.fillRect(0, 0, W, H);

    const image = images.get(key);

    if (image) {
      const scale = Math.min(
        (W * (pdf ? PDF_W : 0.96)) / image.width,
        (H * (pdf ? 0.995 : 0.96)) / image.height
      );

      const width = image.width * scale;
      const height = image.height * scale;
      const x = (W - width) / 2;
      const y = (H - height) / 2;

      if (pdf) {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(x, y, width, height);
      }

      ctx.drawImage(image, x, y, width, height);
    }

    const selectedLayer = layers.get(selected);

    if (selectedLayer) {
      ctx.drawImage(selectedLayer, 0, 0, W, H);
    }

    const pending = active.get(selected);
    if (pending) drawStroke(ctx, pending);
  }

  return { advance, render };
}

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);

    img.src = url;
  });
}

export default function SyncedBoard({
  lectureId,
  playbackUrl,
  videoRef,
  onReady,
}) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const readyRef = useRef(onReady);

  useEffect(() => {
    readyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    let cancelled = false;
    let frame = 0;

    engineRef.current = null;
    readyRef.current?.(false);

    async function setup() {
      if (!lectureId || !playbackUrl) return;

      try {
        const base = new URL(playbackUrl);
        const query = base.search;

        const boardURL =
          `${base.origin}/slides/` +
          `${encodeURIComponent(lectureId)}/board${query}`;

        const manifestURL =
          `${base.origin}/slides/` +
          `${encodeURIComponent(lectureId)}/manifest${query}`;

        const [boardResult, manifestResult] = await Promise.all([
          fetch(boardURL, { cache: "no-store" }),
          fetch(manifestURL, { cache: "no-store" }),
        ]);

        if (!boardResult.ok) {
          throw new Error(`Board HTTP ${boardResult.status}`);
        }

        const boardJSON = await boardResult.json();

        const manifest = manifestResult.ok
          ? await manifestResult.json()
          : { slides: [] };

        const events = [];
        flatten(boardJSON, events);

        events.sort((a, b) =>
          (Number(a.p_time) - Number(b.p_time)) ||
          (Number(a.c_id || 0) - Number(b.c_id || 0))
        );

        const entries = (manifest.slides || []).filter(
          (entry) => entry && entry.url &&
          !String(entry.name || "").toLowerCase().endsWith(".pdf")
        );

        const images = new Map();
        const loaded = [];

        for (const entry of entries) {
          if (cancelled) return;

          const src = new URL(
            entry.url,
            base.origin
          ).toString();

          const img = await loadImage(src);
          if (!img) continue;

          const name = String(
            entry.name || entry.key || ""
          ).toLowerCase();

          images.set(name, img);
          loaded.push(img);
        }

        // Map source asset URLs to downloaded Telegram images.
        // The uploaded asset_n names do not necessarily match
        // the original source names, so keep their order.
        const missingKeys = [];
        const seen = new Set();

        for (const ev of events) {
          if (
            ev.plugin !== "dcn" ||
            ev.data?.e !== "as"
          ) {
            continue;
          }

          const key = assetKey(ev.data?.u);

          if (
            key &&
            !images.has(key) &&
            !seen.has(key)
          ) {
            seen.add(key);
            missingKeys.push(key);
          }
        }

        missingKeys.forEach((key, index) => {
          if (loaded[index] && !images.has(key)) {
            images.set(key, loaded[index]);
          }
        });

        if (cancelled) return;

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");

        if (!ctx || !events.length) {
          throw new Error("Board canvas/events unavailable");
        }

        const engine = createEngine(events, images);
        engineRef.current = engine;

        const video = videoRef?.current;
        engine.advance(video?.currentTime || 0);
        engine.render(ctx);

        readyRef.current?.(true);

        function tick() {
          if (cancelled) return;

          const currentVideo = videoRef?.current;

          if (currentVideo && engineRef.current) {
            engineRef.current.advance(
              currentVideo.currentTime || 0
            );
            engineRef.current.render(ctx);
          }

          frame = requestAnimationFrame(tick);
        }

        frame = requestAnimationFrame(tick);
      } catch (error) {
        console.error("Synchronized board:", error);
        if (!cancelled) readyRef.current?.(false);
      }
    }

    setup();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      engineRef.current = null;
    };
  }, [lectureId, playbackUrl, videoRef]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      aria-label="Synchronized lecture whiteboard"
      style={{
        position: "absolute",
        inset: 0,
        display: "block",
        width: "100%",
        height: "100%",
        background: "#15181f",
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}
