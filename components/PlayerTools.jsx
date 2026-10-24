"use client";

import { useEffect, useRef, useState } from "react";
import ClassSlides from "./ClassSlides";

export default function PlayerTools({
  videoRef,
  playbackUrl,
  lectureId,
  enabled = false
}) {
  const [landscape, setLandscape] = useState(false);
  const [slidesOpen, setSlidesOpen] = useState(false);
  const [message, setMessage] = useState("");
  const cleanupRef = useRef(null);

  function leaveLandscape() {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    setLandscape(false);
    setMessage("");
  }

  useEffect(() => {
    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
  }, []);

  useEffect(() => {
    leaveLandscape();
    setSlidesOpen(false);
  }, [lectureId]);

  async function fullscreen() {
    const video = videoRef?.current;
    if (!video) return;

    const tg = window.Telegram?.WebApp;

    try {
      tg?.requestFullscreen?.();
    } catch {}

    try {
      const container = video.closest(".video-container");

      if (container?.requestFullscreen) {
        await container.requestFullscreen();
      } else if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      } else {
        setMessage(
          "Telegram fullscreen requested. Device support may vary."
        );
      }
    } catch {
      setMessage(
        "Telegram fullscreen requested. Device support may vary."
      );
    }
  }

  function enterLandscape() {
    const video = videoRef?.current;
    const container = video?.closest(".video-container");

    if (!video || !container) {
      setMessage("Video player not ready.");
      return;
    }

    leaveLandscape();

    const tg = window.Telegram?.WebApp;

    try {
      tg?.unlockOrientation?.();
      tg?.requestFullscreen?.();
    } catch {}

    const oldContainerStyle =
      container.getAttribute("style");
    const oldVideoStyle =
      video.getAttribute("style");
    const oldBodyOverflow = document.body.style.overflow;

    // Fallback horizontal player, even if Telegram refuses
    // to rotate the actual device screen.
    Object.assign(container.style, {
      position: "fixed",
      top: "0",
      left: "100vw",
      width: "100dvh",
      height: "100dvw",
      maxWidth: "none",
      maxHeight: "none",
      minHeight: "0",
      margin: "0",
      padding: "0",
      borderRadius: "0",
      zIndex: "20000",
      background: "#000",
      transform: "rotate(90deg)",
      transformOrigin: "top left",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden"
    });

    Object.assign(video.style, {
      width: "100%",
      height: "100%",
      maxWidth: "100%",
      maxHeight: "100%",
      objectFit: "contain",
      borderRadius: "0"
    });

    document.body.style.overflow = "hidden";

    let active = true;

    cleanupRef.current = () => {
      if (!active) return;
      active = false;

      if (oldContainerStyle === null) {
        container.removeAttribute("style");
      } else {
        container.setAttribute("style", oldContainerStyle);
      }

      if (oldVideoStyle === null) {
        video.removeAttribute("style");
      } else {
        video.setAttribute("style", oldVideoStyle);
      }

      document.body.style.overflow = oldBodyOverflow;

      try {
        if (document.fullscreenElement) {
          document.exitFullscreen?.();
        }
      } catch {}
    };

    setLandscape(true);
    setMessage("");
  }

  const buttonStyle = {
    background: "#252b48",
    color: "#fff",
    border: "1px solid #4b5578",
    borderRadius: 10,
    padding: "10px 13px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer"
  };

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginTop: 12
        }}
      >
        <button
          type="button"
          style={buttonStyle}
          disabled={!playbackUrl}
          onClick={fullscreen}
        >
          ⛶ Fullscreen
        </button>

        <button
          type="button"
          style={buttonStyle}
          disabled={!playbackUrl}
          onClick={
            landscape ? leaveLandscape : enterLandscape
          }
        >
          {landscape ? "Exit Landscape" : "↻ Landscape"}
        </button>

        {enabled && (
          <button
            type="button"
            style={buttonStyle}
            disabled={!playbackUrl}
            onClick={() => setSlidesOpen(true)}
          >
            ▣ Show Slides
          </button>
        )}
      </div>

      {message && (
        <p style={{ fontSize: 12, color: "#c4b5fd" }}>
          {message}
        </p>
      )}

      {landscape && (
        <button
          type="button"
          onClick={leaveLandscape}
          style={{
            position: "fixed",
            bottom: 18,
            right: 18,
            zIndex: 25000,
            background: "#7c3aed",
            color: "white",
            padding: "12px 16px",
            borderRadius: 12,
            border: 0,
            fontWeight: 700,
            boxShadow: "0 4px 18px #0009"
          }}
        >
          ✕ Exit Landscape
        </button>
      )}

      {slidesOpen && enabled && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Lecture slides"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 30000,
            background: "#090c16",
            color: "white",
            overflowY: "auto",
            padding: "16px"
          }}
        >
          <div
            style={{
              maxWidth: 950,
              margin: "0 auto"
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 16
              }}
            >
              <h2 style={{ fontSize: 20 }}>
                Class Slides
              </h2>

              <button
                type="button"
                onClick={() => setSlidesOpen(false)}
                style={buttonStyle}
              >
                ✕ Close
              </button>
            </div>

            <ClassSlides
              lectureId={lectureId}
              playbackUrl={playbackUrl}
            />
          </div>
        </div>
      )}
    </>
  );
}
