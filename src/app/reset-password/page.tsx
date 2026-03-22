"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PasswordInput } from "@/components/PasswordInput";
import { SERVER_URL } from "@/lib/socket";

export default function ResetPasswordPage() {
  return <Suspense><ResetPasswordContent /></Suspense>;
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const { login } = useAuth();

  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { inputRefs.current[0]?.focus(); }, []);

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
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(""));
      inputRefs.current[5]?.focus();
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = digits.join("");
    if (code.length !== 6) { setError("Enter the 6-digit code"); return; }
    if (newPassword.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (newPassword !== confirmPassword) { setError("Passwords don't match"); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${SERVER_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");
      login(data.token, data.user);
      router.push("/");
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/auth/forgot-password`, {
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

  const inputClass = "w-full rounded-lg border border-border-primary bg-bg-secondary px-4 py-3 text-sm text-text-primary placeholder-text-tertiary outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition";

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
        <div className="w-full max-w-md rounded-2xl border border-border-primary bg-bg-primary p-6 shadow-lg md:p-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-subtle">
            <svg className="h-7 w-7 text-accent-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text-primary text-center">Reset Password</h1>
          <p className="mt-2 text-sm text-text-secondary text-center">
            Enter the code sent to <span className="font-medium text-text-primary">{email}</span> and your new password.
          </p>

          {error && <p className="mt-4 text-sm text-danger text-center">{error}</p>}

          <form onSubmit={handleReset} className="mt-6 space-y-5">
            {/* OTP inputs */}
            <div>
              <label className="block text-xs font-medium text-text-tertiary mb-2">Verification code</label>
              <div className="flex justify-center gap-2" onPaste={handlePaste}>
                {digits.map((digit, i) => (
                  <input key={i} ref={(el) => { inputRefs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1}
                    value={digit} onChange={(e) => handleChange(i, e.target.value)} onKeyDown={(e) => handleKeyDown(i, e)}
                    className="h-12 w-11 rounded-lg border border-border-primary bg-bg-secondary text-center text-lg font-bold text-text-primary outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition" />
                ))}
              </div>
            </div>

            {/* New password fields */}
            <div>
              <label className="block text-xs font-medium text-text-tertiary mb-1.5">New password</label>
              <PasswordInput placeholder="Min 8 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-tertiary mb-1.5">Confirm new password</label>
              <PasswordInput value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} />
            </div>

            <button type="submit" disabled={loading}
              className="w-full rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50">
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-text-tertiary">
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
