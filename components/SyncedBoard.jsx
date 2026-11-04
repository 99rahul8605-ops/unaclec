"use client";

import { useEffect, useRef } from "react";

const W = 1280;
const H = 720;
const PDF_W = 1.0;
const PEN = 2.35; // thinner pen; original 3px

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

// Identity of a PDF page: PDF path + page number, never page number alone.
// Ignore short-lived `t` query values, but retain the source document.
function pdfIdentity(url) {
  try {
    const u = new URL(String(url));
    const page = u.searchParams.get("page");
    if (!page || !/^\d+$/.test(page) || !/\.pdf$/i.test(u.pathname)) return null;
    return `${u.origin.toLowerCase()}${u.pathname.toLowerCase()}?page=${Number(page)}`;
  } catch { return null; }
}

function pdfSource(url) {
  const identity = pdfIdentity(url);
  return identity ? identity.split("?page=")[0] : null;
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
    ctx.arc(ax, ay, 1.15, 0, Math.PI * 2);
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

function createEngine(events, images, resolveAssetKey = assetKey) {
  let assets = [];
  let selected = 1;
  let color = "#EB3C24";
  let tool = "marker";

  let layers = new Map();
  let histories = new Map();
  let active = new Map();
  let boardViews = new Map();
  let deletedIds = new Set();

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
    boardViews = new Map();
    deletedIds = new Set();

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

  // Inserting a slide shifts the existing board positions. All associated
  // pen layers, histories, pending strokes and viewport state must shift too.
  function shiftBoardMap(map, at) {
    const next = new Map();
    for (const [key, value] of map) {
      const n = Number(key);
      next.set(Number.isInteger(n) && n >= at ? n + 1 : key, value);
    }
    return next;
  }

  function deleteObjectIds(payload) {
    const raw = Array.isArray(payload?.ids) ? payload.ids :
      Array.isArray(payload?.oids) ? payload.oids : [];
    const ids = new Set(raw.map(item => {
      if (typeof item === "string" || typeof item === "number") return String(item);
      if (item && typeof item === "object") return String(item.oid ?? item.id ?? "");
      return "";
    }).filter(Boolean));
    if (!ids.size) return;
    for (const oid of ids) deletedIds.add(oid);
    for (const [board, strokes] of histories) {
      const kept = strokes.filter(op => !op.oid || !ids.has(String(op.oid)));
      if (kept.length !== strokes.length) {
        histories.set(board, kept);
        rebuild(board);
      }
    }
    for (const [board, op] of active) {
      if (op?.oid && ids.has(String(op.oid))) active.delete(board);
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

          const hasImageURL = typeof d.u === "string" && d.u.trim().length > 0;
          // Blank whiteboard pages must never inherit a previously shown JPG.
          // Keep the board colour and existing pen layer for this page.
          const insertedAt = index + 1;
          layers = shiftBoardMap(layers, insertedAt);
          histories = shiftBoardMap(histories, insertedAt);
          active = shiftBoardMap(active, insertedAt);
          boardViews = shiftBoardMap(boardViews, insertedAt);
          if (assets.length && selected >= insertedAt) selected++;
          assets.splice(index, 0, {
            key: hasImageURL ? resolveAssetKey(d.u) : null,
            hasImageURL,
            isPdf: Boolean(pdfIdentity(d.u)),
            bg: d.bc || (hasImageURL ? "#202022" : "#FFFFFF"),
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
    if (kind === "zm") {
      const zoom = Number(inner.v);
      if (Number.isFinite(zoom) && zoom > 0 && zoom <= 10) {
        boardViews.set(Number(id), {
          ...(boardViews.get(Number(id)) || { zoom: 1, panX: 0, panY: 0 }),
          zoom,
        });
      }
      return;
    }
    if (kind === "pn") {
      const v = inner.v;
      if (v && Number.isFinite(Number(v.x)) && Number.isFinite(Number(v.y))) {
        boardViews.set(Number(id), {
          ...(boardViews.get(Number(id)) || { zoom: 1, panX: 0, panY: 0 }),
          panX: Number(v.x), panY: Number(v.y),
        });
      }
      return;
    }
    if (kind === "dlos") {
      deleteObjectIds(inner);
      return;
    }

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
          oid: inner.p?.oid ?? inner.oid ?? null,
        });
      }
      return;
    }

    if (kind === "m") {
      const stroke = active.get(id);
      if (stroke) {
        if (!stroke.oid && inner.p?.oid) stroke.oid = inner.p.oid;
        if (p) stroke.points.push(p);
      }
      return;
    }

    if (kind === "u") {
      const stroke = active.get(id);

      if (stroke) {
        if (!stroke.oid && inner.p?.oid) stroke.oid = inner.p.oid;
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

        if (stroke.points.length && !(stroke.oid && deletedIds.has(String(stroke.oid)))) {
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

    // Replay in bounded slices. A backwards seek previously processed up to
    // 20,000 board events synchronously and froze the video UI thread.
    let processed = 0;
    const limit = 650;
    while (
      pos < events.length &&
      Number(events[pos].p_time) <= target &&
      processed < limit
    ) {
      process(events[pos]);
      pos++;
      processed++;
    }

    previous = t;
    return pos >= events.length || Number(events[pos].p_time) > target;
  }

  function render(ctx, showAnnotations = true) {
    const asset = assets[selected - 1];
    const key = asset?.hasImageURL ? asset.key : null;
    const pdf = /^slide_\d+\.(jpg|jpeg|png|webp)$/i.test(
      key || ""
    ) || Boolean(asset?.isPdf);

    const bg = asset?.bg || "#FFFFFF";

    ctx.fillStyle = /^#[0-9a-f]{6}$/i.test(bg)
      ? bg
      : (pdf ? "#202022" : "#FFFFFF");

    // Explicitly clear the old frame, including when seeking back and forth
    // between an image-backed page and a blank handwriting page.
    ctx.clearRect(0, 0, W, H);
    ctx.fillRect(0, 0, W, H);

    const image = key ? images.get(key) : null;
    const view = boardViews.get(selected) || { zoom: 1, panX: 0, panY: 0 };
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    // Same JSON viewport on image, saved pen and active pen.
    ctx.translate(W / 2 + view.panX * W * view.zoom,
                  H / 2 + view.panY * H * view.zoom);
    ctx.scale(view.zoom, view.zoom);
    ctx.translate(-W / 2, -H / 2);

    if (image) {
      const scale = Math.min(
        (W * (pdf ? PDF_W : 0.96)) / image.width,
        (H * (pdf ? 1.0 : 0.96)) / image.height
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

    // Hide only pen strokes. Keep processing board events/timestamps so
    // annotations reappear at the correct position when toggled back on.
    if (showAnnotations) {
      const selectedLayer = layers.get(selected);
      if (selectedLayer) {
        ctx.drawImage(selectedLayer, 0, 0, W, H);
      }
      const pending = active.get(selected);
      if (pending) drawStroke(ctx, pending);
    }
    ctx.restore();
  }

  function inspect() {
    const asset = assets[selected - 1];
    return {
      selected,
      assetCount: assets.length,
      hasImageURL: Boolean(asset?.hasImageURL),
      imageKey: asset?.hasImageURL ? asset.key : null,
      imageLoaded: Boolean(asset?.hasImageURL && images.has(asset.key)),
    };
  }

  return { advance, render, inspect };
}

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "use-credentials";
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      img.onload = null;
      img.onerror = null;
      resolve(result);
    };
    const timeout = setTimeout(() => finish(null), 15000);
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    img.src = url;
  });
}

export default function SyncedBoard({
  lectureId,
  playbackUrl,
  videoRef,
  onReady,
  onSyncingChange,
  showAnnotations = true,
}) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const readyRef = useRef(onReady);
  const syncingRef = useRef(onSyncingChange);
  const annotationsRef = useRef(showAnnotations);

  useEffect(() => {
    annotationsRef.current = showAnnotations;
  }, [showAnnotations]);

  useEffect(() => {
    readyRef.current = onReady;
    syncingRef.current = onSyncingChange;
  }, [onReady, onSyncingChange]);

  useEffect(() => {
    let cancelled = false;
    let frame = 0;

    engineRef.current = null;
    readyRef.current?.(false);
    syncingRef.current?.(false);

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
          fetch(boardURL, { cache: "no-store", credentials: "include" }),
          fetch(manifestURL, { cache: "no-store", credentials: "include" }),
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

        const expectedKeys = [];
        const seen = new Set();
        const pdfSources = new Set();
        const pageOwners = new Map();
        let firstPdfSource = null;

        for (const ev of events) {
          if (ev.plugin !== "dcn" || ev.data?.e !== "as" || !ev.data?.u) {
            continue;
          }
          const key = assetKey(ev.data.u);
          const source = pdfSource(ev.data.u);
          if (source) {
            if (!firstPdfSource) firstPdfSource = source;
            pdfSources.add(source);
            const page = Number(new URL(ev.data.u).searchParams.get("page"));
            if (!pageOwners.has(page)) pageOwners.set(page, new Set());
            pageOwners.get(page).add(source);
          }
          if (key && !seen.has(key)) {
            seen.add(key);
            expectedKeys.push(key);
          }
        }

        // PDFs are not valid <img> sources. The streaming API now exposes
        // signed JPEG previews of PDF pages under type "pdf_page".
        // Only preload pages actually requested by the board timeline.
        const entries = (manifest.slides || []).filter((entry) => {
          if (!entry?.url || String(entry.name || "").toLowerCase().endsWith(".pdf")) {
            return false;
          }
          if (entry.type === "pdf_page") {
            return expectedKeys.includes(String(entry.name || "").toLowerCase());
          }
          return true;
        });

        // Keep requests bounded: a class may have dozens of PDF pages.
        // The ordered result is important when mapping original board URLs
        // to the separately uploaded numbered asset files.
        const loaded = new Array(entries.length).fill(null);
        let next = 0;
        async function worker() {
          while (!cancelled && next < entries.length) {
            const i = next++;
            const src = new URL(entries[i].url, base.origin).toString();
            const img = await loadImage(src);
            if (img) loaded[i] = img;
          }
        }
        await Promise.all(
          Array.from({ length: Math.min(4, entries.length) }, () => worker())
        );
        if (cancelled) return;

        const images = new Map();
        for (let i = 0; i < entries.length; i++) {
          const img = loaded[i];
          if (!img) continue;
          const entry = entries[i];
          const name = String(entry.name || entry.key || "").toLowerCase();
          if (!images.has(name)) images.set(name, img);
          const sourceKey = String(entry.source_key || "").toLowerCase();
          if (sourceKey && !images.has(sourceKey)) images.set(sourceKey, img);
          const identity = pdfIdentity(sourceKey);
          if (identity && !images.has(identity)) images.set(identity, img);
        }

        // Old ZIPs can have generated extra_001.jpg names instead of the
        // source URL basename. Match these ONLY to real URL-bearing board
        // attachment events, never to blank boards or PDF page assets.
        const usedExtraNames = new Set();
        let directImageIndex = 0;
        for (const key of expectedKeys) {
          if (images.has(key) || /^slide_\d+\./i.test(key)) continue;
          directImageIndex++;
          const normalized = `extra_${String(directImageIndex).padStart(3, "0")}.jpg`;
          const match = images.get(normalized) || images.get(normalized.replace(/\.jpg$/, ".png"));
          if (match && !usedExtraNames.has(normalized)) {
            images.set(key, match);
            usedExtraNames.add(normalized);
          }
        }

        // Each PDF URL + page is a separate logical asset. If multiple
        // source PDFs overlap, unnamed slide_NNN entries are ambiguous:
        // don't show a confidently WRONG page. Explicit URL mappings win.
        if (pdfSources.size > 1) {
          console.warn("Multiple PDF sources; numbered legacy ZIP pages cannot establish a unique source-page mapping", { lectureId, sources: pdfSources.size });
        }

        // A board whose background attachments all failed must not turn
        // the full lecture video into a tiny teacher-camera overlay.
        // Standalone handwritten boards (no external assets) still work.
        // A lecture with some valid pages must not be disabled just because
        // other pages (or another PDF source) are absent in a legacy ZIP.
        const attachmentsReady = expectedKeys.length === 0 || images.size > 0;
        if (!attachmentsReady) {
          console.warn("Board attachments unavailable; retaining full video", {
            lectureId, expected: expectedKeys.length, received: images.size,
            zipError: manifest.zip_error || null
          });
          readyRef.current?.(false);
          return;
        }

        if (cancelled) return;

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");

        if (!ctx || !events.length) {
          throw new Error("Board canvas/events unavailable");
        }

        // New ZIPs provide exact Board URL -> image mappings. Legacy
        // ZIPs still use the historical slide_NNN/basename resolver.
        let unresolvedPdfPages = 0;
        let legacyPdfPages = 0;
        const resolveAssetKey = (url) => {
          const exact = String(url || "").toLowerCase();
          if (images.has(exact)) return exact;
          const identity = pdfIdentity(url);
          if (identity) {
            if (images.has(identity)) return identity;
            const source = pdfSource(url);
            const legacy = assetKey(url);
            const page = Number(new URL(url).searchParams.get("page"));
            const owners = pageOwners.get(page);
            // Compatibility for old ZIPs with no original source metadata:
            // numbers may describe only the first PDF. Never reuse the same
            // page number for a second PDF document.
            const allowedLegacy = pdfSources.size === 1 ||
              (source === firstPdfSource && owners?.size === 1);
            if (allowedLegacy && images.has(legacy)) {
              legacyPdfPages++;
              return legacy;
            }
            unresolvedPdfPages++;
            return identity; // unique, not falsely identified with other PDFs
          }
          return assetKey(url);
        };
        if (pdfSources.size > 1) {
          console.warn("Legacy ZIP PDF pages are ambiguous across sources; exact URL mappings preferred", {
            lectureId, sources: pdfSources.size
          });
        }
        const engine = createEngine(events, images, resolveAssetKey);
        engineRef.current = engine;
        // Read-only troubleshooting without exposing signed URLs or tokens.
        window.__lectureBoardState = () => engineRef.current?.inspect() || null;

        const video = videoRef?.current;
        const initialDone = engine.advance(video?.currentTime || 0);
        if (initialDone) engine.render(ctx, annotationsRef.current);
        else ctx.clearRect(0, 0, W, H);
        syncingRef.current?.(!initialDone);

        readyRef.current?.(true);

        let lastBoardComplete = initialDone;
        function tick() {
          if (cancelled) return;

          const currentVideo = videoRef?.current;

          if (currentVideo && engineRef.current) {
            const done = engineRef.current.advance(currentVideo.currentTime || 0);
            // Never display an intermediate/incorrect board page during a seek.
            // The video UI remains responsive while the timeline is rebuilt.
            if (!done && lastBoardComplete) {
              ctx.clearRect(0, 0, W, H);
              ctx.fillStyle = "#15181f";
              ctx.fillRect(0, 0, W, H);
            }
            if (done !== lastBoardComplete) syncingRef.current?.(!done);
            lastBoardComplete = done;
            if (done) engineRef.current.render(ctx, annotationsRef.current);
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
      syncingRef.current?.(false);
      delete window.__lectureBoardState;
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
