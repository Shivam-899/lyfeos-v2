# PROJECT_KNOWLEDGE.md — LyfeOS

> **Living Document — Single Source of Truth**
>
> This file is the **single source of truth and living documentation** for any developer or AI assistant working on the LyfeOS codebase. It reflects the **actual current state** of the project and must be updated as part of every meaningful change.
> See [§19 Documentation Maintenance](#19-documentation-maintenance) for the update protocol.
>
> **Last audited:** 2026-09-10  
> **App version at audit:** `2.2.2` (Android versionCode is automatically managed by Expo/EAS.)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Folder Structure](#3-folder-structure)
4. [Navigation Architecture](#4-navigation-architecture)
5. [State Management](#5-state-management)
6. [Authentication](#6-authentication)
7. [Database & Storage](#7-database--storage)
8. [Data Synchronization](#8-data-synchronization)
9. [Core Features](#9-core-features)
10. [Data Models](#10-data-models)
11. [External APIs & Third-Party Services](#11-external-apis--third-party-services)
12. [Analytics & Telemetry](#12-analytics--telemetry)
13. [Monetization](#13-monetization)
14. [Build & Deployment](#14-build--deployment)
15. [Environment Variables & Secrets](#15-environment-variables--secrets)
16. [Security Analysis](#16-security-analysis)
17. [Known Issues & Tech Debt](#17-known-issues--tech-debt)
18. [Future Roadmap Hooks](#18-future-roadmap-hooks)
19. [Documentation Maintenance](#19-documentation-maintenance)
20. [Change Log](#20-change-log)

---

## 1. Project Overview

| Field | Value |
|---|---|
| **App name** | LyfeOS |
| **Package ID** | `com.lyfeos.app` |
| **Expo slug** | `lyfeos` |
| **EAS Project ID** | `54f639f6-a140-4168-afdc-eb3bca56979e` |
| **Developer account** | `shivam.2k` (EAS) / **Orbits Lab** (Google Play Store) |
| **Current version** | `2.2.2` (Android versionCode is automatically managed by Expo/EAS.) |
| **Platform status** | Android — **Live on Google Play** (internal track → production). iOS config present but not deployed. |
| **Firebase project** | `lyfe-os-2c7cd` |

### What LyfeOS Is

LyfeOS is an **AI-styled, all-in-one life management and productivity app** built with React Native (Expo). It unifies:

- **Habit tracking** — build or quit habits with streak counting, colour/emoji customisation, and flexible tracking methods (task, numeric target, timer)
- **Task management** — prioritised to-do list with categories, due dates, repeat rules, and drag-to-reorder
- **Nutrition tracking** — calorie and macro/micro-nutrient logging with an embedded 300+ item Indian food database plus USDA/Open Food Facts fallback
- **Water tracking** — daily glass counter with custom target
- **Sports & activity logging** — logs workouts with offline MET-based calorie/hydration analysis (styled with AI output delay)
- **Personal health dashboard** — BMR/TDEE calculation (Mifflin-St Jeor), weekly summaries, and in-app coach insights
- **Cloud sync** — Firestore sync for habits, todos, and nutrition (not activity, health profile, or preferences)
- **Push notifications** — 7 configurable daily reminders via Expo Notifications

### Core Architectural Philosophy

The app is **local-first**. AsyncStorage is the primary source of truth during runtime. Cloud sync is a secondary, opportunistic, fire-and-forget layer via Firestore. The app runs fully offline.

> **Critical fact:** The activity analysis ("AI coach") does **not** call any external AI API at runtime on mobile. It uses a fully offline, local MET (Metabolic Equivalent of Task) scientific calculation engine in `utils/analyzeActivity.ts` with an artificial 300–1200 ms delay to simulate a network call. The Gemini API proxy in `metro.config.js` and `server/serve.js` exists for development inspection and static web exports.

---

## 2. Tech Stack

### Frontend & Runtime

| Category | Package | Version |
|---|---|---|
| Framework | `react-native` | `0.81.5` |
| Platform | `expo` | `~54.0.35` |
| Language | TypeScript | `~5.9.2` |
| Router | `expo-router` | `~6.0.24` (file-based) |
| Animations | `react-native-reanimated` | `~4.1.1` |
| Gestures | `react-native-gesture-handler` | `~2.28.0` |
| Safe area | `react-native-safe-area-context` | `~5.6.0` |
| SVG | `react-native-svg` | `15.12.1` |
| Keyboard | `react-native-keyboard-controller` | `^1.18.5` |
| Keyboard scroll | `react-native-keyboard-aware-scroll-view` | `^0.9.5` |
| Blur/Glass | `expo-blur` / `expo-glass-effect` | `~15.0.8` / `~0.1.4` |
| Linear gradients | `expo-linear-gradient` | `~15.0.8` |
| Haptics | `expo-haptics` | `~15.0.8` |
| Image picker | `expo-image-picker` | `~17.0.9` |
| Audio/video | `expo-av` | `^16.0.8` |
| Icons | `@expo/vector-icons` (Ionicons + SymbolView) | `^15.0.3` |
| Font | `@expo-google-fonts/inter` (400/500/600/700) | `^0.4.0` |
| Notifications | `expo-notifications` | `^0.32.17` |
| Store review | `expo-store-review` | `~9.0.9` |
| OTA updates | `expo-updates` | `~29.0.18` |
| Server state | `@tanstack/react-query` | `^5.80.0` (scaffolded, not actively used) |
| Validation | `zod` + `zod-validation-error` | `^3.25.0` / `^3.4.0` |
| Worklets | `react-native-worklets` | `0.5.1` |
| React Compiler | `babel-plugin-react-compiler` | `^19.0.0-beta` (experimental) |

> **Babel Configuration Note:** The current `babel.config.js` uses `babel-preset-expo` with `unstable_transformImportMeta: true`. The `react-native-reanimated/plugin` that appeared in older templates is no longer listed in `babel.config.js`.

### Backend & Cloud

| Service | SDK | Version | Status |
|---|---|---|---|
| Firebase Auth | `@react-native-firebase/auth` | `^24.1.1` | **Active** |
| Firebase Firestore | `@react-native-firebase/firestore` | `^24.1.1` | **Active** |
| Firebase Analytics | `@react-native-firebase/analytics` | `^24.1.1` | **Active** (real native SDK, not a stub) |
| Firebase Crashlytics | `@react-native-firebase/crashlytics` | `^24.1.1` | **Active** (fatal + non-fatal error capture, sanitized attributes, ErrorBoundary & global handler) |
| Firebase Performance | `@react-native-firebase/perf` | `^24.1.1` | **Active** (app startup, HTTP network, custom traces via `utils/perf.ts`) |
| Firebase App Check | *(not installed)* | — | **Not Active / Unenforced** (Must remain in monitoring mode in Console) |
| Google Sign-In | `@react-native-google-signin/google-signin` | `^16.1.2` | **Active** |
| Google AdMob | `react-native-google-mobile-ads` | `^16.3.3` | **Active** |
| Meta (Facebook) SDK | `react-native-fbsdk-next` | `13.4.3` | **Active** |

### Local Storage

- **`@react-native-async-storage/async-storage`** `2.2.0` — single local persistence layer; stores all user data as plain-text JSON.

### Build System

- **EAS Build** (`eas-cli >= 19.0.5`) for production `.aab` and `.apk`
- **pnpm** `9.15.4` package manager
- **Metro** bundler with custom `metro.config.js` that embeds a Gemini API proxy for **development inspection only**
- **Kotlin** pinned to `2.1.20` via custom `plugins/withKotlinVersion.js` config plugin
- **ProGuard & Resource Shrinking** enabled in release builds (`enableProguardInReleaseBuilds: true`, `enableShrinkResourcesInReleaseBuilds: true`)
- **React Compiler** experimental (`reactCompiler: true` in `app.json`)
- **New Architecture** enabled (`newArchEnabled: true` in `app.json`)

---

## 3. Folder Structure

```
D:\vf\                                 <- Project root (LyfeOS)
├── app/                               <- Expo Router: all screens live here
│   ├── _layout.tsx                    <- Root layout: providers, auth guard, splash, ads init
│   ├── index.tsx                      <- Minimal entry (routing handled in _layout)
│   ├── onboarding.tsx                 <- 4-slide animated onboarding (first-launch only)
│   ├── login.tsx                      <- Auth: Google, Email/Password, Guest, Forgot Password
│   ├── legal-consent.tsx              <- Terms/Privacy/Health disclaimer gate (CONSENT_VERSION='1.0')
│   ├── +not-found.tsx                 <- 404 fallback
│   └── (tabs)/                        <- Authenticated tab group
│       ├── _layout.tsx                <- Tab bar (iOS Liquid Glass or classic Expo Tabs)
│       ├── index.tsx                  <- Home / Dashboard (~70 KB)
│       ├── habits.tsx                 <- Habit tracker (~30 KB)
│       ├── todos.tsx                  <- Task list (~55 KB)
│       ├── calories.tsx               <- Nutrition tracker (~121 KB — largest screen)
│       └── profile.tsx                <- Profile, health settings, account deletion (~90 KB)
│
├── components/                        <- Reusable UI components
│   ├── ActivityTracker.tsx            <- Sports/activity logging modal (~80 KB)
│   ├── AddHabitSheet.tsx              <- Bottom sheet: create/edit habits (~34 KB)
│   ├── CalendarStrip.tsx              <- Horizontal scrollable calendar strip (~17 KB)
│   ├── CircularProgress.tsx           <- SVG circular progress ring
│   ├── ConfettiEffect.tsx             <- Confetti animation for habit streak celebrations
│   ├── ErrorBoundary.tsx              <- React error boundary wrapper
│   ├── ErrorFallback.tsx              <- UI shown on crash (~7 KB)
│   └── HabitTile.tsx                  <- Individual habit card with toggle (~19 KB)
│
├── context/                           <- React Context API: all global state
│   ├── AuthContext.tsx                <- Firebase auth state + all auth actions (303 lines)
│   ├── CaloriesContext.tsx            <- Food items, water logs, daily goals, sync
│   ├── HabitsContext.tsx              <- Habits, logs, streaks, ad integration
│   ├── TodosContext.tsx               <- Todos: CRUD, ordering, sync
│   ├── ActivityContext.tsx            <- Activity logs, steps, banner, coach insight
│   ├── ProfileContext.tsx             <- User profile, health data, reminders, prefs
│   └── ThemeContext.tsx               <- Theme mode (system/dark/light)
│
├── constants/
│   └── colors.ts                      <- Light/dark token palette for the app
│
├── hooks/
│   ├── useAppTheme.ts                 <- Returns DARK_TOKENS / LIGHT_TOKENS + mode/setMode
│   └── useColors.ts                   <- Returns the active colors object
│
├── utils/                             <- Pure utilities and external API clients
│   ├── storage.ts                     <- AsyncStorage wrapper + LYFEOS_STORAGE_KEYS + clearAllLyfeOSLocalData()
│   ├── cloudSync.ts                   <- Firestore CRUD: sync/fetch/merge + deleteUserCloudData (286 lines)
│   ├── analytics.ts                   <- Firebase Analytics (active) + Meta SDK events + Crashlytics stubs (154 lines)
│   ├── ads.ts                         <- AdMob: banner, interstitial, rewarded + interstitial block guard
│   ├── notifications.ts               <- expo-notifications: permissions + 7 daily reminders
│   ├── analyzeFoodImage.ts            <- FoodAnalysisResult interface; camera scan STUBBED; text delegates to nutritionSearch
│   ├── nutritionSearch.ts             <- Waterfall: local Indian DB -> cache -> USDA -> Open Food Facts
│   ├── indianFoodDatabase.ts          <- Bundled ~300 Indian food items with nutrients
│   ├── analyzeActivity.ts             <- Offline MET-based calculation engine + 30+ activities (404 lines)
│   └── date.ts                        <- getLocalDateString() — timezone-safe YYYY-MM-DD
│
├── plugins/
│   └── withKotlinVersion.js           <- Custom Expo config plugin: pins Kotlin to 2.1.20
│
├── server/
│   ├── serve.js                       <- Node.js HTTP server for static Expo web export (not used in native app)
│   └── templates/landing-page.html
│
├── scripts/
│   ├── build.js                       <- Static Expo web export build script
│   ├── diagnose-gemini.mjs            <- Dev diagnostic: tests Gemini API connectivity
│   └── test-indian-db.js              <- Dev test: validates indianFoodDatabase entries
│
├── assets/images/                     <- App icon, splash image
├── assets/sounds/                     <- Empty — reserved for future audio
├── android/                           <- Native Android project (EAS build target)
│
├── app.json                           <- Expo config: name, plugins, permissions, SDK versions
├── eas.json                           <- EAS Build profiles
├── package.json                       <- Dependencies and scripts
├── metro.config.js                    <- Metro bundler + dev-only Gemini proxy middleware
├── babel.config.js                    <- Babel: babel-preset-expo only (no reanimated plugin)
├── tsconfig.json                      <- TypeScript strict, paths: "@/*" -> root
├── google-services.json               <- Firebase Android config (safe to commit)
├── @shivam.2k__lyfeos.jks             <- DANGER: Production Android keystore (never commit to public repo)
├── @shivam.2k__lyfeos_OLD_1.jks       <- Old keystore (keep for reference only)
├── .env.example                       <- Template for environment variables
├── .env.local                         <- GITIGNORED — actual secrets
└── build-android.sh                   <- Shell: clears EAS temp dirs + runs production build
```

### Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Screens / components | PascalCase | `CaloriesContext.tsx` |
| Utilities | camelCase | `cloudSync.ts` |
| AsyncStorage keys | `@lyfeos_<domain>_v<N>` | `@lyfeos_habits_v2` |
| Routes | File name = route segment | `calories.tsx` -> `/calories` |

---

## 4. Navigation Architecture

**Router:** Expo Router (file-based, Stack + Tabs)

```
/ (root Stack — app/_layout.tsx)
├── /index                    <- Minimal redirect (renders null, routing in _layout)
├── /onboarding               <- First-launch 4-slide carousel; sets hasSeenOnboarding
├── /login                    <- Auth screen
├── /legal-consent            <- GDPR/legal gate (must pass before entering tabs)
└── /(tabs)                   <- Bottom tab group (requires auth + legal consent)
    ├── /             (index) <- Home / Dashboard
    ├── /habits               <- Habit tracker
    ├── /todos                <- Task list
    ├── /calories             <- Nutrition tracker
    └── /profile              <- Profile & settings
```

### Navigation Guard Logic (`app/_layout.tsx` -> `RootLayoutNav`)

```
App launches
  |-- isInitializing (auth resolving) -> wait, no redirect
  |-- Not logged in:
  |   |-- hasSeenOnboarding = false -> /onboarding
  |   +-- hasSeenOnboarding = true  -> /login
  +-- Logged in (user or guest):
      |-- legalConsentAccepted = false -> /legal-consent
      +-- legalConsentAccepted = true  -> /(tabs)
```

**Consent versioning:** `CONSENT_VERSION = '1.0'` stored alongside the acceptance timestamp in both AsyncStorage (`legalConsent`) and Firestore (`users/{uid}/data/consent`). Bumping this constant forces all existing users through the consent screen again on launch.

### Tab Bar Adaptation

- **iOS with Liquid Glass available:** uses `expo-router/unstable-native-tabs` (native iOS tab bar)
- **All other platforms (Android, web):** uses Expo Router `<Tabs>` with `BlurView` on iOS, solid background on Android

---

## 5. State Management

**Strategy:** React Context API only. No Redux, Zustand, MobX, or Jotai.  
`@tanstack/react-query` is scaffolded in `_layout.tsx` but **not used anywhere in the app**.

### Provider Hierarchy (`app/_layout.tsx`)

```
SafeAreaProvider
  +-- ThemeProvider
      +-- ErrorBoundary
          +-- QueryClientProvider          (not actively used)
              +-- AuthProvider
                  +-- HabitsProvider
                      +-- TodosProvider
                          +-- CaloriesProvider
                              +-- ActivityProvider
                                  +-- ProfileProvider
                                      +-- GestureHandlerRootView
                                          +-- KeyboardProvider
                                              +-- RootLayoutNav
```

### Lifecycle Pattern (all contexts follow this)

1. **Mount:** Read from AsyncStorage -> set React state. (`HabitsProvider` renders `null` until loaded.)
2. **If auth user (non-guest):** One-time `.get()` from Firestore -> merge/conflict-resolve -> update state + AsyncStorage
3. **On every mutation:** Update React state -> write AsyncStorage -> fire-and-forget Firestore `.set()` (non-blocking)
4. **Stale closure fix:** All mutation callbacks use `useRef` to access latest `user`/`isGuest` values without re-render

### Auth-Aware Sync

- Firestore sync only fires when `user && !isGuest`
- Guest users have full local functionality, no cloud sync
- On sign-in from guest -> `migrateGuestDataToAccount()` uploads and merges local data to Firestore atomically

---

## 6. Authentication

**File:** `context/AuthContext.tsx` (303 lines)

### Sign-In Methods

| Method | Implementation |
|---|---|
| **Email / Password** | `auth().createUserWithEmailAndPassword()` / `auth().signInWithEmailAndPassword()` |
| **Google Sign-In** | `GoogleSignin.signIn()` -> `auth.GoogleAuthProvider.credential(idToken)` -> `auth().signInWithCredential()` |
| **Anonymous (Guest)** | `auth().signInAnonymously()` — `user.isAnonymous === true` |
| **Password Reset** | `auth().sendPasswordResetEmail()` — triggered from modal in `app/login.tsx` |

**Google Sign-In webClientId (hardcoded):** `66808080139-r6t78lrsqsoabug2jlrltb1bbevt2003.apps.googleusercontent.com`

### Auth Context API

```typescript
interface AuthContextType {
  user: FirebaseAuthTypes.User | null;
  loading: boolean;
  isInitializing: boolean;      // alias for loading (backward compat)
  isGuest: boolean;             // user.isAnonymous
  migrationDone: boolean;
  clearMigrationDone: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email, password) => Promise<void>;
  signUpWithEmail: (name, email, password) => Promise<void>;
  signInAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  reauthenticateWithEmail: (password) => Promise<void>;
  reauthenticateWithGoogle: () => Promise<void>;
  deleteAccountAndData: (passwordForReauth?) => Promise<void>;
  deleteGuestData: () => Promise<void>;
}
```

### Sign-Out

`signOut()` calls `auth().signOut()` + `GoogleSignin.signOut()`.

> **CRITICAL ISSUE:** `signOut()` does **not** call `clearAllLyfeOSLocalData()`. All user data remains in AsyncStorage after logout. On shared devices, a subsequent user's `handleGuestMigration()` may read and upload the prior user's data. See [§17, Issue #1](#17-known-issues--tech-debt).

### Account Deletion (5-Step Sequence)

1. **Re-authenticate** — email users must supply password; Google users must re-sign-in. If re-auth fails, nothing is deleted.
2. **Delete Firestore data** — `deleteUserCloudData(uid)` batch-deletes all docs under `users/{uid}/data/*` + `users/{uid}` doc, then verifies `snapshot.empty`.
3. **Delete Firebase Auth record** — `currentUser.delete()`
4. **Clear local data** — `cancelAllNotifications()` + `clearAllLyfeOSLocalData()` (removes all `@lyfeos_*` keys; preserves `hasSeenOnboarding`)
5. **Reset telemetry** — `setAnalyticsUser("")` + `AppEventsLogger.setUserID(null)` + `GoogleSignin.signOut()`

### Guest Account Deletion (`deleteGuestData()`)

Deletes anonymous Firebase Auth session (or signs out), then runs steps 4 and 5 above.

### Guest -> Account Conversion & Migration (`linkWithCredential` & `handleGuestMigration()`)

- **Anonymous -> New Account Conversion (Phase 2A):**
  - When an active guest creates a new email account (`signUpWithEmail`) or links a new Google account (`signInWithGoogle`), LyfeOS invokes `anonUser.linkWithCredential(credential)`.
  - **UID Preservation:** The anonymous UID is preserved as the permanent account UID (`result.user.uid === anonUser.uid`), and `user.isAnonymous` transitions to `false`.
  - **Zero Orphan Accounts:** No abandoned anonymous Firebase Auth records are left behind.
  - **Duplicate Migration Prevention:** Because the UID is identical and all local `AsyncStorage` data is already attached to this session, `handleGuestMigration()` is intentionally skipped on successful linking. The app's standard context providers mount, detect `user && !isGuest`, and naturally synchronize the local data to Firestore under the permanent UID.
  - **Known Limitation / Existing Account Guard:** If the credential belongs to an existing account, Firebase throws `auth/credential-already-in-use`. In Phase 2A, the anonymous user is **not** deleted, no silent account switch or blind data merge occurs, and the guest session is preserved. Resolution via user prompt (Merge vs. Discard) is deferred to Phase 2B/2C.

- **Existing Account Guest Migration Gate & Resolution State (Phase 2B-1):**
  - **Vulnerability Remediated:** Previously, when a guest user signed into an existing account (`signInWithEmail` or Google `signInWithCredential` after `auth/credential-already-in-use`), `handleGuestMigration()` was called unconditionally, silently injecting transient guest data into the existing account without user consent.
  - **`hasMeaningfulGuestData()` Helper (`utils/storage.ts`):** Evaluates 10 deterministic criteria for genuine user activity (active habits, habit logs, todos, food items, water >0, activity logs, steps >0, custom health profile, custom calorie goals, custom profile name). Strictly ignores default preferences, `joinDate`, onboarding state, legal consent, empty arrays, and soft-deleted tombstones (`deletedAt`).
  - **`isPendingMigrationResolution` in `AuthContext`:** Tracks whether an existing account has authenticated from an anonymous guest session containing meaningful guest data. Exposed via `useAuth()` along with `setPendingMigrationResolution`.
  - **Authentication Gate (`signInWithEmail` & `signInWithGoogle`):**
    - If `wasAnonymous && !isNewUser && hasMeaningfulGuestData()` is detected, `isPendingMigrationResolution` is set to `true`, and `handleGuestMigration()` is completely suppressed.
    - If no meaningful guest data exists, `clearAllLyfeOSLocalData()` runs to purge transient guest state, and normal login proceeds.
  - **Navigation Gate (`app/_layout.tsx`):** `RootLayoutNav` checks `if (... || isPendingMigrationResolution) return;` preventing premature redirection to `/(tabs)`. The user remains on `app/login.tsx` while migration resolution is pending.
  - **Native Client Deletion Safety:** Reaffirms that `anonUser.delete()` must NEVER be invoked on the client after authenticating an existing account because `@react-native-firebase/auth` always executes `delete()` against `getCurrentUser()`, which would permanently delete the user's permanent account. Client-side discard must only clear local state via `clearAllLyfeOSLocalData()`.

- **Existing-Account Guest Data Resolution (Phase 2B-2):**
  - **Persistent Checkpoint (`@lyfeos_pending_migration_v1`):** Stores `{ version: 1, targetUid, createdAt, status: "pending" | "cloud_merged" }`. Written in `signInWithEmail` and `signInWithGoogle` only after confirming meaningful guest data. Never stores tokens or sensitive credentials.
  - **Cold-Start Recovery & UID Mismatch Protection:** On startup, `AuthProvider` verifies that the active authenticated UID matches `checkpoint.targetUid`. If matched, `isPendingMigrationResolution = true` is restored, preventing `_layout.tsx` from redirecting into `/(tabs)`. If mismatched or user is logged out, the stale checkpoint is safely invalidated and removed without modifying either account or data.
  - **Discard Action (`discardGuestDataAndProceed()`):** Verifies authenticated target UID matches checkpoint, clears local guest data from AsyncStorage via `clearAllLyfeOSLocalData()`, cancels guest notifications, clears checkpoint, resets `isPendingMigrationResolution(false)`, updates analytics identity to target UID, and unblocks navigation. Target-account Firestore data is 100% untouched.
  - **Merge Action (`mergeGuestDataAndProceed()`):** Verifies target UID matches checkpoint, reads local guest data, merges into existing cloud account via `migrateGuestDataToAccount()`, atomically batches writes with `{ merge: true }`, updates local storage, marks checkpoint `status: "cloud_merged"` to ensure idempotency on retry, clears checkpoint, resets `isPendingMigrationResolution(false)`, sets `migrationDone = true`, updates analytics identity, and unblocks navigation.
  - **Failure & Retry Safety:** If merge fails (e.g. offline/network), local guest data is preserved, checkpoint remains intact in AsyncStorage, and pending state remains true. Retrying merge is idempotent and does not create duplicate records or corrupt cloud state. If local cleanup fails during discard, error is thrown and checkpoint is preserved.
  - **Child Provider Sync Dormancy:** While `isPendingMigrationResolution === true`, `AuthProvider` masks `user` as `null` to child context providers (`Habits`, `Calories`, `Todos`, `Activity`, `Profile`), preventing them from prematurely fetching from cloud and syncing local guest data to Firestore before the user decides. Once resolution completes, `user` is unmasked, and providers hydrate correctly.
- **Existing-Account Guest Data Resolution UI & Cold-Start Routing (Phase 2B-3):**
  - **Cold-Start Routing Guard (`app/_layout.tsx`):** If `isPendingMigrationResolution === true` on cold-start or app resume, `RootLayoutNav` immediately calls `router.replace("/login")` if not already on the login route, hides the splash screen via `SplashScreen.hideAsync()`, and returns early. This guarantees the user is routed to `app/login.tsx` to resolve the pending migration rather than getting stuck on a blank screen.
  - **`GuestDataResolutionModal` Component (`app/login.tsx`):**
    - Renders automatically whenever `isPendingMigrationResolution === true` using standard theme tokens (`#0F0F0F`, `#1A1A1A`, `#FF6B35`, `#EF4444`).
    - **Decision View:**
      - Header icon badge with `cloud-download-outline` in accent tint.
      - Exact title: `"Guest Data Found"`.
      - Exact body: `"We found data you created on this device while using LyfeOS as a guest. You can add it to your account or discard it."`.
      - Reassurance box with `shield-checkmark-outline`: `"Your existing account data is safe and won't be overwritten."`.
      - Primary CTA: `"Keep & Merge Data"` with subtext `"Adds your guest data to this account"`. Triggers `mergeGuestDataAndProceed()`.
      - Secondary CTA: `"Discard Guest Data"` with subtext `"Permanently removes data from your guest session"`. Transitions view to Discard Confirmation.
    - **Discard Confirmation View:**
      - Header badge with `trash-outline` in red error tint.
      - Exact title: `"Permanently Discard Guest Data?"`.
      - Exact body: `"This will permanently remove the data created during your guest session. This action cannot be undone.\n\nYour existing account data will remain completely untouched."`.
      - Destructive Primary CTA: `"Yes, Permanently Discard"`. Triggers `discardGuestDataAndProceed()`.
      - Secondary Cancel CTA: `"No, Keep Data"`. Returns to Decision view.
    - **Loading States:** Displays large activity indicator with `"Merging your guest data..."` during merge and `"Discarding guest data..."` during discard.
    - **Error & Retry States:** Displays inline error banner (`"Unable to Merge Data"` or `"Unable to Discard Data"`) with a `"Try Again"` button.
    - **Double-Tap Lockout:** All modal buttons are disabled when an operation is in-flight (`resolutionLoading !== null`), preventing concurrent or duplicate calls.
    - **Strict Non-Dismissibility & Android Back Handling:** The modal overlay does not dismiss on tap-outside. Android back button on Discard Confirmation safely returns to the Decision view; on Decision view or during loading, Android back is strictly blocked until the user makes an explicit choice.
    - **Copy Hygiene:** Zero technical jargon (no mention of AsyncStorage, Firebase, Firestore, UID, checkpoint, migration, tokens). Uses generic "Guest Data" terminology across all user-facing text.

- **Legacy / Direct Guest Migration (`handleGuestMigration()`):**
  - For non-linked migrations, reads all local guest data using **correct versioned keys** (`@lyfeos_habits_v2`, `@lyfeos_habit_logs_v2`, `@lyfeos_todos_v2`, `@lyfeos_food_v2`, `@lyfeos_water_v2`, `@lyfeos_food_meta_v1`, `@lyfeos_goal_v2`, `@lyfeos_goals_configured_v1`, plus profile and activity keys) then calls `migrateGuestDataToAccount()` in `cloudSync.ts` which:
  - Fetches existing cloud data for habits, todos, calories, activity, profile in parallel
  - Merges: habits (set-union by ID + name), habit logs (keep true + max amount/time), todos (cloud-first union with re-indexing), food (dedup by ID), water (max glasses per date)
  - Merges nutrition via `mergeCaloriesMigrationData()`, strictly preserving existing authenticated account `dailyGoal`, `goalsConfigured`, and arbitrary top-level fields
  - Writes all merged data in an atomic Firestore batch
  - Updates local AsyncStorage with the merged result so device stays consistent


---

## 7. Database & Storage

### Firestore Structure

Firestore uses a **document-as-table array store** pattern. Individual items are NOT separate Firestore documents.

```
users/                             (Collection)
  +-- {uid}/                       (Document — no direct fields)
        +-- data/                  (Subcollection)
              +-- habits           { habits: Habit[], habitLogs: HabitLog[], updatedAt, migratedFromGuest? }
              +-- todos            { todos: Todo[], updatedAt, migratedFromGuest? }
              +-- calories         { calories: { foodItems: FoodItem[], waterLogs: WaterLog[], lastModified: number }, updatedAt, migratedFromGuest? }
              +-- consent          { accepted: boolean, version: string, timestamp: string (ISO) }
```

**No real-time listeners (`onSnapshot`) are used.** All reads are one-time `.get()` calls on mount.

### What Is and Is Not Synced to Firestore

| Data Domain | AsyncStorage | Firestore | Notes |
|---|---|---|---|
| Habits + Habit Logs | YES | YES | Set-union merge |
| Todos | YES | YES | Naive cloud-overwrite on fetch — known issue |
| Nutrition (food + water) | YES | YES | Timestamp-guarded last-write-wins |
| Legal Consent | YES | YES | Written once on acceptance |
| Activity / Workout Logs | YES | **NO** | Local only — lost on device replacement |
| Daily Steps | YES | **NO** | Local only |
| Health Profile | YES | **NO** | Local only |
| User Preferences | YES | **NO** | Local only |
| Notification Settings | YES | **NO** | Local only |
| Daily Nutrition Goals | YES | **NO** | Local only |
| Post-Activity Banner & Coach Insight | YES | **NO** | Local only |
| Theme Mode | YES | **NO** | Local only |

### AsyncStorage Key Registry

All keys are defined in `utils/storage.ts` — `LYFEOS_STORAGE_KEYS` array. `clearAllLyfeOSLocalData()` removes all of these plus any dynamic `@lyfeos_*` keys, while **preserving `hasSeenOnboarding`**.

| Key | Data Type | Notes |
|---|---|---|
| `@lyfeos_food_v2` | `FoodItem[]` | |
| `@lyfeos_water_v2` | `WaterLog[]` | |
| `@lyfeos_goal_v2` | `DailyGoal` | |
| `@lyfeos_goals_configured_v1` | `"true"\|"false"` | |
| `@lyfeos_food_meta_v1` | `{ lastModified: number }` | Calories sync timestamp guard |
| `@lyfeos_habits_v2` | `Habit[]` | |
| `@lyfeos_habit_logs_v2` | `HabitLog[]` | |
| `@lyfeos_version` | `"v2_empty"` | Schema migration gate |
| `@lyfeos_todos_v2` | `Todo[]` | |
| `@lyfeos_activity_logs_v1` | `ActivityLog[]` | |
| `@lyfeos_steps_v1` | `StepsLog[]` | |
| `@lyfeos_activity_banner_v1` | `PostActivityBanner \| null` | Auto-purged if > 2 hours old |
| `@lyfeos_coach_insight_v1` | `WeeklyCoachInsight \| null` | |
| `@lyfeos_profile_name_v1` | `string` | |
| `@lyfeos_profile_join_v1` | ISO date string | |
| `@lyfeos_profile_habitgoal_v1` | `string` (number) | |
| `@lyfeos_profile_actgoal_v1` | `string` (number) | |
| `@lyfeos_profile_health_v1` | `HealthProfile` | |
| `@lyfeos_profile_reminders_v1` | `Reminders` | |
| `@lyfeos_profile_prefs_v1` | `Preferences` | |
| `@lyfeos_theme_mode_v1` | `"system"\|"dark"\|"light"` | |
| `@lyfeos_notifications_v1` | `NotifItem[]` | In-app notification inbox |
| `@lyfeos_notif_asked_v1` | flag string | |
| `@lyfeos_rate_reminder_v1` | `RateReminderState` | |
| `@lyfeos_confetti_date_v1` | date string | |
| `legalConsent` | `{ accepted, version, timestamp }` | |
| `hasSeenOnboarding` | `"true"` | **Preserved** by `clearAllLyfeOSLocalData()` |
| `habitCompletionCount` | string (counter) | Ad trigger |
| `lastFoodSearchDate` / `foodSearchCount` / `foodBonusSearches` | strings | Ad/reward gate counters |
| `lastInterstitialDate` | string | |
| `todoBonusUnlocks` / `habitBonusUnlocks` | strings | |
| `lastActivityLogDate` / `activityLogCount` / `activityBonusLogs` | strings | |
| `@lyfeos_notif_enabled_v1` | `"true"\|"false"` | Canonical master notification toggle |
| `notificationsEnabled` | `"true"\|"false"` | Legacy master toggle key (migrated to canonical key, retained for logout purge) |
| `@lyfeos_last_timezone_v1` | `string` | Last recorded device timezone (IANA identifier, e.g. "Asia/Kolkata") for invalidating and rescheduling notifications |

> **Rule for new keys:** Always use `@lyfeos_<domain>_v<N>` prefix. Add to `LYFEOS_STORAGE_KEYS` in `utils/storage.ts`. If the schema changes, bump the version in the key name and add a migration in the Context's `useEffect` initializer.

### Storage Security

- AsyncStorage stores all data as **unencrypted plain text** (SQLite files at `/data/data/com.lyfeos.app/databases/RKStorage`).
- **Android Auto Backup & Device-to-Device (D2D) Migration are intentionally disabled** via `android:allowBackup="false"` in both `app.json` and `android/app/src/main/AndroidManifest.xml`.
- **Security & Privacy Rationale:** LyfeOS stores sensitive personal data locally (biometrics, health profiles, nutrition logs, workouts, habits, personal tasks). Disabling OS-level backup prevents unencrypted local data exposure, cross-account contamination on restored/shared devices, and resurrection of deleted data after account deletion.
- **Restoration Architecture:** Local app data is never restored through Android OS backup or D2D transfer. Authenticated data restoration across devices is strictly handled via the existing Firestore cloud synchronization/hydration architecture upon login.
- **Local Data Lifecycle:** Logout (`signOut`) and account deletion (`deleteAccountAndData`) remain responsible for actively clearing local device storage (`clearAllLyfeOSLocalData()`).

---

## 8. Data Synchronization

### Conflict Resolution by Domain

| Domain | Policy | Details |
|---|---|---|
| **Habits** | Set-union deduplication & latest updatedAt wins | Keyed by stable `id`. Highest `updatedAt` wins; delete-wins on timestamp ties. 30-day tombstone retention. |
| **Habit Logs** | Item-level latest updatedAt wins | Keyed by `habitId_date`. Mutable `completed` state where latest `updatedAt` wins (explicit unchecks propagate). |
| **Todos** | Bidirectional merge with soft-delete tombstones | Highest `updatedAt` wins; delete-wins on timestamp ties. 30-day tombstone retention. Deduplicated by `seriesId` or `title + dueDate + repeat`. |
| **Nutrition (Food Items)** | Item-level latest updatedAt wins | Keyed by stable `id`. Highest `updatedAt` wins; delete-wins on timestamp ties. 30-day tombstone retention. |
| **Water Logs** | Daily aggregate latest updatedAt wins | Keyed by `date`. Latest `updatedAt` wins (decrements propagate). Delete-wins on ties; `Math.max(glasses)` on active ties. |
| **Activity Logs (Workouts)** | Event-level latest updatedAt wins | Keyed by unique `id`. Multiple workouts on same date/sport have distinct IDs and both survive. Highest `updatedAt` wins; delete-wins on timestamp ties. 30-day tombstone retention. |
| **Steps Logs (Daily Steps)** | Daily aggregate latest updatedAt wins (Alternative 1) | Keyed by `date`. Highest `updatedAt` wins (downward typo corrections propagate; `Math.max` NOT used). Delete-wins on ties if either deleted. Cloud-wins deterministically on active ties. Derived metrics remain intact with winning record. |
| **Guest Migration** | Non-destructive deterministic merge | Reads cloud state first, merges per domain rules (habits, todos, calories, goals, activity, steps), writes single atomic batch with `{ merge: true }`, then updates local AsyncStorage. |

### Sync Functions in `utils/cloudSync.ts`

| Function | Purpose |
|---|---|
| `syncHabitsToCloud(uid, habits, habitLogs?)` | `.set({ habits, habitLogs, updatedAt }, { merge: true })` to `users/{uid}/data/habits` |
| `fetchHabitsFromCloud(uid)` | One-time `.get()` returning `habits` array |
| `fetchHabitLogsFromCloud(uid)` | One-time `.get()` returning `habitLogs` array |
| `syncTodosToCloud(uid, todos)` | `.set({ todos, updatedAt })` to `users/{uid}/data/todos` |
| `fetchTodosFromCloud(uid)` | One-time `.get()` returning `todos` array |
| `syncCaloriesToCloud(uid, calories, dailyGoal?, goalsConfigured?)` | `.set(payload, { merge: true })` to `users/{uid}/data/calories` |
| `fetchCaloriesFromCloud(uid)` | One-time `.get()` returning `calories` object + goals |
| `syncActivityToCloud(uid, activity)` | `.set({ ...activity, updatedAt }, { merge: true })` to `users/{uid}/data/activity` |
| `fetchActivityFromCloud(uid)` | One-time `.get()` returning `activity` object (`activityLogs`, `stepsLogs`, `coachInsight`) |
| `mergeHabits(local, cloud)` | Bidirectional merge with updatedAt/deletedAt conflict resolution |
| `mergeHabitLogs(local, cloud)` | Bidirectional merge with mutable completed state resolution |
| `mergeTodos(local, cloud)` | Bidirectional merge with tombstone retention and recurring dedup |
| `mergeFoodItems(local, cloud)` | Item-level bidirectional merge with 30-day tombstone retention |
| `mergeWaterLogs(local, cloud)` | Daily aggregate merge with decrement support and active-tie max |
| `mergeActivityLogs(local, cloud)` | Event-level bidirectional merge with distinct ID multi-workout support |
| `mergeStepsLogs(local, cloud)` | Daily aggregate merge (Alternative 1: newer wins, Delete-Wins on tie, Cloud-Wins on active tie) |
| `migrateGuestDataToAccount(uid, payload)` | Atomic batch: fetch + merge all domains + write + update local AsyncStorage |
| `syncAllUserDataBeforeLogout(uid)` | Pre-logout bidirectional cloud merge + batch commit before local purge |
| `deleteUserCloudData(uid)` | Batch delete all `users/{uid}/data/*` docs + parent doc + verify empty |

### Behavior Under Network Conditions

| Condition | Result |
|---|---|
| Internet available | Background Firestore write succeeds silently |
| Internet unavailable | Local write succeeds; Firebase SDK queues mutation; error caught by `logError()` (no-op stub); UI seamless |
| Firebase request fails | Error logged; local state untouched; app functional |
| App restart | AsyncStorage loaded first; cloud fetch + merge if authenticated |
| User logs out | Pre-logout sync executes full bidirectional merge to Firestore; if successful, local personal data is purged |
| New device login | Habits, todos, calories, food items, water logs, workout activities, and steps download and merge from cloud. |

---

## 9. Core Features

### 9.1 Home / Dashboard (`app/(tabs)/index.tsx`, ~70 KB)

- Daily summary ring (habit completion %), calorie progress bars, active minutes, water count
- Quick habit completion toggles for today
- Upcoming todos preview
- Post-activity banner (shown for 2 hours after a logged workout; stored in `@lyfeos_activity_banner_v1`)
- Weekly AI coach insight text (stored in `@lyfeos_coach_insight_v1`)
- In-app notification inbox
- Rate-reminder prompt (uses `expo-store-review`)
- `ConfettiEffect` fires when 100% of daily habits are completed (guarded by `@lyfeos_confetti_date_v1` to show once per day)
- Progress ring colour: 6-tier dynamic system based on percentage (0–100%)

### 9.2 Habit Tracker (`app/(tabs)/habits.tsx`, `components/AddHabitSheet.tsx`, `components/HabitTile.tsx`)

**Context:** `HabitsContext.tsx`

- Types: `"build"` (start a habit) / `"quit"` (break a bad habit)
- Tracking methods: `"task"` (done/not done), `"amount"` (numeric target), `"time"` (timer in seconds)
- 8 colour choices, ~60 emoji options in 5 categories
- Optional description and weekday scheduling
- `getStreak()` -> `{ current, best }` using local-date-safe arithmetic via `utils/date.ts`
- `getCompletionRate()` -> % of all scheduled days where habit was completed
- Cloud sync on every mutation (add/update/delete/log)
- **Interstitial ad trigger:** every 3rd habit completion -> `maybeShowCompletionAd()` -> `showInterstitialAd()`

### 9.3 Task Management (`app/(tabs)/todos.tsx`, ~55 KB)

**Context:** `TodosContext.tsx`

- Priority: `urgent | high | medium | low`
- Category: `Work | Personal | Shopping | Health | Other`
- Optional: due date, due time, notes, repeat (`none | daily | weekly | monthly`)
- Drag-to-reorder via `reorderTodos(fromIdx, toIdx)`; order persisted as `order: number`
- **Conflict-aware cloud sync:** Bidirectional merge via `mergeTodos()` in `utils/cloudSync.ts`. Each todo tracks `updatedAt: number` and optional `deletedAt?: number` (soft-delete tombstone). Highest `updatedAt` wins; delete wins on timestamp ties. Tombstones are retained for 30 days (`TOMBSTONE_RETENTION_MS`) and purged automatically. Recurring task occurrences are deduplicated by `seriesId` or `title + dueDate + repeat`. UI exposes only active items (`!t.deletedAt`).

### 9.4 Sports / Activity Tracker (`components/ActivityTracker.tsx`, ~80 KB)

**Context:** `ActivityContext.tsx`

- Bottom-sheet modal: user selects sport (with emoji), duration (minutes), intensity (`light | moderate | intense`)
- On submit: calls `analyzeActivity(sport, duration, intensity, weightKg, age)` from `utils/analyzeActivity.ts`
- **This is a 100% offline calculation** using `ACTIVITY_DATABASE` (30+ sports with MET values). No network call. 300–1200 ms artificial delay simulates AI.
- `estimateCalories(sport, durationMin, intensity, weightKg)` — synchronous quick-preview for the live preview card
- Post-activity banner: stored in `@lyfeos_activity_banner_v1`, auto-expires after 2 hours
- Steps: separate `StepsLog` entity; `calculateSteps(steps, weightKg, heightCm)` for stride-based distance/calorie calc
- **Conflict-aware multi-device sync:**
  - **Activity Logs (Workouts):** Synchronized to Firestore under `users/{uid}/data/activity` (`activityLogs`). Keyed by unique `id`. Each log contains `updatedAt: number` and optional `deletedAt?: number`. Merged via `mergeActivityLogs()`. Higher `updatedAt` wins; delete-wins on timestamp ties. Multiple workouts on the same date/sport have distinct IDs and both survive. 30-day tombstone retention (`TOMBSTONE_RETENTION_MS`).
  - **Steps Logs (Daily Steps):** Synchronized to Firestore under `users/{uid}/data/activity` (`stepsLogs`). Strictly one aggregate record per calendar date (`date: YYYY-MM-DD`). Merged via `mergeStepsLogs()` using **Approved Alternative 1**: Higher `updatedAt` wins (allowing both increments and downward typo corrections to propagate across devices; `Math.max()` is strictly avoided). On timestamp ties where either record is deleted: Delete-Wins. On timestamp ties where both are active and values differ: **Cloud-Wins deterministically**. All derived metrics (`distanceKm`, `caloriesBurned`, `activeMinutes`) are retained intact with the winning StepsLog.
  - **Weekly Coach Insight:** Synchronized under `users/{uid}/data/activity` (`coachInsight`).
  - **Context & Storage Isolation:** `ActivityContext` maintains `rawActivityLogs` and `rawStepsLogs` in local storage and cloud payloads while exposing memoized active items (`!l.deletedAt` and `!s.deletedAt`) to UI consumers and metric aggregators. `utils/notifications.ts` filters out tombstones.
  - **Pre-logout & Guest Migration:** Both `syncAllUserDataBeforeLogout` and `migrateGuestDataToAccount` perform bidirectional conflict-aware merges with cloud before committing batch writes with `{ merge: true }`.

> **Important:** `metro.config.js` and `server/serve.js` both expose `/api/analyze-activity` and `/api/gemini` Gemini proxy endpoints. The **native Android/iOS client never calls these**. `utils/analyzeActivity.ts` is fully offline. The proxy is only for development testing or a potential future web deployment.

### 9.5 Nutrition Tracking (`app/(tabs)/calories.tsx`, ~121 KB)

**Context:** `CaloriesContext.tsx`

- 4 meal slots: `breakfast | lunch | dinner | snacks`; default selected based on time of day
- **BMR** computed with Mifflin-St Jeor formula from `HealthProfile`; multiplied by activity level for TDEE
- Macro tracking: Calories, Carbs, Protein, Fat
- Micro-nutrient tracking: Fiber, Sugar, Sodium, Potassium, Calcium, Iron, Magnesium, Zinc, Vitamins A/C/D/B12
- Indian food quick-chips: 20+ preset items as shortcuts
- `getDayStats(date)` aggregates all nutrients for a given day
- **Conflict-aware multi-device sync:** Monolithic overwrite eliminated. Items are merged via `mergeFoodItems()` in `utils/cloudSync.ts`. Each `FoodItem` tracks `id: string`, `updatedAt: number`, and optional `deletedAt?: number` (soft-delete tombstone). Highest `updatedAt` wins; delete wins on timestamp ties. Tombstones are retained for 30 days (`TOMBSTONE_RETENTION_MS`) before purging. The context maintains raw items in storage and cloud while exposing only active items (`!f.deletedAt`) to UI consumers.

**Food search waterfall (`utils/nutritionSearch.ts`):**
1. Local in-memory cache (`searchCache` Map; concurrent duplicate requests deduped via `pendingRequests`)
2. Local Indian food DB (`utils/indianFoodDatabase.ts`, ~300 items)
3. USDA FoodData Central API (`api.nal.usda.gov` — uses `EXPO_PUBLIC_USDA_API_KEY` or falls back to `"DEMO_KEY"` at 30 req/hr/IP)
4. Open Food Facts API (`world.openfoodfacts.org` — no key required)

**Camera food scan:** `analyzeFoodImage()` always throws `"Food Scan is coming soon."` — intentionally disabled.

### 9.6 Water Tracking

Part of `CaloriesContext`. `logWater(date, delta)` increments/decrements `WaterLog.glasses`. Default goal: 8 glasses.
- **Water Sync Semantics:** Strictly one aggregate record per calendar day (`date: YYYY-MM-DD`). Merged via `mergeWaterLogs()`. Newer `updatedAt` wins (ensuring user decrements via `-` button propagate across devices). Delete-Wins on timestamp ties; `Math.max(glasses)` on active timestamp ties guarantees concurrent additions are never lost. Soft-deleted on `clearTodayData(date)` and purged after 30 days. Synced to Firestore with `{ merge: true }`.

### 9.7 Profile & Health Settings (`app/(tabs)/profile.tsx`, ~90 KB)

**Context:** `ProfileContext.tsx`

- `userName`, `joinDate`, `habitGoal` (default: 5), `activityGoal` (default: 30 min)
- `HealthProfile`: `age`, `sex`, `height`, `weight`, `activityLevel`, `goal` — all strings
- `Reminders`: `morning`, `meal`, `water`, `evening` booleans
- `Preferences`: `units` (metric/imperial — stored but UI only shows metric), `calorieDisplay` (kcal/kj — stored but UI hardcodes kcal), `habitEffectsEnabled`
- Profile avatar: picked via `expo-image-picker`, stored only in volatile component state — **lost on app reload** (never persisted)
- Account deletion and guest data deletion flows are exposed from this screen

### 9.8 Push Notifications (`utils/notifications.ts`)

Local scheduled notifications managed via `expo-notifications`, governed by master notification controls and granular `Reminders` toggles:

#### Master Notification Control & Storage
- **Canonical Key:** `@lyfeos_notif_enabled_v1` (boolean string `"true" | "false"`).
- **Legacy Migration:** Automatically migrates legacy `notificationsEnabled` without flipping explicit `"false"` to `"true"`.
- **Immediate Cancellation:** Setting master notifications to `false` via `setMasterNotificationsEnabled(false)` cancels all scheduled OS notifications immediately (`cancelAllNotifications()`).
- **Pre-execution Gate:** The scheduler verifies the master toggle before OS permission checks and before building notification candidates.

#### Notification Schedule & Candidate Reminders
Up to 9 candidate smart reminders evaluated, capped at a maximum of 8 daily notifications (`MAX_DAILY_NOTIFICATIONS = 8`):

| ID | Title | Time | Toggle | Priority | Route |
|---|---|---|---|---|---|
| `morning_start` | Good Morning | 08:00 | `morning` | 10 | `/(tabs)/index` |
| `meal_breakfast` | Breakfast Time | 08:30 | `meal` | 8 | `/(tabs)/calories` |
| `water_midday` | Stay Hydrated | 11:00 | `water` | 7 | `/(tabs)/calories` |
| `meal_lunch` | Lunch Time | 13:00 | `meal` | 8 | `/(tabs)/calories` |
| `habit_midday` | Keep Your Momentum | 14:30 | `morning` | 6 | `/(tabs)/habits` |
| `activity_evening` | Daily Movement | 18:00 | `evening` | 7 | `/(tabs)/index` |
| `meal_dinner` | Dinner Time | 20:00 | `meal` | 8 | `/(tabs)/calories` |
| `nightly_review` | Daily Review | 21:30 | `evening` | 9 | `/(tabs)/index` |
| `wind_down` | Wind Down & Rest | 23:00 | `evening` | 5 | `/(tabs)/index` |

- **Evergreen Action-Oriented Copy:** Repeating daily alarms never bake transient single-day progress counters (e.g. `"You're at 2/8 glasses"`) into alarms. Notification text is actionable and universally accurate across days.
- **Rate Reminder:** Idempotent one-shot reminder scheduled for eligible users (7+ days active, 5+ logged days) at 19:00 with a 30-day cooldown (`@lyfeos_rate_reminder_v1`).
- **Android Channel & Channel Health:** All scheduled notifications explicitly specify `channelId: "default"`, registered as `"LyfeOS Reminders"` with `HIGH` importance. `isAndroidChannelHealthy("default")` inspects channel importance via `getNotificationChannelAsync("default")`; if importance is `AndroidImportance.NONE (0)` (muted by user in System Settings), `hasNotificationPermission()` evaluates to `false` and `scheduleDailyNotifications` aborts and cancels alarms.

#### Real OS Permission UI Synchronization (`app/(tabs)/profile.tsx`)
- **Continuous Focus Reconciliation:** Profile tab uses `useFocusEffect` to continuously reconcile stored toggle state with real OS permission (`hasNotificationPermission()`) whenever user returns from Settings or switches tabs.
- **Visual Accuracy When Blocked:** If notification permissions are disabled at the OS level or the Android channel is muted:
  - Master Daily Reminders switch visually displays `OFF` (`notificationsEnabled && osPermissionGranted`).
  - Status text displays `BLOCKED` in red.
  - Subtext displays `"System notifications disabled in Settings"`.
  - Prominently displays a touchable warning banner: `"Notifications are blocked. Tap to open Settings."`
  - Granular reminder sub-toggles are disabled and dimmed (`opacity: 0.4`).
- **Toggle Handler & Native Settings Fallback:** Turning ON the toggle checks permissions via `requestNotificationPermissions()`. If permission is denied and permanently blocked (`canAskAgain === false`), alerts the user with `"Notifications are blocked"` and offers an `"Open Settings"` button invoking `openNotificationSettings()` (`Linking.openSettings()`). Stored user preference is preserved and not clobbered.

#### Centralized Debounced Coordinator & Timezone Resilience
- `requestScheduleRefresh(options)`: Coalesces rapid calls (tab changes, data mutations, app foregrounding) with a 400ms debounce window.
- **Race Condition Protection:** `app/(tabs)/index.tsx` guards initialization: if an authenticated non-guest user is logging in, scheduler waits until `ProfileContext` completes cloud profile hydration (`isProfileLoaded === true`) before scheduling.
- **Foreground Refresh:** An `AppState` listener in `app/(tabs)/index.tsx` refreshes the schedule when the app returns from background.
- **Timezone Change Resilience:** `checkTimezoneChangeAndRefresh()` verifies `Intl.DateTimeFormat().resolvedOptions().timeZone` against `@lyfeos_last_timezone_v1` on app mount and on every foreground transition in `app/(tabs)/index.tsx`. When a timezone change is detected, cache is updated and `requestScheduleRefresh({ reason: "timezone_change" })` reschedules repeating alarms to match local clock time.

#### In-App Notification Inbox (`@lyfeos_notifications_v1`)
Synchronized with OS push alarms in `app/(tabs)/index.tsx`:
- **Foreground Delivery:** `Notifications.addNotificationReceivedListener` captures notifications received while the app is open and calls `upsertInboxNotification()`, inserting an unread item with category mapping (`streak`, `nutrition`, `habit`, `activity`, `info`).
- **Notification Taps:** `Notifications.addNotificationResponseReceivedListener` marks tapped notifications as `read: true`, upserts into the inbox, and routes user to the target screen (`route`).
- **Deduplication:** Uses deterministic IDs `${notifId}_${todayStr}` so foreground receipt and tray taps on the same day update in place without duplicate entries.
- **Bounded Storage:** Inbox is strictly capped at 30 items (`.slice(0, 30)`), safely preserving initial onboarding/welcome notifications.

### 9.9 Theming

**Context:** `ThemeContext.tsx` + `hooks/useAppTheme.ts` + `constants/colors.ts`

- Three modes: `"system" | "dark" | "light"` — persisted to `@lyfeos_theme_mode_v1`
- Default on first launch: `"dark"`
- `useAppTheme()` returns typed `DARK_TOKENS` or `LIGHT_TOKENS`
- Brand accent: `#FF6B35` (orange) — same in both themes

---

## 10. Data Models

### FoodItem
```typescript
interface FoodItem {
  id: string;
  name: string;
  calories: number;
  carbs?: number;          // g
  protein?: number;        // g
  fat?: number;            // g
  fiber?: number;          // g
  sugar?: number;          // g
  sodium?: number;         // mg
  portionSize?: string;
  meal: "breakfast" | "lunch" | "dinner" | "snacks";
  date: string;            // "YYYY-MM-DD"
  potassium?: number;      // mg
  calcium?: number;        // mg
  iron?: number;           // mg
  magnesium?: number;      // mg
  zinc?: number;           // mg
  vitaminA?: number;       // mcg
  vitaminC?: number;       // mg
  vitaminD?: number;       // mcg
  vitaminB12?: number;     // mcg
}
```

### DailyGoal
```typescript
interface DailyGoal {
  calories: number;   // kcal (default 2000)
  carbs: number;      // g   (default 250)
  protein: number;    // g   (default 150)
  fat: number;        // g   (default 65)
  water: number;      // glasses (default 8)
}
```

### WaterLog
```typescript
interface WaterLog {
  id: string;
  date: string;       // "YYYY-MM-DD"
  glasses: number;
}
```

### Habit
```typescript
interface Habit {
  id: string;
  name: string;
  type: "build" | "quit";
  trackMethod: "task" | "amount" | "time";
  colorId: string;
  emoji: string;
  targetAmount?: number;
  targetTimeSeconds?: number;
  weekDays: number[];   // 0-6, 0 = Sunday
  createdAt: string;    // ISO string
  description?: string;
  updatedAt: number;    // timestamp ms for conflict resolution
  deletedAt?: number;   // soft-delete tombstone timestamp ms
}
```

### HabitLog
```typescript
interface HabitLog {
  id: string;
  habitId: string;
  date: string;         // "YYYY-MM-DD"
  completed: boolean;
  amount?: number;
  timeSeconds?: number;
  updatedAt: number;    // timestamp ms for conflict resolution
  deletedAt?: number;   // soft-delete tombstone timestamp ms
}
```

### Todo
```typescript
interface Todo {
  id: string;
  title: string;
  completed: boolean;
  priority: "urgent" | "high" | "medium" | "low";
  category: "Work" | "Personal" | "Shopping" | "Health" | "Other";
  dueDate?: string;
  dueTime?: string;
  notes?: string;
  repeat?: "none" | "daily" | "weekly" | "monthly";
  createdAt: string;
  order: number;        // manual sort index
  updatedAt: number;    // timestamp ms for conflict resolution
  deletedAt?: number;   // soft-delete tombstone timestamp ms
  seriesId?: string;    // recurrence group ID for deduplication
}
```

### ActivityLog
```typescript
interface ActivityLog {
  id: string;
  date: string;                 // "YYYY-MM-DD"
  sport: string;
  emoji: string;
  duration: number;             // minutes
  intensity: "light" | "moderate" | "intense";
  caloriesBurned: number;
  hydrationNeededMl: number;
  hydrationGlasses: number;
  proteinNeededG: number;
  carbsNeededG: number;
  recoveryTimeHours: number;
  heartRateZone: string;
  healthBenefits: string[];
  tips: string[];
  postActivityMeal: string;
  sportCategory: string;
  steps?: number;
}
```

### HealthProfile
```typescript
interface HealthProfile {
  age: string;
  sex: "male" | "female" | "other" | "";
  height: string;         // cm (metric) or ft'in" (imperial)
  weight: string;         // kg or lb
  activityLevel: "sedentary" | "lightly" | "moderately" | "very" | "";
  goal: "lose" | "maintain" | "muscle" | "fitness" | "";
}
```

### ActivityAnalysis (returned by `analyzeActivity()`)
```typescript
interface ActivityAnalysis {
  calories_burned: number;
  hydration_needed_ml: number;
  hydration_glasses: number;
  protein_needed_g: number;
  carbs_needed_g: number;
  recovery_time_hours: number;
  heart_rate_zone: string;
  intensity_level: string;
  health_benefits: string[];
  tips: string[];
  post_activity_meal: string;
  sport_category: string;
  summary?: string;       // AI-style summary sentence (offline-generated)
}
```

### FoodAnalysisResult (returned by nutrition search)
```typescript
interface FoodAnalysisResult {
  name: string;
  servingDescription: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  confidence: "high" | "medium" | "low";
  noFoodDetected?: boolean;
  cuisineType?: string;
  dishNotes?: string;
  source?: "local-db" | "gemini" | "usda" | "open-food-facts";
  // Micro-nutrients (all optional, same fields as FoodItem)
  potassium?: number; calcium?: number; iron?: number;
  magnesium?: number; zinc?: number; vitaminA?: number;
  vitaminC?: number; vitaminD?: number; vitaminB12?: number;
}
```

---

## 11. External APIs & Third-Party Services

| Service | Endpoint / SDK | What Is Sent | Key | Notes |
|---|---|---|---|---|
| **USDA FoodData Central** | `api.nal.usda.gov/fdc/v1/foods/search` | Food query string | `EXPO_PUBLIC_USDA_API_KEY` (falls back to `"DEMO_KEY"` — 30 req/hr/IP) | Primary nutrition source |
| **Open Food Facts** | `world.openfoodfacts.org/api/v2/search` | Food query string + User-Agent | None | Fallback; no PII |
| **Google AdMob** | `react-native-google-mobile-ads` SDK | Google Advertising ID, ad interactions | Ad unit IDs (hardcoded in `utils/ads.ts`) | See §13 |
| **Meta (Facebook) SDK** | `react-native-fbsdk-next` SDK | Firebase UID, app events, device Ad ID | App ID + Client Token (hardcoded in `app.json`) | See §12 |
| **Firebase Analytics** | `@react-native-firebase/analytics` | User ID, events, user properties | Auto (from `google-services.json`) | Active — not a stub |
| **Expo Updates (EAS)** | `https://u.expo.dev/54f639f6-...` | Runtime version, update check | Auto | OTA updates |
| **Gemini API** | `generativelanguage.googleapis.com` | (dev proxy only — activity prompt) | `GEMINI_API_KEY` (server-side only) | **Native Android client never calls this.** Dev/web only. |

---

## 12. Analytics & Telemetry

**File:** `utils/analytics.ts` (154 lines)

### Firebase Analytics — ACTIVE

`@react-native-firebase/analytics` `^24.1.1` is installed and making real SDK calls.

| Function | SDK Call |
|---|---|
| `logScreen(screenName)` | `analytics().logScreenView({ screen_name, screen_class })` |
| `logEvent(eventName, params)` | `analytics().logEvent(eventName, params)` |
| `setAnalyticsUser(userId, props)` | `analytics().setUserId()` + `analytics().setUserProperty()` |

### Meta (Facebook) App Events — ACTIVE IN ALL ENVIRONMENTS

`react-native-fbsdk-next` `13.4.3` is unconditionally active across all build environments.

**`app.config.js` behaviour (as of 2026-09-10 fix):**
- The previous `if (isProduction)` gate has been **removed**.
- The plugin is always injected regardless of `APP_ENV`.
- Credentials are read from env vars with hardcoded fallback: `process.env.META_APP_ID || '1369488158633446'`.
- The `react-native-fbsdk-next` entry already present in `app.json` is **replaced** (not duplicated) by `app.config.js` at build time so env-var-driven values always win.
- `isMetaEnabled()` helper has been **removed** from `utils/analytics.ts`.

**`strings.xml`** always contains the three required Android resources:
```xml
<string name="facebook_app_id">1369488158633446</string>
<string name="facebook_client_token">baa4ccd5f7520f7b478c91e706c11ba4</string>
<string name="fb_login_protocol_scheme">fb1369488158633446</string>
```

| Firebase Event | Meta Event | Payload Details |
|---|---|---|
| `login` | `fb_mobile_login` | Method (`google`, `email`, `guest`) |
| `sign_up` | `AppEventsLogger.AppEvents.CompletedRegistration` | Method (`email`) |
| `habit_completed` | `HabitCompleted` | **Zero-PII:** Meta receives strictly `AppEventsLogger.logEvent("HabitCompleted")` with **zero parameters** or custom habit names. |
| `meal_logged` | `MealLogged` | `mealType` (predefined enum string: `"breakfast"`, `"lunch"`, etc.) |

`setAnalyticsUser(userId)` calls `AppEventsLogger.setUserID(userId)` unconditionally (no null coercion, no environment gate).

Meta SDK initialised via `initializeMetaSDK()` → `Settings.initializeSDK()` (called from `app/_layout.tsx` on auth state change — no `isMetaEnabled()` guard).

#### P1-9 Phase 1 Privacy & Telemetry Hardening (Remediated 2026-09-12)
1. **Zero-PII Telemetry Rule for Meta:**
   - Meta App Events MUST NEVER receive free-form user-generated strings, habit titles, descriptions, or medical/health habit names (e.g. medication reminders).
   - In `utils/analytics.ts`, `eventName === "habit_completed"` triggers `AppEventsLogger.logEvent("HabitCompleted")` without forwarding `metaParams`.
2. **Sanitized Firebase Analytics Habit Telemetry:**
   - In `context/HabitsContext.tsx`, `habit_created` and `habit_completed` dispatches have removed raw `habitName`.
   - Only strictly non-sensitive structural attributes are sent: `{ habitId, trackMethod, colorId, habitType }`.
3. **Centralized Identity Reset (`clearAllAnalyticsAndCrashlyticsIdentity()`):**
   - Implemented in `utils/analytics.ts` and called during:
     - Normal sign-out (`AuthContext.tsx` -> `signOut()`)
     - Account deletion (`AuthContext.tsx` -> `deleteAccountAndData()`)
     - Guest data deletion (`AuthContext.tsx` -> `deleteGuestData()`)
   - Performs isolated cleanup across:
     - Firebase Analytics: `analytics().setUserId(null)` + `analytics().resetAnalyticsData()`
     - Meta SDK: `AppEventsLogger.setUserID(null)`
     - Crashlytics: `crashlytics().setUserId("")` + resets dynamic attributes (`current_screen`, `last_error_context`)
   - Each SDK cleanup is wrapped in an independent `try/catch` block so failures in one SDK never prevent other cleanups or interrupt auth flows.
4. **Important Technical Distinction (Client SDK Reset vs Server-Side Deletion):**
   - Client SDK identity resets (`setUserId(null)`, `resetAnalyticsData()`, `setUserID(null)`, `setUserId("")`) disassociate active device identity and rotate local instance IDs.
   - They **do NOT** trigger retrospective historical telemetry deletion on Google Analytics or Meta cloud servers (which requires backend User Deletion APIs under GDPR Article 17). Server-side historical telemetry deletion remains out-of-scope for client-only releases.

### Firebase Observability & Production Monitoring — ACTIVE

LyfeOS implements enterprise-grade Firebase Observability covering Crashlytics, Performance Monitoring, Release Monitoring, and an App Check audit.

#### 1. Firebase Crashlytics — ACTIVE
- **SDK:** `@react-native-firebase/crashlytics` `^24.1.1`
- **Gradle Plugin:** `com.google.firebase:firebase-crashlytics-gradle:3.0.3` in `android/build.gradle` and `apply plugin: 'com.google.firebase.crashlytics'` in `android/app/build.gradle`.
- **Config Plugin:** `"@react-native-firebase/crashlytics"` in `app.json`.
- **Error Capture Layer:**
  - **Non-fatal error logging:** `logError(error, context?, attributes?)` in `utils/analytics.ts`. Normalizes errors, logs context breadcrumbs (`crashlytics().log()`), sets sanitized custom attributes (`crashlytics().setAttributes()`), and records via `crashlytics().recordError()`.
  - **Global JS unhandled error handler:** Integrated in `app/_layout.tsx` via `ErrorUtils.setGlobalHandler` to capture fatal and non-fatal unhandled JS exceptions before delegating to the runtime handler.
  - **React render crashes:** Wired via `ErrorBoundary` in `app/_layout.tsx` (`onError={(error, stack) => logError(error, 'ErrorBoundary_ReactRenderCrash', ...)}`).
  - **Breadcrumbs & Screen Tracking:** `logScreen(screenName)` records `[Navigation] Screen: {screenName}` breadcrumbs and sets `current_screen` attribute.
  - **User Association:** `setCrashlyticsUser(userId)` associates authenticated user UIDs with Crashlytics sessions.
  - **Environment Metadata:** `initializeCrashlyticsMetadata()` sets `app_version` (`2.2.2`), `build_env`, and `platform`.
  - **Test Crash Mechanism:** Controlled, debug-only `triggerCrashlyticsTestCrash(confirmKey?)` in `utils/analytics.ts`. Guarded to never trigger automatically or run in non-dev builds without explicit confirmation key.

#### 2. Firebase Performance Monitoring — ACTIVE
- **SDK:** `@react-native-firebase/perf` `^24.1.1`
- **Gradle Plugin:** `com.google.firebase:perf-plugin:1.4.2` in `android/build.gradle` and `apply plugin: 'com.google.firebase.firebase-perf'` in `android/app/build.gradle`.
- **Config Plugin:** `"@react-native-firebase/perf"` in `app.json`.
- **Automated Traces:**
  - App startup trace (`_app_start`) collected automatically by native SDK.
  - Network request performance (HTTP duration, payload size, success rates) instrumented automatically via OkHttp bytecode transforms.
- **Custom Trace Helper (`utils/perf.ts`):**
  - `startTrace(traceName, initialAttributes?)`: returns `{ stop, putAttribute, putMetric }`.
  - `measureTrace(traceName, operation, attributes?)`: measures duration of asynchronous workflows (e.g. background cloud sync, authentication, Gemini food analysis) with automatic error tagging and trace completion.
  - Built-in attribute sanitization (keys stripped of PII/credentials, alphanumeric characters only, lengths constrained).

#### 3. Release Monitoring & Symbolication — ACTIVE
- **ProGuard / R8 Rules:** Added to `android/app/proguard-rules.pro`:
  ```proguard
  # Firebase Crashlytics & Release Monitoring
  -keepattributes SourceFile,LineNumberTable
  -keep public class * extends java.lang.Exception
  ```
- **Mapping File Upload:** The Crashlytics Gradle plugin automatically registers tasks `:app:injectCrashlyticsMappingFileIdRelease` and `:app:uploadCrashlyticsMappingFileRelease`. During release builds (`assembleRelease` / `bundleRelease`), ProGuard mapping files are automatically associated with the build for human-readable stack traces in Firebase Console.
- **Version Alignment:** `versionName: "2.2.2"`. Android versionCode is automatically managed by Expo/EAS.

#### 4. App Check Posture — AUDITED / UNENFORCED (SAFE)
- **Status:** Not currently installed in client code.
- **CRITICAL OPERATIONAL RULE:** Do **NOT** enable enforcement for Firestore or Firebase Authentication in Firebase Console. Doing so without client App Check tokens will immediately break all user operations.
- **App Check Migration Path (when scheduled):**
  1. Register debug provider for local builds and obtain SHA-256 for release keystore.
  2. Register Play Integrity provider in Google Cloud Console & Firebase Console.
  3. Install `@react-native-firebase/app-check@24.1.1` and initialize before other Firebase services.
  4. Keep in "Monitoring" mode for at least 14 days before considering enforcement.

#### 5. Privacy & Security Rules for Telemetry
- **Never Logged:** Passwords, auth tokens, refresh tokens, Firebase ID tokens, API keys, private health/medical notes, meal photos, full JSON payloads.
- **Attribute Sanitizer:** `SENSITIVE_KEY_PATTERN` in `utils/analytics.ts` and `utils/perf.ts` strips any key matching `/password|token|secret|credential|auth|bearer|key|email|phone|card|authorization/i`. Strings capped at 500 chars.

---

## 13. Monetization

**File:** `utils/ads.ts`

| Ad Type | Unit ID | Status | Trigger |
|---|---|---|---|
| **Interstitial** | `ca-app-pub-7658674851177824/3997801355` | **Active** | Every 3rd habit completion (`habitCompletionCount` counter) |
| **Banner** | `ca-app-pub-7658674851177824/9719730461` | Wired, unused | No screen shows a banner |
| **Rewarded** | `ca-app-pub-7658674851177824/4491454519` | Wired, unused | `showRewardedAd()` implemented but never called |

**AdMob App ID:** `ca-app-pub-7658674851177824~1838662014`

**Ad personalization:** `requestNonPersonalizedAdsOnly: false` — personalized ads are enabled.

**Modal guard:** `setInterstitialBlocked(true/false)` in `utils/ads.ts`. Any screen opening a form/modal **must** call this to prevent a delayed interstitial from interrupting the user.

**Initialization:** `initializeAds()` called 2 seconds after app launch in `app/_layout.tsx`.

---

## 14. Build & Deployment

### Prerequisites

```bash
# Required tools
node >= 18
pnpm 9.15.4       # pinned in packageManager field
npm i -g eas-cli  # >= 19.0.5
eas login
```

### Development Commands

```bash
pnpm dev              # Expo start on localhost:5000 (includes Gemini dev proxy)
pnpm android          # expo run:android (local native dev build)
pnpm ios              # expo run:ios
pnpm typecheck        # tsc --noEmit
pnpm build            # Static Expo web export (node scripts/build.js)
pnpm serve            # Start production web server (node server/serve.js)
```

### EAS Build Profiles (`eas.json`)

| Profile | Output | Distribution | Key Settings |
|---|---|---|---|
| `development` | APK (dev client) | Internal | `developmentClient: true`, channel: development |
| `preview` | APK | Internal | channel: preview |
| `production` | `.aab` | Play Store internal track | Node 22.14.0, pnpm 9.15.4, `autoIncrement: true` |
| `production-apk` | `.apk` | — | Extends production, APK format |

### Production Build Commands

```bash
# Recommended — clears EAS temp dirs first
bash build-android.sh

# Direct EAS
eas build --platform android --profile production --non-interactive

# APK for sideloading
eas build --platform android --profile production-apk
```

### Submit to Play Store

```bash
eas submit --platform android --profile production
# Submits to "internal" track (configured in eas.json)
```

### OTA Updates

- Policy: `runtimeVersion.policy: "appVersion"` — OTA update only applies to same app version
- Update URL: `https://u.expo.dev/54f639f6-a140-4168-afdc-eb3bca56979e`
- `EXPO_UPDATES_CHECK_ON_LAUNCH: ALWAYS` — checks on every launch

### Custom Config Plugin

`plugins/withKotlinVersion.js` — pins Kotlin Gradle plugin version to `2.1.20` in `build.gradle`. Required because React Native Firebase packages have Kotlin version conflicts. Configured in `app.json` plugins array with `{ "kotlinVersion": "2.1.20" }`.

---

## 15. Environment Variables & Secrets

| Variable | Location | Used By | Sensitivity |
|---|---|---|---|
| `EXPO_PUBLIC_USDA_API_KEY` | `.env.local` | `utils/nutritionSearch.ts` | **Low** — bundled in client; falls back to `"DEMO_KEY"` |
| `GEMINI_API_KEY` | `.env.local` + EAS Secrets | `metro.config.js` (dev proxy), `server/serve.js` (web) | **High** — server-side only; **never** bundled into the APK |
| `EXPO_PUBLIC_DOMAIN` | `eas.json` production env | `scripts/build.js` (web only) | **Low** — placeholder `"YOUR_DEPLOYED_DOMAIN_HERE"` in repo |

### Hardcoded Credentials (compiled into binary)

| Credential | Location | Risk Level |
|---|---|---|
| Firebase API key (`AIzaSy...`) | `google-services.json` | Low — client key; security via Firebase Rules |
| Google OAuth web client ID | `google-services.json`, `AuthContext.tsx:39` | Low — public identifier |
| AdMob App ID + Ad Unit IDs | `app.json`, `utils/ads.ts` | Low — required public identifiers |
| Meta App ID (`1369488158633446`) | `app.json`, `strings.xml` | Low — public identifier |
| Meta Client Token (`baa4ccd5f752...`) | `app.json:78`, `strings.xml` | Medium — compiled into binary |
| Android Keystores (`.jks`) | Project root | **HIGH — never commit to public repo** |

---

## 16. Security Analysis

### Risk Register

| # | Risk | Severity | Status |
|---|---|---|---|
| 1 | **Sign-out data remanence** — `signOut()` does not clear AsyncStorage. Prior user's data stays on device and is potentially migrated to next user's cloud account via `handleGuestMigration()`. | **Critical** | Unresolved |
| 2 | **Firebase Security Rules not in repo** — No `firestore.rules` in codebase. If remote rules are permissive, cross-user access is possible. | **High (unknown)** | Unresolved |
| 3 | **Keystores in project root** — `@shivam.2k__lyfeos.jks` and `OLD_1.jks` in project root. In `.gitignore` but risk of accidental commit. | **High** | Unresolved |
| 4 | **Plain-text local storage + OS backup exposure** — AsyncStorage unencrypted. `android:allowBackup="false"` is now explicitly configured in `app.json` and `AndroidManifest.xml` to prevent OS-level backup/D2D data leakage. | **Medium** | **Resolved** |
| 5 | **Meta UID leakage** — Firebase UID transmitted directly to `AppEventsLogger.setUserID()`. | **Medium** | Unresolved (by design) |
| 6 | **No Firestore schema validation** — No Cloud Functions enforce document schemas; users could write arbitrary payloads. | **Medium** | Unresolved |
| 7 | **Naive todo conflict resolution** — Cloud overwrites local todos on first sync; offline todos silently lost. | **Medium (data loss)** | Unresolved |
| 8 | **Meta Client Token hardcoded** — Compiled into `strings.xml`; extractable via APK reverse engineering. | **Low–Medium** | Unresolved |
| 9 | **Single Firebase project for dev + prod** — Both environments share `lyfe-os-2c7cd`. Dev data can pollute prod. | **Medium** | Unresolved |

### Recommended Remediations (not yet implemented)

1. Call `clearAllLyfeOSLocalData()` + `cancelAllNotifications()` inside `signOut()`
2. Add `firestore.rules` to repo with `allow read, write: if request.auth.uid == userId;`
3. Move `.jks` files out of project directory to offline secure storage
4. [DONE] Set `android:allowBackup="false"` in `app.json` android config and `AndroidManifest.xml`
5. Implement union-merge for todos (identical to habits merge strategy)
6. Move Google Sign-In `webClientId` to an environment variable

---

## 17. Known Issues & Tech Debt

| # | Area | Issue | File Reference |
|---|---|---|---|
| 1 | Auth | `signOut()` does not clear AsyncStorage — data leaks to next user via `handleGuestMigration()` | `context/AuthContext.tsx:148` |
| 2 | Camera | Food image scan always throws `"Food Scan is coming soon."` — intentionally disabled | `utils/analyzeFoodImage.ts:48` |
| 3 | Crashlytics | `logError()` and `setCrashlyticsUser()` are no-op stubs; package not installed | `utils/analytics.ts:130-152` |
| 4 | Ads | `showRewardedAd()` and `BannerAd` are implemented but never called/placed in any screen | `utils/ads.ts:68, 102` |
| 5 | Todos sync | Cloud blindly overwrites local todos on initial fetch — offline-created todos silently lost | `context/TodosContext.tsx` |
| 6 | Avatar | Profile avatar held only in volatile component state — lost on reload; never persisted | `app/(tabs)/profile.tsx` |
| 7 | Imperial units | `Preferences.units` stored but UI always displays metric values | `context/ProfileContext.tsx` |
| 8 | kJ display | `Preferences.calorieDisplay` stored but UI hardcodes kcal | `context/ProfileContext.tsx` |
| 9 | No prod isolation | Dev and production both connect to Firebase project `lyfe-os-2c7cd` | `google-services.json` |
| 10 | React Query unused | `QueryClientProvider` scaffolded in `_layout.tsx` but no queries written | `app/_layout.tsx` |
| 11 | Keystores in root | Production `.jks` files reside in project directory | `/` |
| 12 | iOS not deployed | iOS config present but no App Store submission | `app.json:16-18` |
| 13 | `assets/sounds/` empty | Directory exists; no audio files yet | `assets/sounds/` |
| 14 | `EXPO_PUBLIC_DOMAIN` placeholder | Still `"YOUR_DEPLOYED_DOMAIN_HERE"` in `eas.json` | `eas.json:27` |
| 15 | webClientId hardcoded | Google Sign-In client ID is a literal string instead of env var | `context/AuthContext.tsx:39` |
| 16 | Activity not cloud-synced | All workout logs, steps, health profile are device-local; device replacement = permanent data loss with no user warning | `context/ActivityContext.tsx` |
| 17 | Notifications P3: Rate reminder persistence | Rate reminder cooldown (`@lyfeos_rate_reminder_v1`) stored locally; clearing app data allows re-prompt before 30-day cooldown | `utils/notifications.ts` |
| 18 | Notifications P3: Pre-permission priming | App requests native permission dialog immediately on user action without an in-app educational pre-prompt | `app/(tabs)/index.tsx`, `app/(tabs)/profile.tsx` |
| 19 | Notification device runtime boundaries | Deep OEM battery optimizations / background killer policies (Xiaomi MIUI, Huawei, Samsung deep sleep) cannot be bypassed without user whitelisting | System/OS level |

---

## 18. Future Roadmap Hooks

| Feature | Evidence | File |
|---|---|---|
| Camera food scanner | `analyzeFoodImage()` stub; `expo-image-picker` installed; `/api/gemini` multimodal proxy ready | `utils/analyzeFoodImage.ts`, `metro.config.js` |
| Firebase Crashlytics | Fully implemented & active via @react-native-firebase/crashlytics, app/_layout.tsx, and native Gradle | utils/analytics.ts, app/_layout.tsx |
| Rewarded ads | `showRewardedAd()` fully implemented but never called | `utils/ads.ts:68` |
| Banner ads | `BannerAd`, `BannerAdSize` exported; no screen places them | `utils/ads.ts:102` |
| iOS App Store release | Config scaffolded in `app.json` | `app.json:16-18` |
| Imperial units UI | `Preferences.units` stored and accessible | `context/ProfileContext.tsx` |
| kJ calorie display UI | `Preferences.calorieDisplay` stored and accessible | `context/ProfileContext.tsx` |
| Activity/health cloud sync | Clear gap; `cloudSync.ts` would need new sync functions + new Firestore documents | `utils/cloudSync.ts` |
| Consent version bumping | Architecture supports re-prompting by bumping `CONSENT_VERSION` constant | `app/legal-consent.tsx:18` |
| Gemini multimodal | Generic `/api/gemini` proxy accepts arbitrary model + payload | `metro.config.js:43-62` |
| Habit completion sounds | `assets/sounds/` directory exists but is empty | `assets/sounds/` |

---

## 19. Documentation Maintenance

### This File Is a Living Document

`PROJECT_KNOWLEDGE.md` must always describe the **actual current state** of the project, not aspirational or hypothetical behaviour. If this document and the code disagree, the code wins — update this file.

### Mandatory Update Triggers

Before completing any future development task, check whether `PROJECT_KNOWLEDGE.md` needs to be updated. If yes, update it before considering the task complete:

1. Determine if the task changed anything documented here.
2. If yes, update the relevant section(s).
3. Add a concise entry to the [Change Log](#20-change-log).
4. Verify documentation still matches the actual implementation.

**You MUST update `PROJECT_KNOWLEDGE.md` when you:**

- Add, remove, or modify a feature
- Change architecture or data flow
- Change database structure (Firestore schema or AsyncStorage key names/types)
- Change Firebase services or configuration
- Change authentication or authorization behaviour
- Add, remove, or update an external API integration
- Change dependencies or package versions
- Change environment variables or build configuration
- Fix a bug that changes documented behaviour
- Make a security-related change
- Rename or restructure files meaningfully

### Resolving Documentation vs. Code Conflicts

1. Inspect the actual implementation first.
2. Determine the true current behaviour from the code.
3. Update `PROJECT_KNOWLEDGE.md` to match.
4. If the discrepancy appears intentional or ambiguous, mark it `[UNCERTAIN]` and ask the developer before changing either.

### Related Documents

| Document | Status |
|---|---|
| `PROJECT_KNOWLEDGE.md` | **The single source of truth and living documentation** for all LyfeOS development. |
| `LYFEOS_BACKEND_DATA_ARCHITECTURE.md` | **Superseded** — all verified findings are incorporated into `PROJECT_KNOWLEDGE.md`. |
| `README.md` | Separate developer quickstart. Keep build commands in sync. |

---

## 20. Change Log

> Format: Date — Summary — Area affected — Migration/deployment implications

### 2026-09-12 — P1-9 Phase 2B-3: Existing-Account Guest Data Resolution UI & Cold-Start Routing

**What:** Implemented non-dismissible resolution UI (`GuestDataResolutionModal`) in `app/login.tsx` and cold-start route gating in `app/_layout.tsx`:
- **Cold-Start Routing Guard (`app/_layout.tsx`):** If `isPendingMigrationResolution === true`, immediately redirects to `/login` via `router.replace("/login")`, hides splash screen via `SplashScreen.hideAsync()`, and returns early to prevent the app from hanging on a blank screen.
- **`GuestDataResolutionModal` in `app/login.tsx`:**
  - Automatically displayed when `isPendingMigrationResolution === true`.
  - **Decision View:**
    - Header icon: Accent-tinted badge with `cloud-download-outline`.
    - Exact approved copy: Title `"Guest Data Found"`, Body `"We found data you created on this device while using LyfeOS as a guest. You can add it to your account or discard it."`.
    - Reassurance card: `"Your existing account data is safe and won't be overwritten."`.
    - Primary CTA: `"Keep & Merge Data"` (Helper: `"Adds your guest data to this account"`), triggers `mergeGuestDataAndProceed()`.
    - Secondary CTA: `"Discard Guest Data"` (Helper: `"Permanently removes data from your guest session"`), transitions view to Discard Confirmation.
  - **Discard Confirmation View:**
    - Header icon: Red error badge with `trash-outline`.
    - Exact approved copy: Title `"Permanently Discard Guest Data?"`, Body `"This will permanently remove the data created during your guest session. This action cannot be undone.\n\nYour existing account data will remain completely untouched."`.
    - Destructive CTA: `"Yes, Permanently Discard"`, triggers `discardGuestDataAndProceed()`.
    - Secondary CTA: `"No, Keep Data"`, safely returns to Decision view.
  - **Loading States:** Displays large activity indicator with `"Merging your guest data..."` and `"Discarding guest data..."`.
  - **Error & Retry States:** Displays inline error banner (`"Unable to Merge Data"` / `"Unable to Discard Data"`) with actionable `"Try Again"` button.
  - **Double-Tap Lockout:** Disables all modal buttons while actions are in-flight (`resolutionLoading !== null`).
  - **Strict Non-Dismissibility & Android Back:** Backdrop is non-clickable; Android back on Discard Confirmation returns to Decision view; Android back on Decision view or loading is blocked.
  - **Zero Technical Jargon:** Clean copy with generic "Guest Data" terminology; zero leaks of internal architecture terms.
- **Verification:**
  - 20-test automated suite in `scripts/test-phase2b3-resolution-ui.js` (20/20 PASS).
  - Full regression test run: 109/109 tests PASS across all test suites (Phase 2B-3 20/20, Phase 2B-2 20/20, Phase 2B-1 20/20, Phase 2A 8/8, Privacy 6/6, Habits 12/12, Nutrition Sync 12/12, Nutrition Migration 5/5, Activity 16/16, Profile 10/10).
  - TypeScript typecheck (`tsc -p tsconfig.json --noEmit`): 0 errors.
  - Strict guardrail verification: `context/TodosContext.tsx` is completely untouched (0 lines changed).

**Area affected:** `app/login.tsx`, `app/_layout.tsx`, `scripts/test-phase2b3-resolution-ui.js`, `PROJECT_KNOWLEDGE.md`.

**Migration/deployment implications:** Fully backward-compatible; zero schema breaks or destructive operations.

---

### 2026-09-12 — P1-9 Phase 2B-2: Existing-Account Guest Data Resolution (Checkpoint + Discard + Merge + Cold-Start)

**What:** Implemented persistent checkpointing, discard, and merge handlers for existing-account guest data resolution:
- **Persistent Checkpoint (`@lyfeos_pending_migration_v1`):** Created schema `{ version: 1, targetUid, createdAt, status: "pending" | "cloud_merged" }`. Written in `signInWithEmail` and `signInWithGoogle` only after confirming meaningful guest data; cleared on resolution.
- **Cold-Start Recovery & UID Mismatch Protection:** Restores `isPendingMigrationResolution = true` on startup if `auth().currentUser.uid === checkpoint.targetUid`. If UID mismatches, stale checkpoint is safely invalidated and purged without modifying either account or data.
- **`discardGuestDataAndProceed()`:** Verifies target UID matches checkpoint, clears local guest data from AsyncStorage via `clearAllLyfeOSLocalData()`, cancels guest notifications, clears checkpoint, unblocks navigation, and leaves cloud account 100% untouched.
- **`mergeGuestDataAndProceed()`:** Verifies target UID matches checkpoint, merges local guest data into target cloud account via `migrateGuestDataToAccount()`, updates local storage, ensures idempotency on retry via `status: "cloud_merged"`, clears checkpoint, unblocks navigation.
- **Provider Sync Dormancy:** Masked `user` as `null` to child context providers (`Habits`, `Todos`, `Calories`, `Activity`, `Profile`) while pending resolution to prevent premature cloud synchronization before user decision.
- **Verification:** 20-test automated suite in `scripts/test-phase2b2-guest-resolution.js` (20/20 PASS). Full regression suite passed (89/89 tests). TypeScript typecheck 0 errors. `context/TodosContext.tsx` strictly untouched (0 lines changed).

**Area affected:** `utils/storage.ts`, `context/AuthContext.tsx`, `scripts/test-phase2b2-guest-resolution.js`, `PROJECT_KNOWLEDGE.md`.

**Migration/deployment implications:** Fully backward-compatible; zero schema breaks.

---

### 2026-09-12 — P1-9 Phase 2B-1: Meaningful Guest Data Detection & Migration Resolution State

**What:** Implemented non-destructive gating architecture to prevent blind guest data migration into existing accounts:
- **`hasMeaningfulGuestData()` Helper (`utils/storage.ts`):** Added deterministic helper checking 10 distinct activity criteria (active habits, habit logs, todos, food items, water >0 glasses, activity logs, steps >0, custom health profile, custom calorie goals, custom profile name). Ignores default preferences, `joinDate`, onboarding, legal consent, empty collections, and soft-deleted tombstones (`deletedAt`).
- **Migration Resolution State (`context/AuthContext.tsx`):** Added `isPendingMigrationResolution: boolean` and `setPendingMigrationResolution` to `AuthContextType` and `AuthProvider`.
- **Existing Account Authentication Gate (`context/AuthContext.tsx`):**
  - Updated `signInWithEmail`: If `wasAnonymous && !isNewUser && hasMeaningfulGuestData()` is detected, sets `isPendingMigrationResolution(true)` and completely suppresses blind `handleGuestMigration()`. If no meaningful data exists, purges empty guest state via `clearAllLyfeOSLocalData()` and proceeds normally.
  - Updated `signInWithGoogle`: On `auth/credential-already-in-use` during linking, authenticates existing account via `signInWithCredential()`, checks `hasMeaningfulGuestData()`, sets `isPendingMigrationResolution(true)`, and suppresses `handleGuestMigration()`.
- **Navigation Guard (`app/_layout.tsx`):** Updated `RootLayoutNav` to gate on `isPendingMigrationResolution`. Blocks premature redirect to `/(tabs)`, keeping `app/login.tsx` mounted until the user resolves migration.
- **Native Deletion Safety:** Affirmed that `anonUser.delete()` must NEVER be called client-side after authenticating an existing user, avoiding native `@react-native-firebase/auth` permanent user account deletion.
- **Verification:** 20-test automated suite in `scripts/test-phase2b-migration-guard.js` (20/20 PASS). Full regression test run: 118/118 tests PASS across all modules. TypeScript typecheck 0 errors. `TodosContext.tsx` strictly untouched (0 lines changed).

**Area affected:** `utils/storage.ts`, `context/AuthContext.tsx`, `app/_layout.tsx`, `scripts/test-phase2b-migration-guard.js`, `PROJECT_KNOWLEDGE.md`.

**Migration/deployment implications:** Fully backward-compatible; no schema changes or external dependencies.

---

### 2026-09-12 — P1-9 Phase 2A: Anonymous Auth Lifecycle & Safe New Account Conversion

**What:** Remediated P1-9 Finding #3 (Anonymous Firebase Auth Account Abandonment) for new account creation:
- **Anonymous -> Permanent Credential Linking:** Updated `signUpWithEmail` and `signInWithGoogle` to link credentials to the active anonymous Firebase Auth user via `anonUser.linkWithCredential(credential)`.
- **UID Preservation:** Preserves the existing anonymous UID as the permanent account UID (`result.user.uid === anonUser.uid`), transitioning `user.isAnonymous` from `true` to `false` without abandoning anonymous accounts in Firebase Authentication.
- **Eliminated Redundant Migration:** Skipped `handleGuestMigration()` when linking succeeds because local `AsyncStorage` is already bound to that UID.
- **Existing Account Safety:** When `auth/credential-already-in-use` occurs, the guest session is preserved without deleting the anonymous user or clobbering data.
- **Verification:** 10-test automated suite in `scripts/test-phase2a-auth-linking.js` (10/10 PASS). Full regression suite passed (98/98 tests). TypeScript typecheck 0 errors.

**Area affected:** `context/AuthContext.tsx`, `scripts/test-phase2a-auth-linking.js`, `PROJECT_KNOWLEDGE.md`.

**Migration/deployment implications:** Fully backward-compatible; zero orphaned anonymous accounts on new account registration.

---

### 2026-09-12 — P1-9 Phase 1: Privacy & Telemetry Hardening

**What:** Remediated P1-9 Finding #4 (Sensitive Habit Names Sent to Meta App Events) and Finding #5 (Analytics / Crashlytics Identity Persistence on Deletion):
- **Zero-PII Meta Telemetry:** In `utils/analytics.ts`, restricted `habit_completed` to `AppEventsLogger.logEvent("HabitCompleted")` with zero parameters.
- **Sanitized Firebase Analytics Habits Telemetry:** In `context/HabitsContext.tsx`, removed raw user habit names from `habit_created` and `habit_completed` events, forwarding only non-sensitive structural attributes.
- **Centralized Identity Reset (`clearAllAnalyticsAndCrashlyticsIdentity()`):** Implemented in `utils/analytics.ts` and integrated into `signOut()`, `deleteAccountAndData()`, and `deleteGuestData()` in `context/AuthContext.tsx`. Clears Firebase Analytics ID, resets instance ID, resets Meta User ID, and clears Crashlytics user identity and custom attributes.
- **Verification:** 19-test automated suite in `scripts/test-privacy-telemetry.js` (19/19 PASS). Full regression suite passed (88/88 tests). TypeScript typecheck 0 errors.

**Area affected:** `utils/analytics.ts`, `context/HabitsContext.tsx`, `context/AuthContext.tsx`, `scripts/test-privacy-telemetry.js`, `PROJECT_KNOWLEDGE.md`.

**Migration/deployment implications:** Immediate privacy compliance improvement; no schema or database changes.

---


**What:** Remediated all 5 confirmed P2 findings from the P1-8 Notification / Permission State Consistency Audit:
- **P1-8-04 [P2] Profile UI ↔ Real OS Permission State Reconciliation:**
  - In `app/(tabs)/profile.tsx`, integrated continuous permission checking via `useFocusEffect` and `hasNotificationPermission()`.
  - When system notification permission is absent or revoked, or the Android channel is muted:
    - Master Daily Reminders switch displays `OFF` (`notificationsEnabled && osPermissionGranted`).
    - Status indicator displays `BLOCKED` in red.
    - Subtext displays `"System notifications disabled in Settings"`.
    - Warning banner `"Notifications are blocked. Tap to open Settings."` renders prominently.
    - Granular reminder sub-toggles are disabled and dimmed (`opacity: 0.4`).
- **P1-8-05 [P2] Permanently Denied Permission Settings Fallback:**
  - Extended `requestNotificationPermissions()` and `getDetailedNotificationPermissions()` in `utils/notifications.ts` to return `NotificationPermissionResult` with `granted`, `canAskAgain`, and `status`.
  - Added `openNotificationSettings()` wrapping `Linking.openSettings()`.
  - When permission is permanently denied (`canAskAgain === false`), `handleNotificationsToggle` in `app/(tabs)/profile.tsx` and `handleAllowNotifications` in `app/(tabs)/index.tsx` present an actionable alert with `"Open Settings"`. Stored user preference is preserved and not clobbered.
- **P1-8-06 [P2] Android Notification Channel Health Check:**
  - Implemented `isAndroidChannelHealthy("default")` and `ensureNotificationChannel()` in `utils/notifications.ts`.
  - Detects if the default channel has been muted or disabled in Android system settings (`importance === AndroidImportance.NONE / 0`).
  - Integrated channel health checks into `hasNotificationPermission()`, `requestNotificationPermissions()`, and step 6 of `scheduleDailyNotifications()`. If channel is muted, active schedules are cancelled and scheduling aborts.
- **P1-8-07 [P2] Device Timezone Change Resilience:**
  - Added `@lyfeos_last_timezone_v1` in `LYFEOS_STORAGE_KEYS` (`utils/storage.ts`).
  - Implemented `checkTimezoneChangeAndRefresh()` in `utils/notifications.ts` utilizing `Intl.DateTimeFormat().resolvedOptions().timeZone`.
  - Initialized on app mount and on every `AppState` active transition in `app/(tabs)/index.tsx`.
  - Detects timezone shifts (e.g. travel across time zones), updates cached timezone, and invokes `requestScheduleRefresh({ reason: "timezone_change" })` to reschedule repeating daily alarms without race conditions or timer churn.
- **P1-8-08 [P2] OS Notifications ↔ In-App Bell / Inbox Integration:**
  - In `app/(tabs)/index.tsx`, added `upsertInboxNotification()` helper mapping title, body, and payload data to `NotifItem` with category resolution (`streak`, `nutrition`, `habit`, `activity`, `info`).
  - Added foreground push delivery listener via `Notifications.addNotificationReceivedListener` writing unread items to `@lyfeos_notifications_v1`.
  - Extended notification tap response listener via `Notifications.addNotificationResponseReceivedListener` to mark item as read, persist to inbox, and route to target screen.
  - Deduplicated inbox items by `${notifId}_${todayStr}` to coalesce foreground receipt and status-bar taps into a single daily inbox record. Bounded inbox storage to 30 items without displacing existing welcome messages.
- **Verification:**
  - Automated test suite `scripts/test-notification-remediation.js` extended to 29 tests (all 29 passing: Tests 1-10 Phase 1 + Tests 11-29 Phase 2).
  - Regression test suites: Habits sync (12/12 pass), Nutrition sync (12/12 pass), Activity sync (16/16 pass), Nutrition migration (5/5 pass), Profile sync (10/10 pass).
  - TypeScript typecheck verified with 0 errors (`pnpm typecheck`).
  - Strict guardrail verification: `git diff context/TodosContext.tsx` is completely empty (0 lines changed).
- **Remaining P3 Findings & Physical Device Boundaries:**
  - `P1-8-09 [P3]` Rate reminder persistence across app data clear / cloud profile remains deferred to future profile sync iteration.
  - `P1-8-10 [P3]` In-app pre-permission priming UX prior to system permission dialog remains deferred to UX phase.
  - Physical device runtime verification boundaries (OEM battery optimizations, manufacturer background killer policies) remain documented in Section 17.

**Area affected:** `utils/storage.ts`, `utils/notifications.ts`, `app/(tabs)/profile.tsx`, `app/(tabs)/index.tsx`, `scripts/test-notification-remediation.js`, `PROJECT_KNOWLEDGE.md`.

**Migration/deployment implications:** Fully backward-compatible; no destructive migrations or schema breaks.

---

### 2026-09-11 — P1-8 Notification / Permission State Consistency Remediation (Phase 1: P0/P1 Core Correctness)

**What:** Remediated P0 and P1 vulnerabilities identified during the P1-8 Notification / Permission State Consistency Audit:
- **P1-8-01 [P0] Master Toggle Storage Key Mismatch Remediated:**
  - Standardized on canonical storage key `@lyfeos_notif_enabled_v1` in `LYFEOS_STORAGE_KEYS` (`utils/storage.ts`).
  - Added non-destructive one-time migration in `getMasterNotificationsEnabled()` from legacy `notificationsEnabled` without flipping explicit `"false"` to `"true"`.
  - Updated `setMasterNotificationsEnabled(enabled)` in `utils/notifications.ts` to write both keys and immediately trigger `cancelAllNotifications()` when turned off.
  - Updated `app/(tabs)/profile.tsx` to read and write master notification toggle through `getMasterNotificationsEnabled` and `setMasterNotificationsEnabled`.
- **P1-8-02 [P1] Daily Repeating Notifications Stale Snapshot Data Remediated:**
  - Refactored `buildSmartNotificationSchedule()` in `utils/notifications.ts` to use evergreen, action-focused notification copy that never bakes single-day progress counters (e.g. `"You're at 2/8 glasses"`) into daily repeating OS alarm triggers.
  - Preserved candidate schedule structure: 9 candidate triggers, exact routes (`/(tabs)/index`, `/(tabs)/calories`, `/(tabs)/habits`), priority ranking, and `MAX_DAILY_NOTIFICATIONS = 8` cap.
  - Implemented centralized debounced coordinator `requestScheduleRefresh()` (400ms debounce) in `utils/notifications.ts` to coalesce rapid refresh requests.
  - Added `AppState` change listener in `app/(tabs)/index.tsx` to trigger `requestScheduleRefresh({ reason: "app_foreground" })` when the app transitions to active.
- **P1-8-03 [P1] Login / Cloud Profile Restore Race Condition Remediated:**
  - In `context/ProfileContext.tsx`, deferred setting `isProfileLoaded(true)` until remote Firestore profile hydration completes.
  - ProfileContext invokes `requestScheduleRefresh({ reason: "cloud_profile_restored", userId: user.uid, reminders: merged.reminders })` immediately upon cloud restore.
  - In `app/(tabs)/index.tsx`, updated `initializeNotifications()` to guard against premature default scheduling when an authenticated user is awaiting remote profile restoration (`user && !isGuest && !isProfileLoaded`).
  - Master toggle is verified first; if disabled, notification initialization aborts before requesting OS permissions or scheduling alarms.
- **Verification:**
  - Automated test suite `scripts/test-notification-remediation.js` (10/10 tests passing covering master toggle persistence, legacy migration, master toggle ON scheduling, master toggle OFF cancellation, cloud preferences override, cross-user isolation, cloud failure fallback safety, debounced burst deduplication, OS permission gate, and granular reminder toggle reactivity).
  - TypeScript typecheck verified with 0 errors (`pnpm typecheck`).
  - Strict guardrail verification: `git diff context/TodosContext.tsx` is completely empty.
- **Physical Device Verification Note:**
  - Local automation verified all 10 unit/integration scenarios. Physical device runtime verification (OEM battery optimizations, custom notification permissions, manufacturer kill-switches) remains pending physical hardware test.

**Area affected:** `utils/storage.ts`, `utils/notifications.ts`, `app/(tabs)/profile.tsx`, `context/ProfileContext.tsx`, `app/(tabs)/index.tsx`, `scripts/test-notification-remediation.js`, `PROJECT_KNOWLEDGE.md`.

**Migration/deployment implications:** Fully backward-compatible; legacy toggle values migrate cleanly on launch without overwriting user preferences.

---

### 2026-09-11 — P1-2 Phase C: Nutrition & Water Multi-Device Sync Remediation

**What:** Remediated multi-device sync conflict and overwrite vulnerabilities for Food Items and Water Logs:
- **Root Causes Remediated:**
  1. Dangerous monolithic overwrite of `users/{uid}/data/calories` based on root-level `lastModified` LWW caused cross-device data loss when different meals or waters were logged offline or concurrently.
  2. Missing per-item `updatedAt` / `deletedAt` conflict resolution model for food items and water logs.
  3. Water decrement mutations (e.g. clicking `-` button to reduce glasses) were vulnerable to getting overwritten by stale higher counts.
  4. Deleting food items or clearing today's data lacked soft-delete tombstones, allowing stale cloud records from another device to resurrect deleted data.
- **Architectural Solution:**
  - Added `updatedAt: number` and optional `deletedAt?: number` to `FoodItem` and `WaterLog` interfaces in `CaloriesContext.tsx`.
  - Implemented `normalizeFoodItem()` and `normalizeWaterLog()` in `utils/cloudSync.ts` ensuring active items omit `deletedAt` to prevent `@react-native-firebase/firestore` serializer rejection on undefined values.
  - Implemented `mergeFoodItems()` with timestamp-based conflict resolution: higher `updatedAt` wins, and on exact timestamp ties **DELETE WINS**.
  - Implemented `mergeWaterLogs()` with LyfeOS calendar day semantics (one aggregate record per date `YYYY-MM-DD`): newer `updatedAt` wins (propagating decrements), Delete-Wins on tie, and `Math.max(local.glasses, cloud.glasses)` on active timestamp ties to preserve concurrent additions.
  - Established 30-day tombstone retention and pruning (`TOMBSTONE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000`).
  - Refactored `CaloriesContext` to isolate raw items (`rawFoodItems`, `rawWaterLogs`) in AsyncStorage and Firestore payloads while exposing only active items (`!f.deletedAt`, `!w.deletedAt`) to UI consumers via `useMemo`.
  - Converted `deleteFoodItem()` and `clearTodayData()` to soft-deletions (`deletedAt: now, updatedAt: now`).
  - Updated `syncAllUserDataBeforeLogout()` to execute bidirectional `mergeFoodItems()` and `mergeWaterLogs()` before batch commit with `{ merge: true }`.
  - Updated `utils/notifications.ts` (`loadStoredNotificationContext`) to filter out tombstoned food and water logs.
- **Verification:**
  - Automated test suite `scripts/test-nutrition-sync.js` (12/12 tests passing, covering local-only + cloud-only survival, local deletion vs stale cloud, newer cloud/local updates, Delete-Wins on tie, water decrement propagation, water tie max glasses, legacy normalization, 30-day tombstone pruning, goal preservation, and baseline regression verification).
  - Phase B habits test `scripts/test-habits-sync.js` (12/12 tests passing).
  - Phase A1 nutrition migration test `scripts/test-nutrition-migration.js` (5/5 tests passing).
  - Baseline Todo sync intact (`git diff context/TodosContext.tsx` is completely empty).
  - Full project TypeScript check `pnpm run typecheck` passed with 0 errors.

**Area affected:** `context/CaloriesContext.tsx`, `utils/cloudSync.ts`, `utils/notifications.ts`, `scripts/test-nutrition-sync.js`, `PROJECT_KNOWLEDGE.md`, `LYFEOS_BACKEND_DATA_ARCHITECTURE.md`.

**Migration/deployment implications:** Fully backward-compatible; legacy food items and water logs missing `updatedAt` are normalized on-the-fly without data loss. Goal configurations (`dailyGoal`, `goalsConfigured`) are strictly preserved.

---

### 2026-09-11 — P1-2 Phase B: Habits & Habit Logs Multi-Device Sync Remediation

**What:** Remediated multi-device sync conflict and resurrection vulnerabilities for Habits and Habit Logs:
- **Root Causes Remediated:**
  1. Habit deletions resurrected across devices because missing local habits were treated as additions during cloud sync.
  2. Habit completion state used naive OR logic (`existing.completed || log.completed`), preventing unchecked completions from propagating.
  3. Habit deduplication collided on habit name, breaking same-name habits across schedules or devices.
  4. Absence of per-item `updatedAt` / `deletedAt` conflict resolution model for habits and habit logs.
  5. Habit logs lacked stable deterministic identity across devices.
- **Architectural Solution:**
  - Added `updatedAt: number` and optional `deletedAt?: number` to `Habit` and `HabitLog` interfaces.
  - Implemented `normalizeHabit()` and `normalizeHabitLog()` with deterministic legacy timestamp fallback (deriving from `createdAt` / ISO date) and Firestore serializer compatibility (`deletedAt` property omitted on active records).
  - Implemented `mergeHabits()` and `mergeHabitLogs()` with timestamp-based conflict resolution: higher `updatedAt` wins, and on exact ties **DELETE WINS**.
  - Established 30-day tombstone retention and pruning (`TOMBSTONE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000`).
  - Refactored `HabitsContext` to isolate raw items (`rawHabits`, `rawHabitLogs`) in storage and cloud sync while exposing only active items (`!h.deletedAt`, `!l.deletedAt`) to UI consumers via `useMemo`.
  - Converted `deleteHabit()` and `clearTodayHabitLogs()` to soft-deletions (`deletedAt: now, updatedAt: now`).
  - Updated `syncAllUserDataBeforeLogout()` to execute bidirectional `mergeHabits` and `mergeHabitLogs` before batch commit.
  - Updated `utils/notifications.ts` (`loadStoredNotificationContext`) to filter out tombstoned habits and habit logs.
- **Verification:**
  - Automated test suite `scripts/test-habits-sync.js` (12/12 tests passing, covering local-only + cloud-only survival, local deletion vs stale cloud, newer cloud/local updates, Delete-Wins on tie, explicit uncheck propagation, same-name distinct-ID habits, legacy normalization, UI isolation, and Todo sync regression safety).
  - Full project TypeScript check `pnpm run typecheck` passed with 0 errors.
  - Phase A1 nutrition migration test `scripts/test-nutrition-migration.js` (5/5 tests passing).

**Area affected:** `context/HabitsContext.tsx`, `utils/cloudSync.ts`, `utils/notifications.ts`, `scripts/test-habits-sync.js`, `PROJECT_KNOWLEDGE.md`, `LYFEOS_BACKEND_DATA_ARCHITECTURE.md`.

**Migration/deployment implications:** Fully backward-compatible; legacy habits and logs are normalized on-the-fly without data loss. Todo sync architecture remains 100% untouched.

---

### 2026-09-11 — P1-2 Phase A1: Guest → Account Nutrition Data Safety Fix

**What:** Remediated destructive write vulnerability during Guest → Account migration for the `users/{uid}/data/calories` Firestore document:
- **Root Cause:** `migrateGuestDataToAccount()` in `utils/cloudSync.ts` used `batch.set(caloriesRef, { calories: ... }, ...)` without `{ merge: true }`, dropping existing authenticated account fields (`dailyGoal`, `goalsConfigured`, and custom top-level fields) whenever a guest user signed into an existing account.
- **Fix:**
  - Implemented `mergeCaloriesMigrationData(guestData, rawCloudDocData)` in `utils/cloudSync.ts` to merge nutrition while preserving authenticated account `dailyGoal`, `goalsConfigured`, and any top-level document fields.
  - Commits the Firestore write with `{ merge: true }`.
  - In `context/AuthContext.tsx`, updated `handleGuestMigration()` to read guest local storage (`@lyfeos_goal_v2`, `@lyfeos_goals_configured_v1`) and pass them into migration payload as fallbacks when no account goals exist.
  - If the authenticated account already has cloud goals, they take precedence and are mirrored back to local AsyncStorage on migration completion.
- **Verification:**
  - Automated unit test suite `scripts/test-nutrition-migration.js` (5/5 tests passing).
  - TypeScript compilation `tsc -p tsconfig.json --noEmit` verified 0 errors.

**Area affected:** `utils/cloudSync.ts`, `context/AuthContext.tsx`, `scripts/test-nutrition-migration.js`, `PROJECT_KNOWLEDGE.md`, `LYFEOS_BACKEND_DATA_ARCHITECTURE.md`.

**Migration/deployment implications:** Backward-compatible, non-breaking safety patch. Existing account goals and data are protected from overwrites during sign-in/linking.

---

### 2026-09-11 — P1-2 Phase E: Profile / Health Multi-Device Sync & Data Safety Remediation

**What:** Remediated P1-2 multi-device cloud synchronization and offline data loss for Profile and Health Profile data:
- **Independent Section Conflict Granularity:** Eliminated monolithic whole-document overwrites by establishing independent conflict handling across 6 domains: `userName` (field), `habitGoal` (field), `activityGoal` (field), `healthProfile` (group with blank-field fallback), `reminders` (group), and `preferences` (group).
- **Section Timestamps:** Introduced `@lyfeos_profile_meta_v1` tracking `sectionTimestamps` locally and top-level `*UpdatedAt` attributes in Firestore (`users/{uid}/data/profile`).
- **Intentional Changes vs. Legacy Records:** Newer timestamp wins unconditionally ($T > 0$). Intentional changes to defaults (e.g. `reminders.morning = false`, `habitGoal = 5`) with newer timestamps correctly take precedence over older non-default values. Active timestamp ties resolve with Cloud-Wins deterministically. Legacy un-timestamped records fall back to preserving configured cloud settings against uninitialized local defaults.
- **Health Profile Non-Destructive Blank-Field Fallback:** When a record with a newer timestamp wins for `healthProfile`, any fields left blank (`""`) in the winning record inherit non-empty values from the alternate record, ensuring partial updates do not wipe previously configured health metrics.
- **Immutable `joinDate` Seniority Preservation:** Confirmed `joinDate` is immutable account creation metadata; merged via earliest valid ISO date.
- **Pre-Logout Null Overwrite Prevention:** Updated `syncAllUserDataBeforeLogout` in `utils/cloudSync.ts` to fetch and bidirectionally merge existing cloud profile data before writing, eliminating destructive `null` writes for unconfigured local profile keys.
- **Guest → Account Migration:** Updated `context/AuthContext.tsx` (`handleGuestMigration`) and `utils/cloudSync.ts` (`migrateGuestDataToAccount`) to read guest profile keys, fetch the existing cloud profile, merge non-destructively, and commit in the atomic batch.
- **Firestore Write Safety:** All profile writes use `{ merge: true }` and preserve unknown top-level cloud document fields.
- **Verification:**
  - Automated test suite `scripts/test-profile-sync.js` (10/10 tests passing).
  - Regression test suite (12/12 Habits, 12/12 Nutrition, 16/16 Activity, 5/5 Nutrition Migration — all 55/55 tests pass).
  - Full project TypeScript check `pnpm run typecheck` passed with 0 errors.
  - Guardrail verification: `git diff context/TodosContext.tsx` is completely empty.

**Area affected:** `utils/cloudSync.ts`, `context/ProfileContext.tsx`, `context/AuthContext.tsx`, `utils/storage.ts`, `scripts/test-profile-sync.js`, `PROJECT_KNOWLEDGE.md`, `LYFEOS_BACKEND_DATA_ARCHITECTURE.md`.

**Migration/deployment implications:** Fully backward-compatible; legacy profiles lacking timestamps or subfields normalize safely on-the-fly.

---

### 2026-09-11 — P1-2 Phase D: Activity / Workouts / Steps Sync Remediation

**What:** Remediated P1-2 multi-device cloud synchronization and offline data loss for Activity / Workouts / Steps:
- Added `updatedAt: number` and optional `deletedAt?: number` (soft-delete tombstones) to `ActivityLog` and `StepsLog`.
- Implemented `normalizeActivityLog`, `normalizeStepsLog`, `mergeActivityLogs`, and `mergeStepsLogs` in `utils/cloudSync.ts`.
- Multi-workout support: Workouts keyed by unique `id`. Multiple workouts on the same date with different or identical sports have distinct IDs and both survive.
- Implemented **Approved Alternative 1** for StepsLog: StepsLog remains a daily aggregate keyed by `date`. Higher `updatedAt` wins (allowing both step increments and downward typo corrections to propagate across devices; `Math.max()` is strictly avoided). On timestamp ties where either record is deleted: Delete-Wins. On timestamp ties where both are active and values differ: **Cloud-Wins deterministically**. All derived metrics (`distanceKm`, `caloriesBurned`, `activeMinutes`) remain consistent with the winning record.
- Added 30-day tombstone retention and automatic pruning (`TOMBSTONE_RETENTION_MS`).
- Omitted `deletedAt` entirely on active records (`delete normalized.deletedAt`) to ensure complete compatibility with `@react-native-firebase/firestore` native serializer.
- Refactored `ActivityContext.tsx` to maintain raw items in storage and cloud payloads while exposing memoized active items (`!l.deletedAt` and `!s.deletedAt`) to UI consumers and metric aggregators. Soft-delete implemented in `deleteActivityLog`.
- Integrated non-destructive merge into `syncAllUserDataBeforeLogout` and `migrateGuestDataToAccount` in `utils/cloudSync.ts` and `context/AuthContext.tsx`.
- Updated `utils/notifications.ts` (`loadStoredNotificationContext`) to filter out tombstoned activity logs.
- Created and executed comprehensive 16-test automated suite in `scripts/test-activity-sync.js` covering all 16 conflict, downward correction, tie-breaking, derived metric, normalization, pruning, and migration scenarios.
- Regression verification: 0 regressions on Todos P1-1 (verified `context/TodosContext.tsx` git diff is empty), Phase A1 Guest Nutrition safety (5/5 pass), Phase B Habits sync (12/12 pass), and Phase C Nutrition/Water sync (12/12 pass). All 45 tests pass.
- TypeScript typecheck verified with 0 errors (`pnpm run typecheck`).

**Area affected:** `utils/cloudSync.ts`, `context/ActivityContext.tsx`, `context/AuthContext.tsx`, `utils/notifications.ts`, `scripts/test-activity-sync.js`, `PROJECT_KNOWLEDGE.md`, `LYFEOS_BACKEND_DATA_ARCHITECTURE.md`.

**Migration/deployment implications:** Fully backward-compatible; legacy workouts and steps missing `updatedAt` are automatically normalized without data loss or schema breaks.

---

### 2026-09-10 — Version 2.2.2 Production Release Preparation

**What:** Prepared LyfeOS for version 2.2.2 production release:
- User-facing app version bumped from `2.2.1` to `2.2.2` in `app.json`.
- Dynamic app version resolution integrated in `utils/analytics.ts` (`Constants.expoConfig?.version || "2.2.2"`).
- Confirmed Android `versionCode` is not hardcoded and is strictly auto-managed by Expo/EAS (`appVersionSource: "remote"`, `autoIncrement: true`).
- Firebase Crashlytics, Performance Monitoring, and symbolication mapping fully verified.
- Targeted EAS build profile: `production` (Android AAB).

**Area affected:** `app.json`, `utils/analytics.ts`, `PROJECT_KNOWLEDGE.md`, `LYFEOS_BACKEND_DATA_ARCHITECTURE.md`.

**Migration/deployment implications:** Production AAB build via EAS.

---

### 2026-09-10 — Fix Logout Pre-Sync Serialization Failure (`deletedAt: undefined`)

**What:** Resolved critical logout blocker where `signOut()` aborted with generic dialog `"Sync failed — could not log out"`:
- **Root Cause:** In `utils/cloudSync.ts` -> `normalizeTodo()`, active (non-deleted) todos were assigned `deletedAt: undefined`. When `syncAllUserDataBeforeLogout()` executed `mergeTodos()` and called `batch.set(dataColRef.doc('todos'), ...)`, the `@react-native-firebase/firestore` native serializer rejected the undefined value with `Error: Unsupported field value: undefined`.
- **Fix:** Updated `normalizeTodo()` to omit `deletedAt` entirely whenever `raw.deletedAt` is not a valid number (`delete normalized.deletedAt`). Valid numeric tombstones (`typeof raw.deletedAt === 'number' && !Number.isNaN(raw.deletedAt)`) remain fully supported and preserved.
- **Regression Tests Performed:**
  - Active todo with `deletedAt: undefined` -> `deletedAt` property is completely omitted.
  - Active todo without `deletedAt` -> `deletedAt` property is completely omitted.
  - Valid tombstone with numeric timestamp (e.g. `1750000000000`) -> `deletedAt` preserved.
  - Invalid `deletedAt` values (`null`, `""`, `"123"`, `NaN`, `false`, etc.) -> `deletedAt` property omitted.
  - Merge todos test -> verified no undefined fields in merged output and simulated Firestore serializer acceptance.
- **Security & Data Isolation:** Fully preserved. `syncAllUserDataBeforeLogout(currentUser.uid)` continues to use the authenticated user's UID, local data clearing remains safely guarded behind successful cloud sync, and Firebase Security Rules were not altered.
- **Build & Verification Status:** TypeScript typecheck (`tsc --noEmit`) verified 0 errors.

**Area affected:** `utils/cloudSync.ts`, `PROJECT_KNOWLEDGE.md`.

**Migration/deployment implications:** Fully backward-compatible; active todos no longer contain forbidden undefined values when saved to Firestore.

---

### 2026-09-10 — P1-1 Todos Cloud Sync Conflict & Data-Loss Remediation

**What:** Remediated P1 Todos cloud overwrite/data-loss issue. Replaced naive cloud overwrite on initial load and whole-array replacement with a conflict-aware synchronization strategy:
- Added `updatedAt: number` and `deletedAt?: number` (soft delete tombstones) to `Todo` interface.
- Implemented `mergeTodos(localTodos, cloudTodos)` with timestamp-based conflict resolution (highest `updatedAt` wins, delete-wins on ties).
- Added automatic 30-day tombstone retention and pruning (`TOMBSTONE_RETENTION_MS`).
- Added recurring task deduplication across devices by `seriesId` / `title + dueDate + repeat`.
- Migrated legacy todos seamlessly via `normalizeTodo()` (derives `updatedAt` from `createdAt`).
- Updated `TodosContext` internal state to hold raw todos (active + tombstones) while exposing only active todos to UI.
- Integrated `mergeTodos` into `syncAllUserDataBeforeLogout` and `migrateGuestDataToAccount`.
- Updated `utils/notifications.ts` to filter out tombstones when loading notification context.

**Area affected:** `context/TodosContext.tsx`, `utils/cloudSync.ts`, `utils/notifications.ts`, `PROJECT_KNOWLEDGE.md`, `LYFEOS_BACKEND_DATA_ARCHITECTURE.md`.

**Migration/deployment implications:** Fully backward-compatible; legacy todos missing `updatedAt` are automatically normalized without data loss or schema breaks.

---

### 2026-09-07 — Canonical Project Knowledge Consolidation


**What:** Consolidated all verified audit findings, architecture details, data flows, models, security analysis, and living documentation protocols into `PROJECT_KNOWLEDGE.md` as the single source of truth.

**Verified corrections & updates in current state:**

| Area | Verified State in `PROJECT_KNOWLEDGE.md` |
|---|---|
| **Firebase Analytics** | **Active** — real SDK calls via `@react-native-firebase/analytics` `^24.1.1` (no longer a stub). |
| **Meta (Facebook) SDK** | **Active (all environments)** — `react-native-fbsdk-next` `13.4.3` dual-logs events and tracks user ID. `isMetaEnabled()` removed; no environment gate. `app.config.js` injects plugin unconditionally with env-var-or-hardcoded credentials. |
| **Guest Migration** | Uses correct versioned storage keys (`@lyfeos_habits_v2`, `@lyfeos_todos_v2`, etc.) and performs atomic batch merge with cloud data. |
| **Activity Analysis Engine** | Confirmed 100% offline local MET scientific calculation in `utils/analyzeActivity.ts`. No mobile Gemini calls at runtime. |
| **Babel Config** | Pinned to `babel-preset-expo` only; obsolete reanimated plugin reference removed. |
| **Cloud Sync** | Detailed signatures and logic for `mergeHabits`, `mergeHabitLogs`, `migrateGuestDataToAccount`, and `deleteUserCloudData`. |
| **Account Deletion** | 5-step transactional deletion sequence in `AuthContext.tsx` with re-auth verification. |
| **Kotlin Config Plugin** | Documented `plugins/withKotlinVersion.js` pinning Kotlin to `2.1.20`. |
| **Version** | Updated to `2.2.1` (Android versionCode is automatically managed by Expo/EAS). |

**Area affected:** All sections of `PROJECT_KNOWLEDGE.md`.

**Migration/deployment implications:** None — documentation consolidation only.
