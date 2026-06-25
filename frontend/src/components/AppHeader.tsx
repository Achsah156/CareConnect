"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function AppHeader() {
  const router = useRouter();
  const { user, setUser } = useAuth();

  async function handleLogout() {
    try {
      await api.logout();
    } finally {
      setUser(null);
      router.push("/");
    }
  }

  return (
    <header className="flex items-center justify-between px-6 md:px-12 py-5 border-b border-white/5">
      <Link href="/feed" className="font-display italic text-lg text-paper">
        PathParallel
      </Link>
      <div className="flex items-center gap-6 font-mono text-xs uppercase tracking-wider text-slate">
        <Link href="/feed" className="hover:text-paper transition-colors">
          Feed
        </Link>
        <Link href="/situations/new" className="hover:text-paper transition-colors">
          Share
        </Link>
        {user && <span className="text-paper/40">{user.display_name}</span>}
        <button onClick={handleLogout} className="hover:text-amber transition-colors">
          Log out
        </button>
      </div>
    </header>
  );
}
