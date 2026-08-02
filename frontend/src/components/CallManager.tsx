import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { connectSocket, disconnectSocket, getSocket } from "../api/socket";
import { useAuth } from "../context/AuthContext";

interface IncomingCall {
  matchId: string;
  callerId: string;
  callerName: string;
}

export default function CallManager() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      return;
    }
    connectSocket();
    return () => disconnectSocket();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const socket = getSocket();
    if (!socket) return;

    function onIncomingCall(data: IncomingCall) {
      setIncomingCall(data);
    }
    function onCallCancelled(data: { matchId: string }) {
      setIncomingCall((current) => (current?.matchId === data.matchId ? null : current));
    }

    socket.on("incoming_call", onIncomingCall);
    socket.on("call_cancelled", onCallCancelled);
    return () => {
      socket.off("incoming_call", onIncomingCall);
      socket.off("call_cancelled", onCallCancelled);
    };
  }, [token, incomingCall === null]);

  function accept() {
    if (!incomingCall) return;
    getSocket()?.emit("call_accept", { matchId: incomingCall.matchId, toUserId: incomingCall.callerId });
    const { matchId, callerId, callerName } = incomingCall;
    setIncomingCall(null);
    navigate(`/call/${matchId}?peerId=${callerId}&peerName=${encodeURIComponent(callerName)}`);
  }

  function decline() {
    if (!incomingCall) return;
    getSocket()?.emit("call_decline", { matchId: incomingCall.matchId, toUserId: incomingCall.callerId });
    setIncomingCall(null);
  }

  if (!incomingCall) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999,
        background: "rgba(10, 10, 20, 0.92)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        color: "#fff",
        textAlign: "center",
        padding: 24,
      }}
    >
      <div style={{ fontSize: 15, opacity: 0.7, letterSpacing: 1 }}>INCOMING VIDEO CALL</div>
      <div className="avatar" style={{ width: 88, height: 88, fontSize: 32 }}>
        {incomingCall.callerName.charAt(0).toUpperCase()}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600 }}>{incomingCall.callerName}</div>

      <div style={{ display: "flex", gap: 28, marginTop: 24 }}>
        <button
          type="button"
          onClick={decline}
          aria-label="Decline call"
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            border: "none",
            background: "#e74c3c",
            color: "#fff",
            fontSize: 26,
            cursor: "pointer",
          }}
        >
          ✕
        </button>
        <button
          type="button"
          onClick={accept}
          aria-label="Accept call"
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            border: "none",
            background: "#2ecc71",
            color: "#fff",
            fontSize: 26,
            cursor: "pointer",
          }}
        >
          📹
        </button>
      </div>
    </div>
  );
}
