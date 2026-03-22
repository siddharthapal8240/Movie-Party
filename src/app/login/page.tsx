"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SERVER_URL } from "@/lib/socket";

export default function LoginPage() {
  return <Suspense><LoginContent /></Suspense>;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError("Email and password are required"); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${SERVER_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      if (data.needsVerification) {
        router.push(`/verify-email?email=${encodeURIComponent(data.email)}&redirect=${encodeURIComponent(redirect)}`);
        return;
      }

      login(data.token, data.user);
      router.push(redirect);
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
          <h1 className="text-2xl font-bold text-text-primary">Welcome Back</h1>
          <p className="mt-1 text-sm text-text-secondary">Log in to your Movie Party account</p>

          {error && <p className="mt-4 text-sm text-danger">{error}</p>}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            <div className="text-right">
              <a href={`/forgot-password`} className="text-xs font-medium text-accent-text hover:underline">Forgot password?</a>
            </div>
            <button type="submit" disabled={loading}
              className="w-full rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50">
              {loading ? "Logging in..." : "Log In"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            Don&apos;t have an account?{" "}
            <a href={`/signup?redirect=${encodeURIComponent(redirect)}`} className="font-medium text-accent-text hover:underline">Sign up</a>
          </p>
        </div>
      </main>
    </div>
  );
}
