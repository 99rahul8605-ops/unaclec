"use client";

import { useState } from "react";

const cards = [
  { title: "Today's Users", icon: "👥" },
  { title: "Total Students", icon: "🎓" },
  { title: "Video Plays", icon: "▶️" },
  { title: "Active Batches", icon: "📚" }
];

export default function AdminPage() {
  const [tab, setTab] = useState("Overview");
  const [packUrl, setPackUrl] = useState("");

  const tabs = [
    "Overview",
    "Batches",
    "Import",
    "Force Join"
  ];

  const panel = {
    background: "#19182e",
    border: "1px solid #302b49",
    borderRadius: 18,
    padding: 18
  };

  return (
    <main style={{
      background: "#090b18",
      minHeight: "100vh",
      color: "white",
      padding: "25px 15px",
      fontFamily: "system-ui"
    }}>
      <div style={{ maxWidth: 850, margin: "auto" }}>

        <p style={{
          color: "#aa83ff",
          fontSize: 12,
          fontWeight: 700
        }}>
          LECTURE MANAGER
        </p>

        <h1 style={{ marginBottom: 5 }}>
          Admin Control Center ✦
        </h1>

        <p style={{
          color: "#9994b2",
          fontSize: 13
        }}>
          Manage your lectures and students
        </p>

        <nav style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          marginTop: 25,
          marginBottom: 25
        }}>
          {tabs.map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              style={{
                border: 0,
                borderRadius: 12,
                padding: "12px 15px",
                whiteSpace: "nowrap",
                color: "white",
                background: tab === item
                  ? "#8651ed"
                  : "#242138",
                fontWeight: 600
              }}
            >
              {item}
            </button>
          ))}
        </nav>

        {tab === "Overview" && (
          <>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12
            }}>
              {cards.map((card) => (
                <div key={card.title} style={panel}>
                  <div style={{ fontSize: 25 }}>
                    {card.icon}
                  </div>
                  <h2 style={{
                    fontSize: 30,
                    marginBottom: 5
                  }}>
                    —
                  </h2>
                  <p style={{
                    fontSize: 13,
                    color: "#b7b1ce"
                  }}>
                    {card.title}
                  </p>
                </div>
              ))}
            </div>

            <section style={{
              ...panel,
              marginTop: 15
            }}>
              <h3>📈 Daily Activity</h3>
              <p style={{ color: "#aaa3c3" }}>
                Analytics integration pending.
              </p>
            </section>
          </>
        )}

        {tab === "Batches" && (
          <section style={panel}>
            <h3>📚 Batch Manager</h3>
            <p style={{ color: "#aaa3c3" }}>
              Existing batches will appear here
              after connecting the admin API.
            </p>
          </section>
        )}

        {tab === "Import" && (
          <section style={panel}>
            <h3>🔗 Import New Batch</h3>

            <p style={{
              color: "#aaa3c3",
              fontSize: 13
            }}>
              Paste your HR Vertex pack link.
            </p>

            <input
              value={packUrl}
              onChange={(e) => setPackUrl(e.target.value)}
              placeholder="https://unacademy.hrvertex.workers.dev/pack/..."
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: 14,
                borderRadius: 12,
                border: "1px solid #494164",
                background: "#101021",
                color: "white",
                marginTop: 10
              }}
            />

            <button
              disabled
              style={{
                marginTop: 15,
                padding: 14,
                borderRadius: 12,
                border: 0,
                background: "#8651ed",
                opacity: 0.5,
                color: "white",
                width: "100%"
              }}
            >
              Preview Batch — Coming Soon
            </button>
          </section>
        )}

        {tab === "Force Join" && (
          <section style={panel}>
            <h3>🛡️ Force Join Settings</h3>

            <p style={{ color: "#aaa3c3" }}>
              Connect Telegram channels and groups
              here after server-side membership
              verification is enabled.
            </p>

            <div style={{
              padding: 12,
              background: "#26213c",
              borderRadius: 12
            }}>
              Status: OFF
            </div>
          </section>
        )}

      </div>
    </main>
  );
}
