"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SERVER_URL } from "@/lib/socket";

export default function VerifyEmailPage() {
  return <Suspense><VerifyEmailContent /></Suspense>;
}

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const redirect = searchParams.get("redirect") || "/";
  const { login } = useAuth();

  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendCooldown]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);
    setError("");

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (value && index === 5 && newDigits.every((d) => d)) {
      handleVerify(newDigits.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      const newDigits = pasted.split("");
      setDigits(newDigits);
      inputRefs.current[5]?.focus();
      handleVerify(pasted);
    }
  };

  const handleVerify = async (code: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${SERVER_URL}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");

      // Upload pending avatar if stored during signup
      const pendingAvatar = sessionStorage.getItem("mp-pending-avatar");
      if (pendingAvatar) {
        try {
          const { data: dataUrl, name, type } = JSON.parse(pendingAvatar);
          const blob = await fetch(dataUrl).then((r) => r.blob());
          const formData = new FormData();
          formData.append("avatar", new File([blob], name, { type }));
          const avatarRes = await fetch(`${SERVER_URL}/api/auth/avatar`, {
            method: "POST",
            headers: { Authorization: `Bearer ${data.token}` },
            body: formData,
          });
          if (avatarRes.ok) {
            const avatarData = await avatarRes.json();
            data.user = avatarData.user;
          }
        } catch {}
        sessionStorage.removeItem("mp-pending-avatar");
      }

      login(data.token, data.user);
      router.push(redirect);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/auth/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResendCooldown(60);
      setError("");
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg-primary">
      <nav className="flex items-center justify-between border-b border-border-primary px-5 py-3 md:px-8">
        <a href="/" className="flex items-center gap-2">
          <svg className="h-6 w-6 text-accent" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm0 2v12h16V6H4zm2 2l5 3.5L6 15V8z" /></svg>
          <span className="text-lg font-semibold text-text-primary">Movie Party</span>
        </a>
        <ThemeToggle />
      </nav>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-border-primary bg-bg-primary p-6 shadow-lg md:p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-subtle">
            <svg className="h-7 w-7 text-accent-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Check Your Email</h1>
          <p className="mt-2 text-sm text-text-secondary">
            We sent a 6-digit code to <span className="font-medium text-text-primary">{email}</span>
          </p>

          {error && <p className="mt-4 text-sm text-danger">{error}</p>}

          <div className="mt-6 flex justify-center gap-2" onPaste={handlePaste}>
            {digits.map((digit, i) => (
              <input key={i} ref={(el) => { inputRefs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1}
                value={digit} onChange={(e) => handleChange(i, e.target.value)} onKeyDown={(e) => handleKeyDown(i, e)}
                className="h-14 w-12 rounded-lg border border-border-primary bg-bg-secondary text-center text-xl font-bold text-text-primary outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition" />
            ))}
          </div>

          <button onClick={() => handleVerify(digits.join(""))} disabled={loading || digits.some((d) => !d)}
            className="mt-6 w-full rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50">
            {loading ? "Verifying..." : "Verify Email"}
          </button>

          <p className="mt-4 text-sm text-text-tertiary">
            Didn&apos;t get the code?{" "}
            <button onClick={handleResend} disabled={resendCooldown > 0}
              className="font-medium text-accent-text hover:underline disabled:opacity-50 disabled:no-underline">
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend"}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
