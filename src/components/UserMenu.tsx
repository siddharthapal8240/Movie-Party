"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Avatar } from "./Avatar";

export function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <a href="/login" className="rounded-lg border border-border-primary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-hover transition">Log in</a>
        <a href="/signup" className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover transition">Sign up</a>
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full p-0.5 hover:ring-2 hover:ring-accent/30 transition">
        <Avatar avatar={user.avatar} firstName={user.firstName} lastName={user.lastName} size="sm" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-border-primary bg-bg-primary shadow-lg overflow-hidden z-50 animate-fade-in-up">
          <div className="px-4 py-3 border-b border-border-primary">
            <div className="flex items-center gap-3">
              <Avatar avatar={user.avatar} firstName={user.firstName} lastName={user.lastName} size="md" className="flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">
                  {[user.firstName, user.lastName].filter(Boolean).join(" ")}
                </p>
                <p className="text-xs text-text-tertiary truncate">{user.email}</p>
              </div>
            </div>
          </div>
          <div className="py-1">
            <a href="/profile" className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Profile Settings
            </a>
          </div>
          <div className="border-t border-border-primary py-1">
            <button onClick={() => { logout(); setOpen(false); }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-danger hover:bg-danger-subtle transition">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
