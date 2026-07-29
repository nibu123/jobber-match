import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { pool } from "../db/pool";
import { redisPublisher, redisSubscriber } from "../db/redis";

interface AuthedSocket extends Socket {
  userId?: string;
}

const CHAT_CHANNEL_PREFIX = "jobber-match:chat:";

export function initChatSocket(io: Server) {
  // Middleware: verify JWT on socket connection
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

    // Join a chat room for a specific match
    socket.on("join_match", (matchId: string) => {
      socket.join(matchId);
    });

    // Send a message
    socket.on("send_message", async (data: { matchId: string; content: string }) => {
      const { matchId, content } = data;
      if (!content || content.trim().length === 0) return;

      try {
        const result = await pool.query(
          `INSERT INTO messages (match_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *`,
          [matchId, socket.userId, content.trim()]
        );
        const message = result.rows[0];

        // Publish via Redis so this works across multiple server instances
        await redisPublisher.publish(
          `${CHAT_CHANNEL_PREFIX}${matchId}`,
          JSON.stringify(message)
        );
      } catch (err) {
        console.error("Send message error:", err);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    socket.on("disconnect", () => {
      console.log(`🔌 User disconnected: ${socket.userId}`);
    });
  });

  // Subscribe to Redis pattern for all chat channels, relay to correct Socket.io room
  redisSubscriber.psubscribe(`${CHAT_CHANNEL_PREFIX}*`);
  redisSubscriber.on("pmessage", (_pattern, channel, message) => {
    const matchId = channel.replace(CHAT_CHANNEL_PREFIX, "");
    io.to(matchId).emit("new_message", JSON.parse(message));
  });
}
