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

  const restoreRef = useRef(null);

  function exitLandscape() {
    if (restoreRef.current) {
      restoreRef.current();
      restoreRef.current = null;
    }

    setLandscape(false);
    setMessage("");
  }

  useEffect(() => {
    return () => {
      if (restoreRef.current) {
        restoreRef.current();
        restoreRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    exitLandscape();
    setSlidesOpen(false);
  }, [lectureId]);

  async function enterFullscreen() {
    const video = videoRef?.current;

    if (!video) {
      setMessage("Video player not ready.");
      return;
    }

    try {
      if (video.requestFullscreen) {
        await video.requestFullscreen();
      } else if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      } else {
        setMessage(
          "Fullscreen not supported by this Telegram client."
        );
      }
    } catch {
      setMessage(
        "Fullscreen not supported by this Telegram client."
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

    // Do not request Telegram native fullscreen here.
    // It introduces extra native Minimize / Close buttons
    // that can overlap our landscape controls.

    const oldContainerStyle =
      container.getAttribute("style");
    const oldVideoStyle =
      video.getAttribute("style");
    const oldBodyOverflow =
      document.body.style.overflow;

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

    let restored = false;

    restoreRef.current = () => {
      if (restored) return;
      restored = true;

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
    };

    setLandscape(true);
    setMessage("");
  }

  function toggleLandscape() {
    if (landscape) {
      exitLandscape();
    } else {
      enterLandscape();
    }
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
          onClick={enterFullscreen}
        >
          ⛶ Fullscreen
        </button>

        <button
          type="button"
          style={buttonStyle}
          disabled={!playbackUrl}
          onClick={toggleLandscape}
        >
          {landscape ? "Exit Landscape" : "↻ Landscape"}
        </button>

        {enabled && (
          <button
            type="button"
            style={buttonStyle}
            disabled={!playbackUrl}
            onClick={() => {
              if (landscape) exitLandscape();
              setSlidesOpen(true);
            }}
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
          onClick={exitLandscape}
          aria-label="Exit landscape"
          style={{
            position: "fixed",
            bottom:
              "calc(72px + env(safe-area-inset-bottom, 0px))",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 25000,
            background: "rgba(15, 23, 42, 0.88)",
            color: "#ffffff",
            border: "1px solid rgba(255,255,255,0.35)",
            borderRadius: 999,
            padding: "10px 22px",
            fontSize: 13,
            fontWeight: 700,
            boxShadow: "0 4px 18px rgba(0,0,0,0.5)",
            whiteSpace: "nowrap"
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
            color: "#fff",
            overflowY: "auto",
            padding:
              "calc(16px + env(safe-area-inset-top, 0px)) 16px 16px"
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
                ✕ Close Slides
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
