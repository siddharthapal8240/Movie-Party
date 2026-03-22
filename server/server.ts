import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, ".env") });
import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import Busboy from "busboy";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import jwt from "jsonwebtoken";
import {
  connectDB,
  createRoomInDB,
  getAllRoomsFromDB,
  updateRoomActivity,
  updateRoomAccess as updateRoomAccessDB,
  deleteRoomFromDB,
  deleteStaleRooms,
  createSession,
  getSession,
  findUserById,
} from "./db";
import { authRouter } from "./auth";
import { isCloudStorageConfigured, uploadToCloud, getFileInfo, getFileStream, deleteFromCloud } from "./storage";

// --- Types ---
type SourceType = "file" | "youtube" | "vimeo" | "dailymotion" | "gdrive" | "url" | "screen";

interface WaitingUser {
  socketId: string;
  displayName: string;
}

interface ViewerInfo {
  name: string;
  avatar: string;
  verified: boolean;
}

interface Room {
  id: string;
  hostId: string;
  hostToken: string;
  sourceType: SourceType;
  movieFileName: string;
  videoUrl: string;
  isOpen: boolean;
  viewers: Map<string, ViewerInfo>;
  waitingRoom: WaitingUser[];
  videoState: { playing: boolean; currentTime: number; lastUpdate: number };
}

// --- Helpers ---
function detectSource(url: string): { sourceType: SourceType; videoId: string } {
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return { sourceType: "youtube", videoId: ytMatch[1] };
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return { sourceType: "vimeo", videoId: vimeoMatch[1] };
  const dmMatch = url.match(/(?:dailymotion\.com\/video\/|dai\.ly\/)([a-zA-Z0-9]+)/);
  if (dmMatch) return { sourceType: "dailymotion", videoId: dmMatch[1] };
  const gdriveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (gdriveMatch) return { sourceType: "gdrive", videoId: gdriveMatch[1] };
  return { sourceType: "url", videoId: url };
}

function createRoomObj(overrides: Partial<Omit<Room, "id">> & { id?: string } = {}): Room {
  const { id: overrideId, ...rest } = overrides;
  const roomId = overrideId || uuidv4().split("-")[0];
  return {
    id: roomId,
    hostId: "",
    hostToken: "",
    sourceType: "file",
    movieFileName: "",
    videoUrl: "",
    isOpen: false,
    viewers: new Map(),
    waitingRoom: [],
    videoState: { playing: false, currentTime: 0, lastUpdate: Date.now() },
    ...rest,
  };
}

function getViewersList(room: Room) {
  return Array.from(room.viewers.entries()).map(([socketId, info]) => ({
    name: info.name,
    avatar: info.avatar,
    verified: info.verified,
    isHost: socketId === room.hostId,
  }));
}

// --- In-memory state ---
const rooms = new Map<string, Room>();
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// --- Express + Socket.IO setup ---
const app = express();
const httpServer = createServer(app);

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());
app.use("/api/auth", authRouter);

const io = new SocketIOServer(httpServer, {
  cors: { origin: corsOrigin, credentials: true },
  maxHttpBufferSize: 1e9,
});

// --- Auth middleware for room creation ---
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required. Please log in." });
    return;
  }
  try {
    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.JWT_SECRET || "dev-secret-change-me");
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token. Please log in again." });
  }
}

// --- REST API ---

// Create room via screen share
app.post("/api/rooms/screen", requireAuth, async (req, res) => {
  try {
    const { hostName, isOpen } = req.body;
    if (!hostName) return res.status(400).json({ error: "Host name is required" });

    const hostToken = uuidv4();
    const room = createRoomObj({ sourceType: "screen", isOpen: isOpen === true, hostToken });
    rooms.set(room.id, room);
    await createRoomInDB({ id: room.id, hostToken, sourceType: "screen", movieFileName: "", videoUrl: "", isOpen: isOpen === true });
    await createSession(hostToken, room.id, hostName, "host");

    console.log(`Room created (screen share): ${room.id}`);
    res.json({ roomId: room.id, hostToken });
  } catch (err) {
    console.error("Screen room creation error:", err);
    res.status(500).json({ error: "Failed to create room" });
  }
});

// Create room via URL/link
app.post("/api/rooms/url", requireAuth, async (req, res) => {
  try {
    const { hostName, videoUrl, isOpen } = req.body;
    if (!hostName || !videoUrl) return res.status(400).json({ error: "Host name and video URL are required" });

    const { sourceType, videoId } = detectSource(videoUrl);
    const hostToken = uuidv4();
    const room = createRoomObj({ sourceType, videoUrl: videoId, isOpen: isOpen === true, hostToken });
    rooms.set(room.id, room);
    await createRoomInDB({ id: room.id, hostToken, sourceType, movieFileName: "", videoUrl: videoId, isOpen: isOpen === true });
    await createSession(hostToken, room.id, hostName, "host");

    console.log(`Room created (${sourceType}): ${room.id}, url: ${videoUrl}`);
    res.json({ roomId: room.id, hostToken });
  } catch (err) {
    console.error("URL room creation error:", err);
    res.status(500).json({ error: "Failed to create room" });
  }
});

// Create room via file upload
app.post("/api/rooms", requireAuth, (req, res) => {
  req.setTimeout(30 * 60 * 1000);
  res.setTimeout(30 * 60 * 1000);
  const tempRoomId = uuidv4().split("-")[0];
  const roomDir = path.join(uploadsDir, tempRoomId);
  fs.mkdirSync(roomDir, { recursive: true });

  let hostName = "";
  let isOpen = false;
  let movieFileName = "";
  let mimeType = "video/mp4";
  let fileWritePromise: Promise<void> | null = null;

  try {
    const busboy = Busboy({ headers: req.headers });

    busboy.on("field", (name: string, val: string) => {
      if (name === "hostName") hostName = val;
      if (name === "isOpen") isOpen = val === "true";
    });

    busboy.on("file", (_name: string, file: NodeJS.ReadableStream, info: { filename: string; mimeType: string }) => {
      movieFileName = (info.filename || "movie.mp4").replace(/[^a-zA-Z0-9._-]/g, "_");
      mimeType = info.mimeType || "video/mp4";
      // Always save to local disk first (fast)
      const savePath = path.join(roomDir, movieFileName);
      const writeStream = fs.createWriteStream(savePath);
      fileWritePromise = new Promise<void>((resolve, reject) => {
        file.pipe(writeStream);
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });
    });

    busboy.on("finish", async () => {
      try {
        if (fileWritePromise) await fileWritePromise;
        if (!movieFileName || !hostName) {
          res.status(400).json({ error: "Movie file and host name are required" });
          return;
        }

        const hostToken = uuidv4();
        const room = createRoomObj({ id: tempRoomId, sourceType: "file", movieFileName, isOpen, hostToken });
        rooms.set(room.id, room);
        await createRoomInDB({ id: room.id, hostToken, sourceType: "file", movieFileName, videoUrl: "", isOpen });
        await createSession(hostToken, room.id, hostName, "host");

        console.log(`Room created: ${room.id}, isOpen: ${isOpen}, file: ${movieFileName}`);
        res.json({ roomId: room.id, hostToken });

        // Upload to cloud storage in background (non-blocking)
        if (isCloudStorageConfigured()) {
          const filePath = path.join(roomDir, movieFileName);
          const r2Key = `rooms/${tempRoomId}/${movieFileName}`;
          const { Readable } = require("stream");
          const readStream = fs.createReadStream(filePath);
          uploadToCloud(r2Key, readStream, mimeType)
            .then(() => {
              console.log(`Background upload to B2 complete: ${r2Key}`);
              // Delete local file to save disk space (B2 is now the source)
              try { fs.rmSync(roomDir, { recursive: true }); } catch {}
            })
            .catch((err: any) => console.error(`Background upload to B2 failed: ${err.message}`));
        }
      } catch (err) {
        console.error("File write error:", err);
        res.status(500).json({ error: "Failed to save file" });
      }
    });

    busboy.on("error", (err: Error) => {
      console.error("Upload parse error:", err);
      res.status(500).json({ error: "Upload failed" });
    });

    req.pipe(busboy);
  } catch (err) {
    console.error("Upload handler error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// Video streaming
app.get("/api/stream/:roomId", async (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) return res.status(404).send("Room not found");

  const r2Key = `rooms/${room.id}/${room.movieFileName}`;
  const range = req.headers.range;

  // Try R2 first, fall back to local disk
  if (isCloudStorageConfigured()) {
    try {
      if (range) {
        const fileInfo = await getFileInfo(r2Key);
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileInfo.size - 1;
        const result = await getFileStream(r2Key, { start, end });
        res.writeHead(206, {
          "Content-Range": result.contentRange,
          "Accept-Ranges": "bytes",
          "Content-Length": result.contentLength,
          "Content-Type": fileInfo.contentType,
        });
        result.stream.pipe(res);
      } else {
        const result = await getFileStream(r2Key);
        res.writeHead(200, { "Content-Length": result.contentLength, "Content-Type": "video/mp4" });
        result.stream.pipe(res);
      }
      return;
    } catch (err) {
      console.error("R2 stream error:", err);
    }
  }

  // Local disk fallback
  const filePath = path.join(uploadsDir, room.id, room.movieFileName);
  if (!fs.existsSync(filePath)) return res.status(404).send("Video not found");

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": "video/mp4",
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { "Content-Length": fileSize, "Content-Type": "video/mp4" });
    fs.createReadStream(filePath).pipe(res);
  }
});

// --- Per-socket auth info ---
const socketAuthMap = new Map<string, { userId: string; firstName: string; lastName: string; email: string; avatar: string }>();

// --- Socket.IO ---
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // --- JWT auth for logged-in users (resolved lazily) ---
  let authResolved = false;

  const resolveAuth = async () => {
    if (authResolved) return;
    authResolved = true;
    const jwtToken = socket.handshake.auth?.jwt;
    if (jwtToken) {
      try {
        const decoded = jwt.verify(jwtToken, process.env.JWT_SECRET || "dev-secret-change-me") as { userId: string };
        const user = await findUserById(decoded.userId);
        if (user && user.emailVerified) {
          socketAuthMap.set(socket.id, { userId: user._id.toString(), firstName: user.firstName, lastName: user.lastName || "", email: user.email, avatar: user.avatar || "" });
        }
      } catch {}
    }
  };

  // Admit user into a room (shared logic)
  async function admitUser(room: Room, roomId: string, targetSocket: any, displayName: string, existingToken?: string) {
    const targetAuth = socketAuthMap.get(targetSocket.id);
    targetSocket.join(roomId);
    room.viewers.set(targetSocket.id, {
      name: displayName,
      avatar: targetAuth?.avatar || "",
      verified: !!targetAuth,
    });

    let token = existingToken || "";
    let isHost = false;

    if (existingToken) {
      // Reconnecting user — check if they're the host
      const session = await getSession(existingToken);
      if (session && session.role === "host") {
        room.hostId = targetSocket.id;
        isHost = true;
      }
    } else if (room.viewers.size === 1 && !room.hostId) {
      // First person and no host set — they become host
      room.hostId = targetSocket.id;
      isHost = true;
      token = room.hostToken;
    } else {
      // New viewer — generate token
      token = uuidv4();
      await createSession(token, roomId, displayName, "viewer");
    }

    await updateRoomActivity(roomId);

    targetSocket.emit("room-state", {
      sourceType: room.sourceType,
      movieFileName: room.movieFileName,
      videoUrl: room.videoUrl,
      videoState: room.videoState,
      viewers: getViewersList(room),
      isHost,
      isOpen: room.isOpen,
      token,
    });

    io.to(roomId).emit("viewer-update", {
      viewers: getViewersList(room),
      message: `${displayName} joined the party!`,
    });

    targetSocket.emit("chat-message", {
      sender: "System",
      message: `Welcome to the movie party! ${room.viewers.size} viewer(s) watching.`,
      timestamp: Date.now(),
    });
  }

  socket.on("join-room", async ({ roomId, displayName, token }: { roomId: string; displayName: string; token?: string }) => {
    await resolveAuth();
    // Use verified name from JWT if available
    const myAuth = socketAuthMap.get(socket.id);
    const resolvedName = myAuth
      ? [myAuth.firstName, myAuth.lastName].filter(Boolean).join(" ")
      : displayName;

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit("error", { message: "Room not found" });
      return;
    }

    // Token-based reconnection
    if (token) {
      const session = await getSession(token);
      if (session && session.roomId === roomId) {
        console.log(`Reconnecting ${resolvedName} as ${session.role} to room ${roomId}`);
        if (session.role === "host") {
          room.hostId = socket.id;
        }
        await admitUser(room, roomId, socket, resolvedName, token);
        return;
      }
      console.log(`Invalid token for room ${roomId}, treating as new user`);
    }

    // First person — always admitted as host
    if (room.viewers.size === 0) {
      console.log(`Admitting first user (host): ${resolvedName}`);
      await admitUser(room, roomId, socket, resolvedName);
      return;
    }

    // Open room — admit directly
    if (room.isOpen) {
      console.log(`Room is open, admitting: ${resolvedName}`);
      await admitUser(room, roomId, socket, resolvedName);
      return;
    }

    // Private room — waiting room
    console.log(`Room is private, adding to waiting room: ${resolvedName}`);
    room.waitingRoom.push({ socketId: socket.id, displayName: resolvedName });
    socket.emit("waiting-room", { message: "Waiting for the host to let you in..." });
    io.to(room.hostId).emit("waiting-room-update", {
      waiting: room.waitingRoom.map((w) => ({ id: w.socketId, name: w.displayName })),
    });
  });

  socket.on("admit-user", async ({ roomId, userId }: { roomId: string; userId: string }) => {
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostId) return;

    const idx = room.waitingRoom.findIndex((w) => w.socketId === userId);
    if (idx === -1) return;

    const user = room.waitingRoom[idx];
    room.waitingRoom.splice(idx, 1);

    const targetSocket = io.sockets.sockets.get(userId);
    if (targetSocket) await admitUser(room, roomId, targetSocket, user.displayName);

    io.to(room.hostId).emit("waiting-room-update", {
      waiting: room.waitingRoom.map((w) => ({ id: w.socketId, name: w.displayName })),
    });
  });

  socket.on("admit-all", async ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostId) return;

    const usersToAdmit = [...room.waitingRoom];
    room.waitingRoom = [];

    for (const user of usersToAdmit) {
      const targetSocket = io.sockets.sockets.get(user.socketId);
      if (targetSocket) await admitUser(room, roomId, targetSocket, user.displayName);
    }
    io.to(room.hostId).emit("waiting-room-update", { waiting: [] });
  });

  socket.on("reject-user", ({ roomId, userId }: { roomId: string; userId: string }) => {
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostId) return;

    const idx = room.waitingRoom.findIndex((w) => w.socketId === userId);
    if (idx === -1) return;
    room.waitingRoom.splice(idx, 1);

    const targetSocket = io.sockets.sockets.get(userId);
    if (targetSocket) targetSocket.emit("rejected", { message: "The host declined your request to join." });

    io.to(room.hostId).emit("waiting-room-update", {
      waiting: room.waitingRoom.map((w) => ({ id: w.socketId, name: w.displayName })),
    });
  });

  socket.on("toggle-room-access", async ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostId) return;

    room.isOpen = !room.isOpen;
    await updateRoomAccessDB(roomId, room.isOpen);
    console.log(`Room ${roomId} access changed to: ${room.isOpen ? "open" : "private"}`);

    io.to(roomId).emit("room-access-changed", { isOpen: room.isOpen });

    if (room.isOpen && room.waitingRoom.length > 0) {
      const usersToAdmit = [...room.waitingRoom];
      room.waitingRoom = [];
      for (const user of usersToAdmit) {
        const targetSocket = io.sockets.sockets.get(user.socketId);
        if (targetSocket) await admitUser(room, roomId, targetSocket, user.displayName);
      }
      io.to(room.hostId).emit("waiting-room-update", { waiting: [] });
    }
  });

  socket.on("video-action", ({ roomId, action, currentTime }: { roomId: string; action: "play" | "pause" | "seek"; currentTime: number }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    room.videoState = { playing: action === "play", currentTime, lastUpdate: Date.now() };
    socket.to(roomId).emit("video-sync", { action, currentTime, timestamp: Date.now() });
  });

  // --- WebRTC Signaling ---
  socket.on("webrtc-get-peers", ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const peers = Array.from(room.viewers.entries())
      .filter(([id]) => id !== socket.id)
      .map(([id, info]) => ({ id, name: info.name }));
    socket.emit("webrtc-peers", { peers });
  });

  socket.on("webrtc-offer", ({ to, offer }: { to: string; offer: RTCSessionDescriptionInit }) => {
    socket.to(to).emit("webrtc-offer", { from: socket.id, offer });
  });

  socket.on("webrtc-answer", ({ to, answer }: { to: string; answer: RTCSessionDescriptionInit }) => {
    socket.to(to).emit("webrtc-answer", { from: socket.id, answer });
  });

  socket.on("webrtc-ice-candidate", ({ to, candidate }: { to: string; candidate: RTCIceCandidateInit }) => {
    socket.to(to).emit("webrtc-ice-candidate", { from: socket.id, candidate });
  });

  socket.on("webrtc-media-toggle", ({ roomId, kind, enabled }: { roomId: string; kind: "audio" | "video"; enabled: boolean }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const viewer = room.viewers.get(socket.id);
    socket.to(roomId).emit("webrtc-media-toggle", { peerId: socket.id, name: viewer?.name || "Unknown", kind, enabled });
  });

  // --- Screen Share Signaling ---
  socket.on("screen-offer", ({ to, offer }: { to: string; offer: RTCSessionDescriptionInit }) => {
    socket.to(to).emit("screen-offer", { from: socket.id, offer });
  });

  socket.on("screen-answer", ({ to, answer }: { to: string; answer: RTCSessionDescriptionInit }) => {
    socket.to(to).emit("screen-answer", { from: socket.id, answer });
  });

  socket.on("screen-ice-candidate", ({ to, candidate }: { to: string; candidate: RTCIceCandidateInit }) => {
    socket.to(to).emit("screen-ice-candidate", { from: socket.id, candidate });
  });

  socket.on("screen-share-status", ({ roomId, active }: { roomId: string; active: boolean }) => {
    socket.to(roomId).emit("screen-share-status", { active, hostId: socket.id });
  });

  socket.on("request-screen-share", ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    io.to(room.hostId).emit("send-screen-to", { viewerId: socket.id });
  });

  // --- Chat ---
  socket.on("chat-message", ({ roomId, message }: { roomId: string; message: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const sender = room.viewers.get(socket.id);
    io.to(roomId).emit("chat-message", { sender: sender?.name || "Unknown", message, timestamp: Date.now() });
  });

  // --- Disconnect ---
  socket.on("disconnect", () => {
    socketAuthMap.delete(socket.id);
    rooms.forEach((room, roomId) => {
      // Remove from waiting room
      const waitIdx = room.waitingRoom.findIndex((w) => w.socketId === socket.id);
      if (waitIdx !== -1) {
        room.waitingRoom.splice(waitIdx, 1);
        if (room.hostId) {
          io.to(room.hostId).emit("waiting-room-update", {
            waiting: room.waitingRoom.map((w) => ({ id: w.socketId, name: w.displayName })),
          });
        }
      }

      // Remove from viewers
      if (room.viewers.has(socket.id)) {
        const viewer = room.viewers.get(socket.id);
        const name = viewer?.name;
        room.viewers.delete(socket.id);

        io.to(roomId).emit("viewer-update", {
          viewers: getViewersList(room),
          message: `${name} left the party.`,
        });

        if (room.viewers.size === 0) {
          setTimeout(async () => {
            const currentRoom = rooms.get(roomId);
            if (currentRoom && currentRoom.viewers.size === 0) {
              // Clean up R2 file if applicable
              if (currentRoom.sourceType === "file" && currentRoom.movieFileName && isCloudStorageConfigured()) {
                await deleteFromCloud(`rooms/${roomId}/${currentRoom.movieFileName}`);
              }
              rooms.delete(roomId);
              await deleteRoomFromDB(roomId);
              const roomDir = path.join(uploadsDir, roomId);
              if (fs.existsSync(roomDir)) fs.rmSync(roomDir, { recursive: true });
              console.log(`Room ${roomId} cleaned up`);
            }
          }, 5 * 60 * 1000);
        }
      }
    });
  });
});

// --- Startup ---
const PORT = parseInt(process.env.PORT || "4000", 10);
const MONGODB_URI = process.env.MONGODB_URI || "";

async function start() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI is required. Set it in server/.env");
    process.exit(1);
  }

  await connectDB(MONGODB_URI);
  // Clean up rooms older than 6 hours
  const CLEANUP_INTERVAL = 6 * 60 * 60; // 6 hours in seconds
  const cleanupRooms = async () => {
    console.log("Running scheduled cleanup...");
    const staleRoomIds = await deleteStaleRooms(CLEANUP_INTERVAL);
    // Clean up B2 files and local files for stale rooms
    for (const roomId of staleRoomIds) {
      const room = rooms.get(roomId);
      if (room?.sourceType === "file" && room.movieFileName) {
        if (isCloudStorageConfigured()) {
          await deleteFromCloud(`rooms/${roomId}/${room.movieFileName}`);
        }
        const roomDir = path.join(uploadsDir, roomId);
        if (fs.existsSync(roomDir)) fs.rmSync(roomDir, { recursive: true });
      }
      rooms.delete(roomId);
    }
  };
  await cleanupRooms();
  setInterval(cleanupRooms, CLEANUP_INTERVAL * 1000);

  // Restore rooms from DB
  const persistedRooms = await getAllRoomsFromDB();
  for (const dbRoom of persistedRooms) {
    rooms.set(dbRoom._id as string, {
      id: dbRoom._id as string,
      hostId: "",
      hostToken: dbRoom.hostToken,
      sourceType: dbRoom.sourceType as SourceType,
      movieFileName: dbRoom.movieFileName,
      videoUrl: dbRoom.videoUrl,
      isOpen: dbRoom.isOpen,
      viewers: new Map(),
      waitingRoom: [],
      videoState: { playing: false, currentTime: 0, lastUpdate: Date.now() },
    });
  }
  console.log(`Restored ${persistedRooms.length} rooms from database`);

  httpServer.listen(PORT, () => {
    console.log(`> Movie Party server running on http://localhost:${PORT}`);
  });
  // Allow long uploads (30 min timeout)
  httpServer.timeout = 30 * 60 * 1000;
  httpServer.keepAliveTimeout = 30 * 60 * 1000;
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
