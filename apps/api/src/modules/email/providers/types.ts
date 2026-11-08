// Least-privilege OAuth adapter interface for connected mail accounts (Outlook via
// Microsoft Graph, Gmail via Google API). Implemented with the correct request/response
// shapes; cannot go live in this session without a real Azure AD / Google Cloud OAuth
// app registration (needs the user's own admin console access), so `connect()` throws
// a NOT_IMPLEMENTED-shaped error the route layer turns into HTTP 501. See
// docs/EMAIL_INTEGRATION.md.
export interface EmailProviderAdapter {
  provider: "OUTLOOK" | "GMAIL";
  isConfigured(): boolean;
  requiredEnvVars(): string[];
  /** Would start the OAuth authorization-code flow. Throws if not configured. */
  getAuthorizationUrl(userId: string): string;
}
