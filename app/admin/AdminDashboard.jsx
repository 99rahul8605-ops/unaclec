"use client";

import { useCallback, useEffect, useState } from "react";

const TABS = ["Overview", "Batches", "Import", "Students"];

const EXAMPLE = JSON.stringify(
  {
    batches: [
      {
        id: "my-batch",
        name: "My Batch",
        description: "Short description",
        published: true,
        subjects: [
          {
            id: "subject-1",
            name: "Subject 1",
            lectures: [
              {
                id: "lecture-1",
                name: "Lecture 1",
                class_number: 1,
                duration: 0,
                stream_url: "",
                notes_url: ""
              }
            ]
          }
        ]
      }
    ]
  },
  null,
  2
);

const panel = {
  background: "#19182e",
  border: "1px solid #302b49",
  borderRadius: 18,
  padding: 18
};

const muted = { color: "#aaa3c3", fontSize: 13 };

function btn(bg = "#8651ed", extra = {}) {
  return {
    border: 0,
    borderRadius: 10,
    padding: "10px 14px",
    background: bg,
    color: "white",
    fontWeight: 600,
    cursor: "pointer",
    ...extra
  };
}

async function api(path, options = {}) {
  const initData =
    (typeof window !== "undefined" && window.Telegram?.WebApp?.initData) || "";

  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-telegram-init-data": initData,
      ...(options.headers || {})
    },
    cache: "no-store"
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      });
}

function Notice({ error, ok }) {
  if (!error && !ok) return null;
  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 12,
        fontSize: 13,
        whiteSpace: "pre-line",
        background: error ? "#3b1d2a" : "#173326",
        color: error ? "#ffb3c6" : "#a8f0c6",
        wordBreak: "break-word"
      }}
    >
      {error || ok}
    </div>
  );
}

function Overview() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setStats(await api("/api/admin/stats"));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cards = stats
    ? [
        { icon: "👥", label: "Active Today", value: stats.todayUsers },
        { icon: "🎓", label: "Total Students", value: stats.totalStudents },
        { icon: "▶️", label: "Lectures Watched", value: stats.videoPlays },
        { icon: "✅", label: "Completed", value: stats.completed },
        {
          icon: "📚",
          label: "Active Batches",
          value: `${stats.activeBatches}/${stats.totalBatches}`
        },
        { icon: "🎬", label: "Total Lectures", value: stats.totalLectures }
      ]
    : [];

  const maxPlays = stats ? Math.max(1, ...stats.daily.map((d) => d.plays)) : 1;

  return (
    <>
      <Notice error={error} />
      {!stats && !error && <p style={muted}>Loading…</p>}

      {stats && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12
            }}
          >
            {cards.map((card) => (
              <div key={card.label} style={panel}>
                <div style={{ fontSize: 24 }}>{card.icon}</div>
                <h2 style={{ fontSize: 28, margin: "6px 0" }}>{card.value}</h2>
                <p style={muted}>{card.label}</p>
              </div>
            ))}
          </div>

          <section style={{ ...panel, marginTop: 14 }}>
            <h3 style={{ marginTop: 0 }}>📈 Last 7 days</h3>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 8,
                height: 120
              }}
            >
              {stats.daily.map((d) => (
                <div
                  key={d.day}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    fontSize: 11,
                    color: "#b7b1ce"
                  }}
                >
                  <div style={{ marginBottom: 4 }}>{d.plays}</div>
                  <div
                    title={`${d.users} students`}
                    style={{
                      height: Math.max(4, (d.plays / maxPlays) * 80),
                      background: "#8651ed",
                      borderRadius: 6
                    }}
                  />
                  <div style={{ marginTop: 4 }}>{d.day.slice(8)}</div>
                </div>
              ))}
            </div>
            <p style={{ ...muted, marginTop: 10 }}>
              Lectures last touched per day (a lecture is counted on the day it
              was last watched).
            </p>
          </section>
        </>
      )}

      <button style={{ ...btn("#242138"), marginTop: 14 }} onClick={load}>
        ↻ Refresh
      </button>
    </>
  );
}

function Batches() {
  const [batches, setBatches] = useState(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState("");
  const [confirmId, setConfirmId] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await api("/api/admin/batches");
      setBatches(data.batches);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function togglePublish(batch) {
    setBusy(batch.id);
    setOk("");
    setError("");
    try {
      await api("/api/admin/batches", {
        method: "PATCH",
        body: JSON.stringify({ id: batch.id, published: !batch.published })
      });
      setOk(
        `${batch.name}: ${batch.published ? "hidden from students" : "published"}`
      );
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  async function remove(batch) {
    setBusy(batch.id);
    setOk("");
    setError("");
    try {
      await api(`/api/admin/batches?id=${encodeURIComponent(batch.id)}`, {
        method: "DELETE"
      });
      setConfirmId("");
      setOk(`Deleted: ${batch.name}`);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <Notice error={error} ok={ok} />
      {!batches && !error && <p style={muted}>Loading…</p>}
      {batches && batches.length === 0 && (
        <section style={panel}>
          <p style={muted}>No batches yet. Use the Import tab.</p>
        </section>
      )}

      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        {(batches || []).map((batch) => (
          <section key={batch.id} style={panel}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16 }}>{batch.name}</h3>
              <span
                style={{
                  fontSize: 11,
                  padding: "4px 8px",
                  borderRadius: 8,
                  height: "fit-content",
                  background: batch.published ? "#173326" : "#3b2d17",
                  color: batch.published ? "#a8f0c6" : "#ffd89a"
                }}
              >
                {batch.published ? "LIVE" : "HIDDEN"}
              </span>
            </div>

            <p style={{ ...muted, margin: "8px 0" }}>
              {batch.subjects} subjects · {batch.lectures} lectures ·{" "}
              {batch.withStreamUrl} with direct stream URL
            </p>
            <p style={{ ...muted, margin: 0 }}>
              Updated {formatDate(batch.updatedAt)}
            </p>

            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 12,
                flexWrap: "wrap"
              }}
            >
              <button
                disabled={busy === batch.id}
                onClick={() => togglePublish(batch)}
                style={btn(batch.published ? "#4a3a1a" : "#1f6b45")}
              >
                {batch.published ? "Hide" : "Publish"}
              </button>

              {confirmId === batch.id ? (
                <>
                  <button
                    disabled={busy === batch.id}
                    onClick={() => remove(batch)}
                    style={btn("#b3263f")}
                  >
                    Confirm delete
                  </button>
                  <button onClick={() => setConfirmId("")} style={btn("#242138")}>
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  disabled={busy === batch.id}
                  onClick={() => setConfirmId(batch.id)}
                  style={btn("#3b1d2a")}
                >
                  Delete
                </button>
              )}
            </div>
          </section>
        ))}
      </div>

      <button style={{ ...btn("#242138"), marginTop: 14 }} onClick={load}>
        ↻ Refresh
      </button>
    </>
  );
}

function ImportTab() {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  async function readFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setError("File too large (max 4 MB).");
      return;
    }
    setText(await file.text());
    setError("");
    setOk("");
  }

  async function submit() {
    setError("");
    setOk("");

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      setError("Invalid JSON. Check commas and quotes.");
      return;
    }

    setBusy(true);
    try {
      const result = await api("/api/admin/import", {
        method: "POST",
        body: JSON.stringify(parsed)
      });
      setOk(
        result.batches
          .map((b) => `${b.name}: ${b.subjects} subjects, ${b.lectures} lectures`)
          .join("\n")
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={panel}>
      <h3 style={{ marginTop: 0 }}>🔗 Import Catalog (JSON)</h3>
      <p style={muted}>
        Paste catalog JSON (same format as catalog-example.json) or choose a
        file. Existing batches with the same id are updated.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='{"batches":[...]}'
        rows={12}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: 12,
          borderRadius: 12,
          border: "1px solid #494164",
          background: "#101021",
          color: "white",
          fontFamily: "monospace",
          fontSize: 12
        }}
      />

      <div
        style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}
      >
        <button disabled={busy || !text.trim()} onClick={submit} style={btn()}>
          {busy ? "Importing…" : "Import"}
        </button>
        <button onClick={() => setText(EXAMPLE)} style={btn("#242138")}>
          Load example
        </button>
        <label style={btn("#242138", { display: "inline-block" })}>
          Choose file
          <input
            type="file"
            accept="application/json,.json"
            onChange={readFile}
            style={{ display: "none" }}
          />
        </label>
      </div>

      <Notice error={error} ok={ok} />
      <p style={{ ...muted, marginTop: 12 }}>
        Videos only play if a lecture has a direct HTTPS stream_url, or belongs
        to a batch configured on the stream server.
      </p>
    </section>
  );
}

function Students() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/admin/stats")
      .then((s) => setRows(s.recentStudents))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <section style={panel}>
      <h3 style={{ marginTop: 0 }}>🎓 Recent Students</h3>
      <Notice error={error} />
      {!rows && !error && <p style={muted}>Loading…</p>}
      {rows && rows.length === 0 && (
        <p style={muted}>No student activity yet.</p>
      )}
      <div style={{ display: "grid", gap: 8 }}>
        {(rows || []).map((r) => (
          <div
            key={r.userId}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              padding: 10,
              background: "#26213c",
              borderRadius: 12,
              fontSize: 13
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>ID {r.userId}</div>
              <div style={muted}>Last active {formatDate(r.last)}</div>
            </div>
            <div style={{ textAlign: "right", ...muted }}>
              {r.lectures} lectures
              <br />
              {r.completed} completed
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState("Overview");

  return (
    <main
      style={{
        background: "#090b18",
        minHeight: "100vh",
        color: "white",
        padding: "25px 15px",
        fontFamily: "system-ui"
      }}
    >
      <div style={{ maxWidth: 850, margin: "auto" }}>
        <p style={{ color: "#aa83ff", fontSize: 12, fontWeight: 700 }}>
          LECTURE MANAGER
        </p>
        <h1 style={{ marginBottom: 5 }}>Admin Control Center ✦</h1>
        <p style={muted}>Manage your lectures and students</p>

        <nav
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            margin: "25px 0"
          }}
        >
          {TABS.map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              style={{
                ...btn(tab === item ? "#8651ed" : "#242138"),
                padding: "12px 15px",
                whiteSpace: "nowrap"
              }}
            >
              {item}
            </button>
          ))}
        </nav>

        {tab === "Overview" && <Overview />}
        {tab === "Batches" && <Batches />}
        {tab === "Import" && <ImportTab />}
        {tab === "Students" && <Students />}
      </div>
    </main>
  );
}
