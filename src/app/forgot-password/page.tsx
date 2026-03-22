"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SERVER_URL } from "@/lib/socket";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError("Enter your email address"); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${SERVER_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      router.push(`/reset-password?email=${encodeURIComponent(email.trim())}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text-primary text-center">Forgot Password</h1>
          <p className="mt-2 text-sm text-text-secondary text-center">Enter your email and we&apos;ll send you a code to reset your password.</p>

          {error && <p className="mt-4 text-sm text-danger">{error}</p>}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input type="email" placeholder="Email address" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} className={inputClass} />
            <button type="submit" disabled={loading}
              className="w-full rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50">
              {loading ? "Sending..." : "Send Reset Code"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            Remember your password?{" "}
            <a href="/login" className="font-medium text-accent-text hover:underline">Log in</a>
          </p>
        </div>
      </main>
    </div>
  );
}
