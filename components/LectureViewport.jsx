"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Images,
  Maximize2,
  Monitor,
  Move,
  Pause,
  Play,
  X,
} from "lucide-react";

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

function formatTime(value) {
  const total = Math.max(0, Math.floor(Number(value) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function LectureViewport({
  batchTitle = "",
  subjectTitle = "",
  lectureTitle = "",
  lectureIndex = 1,
  lectureCount = 1,
  playbackUrl = "",
  teacherCamUrl = "",
  slides = [],
  boardRenderer = null,
  onNext = null,
}) {
  const stageRef = useRef(null);
  const videoRef = useRef(null);
  const camVideoRef = useRef(null);
  const camRef = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [landscapeMode, setLandscapeMode] = useState(false);

  const [slidesOpen, setSlidesOpen] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);

  const [camVisible, setCamVisible] = useState(true);
  const [dragState, setDragState] = useState(null);
  const [camPos, setCamPos] = useState({ x: 16, y: 16 });

  const hasBoard = !!boardRenderer;
  const hasSlides = Array.isArray(slides) && slides.length > 0;
  const boardContent = useMemo(() => {
    if (!boardRenderer) return null;
    if (typeof boardRenderer === "function") {
      return boardRenderer({
        currentTime,
        duration,
        playing,
      });
    }
    return boardRenderer;
  }, [boardRenderer, currentTime, duration, playing]);

  const activeSlide = hasSlides ? slides[slideIndex] : null;
  const speed = SPEEDS[speedIndex];

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoaded = () => {
      setDuration(video.duration || 0);
      setCurrentTime(video.currentTime || 0);
    };

    const onTime = () => {
      setCurrentTime(video.currentTime || 0);
    };

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);

    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
    };
  }, [playbackUrl, hasBoard]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
  }, [speed, playbackUrl]);

  useEffect(() => {
    if (!hasBoard) return;
    const driver = videoRef.current;
    const cam = camVideoRef.current;
    if (!driver || !cam || !teacherCamUrl) return;

    cam.playbackRate = driver.playbackRate || 1;

    const timeGap = Math.abs((cam.currentTime || 0) - (driver.currentTime || 0));
    if (timeGap > 0.5) {
      try {
        cam.currentTime = driver.currentTime || 0;
      } catch {}
    }

    if (playing) {
      cam.play().catch(() => {});
    } else {
      cam.pause();
    }
  }, [hasBoard, teacherCamUrl, currentTime, playing, speed]);

  useEffect(() => {
    if (!(landscapeMode && controlsVisible)) return;
    const timer = setTimeout(() => {
      setControlsVisible(false);
    }, 2200);
    return () => clearTimeout(timer);
  }, [landscapeMode, controlsVisible, currentTime, playing]);

  useEffect(() => {
    if (!dragState) return;

    const move = (event) => {
      const point =
        event.touches && event.touches[0] ? event.touches[0] : event;
      const stage = stageRef.current;
      const cam = camRef.current;
      if (!stage || !cam) return;

      const rect = stage.getBoundingClientRect();
      const camWidth = cam.offsetWidth || 140;
      const camHeight = cam.offsetHeight || 98;

      let x = point.clientX - rect.left - dragState.offsetX;
      let y = point.clientY - rect.top - dragState.offsetY;

      x = Math.max(8, Math.min(x, rect.width - camWidth - 8));
      y = Math.max(8, Math.min(y, rect.height - camHeight - 8));

      setCamPos({ x, y });
    };

    const up = () => setDragState(null);

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up);

    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
  }, [dragState]);

  function startDrag(event) {
    event.stopPropagation();

    const point =
      event.touches && event.touches[0] ? event.touches[0] : event;
    const cam = camRef.current;
    if (!cam) return;

    const rect = cam.getBoundingClientRect();
    setDragState({
      offsetX: point.clientX - rect.left,
      offsetY: point.clientY - rect.top,
    });
  }

  async function togglePlay() {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (video.paused) {
        await video.play();
        setPlaying(true);
      } else {
        video.pause();
        setPlaying(false);
      }
    } catch {}
  }

  function onSeek(event) {
    const video = videoRef.current;
    if (!video) return;

    const value = Number(event.target.value || 0);
    video.currentTime = value;
    setCurrentTime(value);
  }

  function cycleSpeed() {
    setSpeedIndex((prev) => (prev + 1) % SPEEDS.length);
  }

  async function openFullscreen() {
    const node = stageRef.current;
    if (!node) return;

    try {
      if (node.requestFullscreen) {
        await node.requestFullscreen();
      } else if (node.webkitRequestFullscreen) {
        await node.webkitRequestFullscreen();
      }
    } catch {}
  }

  async function openLandscape() {
    setLandscapeMode(true);
    setControlsVisible(true);

    try {
      await openFullscreen();
      if (screen.orientation?.lock) {
        await screen.orientation.lock("landscape");
      }
    } catch {}
  }

  function handleStageTap() {
    if (landscapeMode) {
      setControlsVisible((prev) => !prev);
    }
  }

  function closeSlides() {
    setSlidesOpen(false);
  }

  function prevSlide() {
    setSlideIndex((prev) => Math.max(0, prev - 1));
  }

  function nextSlide() {
    setSlideIndex((prev) => Math.min(slides.length - 1, prev + 1));
  }

  return (
    <>
      <div className="lm-wrap">
        <div className="lm-meta">
          <button
            type="button"
            className="lm-back"
            onClick={() => window.history.back()}
          >
            ← Back
          </button>

          <div className="lm-breadcrumb">
            {batchTitle}
            {subjectTitle ? ` / ${subjectTitle}` : ""}
          </div>

          <h1 className="lm-title">{lectureTitle}</h1>
          <div className="lm-subtitle">
            Lecture {lectureIndex} of {lectureCount}
          </div>
        </div>

        <div
          className="lm-stage"
          ref={stageRef}
          onClick={handleStageTap}
        >
          {hasBoard ? (
            <>
              <div className="lm-board-layer">{boardContent}</div>

              <video
                ref={videoRef}
                src={playbackUrl}
                className="lm-driver-video"
                playsInline
                preload="metadata"
              />

              {teacherCamUrl && camVisible ? (
                <div
                  ref={camRef}
                  className="lm-cam"
                  style={{
                    transform: `translate(${camPos.x}px, ${camPos.y}px)`,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="lm-cam-head">
                    <button
                      type="button"
                      className="lm-cam-drag"
                      onMouseDown={startDrag}
                      onTouchStart={startDrag}
                      title="Move"
                    >
                      <Move size={14} />
                    </button>

                    <button
                      type="button"
                      className="lm-cam-hide"
                      onClick={() => setCamVisible(false)}
                      title="Hide teacher cam"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <video
                    ref={camVideoRef}
                    src={teacherCamUrl}
                    className="lm-cam-video"
                    playsInline
                    muted={false}
                    preload="metadata"
                  />
                </div>
              ) : null}
            </>
          ) : (
            <video
              ref={videoRef}
              src={playbackUrl}
              className="lm-main-video"
              playsInline
              preload="metadata"
            />
          )}

          {!hasBoard && !playing && (
            <button
              type="button"
              className="lm-big-play"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
            >
              <Play size={28} />
            </button>
          )}

          {controlsVisible && (
            <div
              className={`lm-controls ${landscapeMode ? "landscape" : ""}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="lm-top-actions">
                {hasBoard && teacherCamUrl ? (
                  <button
                    type="button"
                    className="lm-chip"
                    onClick={() => setCamVisible((prev) => !prev)}
                  >
                    {camVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                    {camVisible ? "Hide Cam" : "Show Cam"}
                  </button>
                ) : null}

                {hasSlides ? (
                  <button
                    type="button"
                    className="lm-chip"
                    onClick={() => {
                      setSlideIndex(0);
                      setSlidesOpen(true);
                    }}
                  >
                    <Images size={16} />
                    Show Slides
                  </button>
                ) : null}
              </div>

              <div className="lm-bottom-bar">
                <button
                  type="button"
                  className="lm-icon-btn"
                  onClick={togglePlay}
                >
                  {playing ? <Pause size={18} /> : <Play size={18} />}
                </button>

                <div className="lm-time">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>

                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  step="0.01"
                  value={Math.min(currentTime, duration || 0)}
                  onChange={onSeek}
                  className="lm-range"
                />

                <button
                  type="button"
                  className="lm-chip"
                  onClick={cycleSpeed}
                >
                  {speed}x
                </button>

                <button
                  type="button"
                  className="lm-chip"
                  onClick={openFullscreen}
                >
                  <Maximize2 size={16} />
                  Fullscreen
                </button>

                <button
                  type="button"
                  className="lm-chip"
                  onClick={openLandscape}
                >
                  <Monitor size={16} />
                  Landscape
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="lm-footer-card">
          <div className="lm-footer-head">{lectureTitle}</div>
          <div className="lm-footer-sub">Class {lectureIndex}</div>

          {onNext ? (
            <button className="lm-next" onClick={onNext}>
              Next Lecture <ChevronRight size={18} />
            </button>
          ) : null}
        </div>
      </div>

      {slidesOpen && (
        <div className="lm-slides-overlay" onClick={closeSlides}>
          <div
            className="lm-slides-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lm-slides-header">
              <div>
                <div className="lm-slides-title">Class Slides</div>
                <div className="lm-slides-sub">
                  {lectureTitle}
                </div>
              </div>

              <button
                type="button"
                className="lm-slides-close"
                onClick={closeSlides}
              >
                <X size={18} />
                Close
              </button>
            </div>

            {activeSlide ? (
              <>
                <div className="lm-slide-frame">
                  <img
                    src={activeSlide.url}
                    alt={activeSlide.name || `Slide ${slideIndex + 1}`}
                    className="lm-slide-image"
                  />
                </div>

                <div className="lm-slide-nav">
                  <button
                    type="button"
                    className="lm-slide-btn"
                    onClick={prevSlide}
                    disabled={slideIndex === 0}
                  >
                    <ChevronLeft size={18} />
                    Previous
                  </button>

                  <div className="lm-slide-count">
                    {slideIndex + 1} / {slides.length}
                  </div>

                  <button
                    type="button"
                    className="lm-slide-btn"
                    onClick={nextSlide}
                    disabled={slideIndex === slides.length - 1}
                  >
                    Next
                    <ChevronRight size={18} />
                  </button>
                </div>

                <div className="lm-slide-dots">
                  {slides.map((slide, idx) => (
                    <button
                      key={slide.id || slide.url || idx}
                      type="button"
                      className={`lm-dot ${idx === slideIndex ? "active" : ""}`}
                      onClick={() => setSlideIndex(idx)}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="lm-no-slides">No slides available.</div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .lm-wrap {
          min-height: 100vh;
          background: #070b22;
          color: #f5f7ff;
          padding:
            calc(env(safe-area-inset-top, 0px) + 14px)
            16px
            calc(env(safe-area-inset-bottom, 0px) + 24px);
        }

        .lm-meta {
          padding-top: 6px;
        }

        .lm-back {
          border: 0;
          background: transparent;
          color: #bfa9ff;
          font-size: 15px;
          cursor: pointer;
          margin-bottom: 18px;
          padding: 0;
        }

        .lm-breadcrumb {
          color: #b896ff;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.12em;
          line-height: 1.65;
          margin-bottom: 12px;
          word-break: break-word;
        }

        .lm-title {
          margin: 0 0 10px;
          font-size: 28px;
          line-height: 1.12;
          font-weight: 800;
        }

        .lm-subtitle {
          color: #9ca3c3;
          font-size: 15px;
          margin-bottom: 18px;
        }

        .lm-stage {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          border-radius: 24px;
          overflow: hidden;
          background: #0e1433;
          border: 1px solid rgba(255,255,255,0.08);
        }

        .lm-main-video,
        .lm-board-layer {
          width: 100%;
          height: 100%;
          object-fit: contain;
          background: #000;
        }

        .lm-driver-video {
          position: absolute;
          width: 1px;
          height: 1px;
          opacity: 0.001;
          left: 0;
          bottom: 0;
          pointer-events: none;
        }

        .lm-big-play {
          position: absolute;
          inset: 0;
          margin: auto;
          width: 88px;
          height: 88px;
          border-radius: 999px;
          border: 0;
          background: rgba(255,255,255,0.94);
          color: #111827;
          display: grid;
          place-items: center;
          cursor: pointer;
          z-index: 4;
        }

        .lm-controls {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 5;
          background: linear-gradient(
            180deg,
            rgba(7, 11, 34, 0) 0%,
            rgba(7, 11, 34, 0.38) 22%,
            rgba(7, 11, 34, 0.92) 100%
          );
          padding: 10px 12px 12px;
        }

        .lm-top-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          margin-bottom: 10px;
          flex-wrap: wrap;
        }

        .lm-bottom-bar {
          display: grid;
          grid-template-columns: auto auto 1fr auto auto auto;
          gap: 8px;
          align-items: center;
        }

        .lm-chip,
        .lm-icon-btn,
        .lm-slide-btn,
        .lm-slides-close {
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(45, 56, 104, 0.88);
          color: #fff;
          border-radius: 14px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
        }

        .lm-chip {
          padding: 10px 14px;
          font-size: 14px;
        }

        .lm-icon-btn {
          width: 42px;
          height: 42px;
          justify-content: center;
        }

        .lm-time {
          font-size: 13px;
          color: #d7dbef;
          min-width: 92px;
          text-align: center;
        }

        .lm-range {
          width: 100%;
          accent-color: #9560ff;
        }

        .lm-footer-card {
          margin-top: 20px;
          background: #101733;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 18px;
        }

        .lm-footer-head {
          font-size: 19px;
          font-weight: 800;
          margin-bottom: 6px;
        }

        .lm-footer-sub {
          color: #a8b0cf;
          margin-bottom: 16px;
        }

        .lm-next {
          width: 100%;
          border: 0;
          border-radius: 18px;
          background: linear-gradient(135deg, #7c3aed 0%, #9b6dff 100%);
          color: white;
          font-weight: 800;
          padding: 16px 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          cursor: pointer;
          font-size: 18px;
        }

        .lm-cam {
          position: absolute;
          top: 0;
          left: 0;
          width: 34%;
          max-width: 180px;
          min-width: 128px;
          aspect-ratio: 16 / 10;
          border-radius: 18px;
          overflow: hidden;
          z-index: 6;
          background: #000;
          border: 1px solid rgba(255,255,255,0.14);
          box-shadow: 0 10px 28px rgba(0,0,0,0.35);
        }

        .lm-cam-head {
          position: absolute;
          left: 8px;
          right: 8px;
          top: 8px;
          display: flex;
          justify-content: space-between;
          z-index: 7;
        }

        .lm-cam-drag,
        .lm-cam-hide {
          width: 28px;
          height: 28px;
          border-radius: 999px;
          border: 0;
          background: rgba(0,0,0,0.58);
          color: #fff;
          display: grid;
          place-items: center;
          cursor: pointer;
        }

        .lm-cam-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          background: #000;
        }

        .lm-slides-overlay {
          position: fixed;
          inset: 0;
          z-index: 999;
          background: rgba(4, 7, 20, 0.92);
          padding:
            calc(env(safe-area-inset-top, 0px) + 14px)
            14px
            calc(env(safe-area-inset-bottom, 0px) + 18px);
          overflow: auto;
        }

        .lm-slides-panel {
          max-width: 920px;
          margin: 0 auto;
          min-height: calc(100vh - 32px);
          background: transparent;
        }

        .lm-slides-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
          padding-top: 4px;
        }

        .lm-slides-title {
          font-size: 20px;
          font-weight: 800;
        }

        .lm-slides-sub {
          color: #a8b0cf;
          font-size: 14px;
          margin-top: 4px;
        }

        .lm-slides-close {
          padding: 10px 14px;
        }

        .lm-slide-frame {
          width: 100%;
          border-radius: 24px;
          overflow: hidden;
          background: #101733;
          border: 1px solid rgba(255,255,255,0.08);
          margin-bottom: 18px;
        }

        .lm-slide-image {
          display: block;
          width: 100%;
          height: auto;
        }

        .lm-slide-nav {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
        }

        .lm-slide-btn {
          padding: 14px 18px;
          justify-content: center;
        }

        .lm-slide-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .lm-slide-count {
          text-align: center;
          font-weight: 800;
          font-size: 20px;
        }

        .lm-slide-dots {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 10px;
        }

        .lm-dot {
          width: 54px;
          height: 54px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.12);
          background: #283156;
          color: #fff;
          font-size: 24px;
          cursor: pointer;
        }

        .lm-dot.active {
          background: linear-gradient(135deg, #7c3aed 0%, #9b6dff 100%);
        }

        .lm-no-slides {
          padding: 28px;
          border-radius: 22px;
          background: #101733;
          color: #c5cbea;
        }

        @media (max-width: 768px) {
          .lm-title {
            font-size: 22px;
          }

          .lm-bottom-bar {
            grid-template-columns: auto 1fr;
          }

          .lm-time {
            min-width: unset;
            text-align: left;
          }

          .lm-range {
            grid-column: 1 / -1;
          }

          .lm-chip {
            font-size: 13px;
            padding: 10px 12px;
          }

          .lm-cam {
            width: 38%;
            min-width: 120px;
          }
        }
      `}</style>
    </>
  );
}