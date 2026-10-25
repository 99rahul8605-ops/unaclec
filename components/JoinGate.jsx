"use client";

export default function JoinGate({ gate }) {
  const chats = gate?.chats || [];

  function open(link) {
    const tg = window.Telegram?.WebApp;
    if (/^https:\/\/(t|telegram)\.me\//.test(link) && tg?.openTelegramLink) {
      tg.openTelegramLink(link);
    } else {
      window.open(link, "_blank", "noopener");
    }
  }

  const button = {
    border: 0,
    borderRadius: 12,
    padding: "12px 16px",
    fontWeight: 600,
    color: "white",
    cursor: "pointer",
    width: "100%"
  };

  return (
    <div className="empty-state" style={{ maxWidth: 420, margin: "0 auto" }}>
      <div style={{ fontSize: 42 }}>🔒</div>
      <h3>Join to continue</h3>
      <p>Please join the following to unlock your lectures.</p>

      <div style={{ display: "grid", gap: 10, width: "100%", marginTop: 14 }}>
        {chats.map((chat, index) =>
          chat.link ? (
            <button
              key={index}
              onClick={() => open(chat.link)}
              style={{ ...button, background: "#8651ed" }}
            >
              {chat.type === "channel" ? "📢" : "👥"} Join {chat.title}
            </button>
          ) : (
            <div key={index} style={{ opacity: 0.8 }}>
              {chat.title} (ask the admin for the join link)
            </div>
          )
        )}

        <button
          onClick={() => window.location.reload()}
          style={{ ...button, background: "#1f6b45", marginTop: 6 }}
        >
          ✅ I have joined — Verify
        </button>
      </div>
    </div>
  );
}
