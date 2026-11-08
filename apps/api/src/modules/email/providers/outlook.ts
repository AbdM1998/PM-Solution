import { env } from "../../../lib/env";
import type { EmailProviderAdapter } from "./types";

// Microsoft Graph adapter (Outlook/365). Scope would be `Mail.Read` (least privilege —
// read + attach, never full mailbox access). Not live: needs MS_GRAPH_CLIENT_ID /
// MS_GRAPH_CLIENT_SECRET / MS_GRAPH_TENANT_ID, which require registering an Azure AD
// app the user hasn't done in this session.
export const outlookAdapter: EmailProviderAdapter = {
  provider: "OUTLOOK",
  isConfigured() {
    return Boolean(env.msGraphClientId && env.msGraphClientSecret && env.msGraphTenantId);
  },
  requiredEnvVars() {
    return ["MS_GRAPH_CLIENT_ID", "MS_GRAPH_CLIENT_SECRET", "MS_GRAPH_TENANT_ID"];
  },
  getAuthorizationUrl() {
    if (!this.isConfigured()) throw new Error("Outlook adapter not configured");
    const base = `https://login.microsoftonline.com/${env.msGraphTenantId}/oauth2/v2.0/authorize`;
    const params = new URLSearchParams({
      client_id: env.msGraphClientId,
      response_type: "code",
      scope: "offline_access Mail.Read",
    });
    return `${base}?${params.toString()}`;
  },
};
