import { useEffect, useRef, useState } from "react";
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
  interests: string[];
}

const SWIPE_THRESHOLD = 100;

export default function Browse() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const [matchMessage, setMatchMessage] = useState("");
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showDetail, setShowDetail] = useState(false);

  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState<"like" | "pass" | null>(null);
  const dragStartX = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const capturedRef = useRef(false);

  useEffect(() => {
    api
      .get("/profiles/browse")
      .then((res) => setProfiles(res.data))
      .catch((err) => console.error("Failed to load profiles", err))
      .finally(() => setLoading(false));
  }, []);

  const current = profiles[0];

  useEffect(() => {
    setPhotoIndex(0);
    setShowDetail(false);
  }, [current?.user_id]);

  async function commitSwipe(targetUserId: string, action: "like" | "pass" | "superlike") {
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
      setDragX(0);
      setExiting(null);
    }
  }

  function handleButtonSwipe(action: "like" | "pass" | "superlike") {
    if (!current || swiping || exiting) return;
    if (action === "like" || action === "pass") {
      setExiting(action);
      setTimeout(() => commitSwipe(current.user_id, action), 300);
    } else {
      commitSwipe(current.user_id, action);
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (swiping || exiting) return;
    dragStartX.current = e.clientX;
    pointerIdRef.current = e.pointerId;
    capturedRef.current = false;
  }

  function onPointerMove(e: React.PointerEvent) {
    if (pointerIdRef.current === null || pointerIdRef.current !== e.pointerId) return;
    const delta = e.clientX - dragStartX.current;
    if (Math.abs(delta) > 6) {
      if (!dragging) setDragging(true);
      if (!capturedRef.current) {
        cardRef.current?.setPointerCapture(e.pointerId);
        capturedRef.current = true;
      }
      setDragX(delta);
    }
  }

  function onPointerUp(_e: React.PointerEvent) {
    if (capturedRef.current && pointerIdRef.current !== null) {
      try {
        cardRef.current?.releasePointerCapture(pointerIdRef.current);
      } catch {}
    }
    pointerIdRef.current = null;
    capturedRef.current = false;
    if (!dragging) return;
    setDragging(false);
    if (!current) return;
    if (dragX > SWIPE_THRESHOLD) {
      setExiting("like");
      setTimeout(() => commitSwipe(current.user_id, "like"), 300);
    } else if (dragX < -SWIPE_THRESHOLD) {
      setExiting("pass");
      setTimeout(() => commitSwipe(current.user_id, "pass"), 300);
    } else {
      setDragX(0);
    }
  }

  function handlePhotoTap(e: React.MouseEvent<HTMLDivElement>) {
    if (!current || current.photos.length <= 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const tapX = e.clientX - rect.left;
    const isRightHalf = tapX > rect.width / 2;
    setPhotoIndex((idx) => {
      if (isRightHalf) return Math.min(idx + 1, current.photos.length - 1);
      return Math.max(idx - 1, 0);
    });
  }

  const rotation = dragX / 18;
  const cardStyle: React.CSSProperties = exiting
    ? {
        transform: `translateX(${exiting === "like" ? 600 : -600}px) rotate(${exiting === "like" ? 30 : -30}deg)`,
        opacity: 0,
        transition: "transform 0.3s ease, opacity 0.3s ease",
      }
    : dragging
    ? { transform: `translateX(${dragX}px) rotate(${rotation}deg)`, transition: "none" }
    : { transform: "translateX(0) rotate(0)", transition: "transform 0.25s ease" };

  const likeOpacity = Math.min(Math.max(dragX / SWIPE_THRESHOLD, 0), 1);
  const passOpacity = Math.min(Math.max(-dragX / SWIPE_THRESHOLD, 0), 1);

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
        <div
          ref={cardRef}
          className="card swipe-card"
          style={{ padding: 0, marginBottom: 24, ...cardStyle, touchAction: "pan-y" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="swipe-photo-wrap" onClick={handlePhotoTap}>
            {current.photos && current.photos.length > 0 ? (
              <img src={current.photos[Math.min(photoIndex, current.photos.length - 1)]} alt={current.display_name} draggable={false} />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  background: "var(--surface-hover)",
                }}
              >
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted-dim)" strokeWidth="1.5">
                  <rect x="3" y="5" width="18" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="8.5" cy="9.5" r="1.5" />
                  <path d="M4 16l4.5-6 3 4 2.5-3L20 16" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ color: "var(--text-muted-dim)", fontSize: 13, fontWeight: 500 }}>No photos yet</span>
              </div>
            )}

            {current.photos.length > 1 && (
              <div className="photo-dots">
                {current.photos.map((_, i) => (
                  <div key={i} className={"photo-dot" + (i === photoIndex ? " active" : "")} />
                ))}
              </div>
            )}

            <div className="swipe-stamp swipe-stamp-like" style={{ opacity: likeOpacity }}>
              LIKE
            </div>
            <div className="swipe-stamp swipe-stamp-pass" style={{ opacity: passOpacity }}>
              NOPE
            </div>

            <div
              className="swipe-overlay"
              onClick={(e) => {
                e.stopPropagation();
                setShowDetail(true);
              }}
            >
              <div className="swipe-more-hint">▲ Tap for full profile</div>
              <div className="swipe-name">
                {current.display_name}{" "}
                {current.pronouns && (
                  <span style={{ color: "rgba(255,255,255,0.75)", fontWeight: 400, fontSize: 16 }}>
                    ({current.pronouns})
                  </span>
                )}
              </div>

              <div className="swipe-tags">
                <span className="tag">{current.orientation}</span>
                {current.city && <span className="tag">{current.city}</span>}
              </div>

              {current.bio && <div className="swipe-bio">{current.bio}</div>}
            </div>
          </div>

          <div className="swipe-actions">
            <button
              type="button"
              disabled={swiping}
              onClick={() => handleButtonSwipe("pass")}
              className="swipe-btn swipe-btn-pass"
              aria-label="Pass"
            >
              ✕
            </button>
            <button
              type="button"
              disabled={swiping}
              onClick={() => handleButtonSwipe("superlike")}
              className="swipe-btn swipe-btn-super"
              aria-label="Superlike"
            >
              ★
            </button>
            <button
              type="button"
              disabled={swiping}
              onClick={() => handleButtonSwipe("like")}
              className="btn-primary swipe-btn swipe-btn-like"
              aria-label="Like"
            >
              ♥
            </button>
          </div>
        </div>
      )}

      {profiles.length > 1 && (
        <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 12, marginTop: 14 }}>
          {profiles.length - 1} more to discover
        </p>
      )}

      {showDetail && current && (
        <div className="profile-detail-overlay">
          <div className="profile-detail-photo" onClick={handlePhotoTap}>
            {current.photos && current.photos.length > 0 ? (
              <>
                <img
                  src={current.photos[Math.min(photoIndex, current.photos.length - 1)]}
                  alt={current.display_name}
                  draggable={false}
                  style={{
                    filter: "blur(22px)",
                    transform: "scale(1.08)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    textAlign: "center",
                    padding: "0 30px",
                    textShadow: "0 1px 4px rgba(0,0,0,0.6)",
                    pointerEvents: "none",
                  }}
                >
                  Photo reveals only if you both choose to, after matching
                </div>
              </>
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, background: "var(--surface-hover)" }}>
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted-dim)" strokeWidth="1.5">
                  <rect x="3" y="5" width="18" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="8.5" cy="9.5" r="1.5" />
                  <path d="M4 16l4.5-6 3 4 2.5-3L20 16" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ color: "var(--text-muted-dim)", fontSize: 14, fontWeight: 500 }}>No photos yet</span>
              </div>
            )}

            {current.photos.length > 1 && (
              <div className="photo-dots">
                {current.photos.map((_, i) => (
                  <div key={i} className={"photo-dot" + (i === photoIndex ? " active" : "")} />
                ))}
              </div>
            )}

            <button
              type="button"
              className="detail-close-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowDetail(false);
              }}
              aria-label="Close"
            >
              ✕
            </button>

            <div className="photo-gradient-overlay" />
            <div className="photo-name-overlay">
              <div className="detail-name">
                {current.display_name}{" "}
                {current.pronouns && (
                  <span style={{ color: "rgba(255,255,255,0.75)", fontWeight: 400, fontSize: 18 }}>
                    ({current.pronouns})
                  </span>
                )}
              </div>
              <div className="swipe-tags" style={{ margin: "10px 0" }}>
                <span className="tag">{current.orientation}</span>
                {current.city && <span className="tag">{current.city}</span>}
              </div>
            </div>
          </div>

          <div className="profile-detail-info">
            {current.bio && (
              <>
                <div className="detail-section-label">About</div>
                <div className="detail-bio">{current.bio}</div>
              </>
            )}

            {current.interests && current.interests.length > 0 && (
              <>
                <div className="detail-section-label" style={{ marginTop: 14 }}>Interests</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                  {current.interests.map((interest) => (
                    <span key={interest} className="tag">{interest}</span>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="detail-actions">
            <button
              type="button"
              disabled={swiping}
              onClick={() => handleButtonSwipe("pass")}
              className="swipe-btn swipe-btn-pass"
              aria-label="Pass"
            >
              ✕
            </button>
            <button
              type="button"
              disabled={swiping}
              onClick={() => handleButtonSwipe("superlike")}
              className="swipe-btn swipe-btn-super"
              aria-label="Superlike"
            >
              ★
            </button>
            <button
              type="button"
              disabled={swiping}
              onClick={() => handleButtonSwipe("like")}
              className="btn-primary swipe-btn swipe-btn-like"
              aria-label="Like"
            >
              ♥
            </button>
          </div>
        </div>
      )}

      <TabBar active="browse" />
    </div>
  );
}



