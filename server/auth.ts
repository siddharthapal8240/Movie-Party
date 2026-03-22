import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Busboy from "busboy";
import { v2 as cloudinary } from "cloudinary";
import { createUser, findUserByEmail, findUserById, updateUserOtp, verifyUserEmail } from "./db";
import { generateOtp, sendOtpEmail, sendPasswordResetEmail } from "./email";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const router = Router();
function getJwtSecret() {
  return process.env.JWT_SECRET || "dev-secret-change-me";
}
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

function signToken(userId: string, email: string) {
  return jwt.sign({ userId, email }, getJwtSecret(), { expiresIn: "7d" });
}

function userResponse(user: any) {
  return { id: user._id.toString(), firstName: user.firstName, lastName: user.lastName || "", email: user.email, phone: user.phone || "", avatar: user.avatar || "" };
}

// --- Signup ---
router.post("/signup", async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone } = req.body;

    if (!firstName?.trim()) return res.status(400).json({ error: "First name is required" });
    if (!email?.trim()) return res.status(400).json({ error: "Email is required" });
    if (!password || password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

    const existing = await findUserByEmail(email);
    if (existing) {
      if (existing.emailVerified) {
        return res.status(409).json({ error: "An account with this email already exists. Try logging in." });
      }
      // Unverified account — resend OTP and redirect to verify
      const otp = generateOtp();
      await updateUserOtp(existing._id.toString(), otp, new Date(Date.now() + OTP_EXPIRY_MS));
      try {
        await sendOtpEmail(email, otp, existing.firstName);
      } catch (emailErr) {
        console.error("Failed to send OTP email:", emailErr);
        return res.status(500).json({ error: "Failed to send verification email. Check server email config." });
      }
      return res.json({ message: "Verification code resent. Check your email.", email });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser({ firstName: firstName.trim(), lastName: lastName?.trim() || "", email, passwordHash, phone: phone?.trim() || "" });

    const otp = generateOtp();
    await updateUserOtp(user._id.toString(), otp, new Date(Date.now() + OTP_EXPIRY_MS));
    try {
      await sendOtpEmail(email, otp, firstName.trim());
    } catch (emailErr) {
      console.error("Failed to send OTP email:", emailErr);
      // Still return success so user can use "resend" — account is created
      return res.json({ message: "Account created but email failed to send. Use 'Resend' on the next page.", email });
    }

    res.json({ message: "Account created. Check your email for the verification code.", email });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Failed to create account" });
  }
});

// --- Verify Email ---
router.post("/verify-email", async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: "Email and code are required" });

    const user = await findUserByEmail(email);
    if (!user) return res.status(404).json({ error: "Account not found" });
    if (user.emailVerified) return res.status(400).json({ error: "Email already verified" });
    if (!user.otpCode || !user.otpExpiresAt) return res.status(400).json({ error: "No verification code pending. Request a new one." });
    if (user.otpCode !== code) return res.status(400).json({ error: "Invalid code" });
    if (new Date() > user.otpExpiresAt) return res.status(400).json({ error: "Code expired. Request a new one." });

    await verifyUserEmail(user._id.toString());
    const token = signToken(user._id.toString(), user.email);
    res.json({ token, user: userResponse(user) });
  } catch (err) {
    console.error("Verify email error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

// --- Resend OTP ---
router.post("/resend-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await findUserByEmail(email);
    if (!user) return res.status(404).json({ error: "Account not found" });
    if (user.emailVerified) return res.status(400).json({ error: "Email already verified" });

    // Rate limit: only resend if previous OTP expired or expires within 1 minute
    if (user.otpExpiresAt && new Date(user.otpExpiresAt.getTime() - 60000) > new Date()) {
      return res.status(429).json({ error: "Please wait before requesting a new code" });
    }

    const otp = generateOtp();
    await updateUserOtp(user._id.toString(), otp, new Date(Date.now() + OTP_EXPIRY_MS));
    await sendOtpEmail(user.email, otp, user.firstName);

    res.json({ message: "New code sent" });
  } catch (err) {
    console.error("Resend OTP error:", err);
    res.status(500).json({ error: "Failed to resend code" });
  }
});

// --- Forgot Password ---
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await findUserByEmail(email);
    if (!user) return res.status(404).json({ error: "No account found with this email" });

    const otp = generateOtp();
    await updateUserOtp(user._id.toString(), otp, new Date(Date.now() + OTP_EXPIRY_MS));
    try {
      await sendPasswordResetEmail(user.email, otp, user.firstName);
    } catch (emailErr) {
      console.error("Failed to send reset email:", emailErr);
      return res.status(500).json({ error: "Failed to send email. Check server config." });
    }

    res.json({ message: "Reset code sent to your email", email: user.email });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Failed to process request" });
  }
});

// --- Reset Password ---
router.post("/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) return res.status(400).json({ error: "Email, code, and new password are required" });
    if (newPassword.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

    const user = await findUserByEmail(email);
    if (!user) return res.status(404).json({ error: "Account not found" });
    if (!user.otpCode || !user.otpExpiresAt) return res.status(400).json({ error: "No reset code pending. Request a new one." });
    if (user.otpCode !== code) return res.status(400).json({ error: "Invalid code" });
    if (new Date() > user.otpExpiresAt) return res.status(400).json({ error: "Code expired. Request a new one." });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.otpCode = null as any;
    user.otpExpiresAt = null as any;
    if (!user.emailVerified) user.emailVerified = true;
    await user.save();

    const token = signToken(user._id.toString(), user.email);
    res.json({ token, user: userResponse(user) });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// --- Login ---
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

    const user = await findUserByEmail(email);
    if (!user) return res.status(404).json({ error: "No account found with this email" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Incorrect password" });

    if (!user.emailVerified) {
      // Resend OTP and redirect to verify
      const otp = generateOtp();
      await updateUserOtp(user._id.toString(), otp, new Date(Date.now() + OTP_EXPIRY_MS));
      await sendOtpEmail(user.email, otp, user.firstName);
      return res.json({ needsVerification: true, email: user.email });
    }

    const token = signToken(user._id.toString(), user.email);
    res.json({ token, user: userResponse(user) });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// --- Get Current User ---
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "No token" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, getJwtSecret()) as { userId: string };
    const user = await findUserById(decoded.userId);
    if (!user || !user.emailVerified) return res.status(401).json({ error: "Invalid token" });

    res.json({ user: userResponse(user) });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

// --- Update Profile ---
router.put("/profile", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "No token" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, getJwtSecret()) as { userId: string };
    const user = await findUserById(decoded.userId);
    if (!user) return res.status(401).json({ error: "Invalid token" });

    const { firstName, lastName, phone } = req.body;
    if (firstName !== undefined) user.firstName = firstName.trim();
    if (lastName !== undefined) user.lastName = lastName.trim();
    if (phone !== undefined) user.phone = phone.trim();
    await user.save();

    res.json({ user: userResponse(user) });
  } catch {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// --- Change Password ---
router.put("/password", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "No token" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, getJwtSecret()) as { userId: string };
    const user = await findUserById(decoded.userId);
    if (!user) return res.status(401).json({ error: "Invalid token" });

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "Both current and new password are required" });
    if (newPassword.length < 8) return res.status(400).json({ error: "New password must be at least 8 characters" });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Current password is incorrect" });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "Password updated" });
  } catch {
    res.status(500).json({ error: "Failed to change password" });
  }
});

// --- Upload Avatar ---
router.post("/avatar", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) { res.status(401).json({ error: "No token" }); return; }

  const token = authHeader.split(" ")[1];
  let userId: string;
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { userId: string };
    userId = decoded.userId;
  } catch {
    res.status(401).json({ error: "Invalid token" }); return;
  }

  const busboy = Busboy({ headers: req.headers, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB max
  const chunks: Buffer[] = [];
  let validFile = false;

  busboy.on("file", (_name: string, file: NodeJS.ReadableStream, info: { filename: string; mimeType: string }) => {
    if (!info.mimeType.startsWith("image/")) {
      file.resume();
      return;
    }
    validFile = true;
    file.on("data", (chunk: Buffer) => chunks.push(chunk));
  });

  busboy.on("finish", async () => {
    if (!validFile || chunks.length === 0) { res.status(400).json({ error: "No image file provided" }); return; }
    try {
      const user = await findUserById(userId);
      if (!user) { res.status(404).json({ error: "User not found" }); return; }

      const buffer = Buffer.concat(chunks);
      const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "movie-party/avatars", public_id: userId, overwrite: true, transformation: [{ width: 256, height: 256, crop: "fill", gravity: "face" }] },
          (err, result) => err ? reject(err) : resolve(result as any)
        );
        stream.end(buffer);
      });

      user.avatar = result.secure_url;
      await user.save();
      res.json({ user: userResponse(user) });
    } catch (err) {
      console.error("Avatar save error:", err);
      res.status(500).json({ error: "Failed to save avatar" });
    }
  });

  busboy.on("error", () => { res.status(500).json({ error: "Upload failed" }); });
  req.pipe(busboy);
});

export { router as authRouter };
