import { env } from "../../../lib/env";
import type { EmailProviderAdapter } from "./types";

// Gmail API adapter. Scope would be `gmail.readonly` (least privilege). Not live: needs
// GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET, which require a Google Cloud
// OAuth client the user hasn't registered in this session.
export const gmailAdapter: EmailProviderAdapter = {
  provider: "GMAIL",
  isConfigured() {
    return Boolean(env.googleOauthClientId && env.googleOauthClientSecret);
  },
  requiredEnvVars() {
    return ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_OAUTH_REDIRECT_URI"];
  },
  getAuthorizationUrl() {
    if (!this.isConfigured()) throw new Error("Gmail adapter not configured");
    const base = "https://accounts.google.com/o/oauth2/v2/auth";
    const params = new URLSearchParams({
      client_id: env.googleOauthClientId,
      redirect_uri: env.googleOauthRedirectUri,
      response_type: "code",
      access_type: "offline",
      scope: "https://www.googleapis.com/auth/gmail.readonly",
    });
    return `${base}?${params.toString()}`;
  },
};
