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
}

export default function Browse() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/profiles/browse")
      .then((res) => setProfiles(res.data))
      .catch((err) => console.error("Failed to load profiles", err))
      .finally(() => setLoading(false));
  }, []);

  async function sendRequest(targetUserId: string) {
    try {
      await api.post("/matches/request", { targetUserId });
      alert("Request sent!");
    } catch (err) {
      console.error(err);
      alert("Could not send request");
    }
  }

  return (
    <div className="container">
      <div style={{ margin: "24px 0 16px" }}>
        <div className="brand">Discover</div>
      </div>

      {loading && <p style={{ color: "var(--text-muted)" }}>Loading profiles...</p>}

      {!loading && profiles.length === 0 && (
        <p style={{ color: "var(--text-muted)" }}>
          No one nearby yet — check back soon, or widen your filters.
        </p>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {profiles.map((p) => (
          <div
            key={p.user_id}
            className="profile-card"
            onClick={() => sendRequest(p.user_id)}
          >
            <div className="avatar">{p.display_name.charAt(0).toUpperCase()}</div>
            <div>
              <div style={{ fontWeight: 600 }}>
                {p.display_name} {p.pronouns && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({p.pronouns})</span>}
              </div>
              <div style={{ display: "flex", gap: 6, margin: "4px 0" }}>
                <span className="tag">{p.orientation}</span>
                {p.city && <span className="tag">{p.city}</span>}
              </div>
              {p.bio && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{p.bio}</div>}
            </div>
          </div>
        ))}
      </div>

      <TabBar active="browse" />
    </div>
  );
}
