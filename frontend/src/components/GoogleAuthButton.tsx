"use client";

import { buildGoogleAuthUrl, isGoogleAuthConfigured } from "@/lib/googleAuth";

export function GoogleAuthButton() {
  if (!isGoogleAuthConfigured()) {
    // No client ID configured — quietly omit the button rather than
    // showing one that's guaranteed to fail.
    return null;
  }

  return (
    <a
      href={buildGoogleAuthUrl()}
      className="w-full flex items-center justify-center gap-3 border border-white/15 rounded-lg px-6 py-3 text-paper text-sm font-medium hover:border-white/30 transition-colors"
    >
      <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.85 2.09-1.81 2.73v2.27h2.92c1.71-1.57 2.69-3.89 2.69-6.64z"
        />
        <path
          fill="#34A853"
          d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.27c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33C2.44 16.02 5.48 18 9 18z"
        />
        <path
          fill="#FBBC05"
          d="M3.97 10.7c-.18-.54-.28-1.11-.28-1.7s.1-1.16.28-1.7V4.97H.96A8.997 8.997 0 0 0 0 9c0 1.45.35 2.83.96 4.03l3.01-2.33z"
        />
        <path
          fill="#EA4335"
          d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0 5.48 0 2.44 1.98.96 4.97l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
        />
      </svg>
      Continue with Google
    </a>
  );
}
