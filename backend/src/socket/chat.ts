import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { pool } from "../db/pool";
import { redisPublisher, redisSubscriber } from "../db/redis";
import { notifyUser } from "../routes/notifications";
import { roomNameForMatch } from "../config/livekit";

interface AuthedSocket extends Socket {
  userId?: string;
}

const CHAT_CHANNEL_PREFIX = "jobber-match:chat:";

export function initChatSocket(io: Server) {
  io.use((socket: AuthedSocket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token provided"));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string };
      socket.userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: AuthedSocket) => {
    console.log(`🔌 User connected: ${socket.userId}`);

    socket.join(`user:${socket.userId}`);

    socket.on("join_match", (matchId: string) => {
      socket.join(matchId);
    });

    socket.on("send_message", async (data: { matchId: string; content: string }) => {
      const { matchId, content } = data;
      if (!content || content.trim().length === 0) return;

      try {
        const result = await pool.query(
          `INSERT INTO messages (match_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *`,
          [matchId, socket.userId, content.trim()]
        );
        const message = result.rows[0];

        await redisPublisher.publish(
          `${CHAT_CHANNEL_PREFIX}${matchId}`,
          JSON.stringify(message)
        );

        try {
          const matchRow = await pool.query(
            `SELECT user_a, user_b FROM matches WHERE id = $1`,
            [matchId]
          );
          if (matchRow.rows.length > 0) {
            const { user_a, user_b } = matchRow.rows[0];
            const recipientId = user_a === socket.userId ? user_b : user_a;
            const room = io.sockets.adapter.rooms.get(matchId);
            const recipientInRoom = room
              ? [...room].some((sid: string) => (io.sockets.sockets.get(sid) as AuthedSocket)?.userId === recipientId)
              : false;
            if (!recipientInRoom) {
              notifyUser(recipientId, {
                title: "New message",
                body: content.trim().slice(0, 100),
                url: `/matches/${matchId}`,
              }).catch((e) => console.error("notifyUser (message) failed:", e));
            }
          }
        } catch (notifErr) {
          console.error("Chat notify lookup error:", notifErr);
        }
      } catch (err) {
        console.error("Send message error:", err);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    async function loadMatchAndOtherUser(matchId: string): Promise<string | null> {
      const result = await pool.query(`SELECT user_a, user_b FROM matches WHERE id = $1 AND status = 'accepted'`, [matchId]);
      if (result.rows.length === 0) return null;
      const { user_a, user_b } = result.rows[0];
      if (socket.userId !== user_a && socket.userId !== user_b) return null;
      return user_a === socket.userId ? user_b : user_a;
    }

    socket.on("call_invite", async (data: { matchId: string }) => {
      const { matchId } = data;
      try {
        const otherUserId = await loadMatchAndOtherUser(matchId);
        if (!otherUserId) return socket.emit("call_error", { matchId, message: "Can't start this call" });

        const callerRow = await pool.query(`SELECT display_name FROM profiles WHERE user_id = $1`, [socket.userId]);
        const callerName = callerRow.rows[0]?.display_name || "Someone";

        await pool.query(
          `INSERT INTO call_sessions (match_id, caller_id, callee_id, room_name, status)
           VALUES ($1, $2, $3, $4, 'ringing')`,
          [matchId, socket.userId, otherUserId, roomNameForMatch(matchId)]
        );

        io.to(`user:${otherUserId}`).emit("incoming_call", { matchId, callerId: socket.userId, callerName });

        const calleeSockets = await io.in(`user:${otherUserId}`).fetchSockets();
        if (calleeSockets.length === 0) {
          notifyUser(otherUserId, {
            title: `${callerName} is calling you 📹`,
            body: "Open BuddiesPride to answer",
            url: `/matches`,
          }).catch((e) => console.error("notifyUser (call invite) failed:", e));
        }
      } catch (err) {
        console.error("call_invite error:", err);
        socket.emit("call_error", { matchId, message: "Failed to start call" });
      }
    });

    socket.on("call_accept", async (data: { matchId: string; toUserId: string }) => {
      const { matchId, toUserId } = data;
      await pool
        .query(
          `UPDATE call_sessions SET status = 'accepted', connected_at = NOW()
           WHERE match_id = $1 AND callee_id = $2 AND status = 'ringing'`,
          [matchId, socket.userId]
        )
        .catch((e) => console.error("call_accept db error:", e));
      io.to(`user:${toUserId}`).emit("call_accepted", { matchId });
    });

    socket.on("call_decline", async (data: { matchId: string; toUserId: string }) => {
      const { matchId, toUserId } = data;
      await pool
        .query(
          `UPDATE call_sessions SET status = 'declined', ended_at = NOW()
           WHERE match_id = $1 AND callee_id = $2 AND status = 'ringing'`,
          [matchId, socket.userId]
        )
        .catch((e) => console.error("call_decline db error:", e));
      io.to(`user:${toUserId}`).emit("call_declined", { matchId });
    });

    socket.on("call_cancel", (data: { matchId: string; toUserId: string }) => {
      io.to(`user:${data.toUserId}`).emit("call_cancelled", { matchId: data.matchId });
    });

    socket.on("call_end", async (data: { matchId: string; toUserId: string }) => {
      const { matchId, toUserId } = data;
      await pool
        .query(
          `UPDATE call_sessions SET status = 'ended', ended_at = NOW()
           WHERE match_id = $1 AND status IN ('accepted', 'ringing') AND ended_at IS NULL`,
          [matchId]
        )
        .catch((e) => console.error("call_end db error:", e));
      io.to(`user:${toUserId}`).emit("call_ended", { matchId });
    });

    socket.on("disconnect", () => {
      console.log(`🔌 User disconnected: ${socket.userId}`);
    });
  });

  redisSubscriber.psubscribe(`${CHAT_CHANNEL_PREFIX}*`);
  redisSubscriber.on("pmessage", (_pattern, channel, message) => {
    const matchId = channel.replace(CHAT_CHANNEL_PREFIX, "");
    io.to(matchId).emit("new_message", JSON.parse(message));
  });
}
