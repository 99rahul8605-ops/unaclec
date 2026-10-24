"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCw,
  Images,
  X
} from "lucide-react";
import ClassSlides from "./ClassSlides";
import SyncedBoard from "./SyncedBoard";

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

function formatTime(value) {
  const n = Math.max(0, Math.floor(Number(value) || 0));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;

  return h
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export default function CustomVideoPlayer({
  videoRef,
  src,
  lectureId,
  showSlides = false,
  onLoadedMetadata,
  onTimeUpdate,
  onPause,
  onEnded,
  onError,
  ...rest
}) {
  const fallbackRef = useRef(null);
  const playerRef = useRef(null);
  const hideTimerRef = useRef(null);
  const restoreRef = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [boardReady, setBoardReady] = useState(false);
  const [camVisible, setCamVisible] = useState(true);
  const [camPos, setCamPos] = useState({x: 69, y: 8});
  const dragRef = useRef(null);

  function startCamDrag(e) {
    if (!boardReady) return;
    e.preventDefault();
    e.stopPropagation();

    const wrapper = playerRef.current;
    if (!wrapper) return;

    dragRef.current = {
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      startX: camPos.x,
      startY: camPos.y
    };

    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function moveCam(e) {
    const drag = dragRef.current;
    const wrapper = playerRef.current;

    if (!drag || !wrapper ||
        drag.pointerId !== e.pointerId) return;

    e.preventDefault();
    e.stopPropagation();

    const width = wrapper.offsetWidth;
    const height = wrapper.offsetHeight;
    if (!width || !height) return;

    const screenDX = e.clientX - drag.clientX;
    const screenDY = e.clientY - drag.clientY;

    const localDX = landscape ? screenDY : screenDX;
    const localDY = landscape ? -screenDX : screenDY;

    const x = drag.startX + 100 * localDX / width;
    const y = drag.startY + 100 * localDY / height;

    setCamPos({
      x: Math.max(0, Math.min(72, x)),
      y: Math.max(0, Math.min(72, y))
    });
  }

  function stopCamDrag(e) {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
      e.stopPropagation();
    }
  }

  function revealControls() {
    setControlsVisible(true);
    scheduleHide();
  }

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }

      if (restoreRef.current) {
        restoreRef.current();
        restoreRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    restoreLayout();
    setSlidesOpen(false);
    setPlaying(false);
    setBoardReady(false);
    setCamVisible(true);
    setCamPos({x: 69, y: 8});
    setDuration(0);
    setCurrent(0);
    setSpeed(1);
    setMessage("");
  }, [lectureId, restoreLayout]);

  function togglePlay() {
    const el = video();
    if (!el) return;

    if (el.paused) {
      el.play().catch(() => {
        setMessage("Video could not start.");
      });
    } else {
      el.pause();
    }

    revealControls();
  }

  function changeSpeed() {
    const el = video();
    if (!el) return;

    const index = SPEEDS.findIndex(
      (value) => value === speed
    );

    const next = SPEEDS[(index + 1) % SPEEDS.length];

    el.playbackRate = next;
    setSpeed(next);
    revealControls();
  }

  function changeVolume() {
    const el = video();
    if (!el) return;

    el.muted = !el.muted;
    setMuted(el.muted);
    revealControls();
  }

  function seekTo(value) {
    const el = video();
    if (!el) return;

    const target = Number(value);

    if (Number.isFinite(target)) {
      el.currentTime = target;
      setCurrent(target);
    }

    revealControls();
  }

  function enterScreenMode(mode) {
    const wrapper = playerRef.current;
    if (!wrapper) return;

    restoreLayout();

    const oldStyle = wrapper.getAttribute("style");
    const oldOverflow = document.body.style.overflow;

    if (mode === "landscape") {
      Object.assign(wrapper.style, {
        position: "fixed",
        top: "0",
        left: "100vw",
        width: "100dvh",
        height: "100dvw",
        maxWidth: "none",
        maxHeight: "none",
        borderRadius: "0",
        zIndex: "20000",
        transform: "rotate(90deg)",
        transformOrigin: "top left",
        background: "#000"
      });

      setLandscape(true);
      setFullscreen(false);
    } else {
      Object.assign(wrapper.style, {
        position: "fixed",
        inset: "0",
        width: "100vw",
        height: "100dvh",
        maxWidth: "none",
        maxHeight: "none",
        borderRadius: "0",
        zIndex: "20000",
        transform: "none",
        background: "#000"
      });

      setFullscreen(true);
      setLandscape(false);
    }

    document.body.style.overflow = "hidden";

    let restored = false;

    restoreRef.current = () => {
      if (restored) return;
      restored = true;

      if (oldStyle === null) {
        wrapper.removeAttribute("style");
      } else {
        wrapper.setAttribute("style", oldStyle);
      }

      document.body.style.overflow = oldOverflow;
    };

    revealControls();
  }

  function openSlides() {
    restoreLayout();

    const el = video();
    if (el && !el.paused) el.pause();

    setSlidesOpen(true);
  }

  const buttonStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minWidth: 36,
    minHeight: 36,
    padding: "7px 9px",
    border: 0,
    borderRadius: 9,
    color: "#fff",
    background: "rgba(30, 41, 59, 0.78)",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer"
  };

  const expanded = landscape || fullscreen;

  return (
    <>
      <div
        ref={playerRef}
        className="custom-lecture-player"
        onMouseMove={() => {
          if (expanded) revealControls();
        }}
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "16 / 9",
          background: "#000",
          overflow: "hidden",
          borderRadius: 12,
          isolation: "isolate"
        }}
      >
        {showSlides && (
          <SyncedBoard
            lectureId={lectureId}
            playbackUrl={src}
            videoRef={videoRef || fallbackRef}
            onReady={setBoardReady}
          />
        )}

        <video
          {...rest}
          ref={(node) => {
            fallbackRef.current = node;

            if (videoRef) {
              videoRef.current = node;
            }
          }}
          src={src}
          playsInline
          preload="metadata"
          disablePictureInPicture
          controlsList="nodownload noplaybackrate"
          onLoadedMetadata={(event) => {
            setDuration(
              Number.isFinite(event.currentTarget.duration)
                ? event.currentTarget.duration
                : 0
            );

            event.currentTarget.playbackRate = 1;
            onLoadedMetadata?.(event);
          }}
          onTimeUpdate={(event) => {
            setCurrent(event.currentTarget.currentTime);
            onTimeUpdate?.(event);
          }}
          onPlay={() => {
            setPlaying(true);
            scheduleHide();
          }}
          onPause={(event) => {
            setPlaying(false);
            setControlsVisible(true);
            onPause?.(event);
          }}
          onEnded={(event) => {
            setPlaying(false);
            setControlsVisible(true);
            onEnded?.(event);
          }}
          onError={onError}
          style={{
            position: boardReady ? "absolute" : "relative",
            top: boardReady ? `${camPos.y}%` : 0,
            left: boardReady ? `${camPos.x}%` : 0,
            width: boardReady ? "28%" : "100%",
            height: boardReady ? "auto" : "100%",
            aspectRatio: boardReady ? "16 / 9" : undefined,
            display: boardReady && !camVisible ? "none" : "block",
            objectFit: "contain",
            background: "#000",
            zIndex: boardReady ? 3 : 0,
            border: boardReady ? "2px solid #fff" : "none",
            borderRadius: boardReady ? 8 : 0,
            pointerEvents: "none"
          }}
        />

        {boardReady && camVisible && (
          <div
            onPointerDown={startCamDrag}
            onPointerMove={moveCam}
            onPointerUp={stopCamDrag}
            onPointerCancel={stopCamDrag}
            style={{
              position: "absolute",
              top: `${camPos.y}%`,
              left: `${camPos.x}%`,
              width: "28%",
              aspectRatio: "16 / 9",
              zIndex: 4,
              cursor: "move",
              touchAction: "none",
              border: "2px solid transparent",
              borderRadius: 8
            }}
            title="Drag to move teacher camera"
          >
            <span style={{
              position: "absolute",
              top: 2,
              left: 3,
              background: "rgba(0,0,0,.7)",
              color: "white",
              borderRadius: 5,
              fontSize: 10,
              padding: "2px 5px"
            }}>
              ↔ Move
            </span>
          </div>
        )}

        <button
          type="button"
          aria-label="Show or hide video controls"
          onClick={() => {
            if (expanded && controlsVisible) {
              setControlsVisible(false);
            } else {
              revealControls();
            }
          }}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: 0,
            background: "transparent",
            cursor: "pointer",
            zIndex: 1
          }}
        />

        {!playing && (
          <button
            type="button"
            aria-label="Play video"
            onClick={togglePlay}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 65,
              height: 65,
              border: 0,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.88)",
              color: "#111827",
              zIndex: 3,
              display: "grid",
              placeItems: "center"
            }}
          >
            <Play size={27} fill="currentColor" />
          </button>
        )}

        {controlsVisible && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 5,
              padding: expanded ? "10px 15px" : "8px",
              background:
                "linear-gradient(transparent, rgba(0,0,0,0.92))",
              color: "#fff"
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <input
              type="range"
              min="0"
              max={duration > 0 ? duration : 1}
              step="0.1"
              value={Math.min(current, duration || 1)}
              onChange={(event) => seekTo(event.target.value)}
              aria-label="Seek video"
              style={{
                width: "100%",
                accentColor: "#a78bfa",
                cursor: "pointer"
              }}
            />

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                justifyContent: "space-between",
                flexWrap: "nowrap"
              }}
            >
              <button
                type="button"
                style={buttonStyle}
                onClick={togglePlay}
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing
                  ? <Pause size={18} />
                  : <Play size={18} />}
              </button>

              <span
                style={{
                  fontSize: 11,
                  whiteSpace: "nowrap",
                  fontVariantNumeric: "tabular-nums",
                  marginRight: "auto"
                }}
              >
                {formatTime(current)} / {formatTime(duration)}
              </span>

              <button
                type="button"
                style={buttonStyle}
                onClick={changeVolume}
                aria-label="Toggle sound"
              >
                {muted
                  ? <VolumeX size={17} />
                  : <Volume2 size={17} />}
              </button>

              {boardReady && (
                <button
                  type="button"
                  style={buttonStyle}
                  onClick={() => {
                    setCamVisible(v => !v);
                    revealControls();
                  }}
                  aria-label={camVisible ? "Hide teacher" : "Show teacher"}
                >
                  {camVisible ? "Cam ✕" : "Cam ✓"}
                </button>
              )}

              <button
                type="button"
                style={buttonStyle}
                onClick={changeSpeed}
                aria-label="Change playback speed"
              >
                {speed}×
              </button>

              {showSlides && (
                <button
                  type="button"
                  style={buttonStyle}
                  onClick={openSlides}
                  aria-label="Show slides"
                >
                  <Images size={17} />
                </button>
              )}

              <button
                type="button"
                style={buttonStyle}
                onClick={() =>
                  expanded
                    ? restoreLayout()
                    : enterScreenMode("landscape")
                }
                aria-label={
                  expanded ? "Exit expanded view" : "Landscape"
                }
              >
                {expanded
                  ? <Minimize size={17} />
                  : <RotateCw size={17} />}
              </button>

              {!expanded && (
                <button
                  type="button"
                  style={buttonStyle}
                  onClick={() => enterScreenMode("fullscreen")}
                  aria-label="Fullscreen"
                >
                  <Maximize size={17} />
                </button>
              )}
            </div>
          </div>
        )}


      </div>

      {message && (
        <p style={{ color: "#fca5a5", fontSize: 12 }}>
          {message}
        </p>
      )}

      {slidesOpen && showSlides && (
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
              "calc(20px + env(safe-area-inset-top, 0px)) 16px 24px"
          }}
        >
          <div style={{ maxWidth: 950, margin: "0 auto" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16
              }}
            >
              <h2>Class Slides</h2>

              <button
                type="button"
                onClick={() => setSlidesOpen(false)}
                style={{
                  ...buttonStyle,
                  padding: "10px 15px"
                }}
              >
                <X size={17} />
                Close
              </button>
            </div>

            <ClassSlides
              lectureId={lectureId}
              playbackUrl={src}
            />
          </div>
        </div>
      )}
    </>
  );
}
