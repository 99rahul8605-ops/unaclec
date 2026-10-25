"use client";

import { useEffect, useState } from "react";
import AdminDashboard from "./AdminDashboard";

export default function AdminPage() {
  const [status, setStatus] = useState("Checking admin access...");
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      // Telegram may finish initializing shortly after page mount.
      let initData = "";

      for (let i = 0; i < 30; i++) {
        if (cancelled) return;

        initData = window.Telegram?.WebApp?.initData || "";
        if (initData) break;

        await new Promise(resolve => setTimeout(resolve, 200));
      }

      if (!initData) {
        if (!cancelled) setStatus("Open Admin from Telegram.");
        return;
      }

      try {
        const response = await fetch("/api/admin/me", {
          method: "GET",
          headers: { "x-telegram-init-data": initData },
          cache: "no-store"
        });

        if (cancelled) return;

        if (response.ok) {
          setAllowed(true);
        } else {
          const result = await response.json().catch(() => ({}));
          setStatus(result.error || "Access denied");
        }
      } catch {
        if (!cancelled) setStatus("Unable to verify admin access.");
      }
    }

    verify();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!allowed) {
    return (
      <main style={{
        minHeight: "100vh",
        background: "#090b18",
        color: "#eee8ff",
        display: "grid",
        placeItems: "center",
        padding: 24,
        textAlign: "center",
        fontFamily: "system-ui"
      }}>
        <div>
          <div style={{ fontSize: 42 }}>🔐</div>
          <h2>Lecture Manager</h2>
          <p>{status}</p>
        </div>
      </main>
    );
  }

  return <AdminDashboard />;
}
