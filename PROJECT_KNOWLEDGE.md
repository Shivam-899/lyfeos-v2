# PROJECT_KNOWLEDGE.md — LyfeOS

> **Living Document — Single Source of Truth**
>
> This file is the **single source of truth and living documentation** for any developer or AI assistant working on the LyfeOS codebase. It reflects the **actual current state** of the project and must be updated as part of every meaningful change.
> See [§19 Documentation Maintenance](#19-documentation-maintenance) for the update protocol.
>
> **Last audited:** 2026-09-07  
> **App version at audit:** `2.2.1` (Android `versionCode: 35`)

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
| **Current version** | `2.2.1` (Android versionCode `35`) |
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
| Firebase Crashlytics | *(not installed)* | — | **Deferred** — `logError()` and `setCrashlyticsUser()` are safe stubs |
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

### Guest -> Account Migration (`handleGuestMigration()`)

Reads all local guest data using **correct versioned keys** (`@lyfeos_habits_v2`, `@lyfeos_habit_logs_v2`, `@lyfeos_todos_v2`, `@lyfeos_food_v2`, `@lyfeos_water_v2`, `@lyfeos_food_meta_v1`) then calls `migrateGuestDataToAccount()` in `cloudSync.ts` which:
- Fetches existing cloud data for habits, todos, calories in parallel
- Merges: habits (set-union by ID + name), habit logs (keep true + max amount/time), todos (cloud-first union with re-indexing), food (dedup by ID), water (max glasses per date)
- Writes all merged data in a single atomic Firestore batch
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
| `notificationsEnabled` | string | |

> **Rule for new keys:** Always use `@lyfeos_<domain>_v<N>` prefix. Add to `LYFEOS_STORAGE_KEYS` in `utils/storage.ts`. If the schema changes, bump the version in the key name and add a migration in the Context's `useEffect` initializer.

### Storage Security

- AsyncStorage stores all data as **unencrypted plain text** (SQLite files at `/data/data/com.lyfeos.app/databases/RKStorage`)
- `android:allowBackup="true"` in the manifest — data can be fully extracted via `adb backup` on a debug-enabled device

---

## 8. Data Synchronization

### Conflict Resolution by Domain

| Domain | Policy | Details |
|---|---|---|
| **Habits** | Set-union deduplication | Cloud + local merged. Deduped by ID or normalised name. Cloud takes precedence; local-only appended. |
| **Habit Logs** | Union + max value merge | Keyed by `habitId_date`. If both exist: `completed = true` if either is; `amount`/`timeSeconds` take maximum. |
| **Todos** | **Naive cloud overwrite** | If cloud has items, it replaces local. Locally-created todos while offline are **silently lost** on reconnect. |
| **Calories/Water** | Timestamp-guarded last-write-wins | `@lyfeos_food_meta_v1.lastModified` vs Firestore `calories.lastModified`. Newer wins; if local is newer, it re-pushes to repair stale cloud. |
| **Guest Migration** | Deterministic merge (atomic batch) | Reads cloud state first, merges per domain rules, writes single atomic batch, then updates local AsyncStorage. |

### Sync Functions in `utils/cloudSync.ts`

| Function | Purpose |
|---|---|
| `syncHabitsToCloud(uid, habits, habitLogs?)` | `.set({ habits, habitLogs, updatedAt }, { merge: true })` to `users/{uid}/data/habits` |
| `fetchHabitsFromCloud(uid)` | One-time `.get()` returning `habits` array |
| `fetchHabitLogsFromCloud(uid)` | One-time `.get()` returning `habitLogs` array |
| `syncTodosToCloud(uid, todos)` | `.set({ todos, updatedAt })` to `users/{uid}/data/todos` |
| `fetchTodosFromCloud(uid)` | One-time `.get()` returning `todos` array |
| `syncCaloriesToCloud(uid, calories)` | `.set({ calories, updatedAt })` to `users/{uid}/data/calories` |
| `fetchCaloriesFromCloud(uid)` | One-time `.get()` returning `calories` object |
| `mergeHabits(local, cloud)` | Set-union dedup by ID + name |
| `mergeHabitLogs(local, cloud)` | Union + max value merge keyed by `habitId_date` |
| `migrateGuestDataToAccount(uid, payload)` | Atomic batch: fetch + merge + write + update local AsyncStorage |
| `deleteUserCloudData(uid)` | Batch delete all `users/{uid}/data/*` docs + parent doc + verify empty |

### Behavior Under Network Conditions

| Condition | Result |
|---|---|
| Internet available | Background Firestore write succeeds silently |
| Internet unavailable | Local write succeeds; Firebase SDK queues mutation; error caught by `logError()` (no-op stub); UI seamless |
| Firebase request fails | Error logged; local state untouched; app functional |
| App restart | AsyncStorage loaded first; cloud fetch + merge if authenticated |
| User logs out | Firebase session ends; AsyncStorage data **remains on device** |
| New device login | Habits, todos, calories download from cloud. Profile, activity, steps do NOT — new device starts with empty defaults. |

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
- Cloud sync on every mutation

### 9.4 Sports / Activity Tracker (`components/ActivityTracker.tsx`, ~80 KB)

**Context:** `ActivityContext.tsx`

- Bottom-sheet modal: user selects sport (with emoji), duration (minutes), intensity (`light | moderate | intense`)
- On submit: calls `analyzeActivity(sport, duration, intensity, weightKg, age)` from `utils/analyzeActivity.ts`
- **This is a 100% offline calculation** using `ACTIVITY_DATABASE` (30+ sports with MET values). No network call. 300–1200 ms artificial delay simulates AI.
- `estimateCalories(sport, durationMin, intensity, weightKg)` — synchronous quick-preview for the live preview card
- Results stored as `ActivityLog` in `@lyfeos_activity_logs_v1`; **never synced to Firestore**
- Post-activity banner: stored in `@lyfeos_activity_banner_v1`, auto-expires after 2 hours
- Steps: separate `StepsLog` entity; `calculateSteps(steps, weightKg, heightCm)` for stride-based distance/calorie calc

> **Important:** `metro.config.js` and `server/serve.js` both expose `/api/analyze-activity` and `/api/gemini` Gemini proxy endpoints. The **native Android/iOS client never calls these**. `utils/analyzeActivity.ts` is fully offline. The proxy is only for development testing or a potential future web deployment.

### 9.5 Nutrition Tracking (`app/(tabs)/calories.tsx`, ~121 KB)

**Context:** `CaloriesContext.tsx`

- 4 meal slots: `breakfast | lunch | dinner | snacks`; default selected based on time of day
- **BMR** computed with Mifflin-St Jeor formula from `HealthProfile`; multiplied by activity level for TDEE
- Macro tracking: Calories, Carbs, Protein, Fat
- Micro-nutrient tracking: Fiber, Sugar, Sodium, Potassium, Calcium, Iron, Magnesium, Zinc, Vitamins A/C/D/B12
- Indian food quick-chips: 20+ preset items as shortcuts
- `getDayStats(date)` aggregates all nutrients for a given day

**Food search waterfall (`utils/nutritionSearch.ts`):**
1. Local in-memory cache (`searchCache` Map; concurrent duplicate requests deduped via `pendingRequests`)
2. Local Indian food DB (`utils/indianFoodDatabase.ts`, ~300 items)
3. USDA FoodData Central API (`api.nal.usda.gov` — uses `EXPO_PUBLIC_USDA_API_KEY` or falls back to `"DEMO_KEY"` at 30 req/hr/IP)
4. Open Food Facts API (`world.openfoodfacts.org` — no key required)

**Camera food scan:** `analyzeFoodImage()` always throws `"Food Scan is coming soon."` — intentionally disabled.

### 9.6 Water Tracking

Part of `CaloriesContext`. `logWater(date, delta)` increments/decrements `WaterLog.glasses`. Default goal: 8 glasses. Synced to Firestore as part of the calories document.

### 9.7 Profile & Health Settings (`app/(tabs)/profile.tsx`, ~90 KB)

**Context:** `ProfileContext.tsx`

- `userName`, `joinDate`, `habitGoal` (default: 5), `activityGoal` (default: 30 min)
- `HealthProfile`: `age`, `sex`, `height`, `weight`, `activityLevel`, `goal` — all strings
- `Reminders`: `morning`, `meal`, `water`, `evening` booleans
- `Preferences`: `units` (metric/imperial — stored but UI only shows metric), `calorieDisplay` (kcal/kj — stored but UI hardcodes kcal), `habitEffectsEnabled`
- Profile avatar: picked via `expo-image-picker`, stored only in volatile component state — **lost on app reload** (never persisted)
- Account deletion and guest data deletion flows are exposed from this screen

### 9.8 Push Notifications (`utils/notifications.ts`)

7 scheduled daily notifications controlled by `Reminders` toggles:

| ID | Title | Time | Toggle |
|---|---|---|---|
| `morning` | Good Morning! | 08:00 | `morning` |
| `breakfast` | Breakfast Time | 08:30 | `meal` |
| `hydration1` | Hydration Check | 11:00 | `water` |
| `lunch` | Lunch Reminder | 13:00 | `meal` |
| `hydration2` | Hydration Check | 15:00 | `water` |
| `dinner` | Dinner Time | 19:00 | `meal` |
| `evening` | Evening Check-in | 21:00 | `evening` |

- Android channel: `"default"` / `"LyfeOS Reminders"` (HIGH importance, `#FF6B35` LED)

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

### Meta (Facebook) App Events — ACTIVE IN PRODUCTION ONLY

`react-native-fbsdk-next` `13.4.3` is dynamically managed via `app.config.js`:
- **Development (`APP_ENV=development`) & Preview (`APP_ENV=preview`):** Completely disabled and omitted from Expo config plugins. No Meta credentials, manifest metadata, or native SDK initialization.
- **Production (`APP_ENV=production`):** Dynamically included in Expo plugins, reading `META_APP_ID` and `META_CLIENT_TOKEN` securely from environment variables.
- **Runtime Guard:** All calls (`initializeMetaSDK`, `logEvent`, `setAnalyticsUser`) are guarded by `isMetaEnabled()`, ensuring no SDK calls occur outside of production builds.

| Firebase Event | Meta Event |
|---|---|
| `login` | `fb_mobile_login` |
| `sign_up` | `AppEventsLogger.AppEvents.CompletedRegistration` |
| `habit_completed` | `HabitCompleted` |
| `meal_logged` | `MealLogged` |

`setAnalyticsUser(userId)` calls `AppEventsLogger.setUserID(userId)` in production only.

Meta SDK initialised via `initializeMetaSDK()` -> `Settings.initializeSDK()` (called from `app/_layout.tsx`, guarded by `isMetaEnabled()`).

### Firebase Crashlytics — DEFERRED / INACTIVE

`@react-native-firebase/crashlytics` is **not installed**. `logError()` and `setCrashlyticsUser()` are stub no-ops that only `console.warn` in dev mode.

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
| 4 | **Plain-text local storage + ADB backup** — AsyncStorage unencrypted. `android:allowBackup="true"` allows `adb backup` extraction. | **Medium** | Unresolved |
| 5 | **Meta UID leakage** — Firebase UID transmitted directly to `AppEventsLogger.setUserID()`. | **Medium** | Unresolved (by design) |
| 6 | **No Firestore schema validation** — No Cloud Functions enforce document schemas; users could write arbitrary payloads. | **Medium** | Unresolved |
| 7 | **Naive todo conflict resolution** — Cloud overwrites local todos on first sync; offline todos silently lost. | **Medium (data loss)** | Unresolved |
| 8 | **Meta Client Token hardcoded** — Compiled into `strings.xml`; extractable via APK reverse engineering. | **Low–Medium** | Unresolved |
| 9 | **Single Firebase project for dev + prod** — Both environments share `lyfe-os-2c7cd`. Dev data can pollute prod. | **Medium** | Unresolved |

### Recommended Remediations (not yet implemented)

1. Call `clearAllLyfeOSLocalData()` + `cancelAllNotifications()` inside `signOut()`
2. Add `firestore.rules` to repo with `allow read, write: if request.auth.uid == userId;`
3. Move `.jks` files out of project directory to offline secure storage
4. Set `android:allowBackup="false"` in `app.json` android config
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

---

## 18. Future Roadmap Hooks

| Feature | Evidence | File |
|---|---|---|
| Camera food scanner | `analyzeFoodImage()` stub; `expo-image-picker` installed; `/api/gemini` multimodal proxy ready | `utils/analyzeFoodImage.ts`, `metro.config.js` |
| Firebase Crashlytics | Implementation commented out with TODO; only needs `@react-native-firebase/crashlytics` install + native rebuild | `utils/analytics.ts:130-152` |
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

---

### 2026-09-07 — Canonical Project Knowledge Consolidation

**What:** Consolidated all verified audit findings, architecture details, data flows, models, security analysis, and living documentation protocols into `PROJECT_KNOWLEDGE.md` as the single source of truth.

**Verified corrections & updates in current state:**

| Area | Verified State in `PROJECT_KNOWLEDGE.md` |
|---|---|
| **Firebase Analytics** | **Active** — real SDK calls via `@react-native-firebase/analytics` `^24.1.1` (no longer a stub). |
| **Meta (Facebook) SDK** | **Active** — `react-native-fbsdk-next` `13.4.3` dual-logs events and tracks user ID. |
| **Guest Migration** | Uses correct versioned storage keys (`@lyfeos_habits_v2`, `@lyfeos_todos_v2`, etc.) and performs atomic batch merge with cloud data. |
| **Activity Analysis Engine** | Confirmed 100% offline local MET scientific calculation in `utils/analyzeActivity.ts`. No mobile Gemini calls at runtime. |
| **Babel Config** | Pinned to `babel-preset-expo` only; obsolete reanimated plugin reference removed. |
| **Cloud Sync** | Detailed signatures and logic for `mergeHabits`, `mergeHabitLogs`, `migrateGuestDataToAccount`, and `deleteUserCloudData`. |
| **Account Deletion** | 5-step transactional deletion sequence in `AuthContext.tsx` with re-auth verification. |
| **Kotlin Config Plugin** | Documented `plugins/withKotlinVersion.js` pinning Kotlin to `2.1.20`. |
| **Version** | Updated to `2.2.1` (Android `versionCode: 35`). |

**Area affected:** All sections of `PROJECT_KNOWLEDGE.md`.

**Migration/deployment implications:** None — documentation consolidation only.
