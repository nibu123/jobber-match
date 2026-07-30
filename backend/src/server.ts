import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { Server } from "socket.io";

import { testDbConnection } from "./db/pool";
import authRoutes from "./routes/auth";
import profileRoutes from "./routes/profiles";
import matchRoutes from "./routes/matches";
import safetyRoutes from "./routes/safety";
import messageRoutes from "./routes/messages";
import { initChatSocket } from "./socket/chat";

dotenv.config();

const app = express();

// Trust Railway's reverse proxy so X-Forwarded-For / rate-limit work correctly
app.set("trust proxy", 1);

const server = http.createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Security & middleware
app.use(helmet());
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: "2mb" }));

// Basic rate limiting — protects auth endpoints from brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: { error: "Too many attempts, please try again later" },
});
app.use("/api/auth", authLimiter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/safety", safetyRoutes);
app.use("/api/messages", messageRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Socket.io setup
const io = new Server(server, {
  cors: { origin: FRONTEND_URL, credentials: true },
});
initChatSocket(io);

const PORT = process.env.PORT || 4000;

server.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await testDbConnection();
});