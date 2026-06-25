"""
Google OAuth (authorization code flow).

Flow:
  1. Frontend redirects the user to Google's consent screen with our
     client_id and redirect_uri.
  2. Google redirects back to the frontend with a `code` query param.
  3. Frontend POSTs that code to our /auth/google endpoint.
  4. We exchange the code for tokens, fetch the user's Google profile,
     and find-or-create a User row keyed on google_id.

This module only handles steps 4 — the HTTP calls to Google. The route
in app/routers/auth.py handles steps 3 (taking the code) and the
find-or-create logic against our own User table.
"""
import httpx

from app.core.config import settings

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


class GoogleOAuthError(Exception):
    pass


def exchange_code_for_profile(code: str, redirect_uri: str) -> dict:
    """
    Exchanges an authorization code for an access token, then fetches the
    user's profile. Returns a dict with at least: sub (Google's user id),
    email, name.

    Raises GoogleOAuthError on any failure — the caller decides how to
    surface that (we turn it into a 401 in the route).
    """
    with httpx.Client(timeout=10.0) as client:
        token_response = client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        if token_response.status_code != 200:
            raise GoogleOAuthError(f"Token exchange failed: {token_response.text}")

        access_token = token_response.json().get("access_token")
        if not access_token:
            raise GoogleOAuthError("No access_token in Google's response")

        profile_response = client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if profile_response.status_code != 200:
            raise GoogleOAuthError(f"Profile fetch failed: {profile_response.text}")

        profile = profile_response.json()
        if "sub" not in profile or "email" not in profile:
            raise GoogleOAuthError("Google profile missing required fields")

        return profile
