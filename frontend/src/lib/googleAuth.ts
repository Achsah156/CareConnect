/**
 * Client-side half of the Google OAuth flow. The backend
 * (app/services/google_oauth.py) handles the actual token exchange;
 * this just builds the URL to redirect the user to, and the callback
 * page (src/app/auth/callback/page.tsx) takes the `code` Google sends
 * back and POSTs it to our backend.
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export function getGoogleClientId(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
}

export function getGoogleRedirectUri(): string {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI ||
    (typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : "")
  );
}

export function isGoogleAuthConfigured(): boolean {
  return Boolean(getGoogleClientId());
}

export function buildGoogleAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: getGoogleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}
