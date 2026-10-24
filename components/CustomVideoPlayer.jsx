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
  const [cameraVisible, setCameraVisible] = useState(true);
  // TEACHER_CAM_DRAG_V3
  const [teacherCamPos, setTeacherCamPos] = useState({
    x: 70,
    y: 6
  });

  const teacherDragRef = useRef(null);

  function teacherDragStart(e) {
    if (!boardReady || !cameraVisible) return;

    e.preventDefault();
    e.stopPropagation();

    teacherDragRef.current = {
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      x: teacherCamPos.x,
      y: teacherCamPos.y
    };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  }

  function teacherDragMove(e) {
    const drag = teacherDragRef.current;
    const box = playerRef.current;

    if (
      !drag ||
      !box ||
      drag.pointerId !== e.pointerId
    ) return;

    e.preventDefault();
    e.stopPropagation();

    const w = box.offsetWidth;
    const h = box.offsetHeight;

    if (!w || !h) return;

    const screenX = e.clientX - drag.clientX;
    const screenY = e.clientY - drag.clientY;

    // Convert screen movement into player coordinates
    // when landscape is using CSS rotate(90deg).
    const localX = landscape ? screenY : screenX;
    const localY = landscape ? -screenX : screenY;

    const x = drag.x + (localX / w) * 100;
    const y = drag.y + (localY / h) * 100;

    // Camera occupies 27% width, 27% height
    // when player aspect ratio is 16:9.
    setTeacherCamPos({
      x: Math.max(0, Math.min(73, x)),
      y: Math.max(0, Math.min(73, y))
    });
  }

  function teacherDragEnd(e) {
    if (
      teacherDragRef.current?.pointerId === e.pointerId
    ) {
      teacherDragRef.current = null;
      e.stopPropagation();
    }
  }

  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [landscape, setLandscape] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [slidesOpen, setSlidesOpen] = useState(false);
  const [message, setMessage] = useState("");

  const video = () => videoRef?.current || fallbackRef.current;

  const restoreLayout = useCallback(() => {
    if (restoreRef.current) {
      restoreRef.current();
      restoreRef.current = null;
    }

    setLandscape(false);
    setFullscreen(false);
    setControlsVisible(true);
  }, []);

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    hideTimerRef.current = setTimeout(() => {
      const el = videoRef?.current || fallbackRef.current;

      if (el && !el.paused) {
        setControlsVisible(false);
      }
    }, 3000);
  }, [videoRef]);

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
        top: "calc((100dvh - min(100dvh, 177.7778dvw)) / 2)",
        left: "calc((100dvw + min(56.25dvh, 100dvw)) / 2)",
        width: "min(100dvh, 177.7778dvw)",
        height: "min(56.25dvh, 100dvw)",
        aspectRatio: "16 / 9",
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

        {boardReady && (
          <button
            type="button"
            onClick={() => setCameraVisible((v) => !v)}
            style={{
              position: "absolute",
              top: expanded ? "auto" : 8,
              bottom: expanded ? 58 : "auto",
              left: 8,
              zIndex: 10,
              border: 0,
              borderRadius: 8,
              padding: "6px 10px",
              color: "#fff",
              background: "rgba(0,0,0,.8)",
              fontSize: 12
            }}
          >
            {cameraVisible ? "Hide Cam" : "Show Cam"}
          </button>
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
            top: boardReady ? `${teacherCamPos.y}%` : 0,
            left: boardReady ? `${teacherCamPos.x}%` : 0,
            width: boardReady ? "27%" : "100%",
            height: boardReady ? "27%" : "100%",
            display: "block",
            opacity: boardReady && !cameraVisible ? 0 : 1,
            objectFit: "contain",
            background: "#000",
            border: boardReady && cameraVisible
              ? "2px solid #fff"
              : "none",
            boxSizing: "border-box",
            borderRadius: boardReady ? 6 : 0,
            zIndex: boardReady ? 3 : 0,
            pointerEvents: "none"
          }}
        />

        {boardReady && cameraVisible && (
          <div
            onPointerDown={teacherDragStart}
            onPointerMove={teacherDragMove}
            onPointerUp={teacherDragEnd}
            onPointerCancel={teacherDragEnd}
            onClick={(e) => e.stopPropagation()}
            title="Drag teacher camera"
            style={{
              position: "absolute",
              top: `${teacherCamPos.y}%`,
              left: `${teacherCamPos.x}%`,
              width: "27%",
              height: "27%",
              zIndex: 4,
              touchAction: "none",
              cursor: "grab",
              userSelect: "none",
              WebkitUserSelect: "none"
            }}
          >
            {controlsVisible && (
              <span
                style={{
                  position: "absolute",
                  top: 3,
                  left: 3,
                  background: "rgba(0,0,0,.7)",
                  borderRadius: 5,
                  padding: "2px 5px",
                  fontSize: 10,
                  color: "white",
                  pointerEvents: "none"
                }}
              >
                ↔ Move
              </span>
            )}
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

              <button
                type="button"
                style={{
                  ...buttonStyle,
                  minWidth: 34,
                  padding: "7px 5px"
                }}
                aria-label="Seek backward 10 seconds"
                onClick={() => {
                  const el = video();
                  if (!el) return;
                  el.currentTime = Math.max(
                    0,
                    (el.currentTime || 0) - 10
                  );
                  revealControls();
                }}
              >
                −10s
              </button>

              <button
                type="button"
                style={{
                  ...buttonStyle,
                  minWidth: 34,
                  padding: "7px 5px"
                }}
                aria-label="Seek forward 10 seconds"
                onClick={() => {
                  const el = video();
                  if (!el) return;

                  const target = (el.currentTime || 0) + 10;

                  el.currentTime =
                    Number.isFinite(el.duration) &&
                    el.duration > 0
                      ? Math.min(el.duration, target)
                      : target;

                  revealControls();
                }}
              >
                +10s
              </button>

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

        {expanded && controlsVisible && (
          <button
            type="button"
            onClick={restoreLayout}
            aria-label="Exit landscape or fullscreen"
            style={{
              ...buttonStyle,
              position: "absolute",
              top: 12,
              right: 12,
              zIndex: 8,
              borderRadius: 100,
              background: "rgba(0,0,0,0.65)"
            }}
          >
            <X size={19} />
          </button>
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
