"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";

export default function SignupPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await api.signup(email, password, displayName);
      setUser(user);
      router.push("/feed");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="font-display italic text-lg text-paper block mb-10">
          PathParallel
        </Link>

        <h1 className="font-display text-2xl text-paper mb-2">Find your path</h1>
        <p className="text-paper/60 text-sm mb-8">
          A few details, then you can post your situation.
        </p>

        <div className="mb-6">
          <GoogleAuthButton />
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="h-px flex-1 bg-white/10" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate">or</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-slate mb-2">
              Name
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-inkmuted border border-white/10 rounded-lg px-4 py-3 text-paper placeholder:text-slate/50 focus:border-amber/50 outline-none"
              placeholder="What should we call you?"
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-slate mb-2">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-inkmuted border border-white/10 rounded-lg px-4 py-3 text-paper placeholder:text-slate/50 focus:border-amber/50 outline-none"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-slate mb-2">
              Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-inkmuted border border-white/10 rounded-lg px-4 py-3 text-paper placeholder:text-slate/50 focus:border-amber/50 outline-none"
              placeholder="At least 8 characters"
            />
          </div>

          {error && <p className="text-sm text-amber">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-amber text-ink font-medium px-6 py-3 rounded-lg hover:bg-amber/90 transition-colors disabled:opacity-50"
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-sm text-paper/60 mt-6">
          Already here?{" "}
          <Link href="/login" className="text-amber hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
