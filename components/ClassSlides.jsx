"use client";

import { useEffect, useState } from "react";

export default function ClassSlides({
  lectureId,
  playbackUrl
}) {
  const [slides, setSlides] = useState([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasBoard, setHasBoard] = useState(false);
  const [zipError, setZipError] = useState("");

  useEffect(() => {
    let cancelled = false;

    setSlides([]);
    setCurrent(0);
    setError("");
    setZipError("");
    setHasBoard(false);

    if (!lectureId || !playbackUrl) {
      return;
    }

    async function load() {
      setLoading(true);

      try {
        const url = new URL(playbackUrl);

        url.pathname =
          `/slides/${encodeURIComponent(lectureId)}/manifest`;

        const response = await fetch(url.toString(), {
          cache: "no-store"
        });

        const contentType =
          response.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
          throw new Error(
            `Slides API returned HTTP ${response.status}`
          );
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.detail || data.error ||
            `Slides unavailable (${response.status})`
          );
        }

        if (cancelled) return;

        setSlides(
          (data.slides || []).map((slide) => ({
            ...slide,
            url: new URL(slide.url, url.origin).toString()
          }))
        );

        setHasBoard(Boolean(data.has_board));
        setZipError(data.zip_error || "");
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Slides failed to load");
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

  const active = slides[current];
  const isPdf = active?.name?.toLowerCase().endsWith(".pdf");

  const navButton = {
    padding: "10px 15px",
    background: "#262044",
    color: "#fff",
    border: "1px solid #51407c",
    borderRadius: 10,
    fontWeight: 600
  };

  return (
    <div
      style={{
        width: "100%",
        color: "#f8fafc",
        padding: "12px 0"
      }}
    >
      <h3 style={{ marginBottom: 12 }}>
        Class Slides
      </h3>

      {loading && (
        <p style={{ color: "#c4b5fd" }}>
          Loading slides from Telegram...
        </p>
      )}

      {error && (
        <p style={{ color: "#fca5a5" }}>
          {error}
        </p>
      )}

      {zipError && (
        <p style={{ color: "#fbbf24", fontSize: 13 }}>
          ZIP: {zipError}
        </p>
      )}

      {!loading && !error && slides.length === 0 && (
        <p style={{ color: "#94a3b8" }}>
          No displayable slides available for this lecture yet.
        </p>
      )}

      {active && (
        <>
          <div
            style={{
              background: "#0c1020",
              border: "1px solid #343052",
              borderRadius: 14,
              overflow: "hidden",
              minHeight: 180,
              display: "flex",
              justifyContent: "center",
              alignItems: "center"
            }}
          >
            {isPdf ? (
              <iframe
                key={active.url}
                src={active.url}
                title={active.name}
                style={{
                  width: "100%",
                  height: "65vh",
                  border: 0
                }}
              />
            ) : (
              <img
                key={active.url}
                src={active.url}
                alt={`Slide ${current + 1}`}
                style={{
                  display: "block",
                  width: "100%",
                  maxHeight: "65vh",
                  objectFit: "contain"
                }}
                onError={(event) => {
                  event.currentTarget.alt =
                    "Slide image failed to load";
                }}
              />
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginTop: 14
            }}
          >
            <button
              type="button"
              style={navButton}
              disabled={current <= 0}
              onClick={() =>
                setCurrent((n) => Math.max(0, n - 1))
              }
            >
              ← Previous
            </button>

            <span style={{ fontSize: 13 }}>
              {current + 1} / {slides.length}
            </span>

            <button
              type="button"
              style={navButton}
              disabled={current >= slides.length - 1}
              onClick={() =>
                setCurrent((n) =>
                  Math.min(slides.length - 1, n + 1)
                )
              }
            >
              Next →
            </button>
          </div>

          <p
            style={{
              fontSize: 12,
              color: "#a5b4fc",
              textAlign: "center",
              overflowWrap: "anywhere",
              marginTop: 8
            }}
          >
            {active.name}
          </p>

          <div
            style={{
              display: "flex",
              gap: 8,
              overflowX: "auto",
              marginTop: 14,
              paddingBottom: 6
            }}
          >
            {slides.map((slide, index) => (
              <button
                key={`${slide.key}-${index}`}
                type="button"
                onClick={() => setCurrent(index)}
                style={{
                  minWidth: 44,
                  padding: "10px",
                  borderRadius: 8,
                  color: "#fff",
                  background:
                    index === current ? "#7c3aed" : "#252b48",
                  border:
                    index === current
                      ? "1px solid #a78bfa"
                      : "1px solid #394161"
                }}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </>
      )}

      {hasBoard && (
        <p
          style={{
            marginTop: 16,
            fontSize: 12,
            color: "#a5b4fc"
          }}
        >
          Board JSON is uploaded. Synchronized handwriting
          rendering requires its timing/drawing format.
        </p>
      )}
    </div>
  );
}
