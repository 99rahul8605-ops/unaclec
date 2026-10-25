
"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import LectureViewport from "../components/LectureViewport";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  Home,
  Layers3,
  LockKeyhole,
  NotebookPen,
  Play,
  Save,
  Search,
  Sparkles,
  Video
} from "lucide-react";
import CustomVideoPlayer from "../components/CustomVideoPlayer";

import ClassSlides from "../components/ClassSlides";
import PlayerTools from "../components/PlayerTools";

function progressKey(batchId, subjectId, lectureId) {
  return `${batchId}|${subjectId}|${lectureId}`;
}

function formatTime(seconds) {
  const n = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(n / 3600);
  const minutes = Math.floor((n % 3600) / 60);
  const secs = n % 60;

  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${minutes}:${String(secs).padStart(2, "0")}`;
}

function countLectures(batch) {
  return (batch.subjects || []).reduce(
    (sum, subject) => sum + (subject.lectures || []).length,
    0
  );
}

function isFoundationPlaybackBatch(batch) {
  return (
    batch?.name?.trim() ===
    "Yoddha Regular Batch for CA Foundation Jan'27/May'27"
  );
}

export default function HomePage() {
  const [initData, setInitData] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [user, setUser] = useState(null);
  const [batches, setBatches] = useState([]);
  const [records, setRecords] = useState({});

  const [selectedBatch, setSelectedBatch] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedLecture, setSelectedLecture] = useState(null);

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("notes");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const [playbackUrl, setPlaybackUrl] = useState("");
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const [playbackError, setPlaybackError] = useState("");

  async function openFullscreen(landscape = false) {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (video.requestFullscreen) {
        await video.requestFullscreen();
      } else if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      } else {
        throw new Error("Fullscreen not supported");
      }

      if (landscape && screen.orientation?.lock) {
        try {
          await screen.orientation.lock("landscape");
        } catch {
          // Telegram or the device may deny orientation lock.
        }
      }
    } catch (err) {
      window.Telegram?.WebApp?.showAlert?.(
        "Fullscreen is not supported in this Telegram client."
      );
    }
  }

  const videoRef = useRef(null);
  const lastSavedRef = useRef(-1);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;

    if (webApp) {
      webApp.ready();
      webApp.expand();
      webApp.setHeaderColor?.("#101322");
      webApp.setBackgroundColor?.("#090c16");
      setInitData(webApp.initData || "");
    }

    setReady(true);
  }, []);


  // Telegram Mini App safe-area handling.
  useEffect(() => {
    const tg = window.Telegram?.WebApp;

    function updateSafeArea() {
      const safe = tg?.safeAreaInset || {};
      const content = tg?.contentSafeAreaInset || {};

      // Telegram's content-safe inset is the relevant space
      // for app content below its own header controls.
      const top = Math.max(
        Number(safe.top) || 0,
        Number(content.top) || 0
      );

      const bottom = Math.max(
        Number(safe.bottom) || 0,
        Number(content.bottom) || 0
      );

      document.documentElement.style.setProperty(
        "--lecture-tg-top",
        `${Math.max(0, top)}px`
      );

      document.documentElement.style.setProperty(
        "--lecture-tg-bottom",
        `${Math.max(0, bottom)}px`
      );
    }

    updateSafeArea();

    tg?.onEvent?.("safeAreaChanged", updateSafeArea);
    tg?.onEvent?.("contentSafeAreaChanged", updateSafeArea);
    tg?.onEvent?.("viewportChanged", updateSafeArea);

    return () => {
      tg?.offEvent?.("safeAreaChanged", updateSafeArea);
      tg?.offEvent?.("contentSafeAreaChanged", updateSafeArea);
      tg?.offEvent?.("viewportChanged", updateSafeArea);
    };
  }, []);

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        ...(options.headers || {}),
        "x-telegram-init-data": initData,
        ...(options.body
          ? { "Content-Type": "application/json" }
          : {})
      },
      cache: "no-store"
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || `Request failed (${response.status})`
      );
    }

    return data;
  }

  useEffect(() => {
    if (!ready) return;

    if (!initData) {
      setError(
        "Open this Mini App from its Telegram bot menu. Direct browser login is disabled."
      );
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/library", {
          headers: {
            "x-telegram-init-data": initData
          },
          cache: "no-store"
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Unable to load library."
          );
        }

        if (cancelled) return;

        setUser(data.user);
        setBatches(data.batches || []);

        const map = {};

        for (const entry of data.progress || []) {
          map[
            progressKey(
              entry.batchId,
              entry.subjectId,
              entry.lectureId
            )
          ] = entry;
        }

        setRecords(map);
        setError("");
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [ready, initData]);

  const allLectures = useMemo(() => {
    const result = [];

    for (const batch of batches) {
      for (const subject of batch.subjects || []) {
        for (const lecture of subject.lectures || []) {
          result.push({ batch, subject, lecture });
        }
      }
    }

    return result;
  }, [batches]);

  const completed = allLectures.filter(
    ({ batch, subject, lecture }) => {
      const key = progressKey(
        batch.id,
        subject.id,
        lecture.id
      );
      return records[key]?.completed === true;
    }
  ).length;

  const filteredBatches = batches.filter(
    (batch) =>
      batch.name.toLowerCase().includes(
        search.toLowerCase()
      ) ||
      (batch.subjects || []).some((subject) =>
        subject.name.toLowerCase().includes(
          search.toLowerCase()
        )
      )
  );

  const currentKey =
    selectedBatch && selectedSubject && selectedLecture
      ? progressKey(
          selectedBatch.id,
          selectedSubject.id,
          selectedLecture.id
        )
      : "";

  const currentRecord = records[currentKey] || {};

  function clearPlayback() {
    setPlaybackUrl("");
    setPlaybackError("");
    setPlaybackLoading(false);
  }

  function openBatch(batch) {
    setSelectedBatch(batch);
    setSelectedSubject(null);
    setSelectedLecture(null);
    setSearch("");
    clearPlayback();
  }

  function openSubject(subject) {
    setSelectedSubject(subject);
    setSelectedLecture(null);
    clearPlayback();
  }

  function openLecture(lecture) {
    setSelectedLecture(lecture);
    setTab("notes");
    setSaveMessage("");
    lastSavedRef.current = -1;
    clearPlayback();

    const key = progressKey(
      selectedBatch.id,
      selectedSubject.id,
      lecture.id
    );

    setNotes(records[key]?.notes || "");
  }

  function goBack() {
    if (selectedLecture) {
      setSelectedLecture(null);
    } else if (selectedSubject) {
      setSelectedSubject(null);
    } else {
      setSelectedBatch(null);
    }

    clearPlayback();
  }

  // Load Telegram signed playback URL for the selected lecture.
  // Existing stream_url remains supported for other batches.
  useEffect(() => {
    if (!selectedLecture || !selectedBatch) return;

    const lectureId = selectedLecture.id;
    let cancelled = false;

    setPlaybackUrl("");
    setPlaybackError("");

    if (!isFoundationPlaybackBatch(selectedBatch)) {
      setPlaybackLoading(false);
      setPlaybackUrl(selectedLecture.stream_url || "");
      return;
    }

    if (!initData) {
      setPlaybackLoading(false);
      setPlaybackError("Telegram login is required.");
      return;
    }

    setPlaybackLoading(true);

    async function connectPlayback() {
      try {
        const response = await fetch(
          `/api/play/${encodeURIComponent(lectureId)}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ initData }),
            cache: "no-store"
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ||
              `Playback error (${response.status})`
          );
        }

        if (!result.url) {
          throw new Error("Streaming URL was not returned.");
        }


        if (!result.session_ticket) {
          throw new Error("Private playback ticket missing");
        }

        const streamOrigin = new URL(result.url).origin;

        if (streamOrigin !== "https://stream.bingolink.site") {
          throw new Error(
            "STREAM_ORIGIN must use stream.bingolink.site"
          );
        }

        const sessionResponse = await fetch(
          `${streamOrigin}/session/bootstrap`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              ticket: result.session_ticket
            }),
            cache: "no-store"
          }
        );

        if (!sessionResponse.ok) {
          let reason = "";
          try {
            const details = await sessionResponse.json();
            reason = details.error || details.detail || "";
          } catch {}

          throw new Error(
            reason
              ? `Private session: ${reason}`
              : `Private session failed (${sessionResponse.status})`
          );
        }

        if (!cancelled) {
          setPlaybackUrl(result.url);
          setPlaybackError("");
        }
      } catch (err) {
        if (!cancelled) {
          setPlaybackError(
            err.message || "Unable to connect playback."
          );
        }
      } finally {
        if (!cancelled) {
          setPlaybackLoading(false);
        }
      }
    }

    connectPlayback();

    return () => {
      cancelled = true;
    };
  }, [selectedLecture, selectedBatch, initData]);

  async function persist(action, values) {
    if (
      !selectedBatch ||
      !selectedSubject ||
      !selectedLecture
    ) {
      return;
    }

    const key = progressKey(
      selectedBatch.id,
      selectedSubject.id,
      selectedLecture.id
    );

    await api("/api/progress", {
      method: "POST",
      body: JSON.stringify({
        batchId: selectedBatch.id,
        subjectId: selectedSubject.id,
        lectureId: selectedLecture.id,
        action,
        ...values
      })
    });

    setRecords((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        ...values,
        updatedAt: new Date().toISOString()
      }
    }));
  }

  async function saveNotes() {
    setSaving(true);
    setSaveMessage("");

    try {
      await persist("notes", { notes });
      setSaveMessage("Notes saved successfully");
    } catch (err) {
      setSaveMessage(err.message);
    } finally {
      setSaving(false);
    }
  }

  function saveWatchProgress(video, force = false) {
    if (!video || !selectedLecture) return;

    const second = Math.floor(video.currentTime || 0);

    if (
      !force &&
      Math.abs(second - lastSavedRef.current) < 10
    ) {
      return;
    }

    lastSavedRef.current = second;

    const complete =
      video.duration > 0 &&
      Number.isFinite(video.duration) &&
      second >= video.duration * 0.95;

    persist("watch", {
      seconds: second,
      completed:
        complete || currentRecord.completed === true
    }).catch(() => {});
  }

  const lectureList = selectedSubject?.lectures || [];

  const currentPosition = selectedLecture
    ? lectureList.findIndex(
        (lecture) => lecture.id === selectedLecture.id
      )
    : -1;

  function nextLecture() {
    const next = lectureList[currentPosition + 1];
    if (next) openLecture(next);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div
          className="brand"
          onClick={() => {
            setSelectedBatch(null);
            setSelectedSubject(null);
            setSelectedLecture(null);
            clearPlayback();
          }}
        >
          <div className="brand-icon">
            <GraduationCap size={23} />
          </div>

          <div>
            <strong>Lecture Manager</strong>
            <small>YOUR LEARNING SPACE</small>
          </div>
        </div>

        <div className="nav-group">
          <div className="nav-label">WORKSPACE</div>

          <button
            className="nav-item active"
            onClick={() => {
              setSelectedBatch(null);
              setSelectedSubject(null);
              setSelectedLecture(null);
              clearPlayback();
            }}
          >
            <Home size={18} />
            Dashboard
          </button>

          <button
            className="nav-item"
            onClick={() => {
              setSelectedBatch(null);
              setSelectedSubject(null);
              setSelectedLecture(null);
              clearPlayback();
            }}
          >
            <Layers3 size={18} />
            My Batches
          </button>
        </div>

        <div className="sidebar-bottom">
          <div className="side-help">
            <Sparkles size={19} />
            <strong>Keep learning</strong>
            <span>
              Your progress and personal notes are saved
              to your Telegram account.
            </span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <div className="mobile-brand">
              <GraduationCap size={21} />
              <strong>Lecture Manager</strong>
            </div>

            <span className="desktop-location">
              Learning Dashboard
            </span>
          </div>

          <div className="profile">
            <div className="avatar">
              {(user?.firstName || "S")[0].toUpperCase()}
            </div>
            <span>{user?.firstName || "Student"}</span>
          </div>
        </header>

        <div className="page-content">
          {loading && (
            <div className="empty-state">
              <div className="spinner" />
              <h3>Loading your library...</h3>
            </div>
          )}

          {!loading && error && (
            <div className="empty-state">
              <LockKeyhole size={40} />
              <h3>Unable to open library</h3>
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && (
            <>
              {(selectedBatch ||
                selectedSubject ||
                selectedLecture) && (
                <button
                  className="back-link"
                  onClick={goBack}
                >
                  <ArrowLeft size={17} />
                  Back
                </button>
              )}

              {!selectedBatch && (
                <>
                  <section className="hero">
                    <div className="hero-copy">
                      <span className="eyebrow">
                        <Sparkles size={14} />
                        YOUR LEARNING JOURNEY
                      </span>

                      <h1>
                        Welcome back,
                        <br />
                        <span>
                          {user?.firstName || "Student"}!
                        </span>
                      </h1>

                      <p>
                        Pick up where you left off. All
                        your lectures, in one beautiful
                        place.
                      </p>

                      <div className="hero-stat">
                        <span>
                          <BookOpen size={16} />
                          {batches.length} batches
                        </span>

                        <span>
                          <CheckCircle2 size={16} />
                          {completed} completed
                        </span>
                      </div>
                    </div>

                    <div className="hero-art">
                      <div className="art-orbit">
                        <GraduationCap size={75} />
                      </div>
                    </div>
                  </section>

                  <div className="section-head">
                    <div>
                      <span className="section-kicker">
                        YOUR COLLECTION
                      </span>
                      <h2>Explore Batches</h2>
                    </div>

                    <div className="search">
                      <Search size={17} />
                      <input
                        placeholder="Search batches..."
                        value={search}
                        onChange={(event) =>
                          setSearch(event.target.value)
                        }
                      />
                    </div>
                  </div>

                  {filteredBatches.length === 0 ? (
                    <div className="empty-state">
                      <BookOpen size={38} />
                      <h3>No batches available</h3>
                      <p>
                        Your administrator can publish
                        batches to this library.
                      </p>
                    </div>
                  ) : (
                    <div className="batch-grid">
                      {filteredBatches.map(
                        (batch, index) => (
                          <button
                            className="batch-card"
                            key={batch.id}
                            onClick={() =>
                              openBatch(batch)
                            }
                          >
                            <div
                              className={
                                "batch-cover shade-" +
                                (index % 4)
                              }
                            >
                              <div className="cover-glow" />
                              <GraduationCap size={57} />
                              <span className="batch-tag">
                                COURSE BATCH
                              </span>
                            </div>

                            <div className="batch-info">
                              <span className="batch-type">
                                LEARNING PROGRAM
                              </span>

                              <h3>{batch.name}</h3>

                              <p>
                                {batch.description ||
                                  "Your complete lecture library"}
                              </p>

                              <div className="batch-meta">
                                <span>
                                  <Layers3 size={15} />
                                  {batch.subjects?.length || 0}
                                  {" "}subjects
                                </span>

                                <span>
                                  <Video size={15} />
                                  {countLectures(batch)}
                                  {" "}lectures
                                </span>
                              </div>

                              <div className="card-action">
                                Explore Batch
                                <ChevronRight size={17} />
                              </div>
                            </div>
                          </button>
                        )
                      )}
                    </div>
                  )}
                </>
              )}

              {selectedBatch && !selectedSubject && (
                <>
                  <div className="page-heading">
                    <span className="section-kicker">
                      BATCH OVERVIEW
                    </span>
                    <h1>{selectedBatch.name}</h1>
                    <p>
                      {selectedBatch.description ||
                        "Choose a subject to start learning."}
                    </p>
                  </div>

                  <div className="section-head">
                    <h2>Subjects</h2>
                    <span className="subtle">
                      {selectedBatch.subjects?.length || 0}
                      {" "}available
                    </span>
                  </div>

                  <div className="subject-grid">
                    {(selectedBatch.subjects || []).map(
                      (subject, index) => (
                        <button
                          key={subject.id}
                          className="subject-card"
                          onClick={() =>
                            openSubject(subject)
                          }
                        >
                          <div
                            className={
                              "subject-icon shade-" +
                              (index % 4)
                            }
                          >
                            <BookOpen size={24} />
                          </div>

                          <div>
                            <h3>{subject.name}</h3>
                            <p>
                              {subject.lectures?.length || 0}
                              {" "}lectures
                            </p>
                          </div>

                          <ChevronRight size={18} />
                        </button>
                      )
                    )}
                  </div>
                </>
              )}

              {selectedSubject && !selectedLecture && (
                <>
                  <div className="page-heading">
                    <span className="section-kicker">
                      {selectedBatch.name}
                    </span>
                    <h1>{selectedSubject.name}</h1>
                    <p>
                      {lectureList.length} lectures in
                      this subject
                    </p>
                  </div>

                  <div className="lecture-list">
                    {lectureList.map((lecture, index) => {
                      const key = progressKey(
                        selectedBatch.id,
                        selectedSubject.id,
                        lecture.id
                      );

                      const record = records[key] || {};

                      return (
                        <button
                          className="lecture-row"
                          key={lecture.id}
                          onClick={() =>
                            openLecture(lecture)
                          }
                        >
                          <div className="lecture-number">
                            {record.completed ? (
                              <CheckCircle2 size={21} />
                            ) : (
                              String(
                                lecture.class_number ||
                                  index + 1
                              ).padStart(2, "0")
                            )}
                          </div>

                          <div className="lecture-details">
                            <h3>{lecture.name}</h3>
                            <p>
                              {record.completed
                                ? "Completed"
                                : record.seconds > 0
                                  ? `Continue at ${formatTime(record.seconds)}`
                                  : "Not started"}
                            </p>
                          </div>

                          <span className="play-icon">
                            <Play size={17} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {selectedLecture && (
                <>
                  <div className="page-heading player-heading">
                    <span className="section-kicker">
                      {selectedBatch.name}
                      {" / "}
                      {selectedSubject.name}
                    </span>

                    <h1>{selectedLecture.name}</h1>
                    <p>
                      Lecture {currentPosition + 1}
                      {" of "}
                      {lectureList.length}
                    </p>
                  </div>

                  <div className="player-layout">
                    <div className="player-main">
                      <div className="video-container">
                        {playbackLoading ? (
                          <div className="no-video">
                            <div className="spinner" />
                            <h3>
                              Connecting to Telegram video...
                            </h3>
                            <p>
                              Preparing secure lecture playback.
                            </p>
                          </div>
                        ) : playbackError ? (
                          <div className="no-video">
                            <div className="no-video-icon">
                              <LockKeyhole size={35} />
                            </div>
                            <h3>Video unavailable</h3>
                            <p>{playbackError}</p>
                          </div>
                        ) : playbackUrl ? (
                          <CustomVideoPlayer
                            key={`${selectedLecture.id}:${playbackUrl}`}
                            videoRef={videoRef}
                            lectureId={selectedLecture.id}
                            showSlides={isFoundationPlaybackBatch(selectedBatch)}
                            src={playbackUrl}
                            crossOrigin="use-credentials"
                            playsInline
                            preload="metadata"
                            disablePictureInPicture
                            onLoadedMetadata={(event) => {
                              const resume =
                                Number(
                                  currentRecord.seconds
                                ) || 0;

                              if (
                                resume > 0 &&
                                resume <
                                  event.currentTarget.duration
                              ) {
                                event.currentTarget.currentTime =
                                  resume;
                              }
                            }}
                            onTimeUpdate={(event) =>
                              saveWatchProgress(
                                event.currentTarget
                              )
                            }
                            onPause={(event) =>
                              saveWatchProgress(
                                event.currentTarget,
                                true
                              )
                            }
                            onEnded={() => {
                              persist("watch", {
                                seconds:
                                  videoRef.current?.duration || 0,
                                completed: true
                              }).catch(() => {});
                            }}
                            onError={() =>
                              setPlaybackError(
                                "Video stream failed. Check HTTPS tunnel, Telegram media access and video format."
                              )
                            }
                          />
                        ) : (
                          <div className="no-video">
                            <div className="no-video-icon">
                              <LockKeyhole size={35} />
                            </div>

                            <h3>
                              Playback not configured
                            </h3>

                            <p>
                              This lecture does not have a
                              streaming URL yet.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="lesson-tools">
                        <div>
                          <h3>{selectedLecture.name}</h3>
                          <p>
                            Class{" "}
                            {selectedLecture.class_number ||
                              currentPosition + 1}
                          </p>
                        </div>
                        



                        <button
                          className="primary-button"
                          onClick={nextLecture}
                          disabled={
                            currentPosition >=
                            lectureList.length - 1
                          }
                        >
                          Next Lecture
                          <ChevronRight size={17} />
                        </button>
                      </div>

                      <div className="note-panel">
                        <div className="tab-header">
                          <button
                            className={
                              tab === "notes"
                                ? "tab active-tab"
                                : "tab"
                            }
                            onClick={() =>
                              setTab("notes")
                            }
                          >
                            <NotebookPen size={16} />
                            My Notes
                          </button>

                          <button
                            className={
                              tab === "resources"
                                ? "tab active-tab"
                                : "tab"
                            }
                            onClick={() =>
                              setTab("resources")
                            }
                          >
                            <BookOpen size={16} />
                            Class Notes
                          </button>
                        </div>

                        {tab === "notes" ? (
                          <div className="notes-content">
                            <h3>
                              Personal Lecture Notes
                            </h3>

                            <p>
                              Write anything you want to
                              remember from this class.
                            </p>

                            <textarea
                              value={notes}
                              onChange={(event) =>
                                setNotes(
                                  event.target.value
                                )
                              }
                              maxLength={10000}
                              placeholder="Start taking notes here..."
                            />

                            <div className="notes-actions">
                              <span>
                                {notes.length}/10000
                              </span>

                              <button
                                className="primary-button"
                                disabled={saving}
                                onClick={saveNotes}
                              >
                                <Save size={16} />
                                {saving
                                  ? "Saving..."
                                  : "Save Notes"}
                              </button>
                            </div>

                            {saveMessage && (
                              <p className="save-message">
                                {saveMessage}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="notes-content">
                            <h3>Class Materials</h3>

                            {isFoundationPlaybackBatch(selectedBatch) && (
                              <ClassSlides
                                lectureId={selectedLecture.id}
                                playbackUrl={playbackUrl}
                              />
                            )}


                            {selectedLecture.notes_url ? (
                              <a
                                className="resource-link"
                                href={
                                  selectedLecture.notes_url
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <BookOpen size={18} />
                                Open Class Notes
                                <ChevronRight size={16} />
                              </a>
                            ) : (
                              <p>
                                No class notes have been
                                added yet.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <aside className="playlist">
                      <div className="playlist-heading">
                        <h3>Up Next</h3>
                        <span>
                          {lectureList.length} lessons
                        </span>
                      </div>

                      {lectureList.map(
                        (lecture, index) => (
                          <button
                            key={lecture.id}
                            className={
                              "playlist-row" +
                              (lecture.id ===
                              selectedLecture.id
                                ? " selected"
                                : "")
                            }
                            onClick={() =>
                              openLecture(lecture)
                            }
                          >
                            <div className="playlist-index">
                              {index + 1}
                            </div>

                            <div>
                              <strong>
                                {lecture.name}
                              </strong>
                              <small>
                                Lecture {index + 1}
                              </small>
                            </div>
                          </button>
                        )
                      )}
                    </aside>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
