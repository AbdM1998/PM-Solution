# ProjectFlow — Mobile (Expo + React Native + Expo Router)

Native-feeling mobile client for ProjectFlow. Shares wire types and the HTTP client
with `apps/web`/`apps/api` via `packages/shared` (`@projectflow/shared`); the UI itself
is built independently for touch, per `docs/TECHNOLOGY_DECISIONS.md`.

## Getting started

```bash
cd apps/mobile
npm install            # or: npm install from the repo root (npm workspaces)
cp .env.example .env   # already present for local dev; EXPO_PUBLIC_API_BASE_URL
npx expo start --web   # or: npx expo start, then press a/i/w, or scan the QR with Expo Go
```

`apps/api` (built in parallel, see root `docs/API_DESIGN.md`) is expected at
`http://localhost:4000/api` by default. If it isn't running yet, every screen still
renders — you'll see this app's real loading → error states (with a "Try again"
button) rather than fake data, which is intentional.

## What's implemented

- **Auth** (`src/app/(auth)/login.tsx`, `register.tsx`) — email/password via
  `ApiClient.login`/`register`. The access token is stored with `expo-secure-store`
  (Keychain/Keystore) on Android/iOS. **Web-only exception:** SecureStore has no web
  implementation, so `src/lib/secure-storage.ts` falls back to `localStorage` on web —
  that fallback exists purely so `expo start --web` is usable as a smoke test in
  environments without a device/emulator (this one); it is not the production target.
- **Bottom tabs** (`src/app/(tabs)/`) — Today (Dashboard + My Day combined, per the
  task brief), Projects, Calendar, Settings (Notifications + account, combined). Native
  builds get a real native tab bar (`expo-router/native-tabs`, see
  `src/components/app-tabs.tsx`); the web preview falls back to a JS-rendered bar
  (`app-tabs.web.tsx`) since `NativeTabs` has no web renderer.
- **Today / My Day** (`src/app/(tabs)/index.tsx`) — the whole point of the app:
  Overdue / Today / Snoozed / Completed-today, aggregated across every project via
  `GET /dashboard/my-day`. Swipe a row left to complete it, tap to open the
  project/task, long-press (or the clock icon) to snooze with the fixed presets
  (5m/10m/30m/1h/later today/tomorrow/next week/custom).
- **Projects** (`(tabs)/projects.tsx`, `project/[id].tsx`) — list with a status filter,
  and a detail screen with the server-computed stats (`durationDays`,
  `completionPercent`, `daysOverdue`, etc. — **read-only**, never recomputed or edited
  client-side) and a swipeable task list.
- **Tasks → Checklists** (`task/[id].tsx`) — arbitrarily nested checklist items
  (`parentId`), quick-complete by tap or swipe.
- **Notifications/Settings** (`(tabs)/settings.tsx`) — the in-app notification feed
  (`GET /notifications`), mark-read / mark-all-read, account info, logout.
- **Deep links** — `projectflow://project/:id` and `projectflow://task/:id` resolve
  automatically via Expo Router's file-based routing (`src/app/project/[id].tsx`,
  `src/app/task/[id].tsx`); no manual URL parsing needed. A tapped notification uses
  the same routes via `src/hooks/use-notification-router.ts`.
- **Light/dark theme** — follows the system appearance (`useColorScheme`), palette in
  `src/constants/theme.ts`.
- **Loading / error / empty states** — every data-bearing screen has its own (see
  `src/components/{loading,error,empty}-state.tsx`); errors always offer "Try again"
  rather than a dead end, since `apps/api` is being built in parallel and may not be
  reachable.

## Local notifications vs. real reminder delivery — read this before assuming push works

Per `docs/REMINDER_ENGINE.md`, the thing that actually survives the app being killed,
the phone rebooting, or the server being down for a day is the **backend worker** and
its `NotificationOutbox` (In-App via Socket.io and Email via SMTP are live today;
WhatsApp and Mobile Push (FCM/APNs) are scaffolded adapters waiting on real
credentials, per `docs/TECHNOLOGY_DECISIONS.md`). That backend-delivered notification
is the source of truth for "did the user get reminded" — **not** anything in this app.

What this app's `expo-notifications` code (`src/lib/notifications.ts`) actually does:

- `registerForPushNotificationsAsync()` calls `POST /devices/register` so the backend
  *could* target this device once a real EAS project + FCM/APNs credentials exist. No
  `eas init`/Expo-account login was run in this environment, so there is no linked EAS
  project — `getExpoPushTokenAsync` can't produce a real token here, and the code
  detects that and skips registration (logging why) rather than fabricating a fake one.
- `confirmActionLocally()` fires an **immediate** local notification (e.g. "Reminder
  snoozed — we'll remind you again later today") purely so the user gets instant
  on-device feedback that their tap registered. It deliberately never schedules into
  the future, to avoid double-notifying once a real push channel exists.

## Known limitations / deliberate scope decisions

- **No project/task/checklist-item creation or editing UI.** The task brief's mobile
  requirements frame Projects/Tasks as read + quick-complete ("computed ... stats
  (server-computed, read-only), tasks list, ... quick-complete") — not authoring.
  Adding full create/edit forms felt like scope creep beyond that; it's a natural
  follow-up once that's actually requested for mobile.
- **No silent token refresh.** `docs/API_DESIGN.md` documents a 15-minute access token
  refreshed via an httpOnly cookie (`POST /auth/refresh`) — a browser-centric
  mechanism. React Native's `fetch` does send/receive cookies through the native
  networking stack, but this hasn't been verified against a real `apps/api` from this
  sandbox, and `ApiClient.request` doesn't retry after calling `onUnauthorized`. On a
  401, this app signs the user out rather than pretend the session silently survived —
  honest, if less convenient. Revisit once `apps/api` is reachable to test against.
- **Custom snooze uses plain text date/time fields**, not
  `@react-native-community/datetimepicker`. That picker has no web renderer and this
  sandbox has no Android/iOS device/emulator to verify its native behavior
  interactively; text inputs are fully testable here and work identically on every
  platform. Swapping in the native picker is a reasonable follow-up once real device
  testing is possible.
- **Swipe gesture uses core React Native `PanResponder`/`Animated`**, not
  `react-native-gesture-handler`'s newer hook-based gesture API (this SDK ships
  gesture-handler v3, which replaced the `Gesture.Pan()` builder with
  `usePanGesture`) — chosen for the same reason: no device to interactively verify an
  unfamiliar gesture API against, versus the long-stable core RN one.
- **NativeTabs icon names weren't visually verified.** `src/components/app-tabs.tsx`
  uses real SF Symbol names and Android Material Symbol names (checked against
  `expo-symbols`' bundled catalog and TypeScript's own literal-union type, which does
  reject invalid SF Symbol names at compile time — `npx tsc --noEmit` passes), but
  their on-device rendering couldn't be visually confirmed without an iOS/Android
  device or simulator.
- **CHECKLIST_ITEM entries in "My Day" open the parent project, not the specific
  checklist item.** `MyDayItem` (shared type) doesn't carry the parent task id for
  checklist-item entries, so there's no route to deep-link directly to one without an
  extra lookup. Flagged in code (`src/app/(tabs)/index.tsx`, `entityHref`).

## Changes made to `packages/shared` (read-only/additive per task scope)

Added only what was documented in `docs/API_DESIGN.md` but missing from the shared
contract, needed by this app specifically:

- `types.ts`: `DevicePlatform`, `AppNotification` (named to avoid colliding with the
  DOM `Notification` type apps/web would also see).
- `api-client.ts`: `getTask(id)` (single-task fetch, needed to resolve a
  `projectflow://task/:id` deep link), `registerDevice(platform, token)`,
  `listNotifications(unreadOnly?)`, `markNotificationRead(id)`,
  `markAllNotificationsRead()`.

(`apps/web`'s engineer was concurrently adding their own additions — `Tag`,
`ActivityEntry`, `refresh()`, `logout()`, etc. — to the same files; both sets of
changes coexist without conflict.)

## Verifying this app without a device/emulator (what was actually run here)

This machine has no Android SDK and no Xcode/macOS, so a signed APK/IPA cannot be
produced here — expected and acceptable per the task brief. What was verified:

```bash
npx tsc --noEmit        # clean — 0 errors
npx expo-doctor         # 20/20 checks passed
npx expo start --web    # Metro/SSR bundled every route with 0 errors (see below)
```

Every route was exercised via HTTP against the running dev server (`(auth)/login`,
`(tabs)/index`, `(tabs)/projects`, `(tabs)/calendar`, `(tabs)/settings`,
`project/[id]`, `task/[id]`) and each one bundled successfully — see the run log in
this task's report. The only console output besides "Bundled"/"Web Bundled" lines was
the expected, benign `expo-notifications` warning that notification handling isn't
fully supported on web.

### Producing a real build later (once an Android SDK / Xcode machine is available)

```bash
npx eas-cli@latest login                 # requires an Expo account
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform ios --profile preview
```

## Project structure

```
src/
  app/                  # Expo Router routes (file-based)
    (auth)/              login, register
    (tabs)/              index (Today), projects, calendar, settings
    project/[id].tsx     project detail (also the deep-link target)
    task/[id].tsx        task + checklist detail (also the deep-link target)
  components/           presentational components (rows, cards, badges, states)
  context/auth-context.tsx
  hooks/                 react-query hooks per data domain
  lib/                   api client wiring, secure storage, notifications, formatting
  constants/theme.ts     light/dark palette, spacing
```
