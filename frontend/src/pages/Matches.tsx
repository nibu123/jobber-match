import { useEffect, useState, useRef } from "react";
import type { FormEvent } from "react";
import api from "../api/client";
import { connectSocket, getSocket, disconnectSocket } from "../api/socket";
import TabBar from "../components/TabBar";
import { useAuth } from "../context/AuthContext";

interface MatchSummary {
  id: string;
  status: string;
  created_at: string;
  other_user_id: string;
  display_name: string;
  photos: string[] | null;
  my_photo_revealed: boolean;
  their_photo_revealed: boolean;
}

interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export default function Matches() {
  const { userId } = useAuth();
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMatch, setActiveMatch] = useState<MatchSummary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .get("/matches")
      .then((res) => setMatches(res.data))
      .catch((err) => console.error("Failed to load matches", err))
      .finally(() => setLoading(false));

    connectSocket();
    return () => disconnectSocket();
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    function onNewMessage(msg: Message) {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    }

    socket.on("new_message", onNewMessage);
    return () => {
      socket.off("new_message", onNewMessage);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function openChat(match: MatchSummary) {
    setActiveMatch(match);
    setMessages([]);
    api
      .get(`/messages/${match.id}`)
      .then((res) => setMessages(res.data))
      .catch((err) => console.error("Failed to load messages", err));
    getSocket()?.emit("join_match", match.id);
  }

  async function revealMyPhoto() {
    if (!activeMatch || activeMatch.my_photo_revealed) return;
    try {
      await api.post(`/matches/${activeMatch.id}/reveal-photo`);
      setActiveMatch({ ...activeMatch, my_photo_revealed: true });
      setMatches((prev) =>
        prev.map((m) => (m.id === activeMatch.id ? { ...m, my_photo_revealed: true } : m))
      );
    } catch (err) {
      console.error("Failed to reveal photo", err);
    }
  }

  function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !activeMatch) return;
    getSocket()?.emit("send_message", { matchId: activeMatch.id, content: draft.trim() });
    setDraft("");
  }

  if (activeMatch) {
    return (
      <div className="container" style={{ display: "flex", flexDirection: "column", height: "100vh", paddingBottom: 90 }}>
        <div className="chat-header">
          <button className="chat-back" onClick={() => setActiveMatch(null)} aria-label="Back">
            &#8249;
          </button>
          <div className="chat-avatar">
            {activeMatch.photos && activeMatch.photos.length > 0 ? (
              <img
                src={activeMatch.photos[0]}
                alt={activeMatch.display_name}
                style={{
                  filter: activeMatch.their_photo_revealed ? "none" : "blur(10px)",
                  transition: "filter 0.4s ease",
                }}
              />
            ) : (
              <div className="avatar">{activeMatch.display_name.charAt(0).toUpperCase()}</div>
            )}
          </div>
          <div className="chat-name">{activeMatch.display_name}</div>
        </div>

        {!activeMatch.my_photo_revealed && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "10px 16px",
              background: "var(--surface-hover)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Your photo is hidden from {activeMatch.display_name}
            </span>
            <button
              type="button"
              onClick={revealMyPhoto}
              className="tag"
              style={{ cursor: "pointer", border: "none", flexShrink: 0 }}
            >
              Reveal my photo
            </button>
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {messages.map((m) => (
            <div key={m.id} className={`msg-bubble ${m.sender_id === userId ? "msg-mine" : "msg-theirs"}`}>
              {m.content}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={sendMessage} className="chat-input-bar">
          <input
            className="chat-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message..."
          />
          <button className="chat-send-btn" type="submit" aria-label="Send">
            &#10148;
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{ margin: "24px 0 16px", textAlign: "center" }}>
        <div className="brand">Matches</div>
      </div>

      {loading && <p style={{ color: "var(--text-muted)" }}>Loading matches...</p>}

      {!loading && matches.length === 0 && (
        <p style={{ color: "var(--text-muted)" }}>
          No matches yet — accepted connections will show up here.
        </p>
      )}

      <div className="matches-list">
        {matches.map((m) => (
          <div key={m.id} className="match-row" onClick={() => openChat(m)}>
            <div className="match-avatar">
              {m.photos && m.photos.length > 0 ? (
                <img
                  src={m.photos[0]}
                  alt={m.display_name}
                  style={{ filter: m.their_photo_revealed ? "none" : "blur(6px)" }}
                />
              ) : (
                <div className="avatar">{m.display_name.charAt(0).toUpperCase()}</div>
              )}
            </div>
            <div className="match-info">
              <div className="match-name">{m.display_name}</div>
              <div className="match-sub">Tap to chat</div>
            </div>
            <div className="match-chevron">&#8250;</div>
          </div>
        ))}
      </div>

      <TabBar active="matches" />
    </div>
  );
}



