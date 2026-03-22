import mongoose from "mongoose";

// --- Connection ---
export async function connectDB(uri: string) {
  await mongoose.connect(uri);
  console.log("Connected to MongoDB");
}

// --- Room Model ---
const roomSchema = new mongoose.Schema({
  _id: String, // roomId
  hostToken: { type: String, required: true },
  sourceType: { type: String, required: true, default: "file" },
  movieFileName: { type: String, default: "" },
  videoUrl: { type: String, default: "" },
  isOpen: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  lastActivity: { type: Date, default: Date.now },
});

export const RoomModel = mongoose.model("Room", roomSchema);

// --- Session Model ---
const sessionSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true, index: true },
  roomId: { type: String, required: true, index: true },
  displayName: { type: String, required: true },
  role: { type: String, required: true, enum: ["host", "viewer"] },
  createdAt: { type: Date, default: Date.now },
});

export const SessionModel = mongoose.model("Session", sessionSchema);

// --- Room Helpers ---
export async function createRoomInDB(room: {
  id: string;
  hostToken: string;
  sourceType: string;
  movieFileName: string;
  videoUrl: string;
  isOpen: boolean;
}) {
  await RoomModel.create({
    _id: room.id,
    hostToken: room.hostToken,
    sourceType: room.sourceType,
    movieFileName: room.movieFileName,
    videoUrl: room.videoUrl,
    isOpen: room.isOpen,
  });
}

export async function getRoomFromDB(id: string) {
  return RoomModel.findById(id).lean();
}

export async function getAllRoomsFromDB() {
  return RoomModel.find().lean();
}

export async function updateRoomActivity(id: string) {
  await RoomModel.updateOne({ _id: id }, { lastActivity: new Date() });
}

export async function updateRoomAccess(id: string, isOpen: boolean) {
  await RoomModel.updateOne({ _id: id }, { isOpen, lastActivity: new Date() });
}

export async function deleteRoomFromDB(id: string) {
  await RoomModel.deleteOne({ _id: id });
  await SessionModel.deleteMany({ roomId: id });
}

export async function deleteStaleRooms(maxAgeSeconds: number): Promise<string[]> {
  const cutoff = new Date(Date.now() - maxAgeSeconds * 1000);
  const stale = await RoomModel.find({ lastActivity: { $lt: cutoff } }).lean();
  const ids: string[] = [];
  for (const room of stale) {
    const id = room._id as string;
    await deleteRoomFromDB(id);
    ids.push(id);
  }
  if (stale.length > 0) console.log(`Cleaned up ${stale.length} stale rooms from DB`);
  return ids;
}

// --- Session Helpers ---
export async function createSession(token: string, roomId: string, displayName: string, role: "host" | "viewer") {
  await SessionModel.create({ token, roomId, displayName, role });
}

export async function getSession(token: string) {
  return SessionModel.findOne({ token }).lean();
}

export async function deleteSessionsByRoom(roomId: string) {
  await SessionModel.deleteMany({ roomId });
}

// --- User Model ---
const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, default: "" },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  phone: { type: String, default: "" },
  avatar: { type: String, default: "" },
  emailVerified: { type: Boolean, default: false },
  otpCode: { type: String, default: null },
  otpExpiresAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

export const UserModel = mongoose.model("User", userSchema);

// --- User Helpers ---
export async function createUser(data: { firstName: string; lastName?: string; email: string; passwordHash: string; phone?: string }) {
  return UserModel.create(data);
}

export async function findUserByEmail(email: string) {
  return UserModel.findOne({ email: email.toLowerCase().trim() });
}

export async function findUserById(id: string) {
  return UserModel.findById(id);
}

export async function updateUserOtp(userId: string, code: string, expiresAt: Date) {
  await UserModel.updateOne({ _id: userId }, { otpCode: code, otpExpiresAt: expiresAt });
}

export async function verifyUserEmail(userId: string) {
  await UserModel.updateOne({ _id: userId }, { emailVerified: true, otpCode: null, otpExpiresAt: null });
}
