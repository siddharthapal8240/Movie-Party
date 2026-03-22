import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import Busboy from "busboy";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

interface WaitingUser {
  socketId: string;
  displayName: string;
}

type SourceType = "file" | "youtube" | "vimeo" | "dailymotion" | "gdrive" | "url" | "screen";

interface Room {
  id: string;
  hostId: string;
  sourceType: SourceType;
  movieFileName: string;
  videoUrl: string; // video ID for yt/vimeo/dm, full URL for gdrive/url
  isOpen: boolean;
  viewers: Map<string, string>;
  waitingRoom: WaitingUser[];
  videoState: {
    playing: boolean;
    currentTime: number;
    lastUpdate: number;
  };
}

function detectSource(url: string): { sourceType: SourceType; videoId: string } {
  // YouTube
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch) return { sourceType: "youtube", videoId: ytMatch[1] };

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return { sourceType: "vimeo", videoId: vimeoMatch[1] };

  // Dailymotion
  const dmMatch = url.match(/(?:dailymotion\.com\/video\/|dai\.ly\/)([a-zA-Z0-9]+)/);
  if (dmMatch) return { sourceType: "dailymotion", videoId: dmMatch[1] };

  // Google Drive
  const gdriveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (gdriveMatch) return { sourceType: "gdrive", videoId: gdriveMatch[1] };

  // Direct URL
  return { sourceType: "url", videoId: url };
}

const rooms = new Map<string, Room>();
const uploadsDir = path.join(process.cwd(), "uploads");

function createRoom(overrides: Partial<Omit<Room, "id">> & { id?: string } = {}): Room {
  const { id: overrideId, ...rest } = overrides;
  const roomId = overrideId || uuidv4().split("-")[0];
  return {
    id: roomId,
    hostId: "",
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

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);

    // Handle screen-share room creation (JSON body)
    if (parsedUrl.pathname === "/api/rooms/screen" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      req.on("end", () => {
        try {
          const { hostName, isOpen } = JSON.parse(body);
          if (!hostName) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Host name is required" }));
            return;
          }

          const room = createRoom({ sourceType: "screen", isOpen: isOpen === true });
          rooms.set(room.id, room);

          console.log(`Room created (screen share): ${room.id}`);
          const roomId = room.id;

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ roomId }));
        } catch (err) {
          console.error("Screen room creation error:", err);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Failed to create room" }));
        }
      });
      return;
    }

    // Handle URL-based room creation (JSON body)
    if (parsedUrl.pathname === "/api/rooms/url" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      req.on("end", () => {
        try {
          const { hostName, videoUrl, isOpen } = JSON.parse(body);
          if (!hostName || !videoUrl) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Host name and video URL are required" }));
            return;
          }

          const { sourceType, videoId } = detectSource(videoUrl);
          const room = createRoom({ sourceType, videoUrl: videoId, isOpen: isOpen === true });
          rooms.set(room.id, room);

          console.log(`Room created (${sourceType}): ${room.id}, url: ${videoUrl}`);
          const roomId = room.id;

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ roomId }));
        } catch (err) {
          console.error("URL room creation error:", err);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Failed to create room" }));
        }
      });
      return;
    }

    // Handle movie upload — streams directly to disk (no memory buffering)
    if (parsedUrl.pathname === "/api/rooms" && req.method === "POST") {
      const tempRoomId = uuidv4().split("-")[0];
      const roomDir = path.join(uploadsDir, tempRoomId);
      fs.mkdirSync(roomDir, { recursive: true });

      let hostName = "";
      let isOpen = false;
      let movieFileName = "";
      let fileWritePromise: Promise<void> | null = null;

      try {
        const busboy = Busboy({ headers: req.headers });

        busboy.on("field", (name: string, val: string) => {
          if (name === "hostName") hostName = val;
          if (name === "isOpen") isOpen = val === "true";
        });

        busboy.on("file", (_name: string, file: NodeJS.ReadableStream, info: { filename: string }) => {
          movieFileName = (info.filename || "movie.mp4").replace(/[^a-zA-Z0-9._-]/g, "_");
          const savePath = path.join(roomDir, movieFileName);
          const writeStream = fs.createWriteStream(savePath);

          // Wait for the file to fully write to disk
          fileWritePromise = new Promise<void>((resolve, reject) => {
            file.pipe(writeStream);
            writeStream.on("finish", resolve);
            writeStream.on("error", reject);
          });
        });

        busboy.on("finish", async () => {
          try {
            // Wait for file to finish writing to disk
            if (fileWritePromise) {
              await fileWritePromise;
            }

            if (!movieFileName || !hostName) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Movie file and host name are required" }));
              return;
            }

            const room = createRoom({ id: tempRoomId, sourceType: "file", movieFileName, isOpen });
            rooms.set(room.id, room);
            const roomId = room.id;

            console.log(`Room created: ${roomId}, isOpen: ${isOpen}, file: ${movieFileName}`);

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ roomId }));
          } catch (err) {
            console.error("File write error:", err);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Failed to save file" }));
          }
        });

        busboy.on("error", (err: Error) => {
          console.error("Upload parse error:", err);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Upload failed" }));
        });

        req.pipe(busboy);
      } catch (err) {
        console.error("Upload handler error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Upload failed" }));
      }
      return;
    }

    // Handle video streaming
    if (parsedUrl.pathname?.startsWith("/api/stream/")) {
      const roomId = parsedUrl.pathname.split("/api/stream/")[1];
      const room = rooms.get(roomId);

      if (!room) {
        res.writeHead(404);
        res.end("Room not found");
        return;
      }

      const filePath = path.join(uploadsDir, room.id, room.movieFileName);

      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end("Video not found");
        return;
      }

      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        const file = fs.createReadStream(filePath, { start, end });
        const head = {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": "video/mp4",
        };

        res.writeHead(206, head);
        file.pipe(res);
      } else {
        const head = {
          "Content-Length": fileSize,
          "Content-Type": "video/mp4",
        };
        res.writeHead(200, head);
        fs.createReadStream(filePath).pipe(res);
      }
      return;
    }

    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*" },
    maxHttpBufferSize: 1e9, // 1GB for large file chunks
  });

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}, rooms: ${Array.from(rooms.keys()).join(", ")}`);

    // Helper to admit a user into the room
    function admitUser(room: Room, roomId: string, targetSocket: any, displayName: string) {
      targetSocket.join(roomId);
      room.viewers.set(targetSocket.id, displayName);

      // If this is the first person (host), set them as host
      if (room.viewers.size === 1) {
        room.hostId = targetSocket.id;
      }

      targetSocket.emit("room-state", {
        sourceType: room.sourceType,
        movieFileName: room.movieFileName,
        videoUrl: room.videoUrl,
        videoState: room.videoState,
        viewers: Array.from(room.viewers.values()),
        isHost: targetSocket.id === room.hostId,
        isOpen: room.isOpen,
      });

      io.to(roomId).emit("viewer-update", {
        viewers: Array.from(room.viewers.values()),
        message: `${displayName} joined the party!`,
      });

      targetSocket.emit("chat-message", {
        sender: "System",
        message: `Welcome to the movie party! ${room.viewers.size} viewer(s) watching.`,
        timestamp: Date.now(),
      });
    }

    socket.on("join-room", ({ roomId, displayName }: { roomId: string; displayName: string }) => {
      const room = rooms.get(roomId);
      console.log(`join-room: roomId=${roomId}, displayName=${displayName}, roomExists=${!!room}, isOpen=${room?.isOpen}, viewerCount=${room?.viewers.size}, hostId=${room?.hostId}`);

      if (!room) {
        socket.emit("error", { message: "Room not found" });
        return;
      }

      // First person is always admitted (they're the host)
      if (room.viewers.size === 0) {
        console.log(`Admitting first user (host): ${displayName}`);
        admitUser(room, roomId, socket, displayName);
        return;
      }

      // If room is open, admit directly
      if (room.isOpen) {
        console.log(`Room is open, admitting: ${displayName}`);
        admitUser(room, roomId, socket, displayName);
        return;
      }

      // Private room — put in waiting room and notify host
      console.log(`Room is private, adding to waiting room: ${displayName}`);
      room.waitingRoom.push({ socketId: socket.id, displayName });
      socket.emit("waiting-room", { message: "Waiting for the host to let you in..." });

      // Notify host about the waiting user
      io.to(room.hostId).emit("waiting-room-update", {
        waiting: room.waitingRoom.map((w) => ({ id: w.socketId, name: w.displayName })),
      });
    });

    // Host admits a user from waiting room
    socket.on("admit-user", ({ roomId, userId }: { roomId: string; userId: string }) => {
      const room = rooms.get(roomId);
      if (!room || socket.id !== room.hostId) return;

      const idx = room.waitingRoom.findIndex((w) => w.socketId === userId);
      if (idx === -1) return;

      const user = room.waitingRoom[idx];
      room.waitingRoom.splice(idx, 1);

      const targetSocket = io.sockets.sockets.get(userId);
      if (targetSocket) {
        admitUser(room, roomId, targetSocket, user.displayName);
      }

      // Update host with remaining waiting list
      io.to(room.hostId).emit("waiting-room-update", {
        waiting: room.waitingRoom.map((w) => ({ id: w.socketId, name: w.displayName })),
      });
    });

    // Host admits all waiting users
    socket.on("admit-all", ({ roomId }: { roomId: string }) => {
      const room = rooms.get(roomId);
      if (!room || socket.id !== room.hostId) return;

      const usersToAdmit = [...room.waitingRoom];
      room.waitingRoom = [];

      for (const user of usersToAdmit) {
        const targetSocket = io.sockets.sockets.get(user.socketId);
        if (targetSocket) {
          admitUser(room, roomId, targetSocket, user.displayName);
        }
      }

      io.to(room.hostId).emit("waiting-room-update", { waiting: [] });
    });

    // Host rejects a user from waiting room
    socket.on("reject-user", ({ roomId, userId }: { roomId: string; userId: string }) => {
      const room = rooms.get(roomId);
      if (!room || socket.id !== room.hostId) return;

      const idx = room.waitingRoom.findIndex((w) => w.socketId === userId);
      if (idx === -1) return;

      room.waitingRoom.splice(idx, 1);

      const targetSocket = io.sockets.sockets.get(userId);
      if (targetSocket) {
        targetSocket.emit("rejected", { message: "The host declined your request to join." });
      }

      io.to(room.hostId).emit("waiting-room-update", {
        waiting: room.waitingRoom.map((w) => ({ id: w.socketId, name: w.displayName })),
      });
    });

    // Host toggles room between open/private
    socket.on("toggle-room-access", ({ roomId }: { roomId: string }) => {
      const room = rooms.get(roomId);
      if (!room) return;

      // Allow if socket is the host
      if (socket.id !== room.hostId) {
        console.log(`toggle-room-access denied: socket=${socket.id} hostId=${room.hostId}`);
        return;
      }

      room.isOpen = !room.isOpen;
      console.log(`Room ${roomId} access changed to: ${room.isOpen ? "open" : "private"}`);

      // Notify everyone in the room (including sender)
      io.to(roomId).emit("room-access-changed", { isOpen: room.isOpen });

      // If switched to open, auto-admit everyone waiting
      if (room.isOpen && room.waitingRoom.length > 0) {
        const usersToAdmit = [...room.waitingRoom];
        room.waitingRoom = [];

        for (const user of usersToAdmit) {
          const targetSocket = io.sockets.sockets.get(user.socketId);
          if (targetSocket) {
            admitUser(room, roomId, targetSocket, user.displayName);
          }
        }

        io.to(room.hostId).emit("waiting-room-update", { waiting: [] });
      }
    });

    socket.on("video-action", ({ roomId, action, currentTime }: {
      roomId: string;
      action: "play" | "pause" | "seek";
      currentTime: number;
    }) => {
      const room = rooms.get(roomId);
      if (!room) return;

      room.videoState = {
        playing: action === "play",
        currentTime,
        lastUpdate: Date.now(),
      };

      // Broadcast to all other viewers in the room
      socket.to(roomId).emit("video-sync", {
        action,
        currentTime,
        timestamp: Date.now(),
      });
    });

    // --- WebRTC Signaling ---

    // When a new peer joins and wants to connect to existing peers
    socket.on("webrtc-get-peers", ({ roomId }: { roomId: string }) => {
      const room = rooms.get(roomId);
      if (!room) return;

      // Send list of other peers already in a call
      const peers = Array.from(room.viewers.entries())
        .filter(([id]) => id !== socket.id)
        .map(([id, name]) => ({ id, name }));

      socket.emit("webrtc-peers", { peers });
    });

    // Relay WebRTC offer to a specific peer
    socket.on("webrtc-offer", ({ to, offer }: { to: string; offer: RTCSessionDescriptionInit }) => {
      socket.to(to).emit("webrtc-offer", {
        from: socket.id,
        offer,
      });
    });

    // Relay WebRTC answer to a specific peer
    socket.on("webrtc-answer", ({ to, answer }: { to: string; answer: RTCSessionDescriptionInit }) => {
      socket.to(to).emit("webrtc-answer", {
        from: socket.id,
        answer,
      });
    });

    // Relay ICE candidates to a specific peer
    socket.on("webrtc-ice-candidate", ({ to, candidate }: { to: string; candidate: RTCIceCandidateInit }) => {
      socket.to(to).emit("webrtc-ice-candidate", {
        from: socket.id,
        candidate,
      });
    });

    // Notify room when someone toggles their camera/mic
    socket.on("webrtc-media-toggle", ({ roomId, kind, enabled }: { roomId: string; kind: "audio" | "video"; enabled: boolean }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      const name = room.viewers.get(socket.id) || "Unknown";
      socket.to(roomId).emit("webrtc-media-toggle", {
        peerId: socket.id,
        name,
        kind,
        enabled,
      });
    });

    // --- Screen Share Signaling ---
    // Host sends screen share offer to a specific peer
    socket.on("screen-offer", ({ to, offer }: { to: string; offer: RTCSessionDescriptionInit }) => {
      socket.to(to).emit("screen-offer", { from: socket.id, offer });
    });

    socket.on("screen-answer", ({ to, answer }: { to: string; answer: RTCSessionDescriptionInit }) => {
      socket.to(to).emit("screen-answer", { from: socket.id, answer });
    });

    socket.on("screen-ice-candidate", ({ to, candidate }: { to: string; candidate: RTCIceCandidateInit }) => {
      socket.to(to).emit("screen-ice-candidate", { from: socket.id, candidate });
    });

    // Host notifies room that screen sharing started/stopped
    socket.on("screen-share-status", ({ roomId, active }: { roomId: string; active: boolean }) => {
      socket.to(roomId).emit("screen-share-status", { active, hostId: socket.id });
    });

    // New viewer requests the screen share stream
    socket.on("request-screen-share", ({ roomId }: { roomId: string }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      // Tell the host to send a screen offer to this viewer
      io.to(room.hostId).emit("send-screen-to", { viewerId: socket.id });
    });

    socket.on("chat-message", ({ roomId, message }: { roomId: string; message: string }) => {
      const room = rooms.get(roomId);
      if (!room) return;

      const senderName = room.viewers.get(socket.id) || "Unknown";

      io.to(roomId).emit("chat-message", {
        sender: senderName,
        message,
        timestamp: Date.now(),
      });
    });

    socket.on("disconnect", () => {
      rooms.forEach((room, roomId) => {
        // Remove from waiting room if they were waiting
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
          const name = room.viewers.get(socket.id);
          room.viewers.delete(socket.id);

          io.to(roomId).emit("viewer-update", {
            viewers: Array.from(room.viewers.values()),
            message: `${name} left the party.`,
          });

          if (room.viewers.size === 0) {
            setTimeout(() => {
              const currentRoom = rooms.get(roomId);
              if (currentRoom && currentRoom.viewers.size === 0) {
                rooms.delete(roomId);
                const roomDir = path.join(uploadsDir, roomId);
                if (fs.existsSync(roomDir)) {
                  fs.rmSync(roomDir, { recursive: true });
                }
                console.log(`Room ${roomId} cleaned up`);
              }
            }, 5 * 60 * 1000);
          }
        }
      });
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Movie Party running on http://${hostname}:${port}`);
  });
});
