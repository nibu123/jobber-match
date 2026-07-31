import { useEffect, useState } from "react";
import api from "../api/client";
import TabBar from "../components/TabBar";

interface Profile {
  user_id: string;
  display_name: string;
  bio: string | null;
  orientation: string;
  pronouns: string | null;
  city: string | null;
  photos: string[];
}

export default function Browse() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const [matchMessage, setMatchMessage] = useState("");

  useEffect(() => {
    api
      .get("/profiles/browse")
      .then((res) => setProfiles(res.data))
      .catch((err) => console.error("Failed to load profiles", err))
      .finally(() => setLoading(false));
  }, []);

  async function handleSwipe(targetUserId: string, action: "like" | "pass" | "superlike") {
    if (swiping) return;
    setSwiping(true);
    try {
      const res = await api.post("/swipes", { targetUserId, action });
      if (res.data.matched) {
        setMatchMessage("It's a match! 🎉");
        setTimeout(() => setMatchMessage(""), 2500);
      }
      setProfiles((prev) => prev.filter((p) => p.user_id !== targetUserId));
    } catch (err) {
      console.error("Swipe failed", err);
    } finally {
      setSwiping(false);
    }
  }

  const current = profiles[0];

  return (
    <div className="container">
      <div style={{ margin: "24px 0 16px", textAlign: "center" }}>
        <div className="brand">Discover</div>
        <p className="tagline">Meet people, not just profiles</p>
      </div>

      {matchMessage && (
        <div
          className="card"
          style={{
            textAlign: "center",
            marginBottom: 16,
            background: "linear-gradient(135deg, var(--coral), var(--gold))",
            color: "var(--bg-deep)",
            fontFamily: "'Bricolage Grotesque', sans-serif",
            fontWeight: 800,
            fontSize: 18,
          }}
        >
          {matchMessage}
        </div>
      )}

      {loading && <p style={{ color: "var(--text-muted)" }}>Loading profiles...</p>}

      {!loading && !current && (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <p style={{ color: "var(--text-muted)" }}>
            No one nearby yet — check back soon, or widen your filters.
          </p>
        </div>
      )}

      {current && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {current.photos && current.photos.length > 0 ? (
            <img
              src={current.photos[0]}
              alt={current.display_name}
              style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                aspectRatio: "1 / 1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--surface-hover)",
              }}
            >
              <div className="avatar" style={{ width: 96, height: 96, fontSize: 36 }}>
                {current.display_name.charAt(0).toUpperCase()}
              </div>
            </div>
          )}

          <div style={{ padding: 20 }}>
            <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 20 }}>
              {current.display_name}{" "}
              {current.pronouns && (
                <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: 15 }}>
                  ({current.pronouns})
                </span>
              )}
            </div>

            <div style={{ display: "flex", gap: 6, margin: "8px 0" }}>
              <span className="tag">{current.orientation}</span>
              {current.city && <span className="tag">{current.city}</span>}
            </div>

            {current.bio && (
              <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 6 }}>{current.bio}</div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                type="button"
                disabled={swiping}
                onClick={() => handleSwipe(current.user_id, "pass")}
                style={{
                  flex: 1,
                  border: "1px solid var(--border)",
                  background: "var(--surface-hover)",
                  color: "var(--text)",
                  borderRadius: 999,
                  padding: "12px 0",
                  fontSize: 20,
                  cursor: swiping ? "not-allowed" : "pointer",
                }}
                aria-label="Pass"
              >
                ✕
              </button>
              <button
                type="button"
                disabled={swiping}
                onClick={() => handleSwipe(current.user_id, "superlike")}
                style={{
                  flex: 1,
                  border: "1px solid var(--border)",
                  background: "var(--surface-hover)",
                  color: "var(--teal)",
                  borderRadius: 999,
                  padding: "12px 0",
                  fontSize: 20,
                  cursor: swiping ? "not-allowed" : "pointer",
                }}
                aria-label="Superlike"
              >
                ★
              </button>
              <button
                type="button"
                disabled={swiping}
                onClick={() => handleSwipe(current.user_id, "like")}
                className="btn-primary"
                style={{
                  flex: 1,
                  border: "none",
                  borderRadius: 999,
                  padding: "12px 0",
                  fontSize: 20,
                  cursor: swiping ? "not-allowed" : "pointer",
                }}
                aria-label="Like"
              >
                ♥
              </button>
            </div>
          </div>
        </div>
      )}

      {profiles.length > 1 && (
        <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 12, marginTop: 10 }}>
          {profiles.length - 1} more to discover
        </p>
      )}

      <TabBar active="browse" />
    </div>
  );
}
