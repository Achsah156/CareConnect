"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getGoogleRedirectUri } from "@/lib/googleAuth";

function GoogleCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const oauthError = searchParams.get("error");

    if (oauthError) {
      setError("Google sign-in was cancelled or denied.");
      return;
    }

    if (!code) {
      setError("Missing authorization code from Google.");
      return;
    }

    api
      .googleAuth(code, getGoogleRedirectUri())
      .then((user) => {
        setUser(user);
        router.push("/feed");
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Google sign-in failed.");
      });
    // Only run once on mount — searchParams/router/setUser are stable enough
    // here and re-running this on their identity changing would re-submit
    // the same one-time code, which Google will reject the second time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="text-center">
      {error ? (
        <>
          <p className="text-amber mb-4">{error}</p>
          <Link href="/login" className="text-paper/70 hover:text-paper underline text-sm">
            Back to login
          </Link>
        </>
      ) : (
        <p className="text-slate text-sm font-mono uppercase tracking-wider">
          Signing you in…
        </p>
      )}
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      {/* useSearchParams() requires a Suspense boundary for static
          prerendering in the App Router — without this, `next build`
          fails outright rather than just warning. */}
      <Suspense
        fallback={
          <p className="text-slate text-sm font-mono uppercase tracking-wider">Loading…</p>
        }
      >
        <GoogleCallbackInner />
      </Suspense>
    </main>
  );
}
