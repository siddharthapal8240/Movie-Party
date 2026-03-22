"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PasswordInput } from "@/components/PasswordInput";
import { SERVER_URL } from "@/lib/socket";

export default function SignupPage() {
  return <Suspense><SignupContent /></Suspense>;
}

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Image must be under 5MB"); return; }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) { setError("First name is required"); return; }
    if (!email.trim()) { setError("Email is required"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords don't match"); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${SERVER_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), password, phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");
      // Store avatar for upload after verification
      if (avatarFile) {
        const reader = new FileReader();
        reader.onload = () => {
          sessionStorage.setItem("mp-pending-avatar", JSON.stringify({
            data: reader.result,
            name: avatarFile.name,
            type: avatarFile.type,
          }));
          router.push(`/verify-email?email=${encodeURIComponent(email.trim())}&redirect=${encodeURIComponent(redirect)}`);
        };
        reader.readAsDataURL(avatarFile);
        return;
      }
      router.push(`/verify-email?email=${encodeURIComponent(email.trim())}&redirect=${encodeURIComponent(redirect)}`);
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
          <h1 className="text-2xl font-bold text-text-primary">Create Account</h1>
          <p className="mt-1 text-sm text-text-secondary">Join Movie Party to watch together</p>

          {error && <p className="mt-4 text-sm text-danger">{error}</p>}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {/* Avatar picker */}
            <div className="flex justify-center">
              <label className="relative cursor-pointer group">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="h-20 w-20 rounded-full object-cover" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-bg-tertiary border-2 border-dashed border-border-primary group-hover:border-accent transition">
                    <svg className="h-8 w-8 text-text-tertiary group-hover:text-accent-text transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                )}
                {avatarPreview && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition">
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
              </label>
            </div>
            <p className="text-center text-xs text-text-tertiary -mt-2">Add profile photo (optional)</p>

            <div className="flex gap-3">
              <input type="text" placeholder="First name *" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
              <input type="text" placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
            </div>
            <input type="email" placeholder="Email *" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            <PasswordInput placeholder="Password * (min 8 chars)" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            <PasswordInput placeholder="Confirm password *" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} />
            <input type="tel" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            <button type="submit" disabled={loading}
              className="w-full rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50">
              {loading ? "Creating account..." : "Sign Up"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            Already have an account?{" "}
            <a href={`/login?redirect=${encodeURIComponent(redirect)}`} className="font-medium text-accent-text hover:underline">Log in</a>
          </p>
        </div>
      </main>
    </div>
  );
}
