// Central, typed access to process.env. Reads the exact variable names documented in
// the repo-root .env.example. No secrets have default real values here — only
// non-secret operational defaults (ports, intervals) fall back to something sane.

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  nodeEnv: optional("NODE_ENV", "development"),
  port: intEnv("PORT", 4000),

  databaseUrl: () => required("DATABASE_URL"),

  jwtSecret: () => required("JWT_SECRET"),
  jwtAccessTtl: optional("JWT_ACCESS_TTL", "15m"),
  refreshTokenTtl: optional("REFRESH_TOKEN_TTL", "30d"),

  // false on a public server: nobody can self-register; the admin creates accounts.
  // The very first account can still register on an empty database (bootstrap).
  allowRegistration: optional("ALLOW_REGISTRATION", "true").toLowerCase() !== "false",
  // Optional bootstrap admin, created on API start if no account with that email
  // exists yet (and promoted to admin if it does). Used for server deployments.
  adminEmail: optional("ADMIN_EMAIL"),
  adminPassword: optional("ADMIN_PASSWORD"),
  adminName: optional("ADMIN_NAME", "Administrator"),

  webOrigin: optional("WEB_ORIGIN", "http://localhost:3000"),
  mobileOrigin: optional("MOBILE_ORIGIN", "http://localhost:19006"),

  storageRoot: optional("STORAGE_ROOT", "./storage"),
  encryptionKey: optional("ENCRYPTION_KEY", ""),

  workerTickSeconds: intEnv("WORKER_TICK_SECONDS", 30),
  workerBatchSize: intEnv("WORKER_BATCH_SIZE", 50),
  dispatcherTickSeconds: intEnv("DISPATCHER_TICK_SECONDS", 10),
  staleAfterHours: intEnv("STALE_AFTER_HOURS", 24),

  smtpHost: optional("SMTP_HOST"),
  smtpPort: intEnv("SMTP_PORT", 587),
  smtpUser: optional("SMTP_USER"),
  smtpPass: optional("SMTP_PASS"),
  smtpFrom: optional("SMTP_FROM", "ProjectFlow <no-reply@example.com>"),

  msGraphClientId: optional("MS_GRAPH_CLIENT_ID"),
  msGraphClientSecret: optional("MS_GRAPH_CLIENT_SECRET"),
  msGraphTenantId: optional("MS_GRAPH_TENANT_ID"),

  googleOauthClientId: optional("GOOGLE_OAUTH_CLIENT_ID"),
  googleOauthClientSecret: optional("GOOGLE_OAUTH_CLIENT_SECRET"),
  googleOauthRedirectUri: optional("GOOGLE_OAUTH_REDIRECT_URI"),

  whatsappPhoneNumberId: optional("WHATSAPP_PHONE_NUMBER_ID"),
  whatsappAccessToken: optional("WHATSAPP_ACCESS_TOKEN"),
  whatsappVerifyToken: optional("WHATSAPP_VERIFY_TOKEN"),
  // Business-initiated WhatsApp messages (reminders) must use an APPROVED template —
  // free-form text is only delivered inside the 24h window after the user messaged you.
  // Set WHATSAPP_TEMPLATE_NAME to a template whose body has two variables
  // ({{1}} = title, {{2}} = message). Empty = send plain text (works only in that window).
  whatsappTemplateName: optional("WHATSAPP_TEMPLATE_NAME"),
  whatsappTemplateLang: optional("WHATSAPP_TEMPLATE_LANG", "en"),
  whatsappApiUrl: optional("WHATSAPP_API_URL", "https://graph.facebook.com/v20.0"),

  webPushVapidPublicKey: optional("WEBPUSH_VAPID_PUBLIC_KEY"),
  webPushVapidPrivateKey: optional("WEBPUSH_VAPID_PRIVATE_KEY"),
  webPushVapidSubject: optional("WEBPUSH_VAPID_SUBJECT"),
  fcmServerKey: optional("FCM_SERVER_KEY"),
};
