"use client";

import { useCallback, useEffect, useState } from "react";

const TABS = ["Overview", "Batches", "Import", "Students", "Force Join"];

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
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [json, setJson] = useState("");

  async function readTxt(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setOk("");
    setPreview(null);

    if (file.size > 5 * 1024 * 1024) {
      setError("File too large (max 5 MB).");
      return;
    }

    const content = await file.text();
    setText(content);
    setFileName(file.name);

    setBusy(true);
    try {
      const result = await api("/api/admin/import-txt", {
        method: "POST",
        body: JSON.stringify({ text: content, dryRun: true })
      });
      setPreview(result.batches);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function publish(published) {
    setBusy(true);
    setError("");
    setOk("");
    try {
      const result = await api("/api/admin/import-txt", {
        method: "POST",
        body: JSON.stringify({ text, published })
      });
      setOk(
        result.batches
          .map((b) => `${b.name}: ${b.subjects} subjects, ${b.lectures} lectures`)
          .join("\n") +
          (published ? "\n\nLive for students." : "\n\nSaved as hidden.")
      );
      setPreview(null);
      setText("");
      setFileName("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function importJson() {
    setError("");
    setOk("");
    let parsed;
    try {
      parsed = JSON.parse(json);
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
    <>
      <section style={panel}>
        <h3 style={{ marginTop: 0 }}>➕ Add a new batch</h3>
        <ol style={{ ...muted, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>In the Telegram bot, pick the batch and export its TXT file.</li>
          <li>Choose that TXT file below.</li>
          <li>Check the summary, then press Publish.</li>
        </ol>

        <label style={btn("#8651ed", { display: "inline-block" })}>
          📄 Choose TXT file
          <input
            type="file"
            accept=".txt,text/plain"
            onChange={readTxt}
            style={{ display: "none" }}
          />
        </label>
        {fileName && <span style={{ ...muted, marginLeft: 10 }}>{fileName}</span>}

        {busy && <p style={muted}>Working…</p>}

        {preview && (
          <div style={{ marginTop: 14 }}>
            {preview.map((b) => (
              <div
                key={b.id}
                style={{ padding: 12, background: "#26213c", borderRadius: 12, marginBottom: 8 }}
              >
                <strong>{b.name}</strong>
                <div style={muted}>
                  {b.subjects} subjects · {b.lectures} lectures
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button disabled={busy} onClick={() => publish(true)} style={btn("#1f6b45")}>
                Publish for students
              </button>
              <button disabled={busy} onClick={() => publish(false)} style={btn("#242138")}>
                Save as hidden
              </button>
            </div>
          </div>
        )}

        <Notice error={error} ok={ok} />
      </section>

      <button
        onClick={() => setShowJson(!showJson)}
        style={{ ...btn("#242138"), marginTop: 14 }}
      >
        {showJson ? "Hide" : "Show"} advanced (JSON import)
      </button>

      {showJson && (
        <section style={{ ...panel, marginTop: 12 }}>
          <p style={muted}>Paste catalog JSON (same format as catalog-example.json).</p>
          <textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            placeholder='{"batches":[...]}'
            rows={10}
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
          <button
            disabled={busy || !json.trim()}
            onClick={importJson}
            style={{ ...btn(), marginTop: 10 }}
          >
            Import JSON
          </button>
        </section>
      )}
    </>
  );
}

function Students() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    api("/api/admin/stats")
      .then((s) => setRows(s.recentStudents))
      .catch((e) => setError(e.message));
  }, []);

  const q = query.trim().toLowerCase();
  const shown = (rows || []).filter(
    (r) =>
      !q ||
      String(r.name).toLowerCase().includes(q) ||
      String(r.username).toLowerCase().includes(q) ||
      String(r.userId).includes(q)
  );

  return (
    <section style={panel}>
      <h3 style={{ marginTop: 0 }}>🎓 Students</h3>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name, @username or ID"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: 10,
          borderRadius: 10,
          border: "1px solid #494164",
          background: "#101021",
          color: "white",
          marginBottom: 12
        }}
      />
      <Notice error={error} />
      {!rows && !error && <p style={muted}>Loading…</p>}
      {rows && shown.length === 0 && <p style={muted}>No students found.</p>}
      <div style={{ display: "grid", gap: 8 }}>
        {shown.map((r) => (
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
              <div style={{ fontWeight: 600 }}>
                {r.name || "Student"}
                {r.username ? ` · @${r.username}` : ""}
              </div>
              <div style={muted}>
                ID {r.userId} · last active {formatDate(r.last)}
              </div>
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

function ForceJoin() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [chatId, setChatId] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api("/api/admin/forcejoin"));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function run(fn, success) {
    setBusy(true);
    setError("");
    setOk("");
    try {
      const result = await fn();
      setOk(success(result));
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const add = () =>
    run(
      async () => {
        const result = await api("/api/admin/forcejoin", {
          method: "POST",
          body: JSON.stringify({ chatId, link })
        });
        setChatId("");
        setLink("");
        return result;
      },
      (r) =>
        `Added ${r.chat.title}.` +
        (r.warning ? `\n⚠️ ${r.warning}` : "") +
        (r.linkMissing
          ? "\n⚠️ No invite link found. Paste one, or students will not see a Join button."
          : "")
    );

  const toggle = () =>
    run(
      () =>
        api("/api/admin/forcejoin", {
          method: "PATCH",
          body: JSON.stringify({ enabled: !data.enabled })
        }),
      () => (data.enabled ? "Force join is OFF." : "Force join is ON.")
    );

  const remove = (chat) =>
    run(
      () => api(`/api/admin/forcejoin?chatId=${chat.chatId}`, { method: "DELETE" }),
      () => `Removed ${chat.title}.`
    );

  const input = {
    width: "100%",
    boxSizing: "border-box",
    padding: 10,
    borderRadius: 10,
    border: "1px solid #494164",
    background: "#101021",
    color: "white",
    marginBottom: 8
  };

  return (
    <>
      <section style={panel}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div>
            <h3 style={{ margin: 0 }}>🔐 Force Join</h3>
            <p style={{ ...muted, margin: "6px 0 0" }}>
              Students must join all chats below to open lectures.
            </p>
          </div>
          {data && (
            <button
              disabled={busy}
              onClick={toggle}
              style={btn(data.enabled ? "#1f6b45" : "#3b2d17", { height: "fit-content" })}
            >
              {data.enabled ? "ON" : "OFF"}
            </button>
          )}
        </div>
        <Notice error={error} ok={ok} />
      </section>

      <section style={{ ...panel, marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Required chats</h3>
        {!data && !error && <p style={muted}>Loading…</p>}
        {data && data.chats.length === 0 && (
          <p style={muted}>None yet. Add a group or channel below.</p>
        )}
        <div style={{ display: "grid", gap: 8 }}>
          {(data?.chats || []).map((chat) => (
            <div
              key={chat.chatId}
              style={{ padding: 12, background: "#26213c", borderRadius: 12 }}
            >
              <strong>
                {chat.type === "channel" ? "📢" : "👥"} {chat.title}
              </strong>
              <div style={muted}>ID {chat.chatId}</div>
              <div style={{ fontSize: 12, marginTop: 4, color: chat.bot?.ok ? "#a8f0c6" : "#ffd89a" }}>
                {chat.bot?.ok ? "✅" : "⚠️"} {chat.bot?.note}
              </div>
              {!chat.link && (
                <div style={{ fontSize: 12, color: "#ffd89a" }}>⚠️ No join link saved</div>
              )}
              <button
                disabled={busy}
                onClick={() => remove(chat)}
                style={btn("#3b1d2a", { marginTop: 8 })}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      <section style={{ ...panel, marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Add a group / channel</h3>
        <ol style={{ ...muted, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>Add this bot to the group/channel as an admin.</li>
          <li>Enter its ID (like -1001234567890) or @username below.</li>
          <li>Optional: paste an invite link for private chats.</li>
        </ol>
        <input
          style={input}
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
          placeholder="-1001234567890 or @username"
        />
        <input
          style={input}
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="Invite link (optional) https://t.me/+..."
        />
        <button disabled={busy || !chatId.trim()} onClick={add} style={btn()}>
          Add
        </button>
      </section>
    </>
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
        {tab === "Force Join" && <ForceJoin />}
      </div>
    </main>
  );
}
