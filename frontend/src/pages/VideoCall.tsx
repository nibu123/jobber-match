import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Room, RoomEvent, Track } from "livekit-client";
import type { RemoteTrack } from "livekit-client";
import { getVideoToken } from "../api/video";
import { getSocket } from "../api/socket";

type CallStatus = "calling" | "connecting" | "connected" | "ended" | "declined" | "error";

export default function VideoCall() {
  const { matchId } = useParams<{ matchId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const peerId = searchParams.get("peerId") || "";
  const peerName = searchParams.get("peerName") || "Match";
  const role = searchParams.get("role") === "caller" ? "caller" : "callee";

  const [status, setStatus] = useState<CallStatus>(role === "caller" ? "calling" : "connecting");
  const [statusMessage, setStatusMessage] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLDivElement | null>(null);
  const remoteVideoRef = useRef<HTMLDivElement | null>(null);
  const leftRef = useRef(false);

  function leave(nextStatus: CallStatus, message?: string, delayMs = 1500) {
    if (leftRef.current) return;
    leftRef.current = true;
    roomRef.current?.disconnect();
    roomRef.current = null;
    setStatus(nextStatus);
    if (message) setStatusMessage(message);
    setTimeout(() => navigate("/matches"), delayMs);
  }

  async function joinRoom() {
    if (!matchId) return;
    try {
      setStatus("connecting");
      const { token, url } = await getVideoToken(matchId);
      if (leftRef.current) return;

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        const el = track.attach();
        if (track.kind === Track.Kind.Video && remoteVideoRef.current) {
          remoteVideoRef.current.innerHTML = "";
          remoteVideoRef.current.appendChild(el);
        } else if (track.kind === Track.Kind.Audio) {
          el.style.display = "none";
          document.body.appendChild(el);
        }
      });

      room.on(RoomEvent.Disconnected, () => leave("ended", undefined, 400));
      room.on(RoomEvent.ParticipantDisconnected, () => leave("ended", `${peerName} left the call`));

      await room.connect(url, token);
      await room.localParticipant.setMicrophoneEnabled(true);
      await room.localParticipant.setCameraEnabled(true);

      const camPub = Array.from(room.localParticipant.videoTrackPublications.values())[0];
      if (camPub?.track && localVideoRef.current) {
        const el = camPub.track.attach();
        el.muted = true;
        localVideoRef.current.innerHTML = "";
        localVideoRef.current.appendChild(el);
      }

      setStatus("connected");
    } catch (err) {
      console.error("Failed to join video call", err);
      leave("error", "Couldn't start the call — check camera/mic permissions and try again.");
    }
  }

  useEffect(() => {
    if (role === "callee") {
      joinRoom();
    }
    return () => {
      roomRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !matchId) return;

    function onAccepted(data: { matchId: string }) {
      if (data.matchId === matchId && role === "caller") joinRoom();
    }
    function onDeclined(data: { matchId: string }) {
      if (data.matchId === matchId) leave("declined", `${peerName} declined the call`);
    }
    function onEnded(data: { matchId: string }) {
      if (data.matchId === matchId) leave("ended");
    }
    function onCallError(data: { matchId: string; message: string }) {
      if (data.matchId === matchId) leave("error", data.message);
    }

    socket.on("call_accepted", onAccepted);
    socket.on("call_declined", onDeclined);
    socket.on("call_ended", onEnded);
    socket.on("call_error", onCallError);
    return () => {
      socket.off("call_accepted", onAccepted);
      socket.off("call_declined", onDeclined);
      socket.off("call_ended", onEnded);
      socket.off("call_error", onCallError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, role]);

  function hangUp() {
    const socket = getSocket();
    if (status === "calling") {
      socket?.emit("call_cancel", { matchId, toUserId: peerId });
      leave("ended", undefined, 0);
    } else {
      socket?.emit("call_end", { matchId, toUserId: peerId });
      leave("ended", undefined, 0);
    }
  }

  function toggleMic() {
    const next = !micOn;
    roomRef.current?.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  }

  function toggleCam() {
    const next = !camOn;
    roomRef.current?.localParticipant.setCameraEnabled(next);
    setCamOn(next);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0a0a14",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ flex: 1, position: "relative" }}>
        <div ref={remoteVideoRef} style={{ width: "100%", height: "100%", background: "#111" }} />

        {status !== "connected" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              background: "rgba(10,10,20,0.85)",
            }}
          >
            <div className="avatar" style={{ width: 88, height: 88, fontSize: 32 }}>
              {peerName.charAt(0).toUpperCase()}
            </div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{peerName}</div>
            <div style={{ opacity: 0.75, fontSize: 14 }}>
              {status === "calling" && "Calling…"}
              {status === "connecting" && "Connecting…"}
              {status === "ended" && (statusMessage || "Call ended")}
              {status === "declined" && statusMessage}
              {status === "error" && statusMessage}
            </div>
          </div>
        )}

        <div
          ref={localVideoRef}
          style={{
            position: "absolute",
            bottom: 16,
            right: 16,
            width: 110,
            height: 150,
            borderRadius: 12,
            overflow: "hidden",
            background: "#222",
            border: "2px solid rgba(255,255,255,0.2)",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 24,
          padding: "20px 0 32px",
        }}
      >
        <button
          type="button"
          onClick={toggleMic}
          aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
          style={callButtonStyle(micOn ? "rgba(255,255,255,0.15)" : "#e74c3c")}
        >
          {micOn ? "🎤" : "🔇"}
        </button>
        <button
          type="button"
          onClick={hangUp}
          aria-label="End call"
          style={{ ...callButtonStyle("#e74c3c"), width: 64, height: 64, fontSize: 26 }}
        >
          ✕
        </button>
        <button
          type="button"
          onClick={toggleCam}
          aria-label={camOn ? "Turn camera off" : "Turn camera on"}
          style={callButtonStyle(camOn ? "rgba(255,255,255,0.15)" : "#e74c3c")}
        >
          {camOn ? "📹" : "📷"}
        </button>
      </div>
    </div>
  );
}

function callButtonStyle(background: string): React.CSSProperties {
  return {
    width: 54,
    height: 54,
    borderRadius: "50%",
    border: "none",
    background,
    color: "#fff",
    fontSize: 20,
    cursor: "pointer",
  };
}
