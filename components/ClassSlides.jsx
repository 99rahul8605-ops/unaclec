"use client";

import { useEffect, useRef, useState } from "react";
import SyncedBoard from "./SyncedBoard";

function timeText(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const sec = seconds % 60;

  return hrs
    ? `${hrs}:${String(mins).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${mins}:${String(sec).padStart(2, "0")}`;
}

function latestBoardTime(value) {
  let largest = 0;
  const stack = [value];

  while (stack.length) {
    const item = stack.pop();

    if (Array.isArray(item)) {
      for (const child of item) stack.push(child);
    } else if (item && typeof item === "object") {
      if (
        "p_time" in item &&
        "plugin" in item
      ) {
        const t = Number(item.p_time);
        if (Number.isFinite(t)) {
          largest = Math.max(largest, t);
        }
      } else {
        for (const child of Object.values(item)) {
          if (child && typeof child === "object") {
            stack.push(child);
          }
        }
      }
    }
  }

  return largest / 1000000;
}

export default function ClassSlides({
  lectureId,
  playbackUrl
}) {
  const [tab, setTab] = useState("gallery");
  const [slides, setSlides] = useState([]);
  const [index, setIndex] = useState(0);
  const [hasBoard, setHasBoard] = useState(false);
  const [zipError, setZipError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [boardTime, setBoardTime] = useState(0);
  const [boardDuration, setBoardDuration] = useState(0);
  const [boardReady, setBoardReady] = useState(false);

  // SyncedBoard reads videoRef.current.currentTime.
  // Here we provide a seekable virtual clock, not a second video.
  const virtualClock = useRef({ currentTime: 0 });

  useEffect(() => {
    virtualClock.current.currentTime = boardTime;
  }, [boardTime]);

  useEffect(() => {
    let cancelled = false;

    setTab("gallery");
    setIndex(0);
    setSlides([]);
    setError("");
    setZipError("");
    setHasBoard(false);
    setBoardTime(0);
    setBoardDuration(0);
    setBoardReady(false);
    virtualClock.current.currentTime = 0;

    if (!lectureId || !playbackUrl) return;

    async function load() {
      setLoading(true);

      try {
        const base = new URL(playbackUrl);

        base.pathname =
          `/slides/${encodeURIComponent(lectureId)}/manifest`;

        const response = await fetch(base.toString(), {
          credentials: "include",
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error(`Slides API HTTP ${response.status}`);
        }

        const manifest = await response.json();

        if (cancelled) return;

        setSlides(
          (manifest.slides || []).map((entry) => ({
            ...entry,
            url: new URL(entry.url, base.origin).toString()
          }))
        );

        setHasBoard(Boolean(manifest.has_board));
        setZipError(manifest.zip_error || "");
      } catch (e) {
        if (!cancelled) {
          setError(e.message || "Slides could not load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [lectureId, playbackUrl]);

  useEffect(() => {
    if (
      !lectureId ||
      !playbackUrl ||
      !hasBoard ||
      tab !== "board"
    ) return;

    let cancelled = false;

    async function loadBoardDuration() {
      try {
        const url = new URL(playbackUrl);

        url.pathname =
          `/slides/${encodeURIComponent(lectureId)}/board`;

        const response = await fetch(url.toString(), {
          credentials: "include",
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error(`Board HTTP ${response.status}`);
        }

        const data = await response.json();
        const duration = latestBoardTime(data);

        if (!cancelled) {
          setBoardDuration(duration);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || "Board timeline unavailable");
        }
      }
    }

    loadBoardDuration();

    return () => {
      cancelled = true;
    };
  }, [lectureId, playbackUrl, hasBoard, tab]);

  const active = slides[index];
  const pdf = active?.name?.toLowerCase().endsWith(".pdf");

  const button = {
    background: "#252b48",
    border: "1px solid #485477",
    borderRadius: 9,
    color: "#fff",
    padding: "9px 12px",
    fontWeight: 600,
    cursor: "pointer"
  };

  return (
    <section style={{ width: "100%", color: "#fff" }}>
      <div
        style={{
          display: "flex",
          gap: 9,
          flexWrap: "wrap",
          marginBottom: 15
        }}
      >
        <button
          type="button"
          style={{
            ...button,
            background:
              tab === "gallery" ? "#6d28d9" : "#252b48"
          }}
          onClick={() => setTab("gallery")}
        >
          Slides ({slides.length})
        </button>

        {hasBoard && (
          <button
            type="button"
            style={{
              ...button,
              background:
                tab === "board" ? "#6d28d9" : "#252b48"
            }}
            onClick={() => setTab("board")}
          >
            Full Board Timeline
          </button>
        )}
      </div>

      {loading && (
        <p style={{ color: "#c4b5fd" }}>
          Loading lecture materials...
        </p>
      )}

      {error && (
        <p style={{ color: "#fca5a5" }}>{error}</p>
      )}

      {zipError && (
        <p style={{ color: "#fbbf24", fontSize: 12 }}>
          ZIP: {zipError}
        </p>
      )}

      {tab === "gallery" && (
        <>
          {!loading && slides.length === 0 && (
            <p style={{ color: "#94a3b8" }}>
              No separate slide files available.
              {hasBoard
                ? " Open Full Board Timeline to view the lesson board."
                : ""}
            </p>
          )}

          {active && (
            <>
              <div
                style={{
                  width: "100%",
                  background: "#101827",
                  borderRadius: 10,
                  overflow: "hidden",
                  border: "1px solid #344057"
                }}
              >
                {pdf ? (
                  <iframe
                    title={active.name}
                    src={active.url}
                    style={{
                      display: "block",
                      width: "100%",
                      height: "65vh",
                      border: 0
                    }}
                  />
                ) : (
                  <img
                    src={active.url}
                    alt={`Slide ${index + 1}`}
                    style={{
                      display: "block",
                      width: "100%",
                      maxHeight: "65vh",
                      objectFit: "contain"
                    }}
                  />
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 12
                }}
              >
                <button
                  type="button"
                  style={button}
                  disabled={index === 0}
                  onClick={() =>
                    setIndex((v) => Math.max(0, v - 1))
                  }
                >
                  ← Previous
                </button>

                <span>
                  {index + 1} / {slides.length}
                </span>

                <button
                  type="button"
                  style={button}
                  disabled={index === slides.length - 1}
                  onClick={() =>
                    setIndex((v) =>
                      Math.min(slides.length - 1, v + 1)
                    )
                  }
                >
                  Next →
                </button>
              </div>

              <p
                style={{
                  textAlign: "center",
                  fontSize: 12,
                  color: "#a5b4fc",
                  overflowWrap: "anywhere",
                  marginTop: 8
                }}
              >
                {active.name}
              </p>

              <div
                style={{
                  display: "flex",
                  overflowX: "auto",
                  gap: 7,
                  paddingBottom: 7
                }}
              >
                {slides.map((slide, i) => (
                  <button
                    key={`${slide.key}-${i}`}
                    type="button"
                    style={{
                      ...button,
                      flexShrink: 0,
                      background:
                        i === index ? "#6d28d9" : "#252b48"
                    }}
                    onClick={() => setIndex(i)}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {tab === "board" && hasBoard && (
        <>
          <div
            style={{
              width: "100%",
              aspectRatio: "16 / 9",
              position: "relative",
              overflow: "hidden",
              borderRadius: 10,
              background: "#15181f"
            }}
          >
            <SyncedBoard
              lectureId={lectureId}
              playbackUrl={playbackUrl}
              videoRef={virtualClock}
              onReady={setBoardReady}
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                color: "#c4b5fd",
                marginBottom: 9
              }}
            >
              <span>{timeText(boardTime)}</span>
              <span>
                {boardReady ? "Board Ready" : "Loading Board..."}
              </span>
              <span>{timeText(boardDuration)}</span>
            </div>

            <input
              type="range"
              aria-label="Browse board timeline"
              min={0}
              max={Math.max(1, boardDuration)}
              step={1}
              value={Math.min(
                boardTime,
                Math.max(1, boardDuration)
              )}
              onChange={(e) =>
                setBoardTime(Number(e.target.value))
              }
              style={{
                width: "100%",
                accentColor: "#a78bfa"
              }}
            />

            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "center",
                marginTop: 11
              }}
            >
              <button
                type="button"
                style={button}
                onClick={() =>
                  setBoardTime((t) => Math.max(0, t - 10))
                }
              >
                −10s
              </button>

              <button
                type="button"
                style={button}
                onClick={() =>
                  setBoardTime((t) =>
                    Math.min(boardDuration, t + 10)
                  )
                }
              >
                +10s
              </button>
            </div>

            <p
              style={{
                fontSize: 12,
                color: "#94a3b8",
                marginTop: 12
              }}
            >
              Move the timeline to see the teacher's
              whiteboard and handwritten notes at that point
              in the lecture.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
