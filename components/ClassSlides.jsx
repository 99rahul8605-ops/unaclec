"use client";

import { useEffect, useState } from "react";

export default function ClassSlides({
  lectureId,
  playbackUrl
}) {
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasZip, setHasZip] = useState(false);
  const [hasBoard, setHasBoard] = useState(false);

  useEffect(() => {
    if (!lectureId || !playbackUrl) return;

    let cancelled = false;

    async function loadSlides() {
      setLoading(true);
      setError("");
      setSlides([]);

      try {
        const url = new URL(playbackUrl);

        url.pathname =
          `/slides/${encodeURIComponent(lectureId)}/manifest`;

        const response = await fetch(url.toString());

        if (!response.ok) {
          throw new Error(
            `Slides unavailable (${response.status})`
          );
        }

        const data = await response.json();

        if (!cancelled) {
          setSlides(
            (data.slides || []).map((slide) => ({
              ...slide,
              url: new URL(slide.url, url.origin).toString()
            }))
          );

          setHasZip(Boolean(data.has_zip));
          setHasBoard(Boolean(data.has_board));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSlides();

    return () => {
      cancelled = true;
    };
  }, [lectureId, playbackUrl]);

  return (
    <div className="notes-content">
      <h3>Class Slides</h3>

      {loading && <p>Loading class slides...</p>}

      {error && (
        <p style={{ color: "#fca5a5" }}>
          {error}
        </p>
      )}

      {!loading && slides.length === 0 && !error && (
        <p>
          No individual image slides are available yet.
        </p>
      )}

      {slides.map((slide, index) => (
        <div
          key={slide.key}
          style={{ marginBottom: 20 }}
        >
          <p>Slide {index + 1}</p>

          <img
            src={slide.url}
            alt={`Lecture slide ${index + 1}`}
            loading="lazy"
            style={{
              width: "100%",
              borderRadius: 10,
              background: "white",
              objectFit: "contain"
            }}
          />
        </div>
      ))}

      {hasZip && (
        <p style={{ color: "#a5b4fc" }}>
          This lecture also has a Slides ZIP.
          ZIP gallery support is pending.
        </p>
      )}

      {hasBoard && (
        <p style={{ color: "#a5b4fc" }}>
          Board JSON is available.
          Handwriting renderer is pending.
        </p>
      )}
    </div>
  );
}