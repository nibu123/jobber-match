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

  function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !activeMatch) return;
    getSocket()?.emit("send_message", { matchId: activeMatch.id, content: draft.trim() });
    setDraft("");
  }

  if (activeMatch) {
    return (
      <div className="container" style={{ display: "flex", flexDirection: "column", height: "100vh", paddingBottom: 90 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 0" }}>
          <button className="btn btn-secondary" style={{ width: "auto", padding: "8px 12px" }} onClick={() => setActiveMatch(null)}>
            ← Back
          </button>
          <div style={{ fontWeight: 600 }}>{activeMatch.display_name}</div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {messages.map((m) => (
            <div key={m.id} className={`msg-bubble ${m.sender_id === userId ? "msg-mine" : "msg-theirs"}`}>
              {m.content}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={sendMessage} style={{ display: "flex", gap: 8, paddingTop: 10 }}>
          <input
            className="field"
            style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "11px 12px", color: "var(--text)" }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message..."
          />
          <button className="btn btn-primary" style={{ width: "auto", padding: "0 20px" }} type="submit">
            Send
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{ margin: "24px 0 16px" }}>
        <div className="brand">Matches</div>
      </div>

      {loading && <p style={{ color: "var(--text-muted)" }}>Loading matches...</p>}

      {!loading && matches.length === 0 && (
        <p style={{ color: "var(--text-muted)" }}>
          No matches yet — accepted connections will show up here.
        </p>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {matches.map((m) => (
          <div key={m.id} className="profile-card" onClick={() => openChat(m)}>
            <div className="avatar">{m.display_name.charAt(0).toUpperCase()}</div>
            <div>
              <div style={{ fontWeight: 600 }}>{m.display_name}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Tap to chat</div>
            </div>
          </div>
        ))}
      </div>

      <TabBar active="matches" />
    </div>
  );
}

