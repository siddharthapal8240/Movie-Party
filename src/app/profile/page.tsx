"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { Avatar } from "@/components/Avatar";
import { PasswordInput } from "@/components/PasswordInput";
import { SERVER_URL } from "@/lib/socket";

export default function ProfilePage() {
  const router = useRouter();
  const { user, token, loading, login } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileMsg, setProfileMsg] = useState("");
  const [profileErr, setProfileErr] = useState("");
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordErr, setPasswordErr] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login?redirect=/profile");
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName);
      setLastName(user.lastName);
      setPhone(user.phone);
    }
  }, [user]);

  const handleProfileSave = async () => {
    if (!firstName.trim()) { setProfileErr("First name is required"); return; }
    setSaving(true);
    setProfileErr("");
    setProfileMsg("");
    try {
      const res = await fetch(`${SERVER_URL}/api/auth/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      login(token!, data.user);
      setProfileMsg("Profile updated");
    } catch (err: any) {
      setProfileErr(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPassword) { setPasswordErr("Enter your current password"); return; }
    if (newPassword.length < 8) { setPasswordErr("New password must be at least 8 characters"); return; }
    if (newPassword !== confirmPassword) { setPasswordErr("Passwords don't match"); return; }
    setChangingPw(true);
    setPasswordErr("");
    setPasswordMsg("");
    try {
      const res = await fetch(`${SERVER_URL}/api/auth/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPasswordMsg("Password changed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordErr(err.message);
    } finally {
      setChangingPw(false);
    }
  };

  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setProfileErr("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { setProfileErr("Image must be under 5MB"); return; }

    setUploadingAvatar(true);
    setProfileErr("");
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch(`${SERVER_URL}/api/auth/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      login(token!, data.user);
      setProfileMsg("Avatar updated");
    } catch (err: any) {
      setProfileErr(err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (loading || !user) return null;

  const inputClass = "w-full rounded-lg border border-border-primary bg-bg-secondary px-4 py-3 text-sm text-text-primary placeholder-text-tertiary outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition";

  return (
    <div className="flex min-h-screen flex-col bg-bg-primary">
      {/* Nav */}
      <nav className="flex items-center justify-between border-b border-border-primary px-5 py-3 md:px-8">
        <div className="flex items-center gap-3">
          <a href="/" className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-surface-hover hover:text-text-primary transition" title="Back to Home">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </a>
          <a href="/" className="flex items-center gap-2">
            <svg className="h-6 w-6 text-accent" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm0 2v12h16V6H4zm2 2l5 3.5L6 15V8z" /></svg>
            <span className="text-lg font-semibold text-text-primary">Movie Party</span>
          </a>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <UserMenu />
        </div>
      </nav>

      <main className="flex flex-1 justify-center px-4 py-10 md:py-16">
        <div className="w-full max-w-lg space-y-6">

          {/* Avatar + Header */}
          <div className="text-center">
            <div className="relative mx-auto w-fit group">
              <Avatar avatar={user.avatar} firstName={user.firstName} lastName={user.lastName} size="xl" />
              <label className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition cursor-pointer ${uploadingAvatar ? "opacity-100" : ""}`}>
                {uploadingAvatar ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
              </label>
            </div>
            <h1 className="mt-4 text-2xl font-bold text-text-primary">
              {[user.firstName, user.lastName].filter(Boolean).join(" ")}
            </h1>
            <p className="mt-1 text-sm text-text-tertiary">{user.email}</p>
          </div>

          {/* Profile Info */}
          <div className="rounded-2xl border border-border-primary bg-bg-primary p-6 shadow-sm">
            <h2 className="text-base font-semibold text-text-primary mb-4">Profile Information</h2>

            {profileMsg && <p className="mb-3 text-sm text-success">{profileMsg}</p>}
            {profileErr && <p className="mb-3 text-sm text-danger">{profileErr}</p>}

            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-text-tertiary mb-1.5">First name *</label>
                  <input type="text" value={firstName} onChange={(e) => { setFirstName(e.target.value); setProfileMsg(""); }} className={inputClass} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-text-tertiary mb-1.5">Last name</label>
                  <input type="text" value={lastName} onChange={(e) => { setLastName(e.target.value); setProfileMsg(""); }} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-tertiary mb-1.5">Email</label>
                <input type="email" value={user.email} disabled className={`${inputClass} opacity-50 cursor-not-allowed`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-tertiary mb-1.5">Phone</label>
                <input type="tel" placeholder="Optional" value={phone} onChange={(e) => { setPhone(e.target.value); setProfileMsg(""); }} className={inputClass} />
              </div>
              <button onClick={handleProfileSave} disabled={saving}
                className="w-full rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50">
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

          {/* Change Password */}
          <div className="rounded-2xl border border-border-primary bg-bg-primary p-6 shadow-sm">
            <h2 className="text-base font-semibold text-text-primary mb-4">Change Password</h2>

            {passwordMsg && <p className="mb-3 text-sm text-success">{passwordMsg}</p>}
            {passwordErr && <p className="mb-3 text-sm text-danger">{passwordErr}</p>}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-tertiary mb-1.5">Current password</label>
                <PasswordInput value={currentPassword} onChange={(e) => { setCurrentPassword(e.target.value); setPasswordMsg(""); }} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-tertiary mb-1.5">New password</label>
                <PasswordInput placeholder="Min 8 characters" value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setPasswordMsg(""); }} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-tertiary mb-1.5">Confirm new password</label>
                <PasswordInput value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setPasswordMsg(""); }} className={inputClass} />
              </div>
              <button onClick={handlePasswordChange} disabled={changingPw}
                className="w-full rounded-lg border border-border-primary px-5 py-2.5 text-sm font-semibold text-text-primary transition hover:bg-surface-hover active:scale-[0.98] disabled:opacity-50">
                {changingPw ? "Changing..." : "Change Password"}
              </button>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
