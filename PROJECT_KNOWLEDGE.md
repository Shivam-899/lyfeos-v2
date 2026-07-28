# PROJECT_KNOWLEDGE.md — LyfeOS

> **This file is the single source of truth for any developer or AI assistant working on this codebase.**
> Generated: 2026-07-07. Update this file whenever a significant architectural change is made.

---

## 1. PROJECT OVERVIEW

**App name:** LyfeOS
**Package ID:** `com.lyfeos.app`
**App Store slug:** `lyfeos`
**EAS Project ID:** `54f639f6-a140-4168-afdc-eb3bca56979e`
**Owner / Developer account:** `shivam.2k` (EAS) / **Orbits Lab** (Play Store developer)
**Current version:** `2.1` (Android `versionCode: 33`)

### What is LyfeOS?
LyfeOS is an **AI-powered, all-in-one life management and productivity app** built in React Native (Expo). It unifies daily task management, habit tracking, sports & activity logging, nutrition & calorie tracking (with a specialised Indian food database), water intake tracking, and a personal health dashboard — all in a single app with real-time cloud sync and optional Google AdMob ads.

### Core value proposition
- Replace 4–5 single-purpose apps with one cohesive experience.
- AI-powered activity analysis (via Google Gemini 2.5 Flash) personalises post-workout nutrition and recovery advice.
- Deep Indian cuisine support with a bundled 300+ item food database.
- Cloud sync via Firebase Firestore so data roams across devices.
- Works fully offline (local-first architecture using AsyncStorage).

### Target users
Health-conscious individuals aged 18–40, primarily in India, who want a privacy-respecting, single-app solution for fitness and daily productivity.

### Current stage
**Live on Google Play Store** (internal track → production). Android-only production build. iOS support scaffolded in code (`supportsTablet: false`) but not deployed.

---

## 2. TECH STACK

### Frontend
| Layer | Technology | Version |
|---|---|---|
| Framework | React Native | `0.81.5` |
| Platform | Expo SDK | `~54.0.35` |
| Router | Expo Router | `~6.0.24` (file-based) |
| Language | TypeScript | `~5.9.2` |
| UI Animations | react-native-reanimated | `~4.1.1` |
| Gesture handling | react-native-gesture-handler | `~2.28.0` |
| Safe area | react-native-safe-area-context | `~5.6.0` |
| SVG | react-native-svg | `15.12.1` |
| Keyboard | react-native-keyboard-controller | `^1.18.5` |
| Keyboard scroll | react-native-keyboard-aware-scroll-view | `^0.9.5` |
| Blur / Glass | expo-blur, expo-glass-effect | `~15.0.8`, `~0.1.4` |
| Linear gradients | expo-linear-gradient | `~15.0.8` |
| Haptics | expo-haptics | `~15.0.8` |
| Image picker | expo-image-picker | `~17.0.9` |
| Audio/video | expo-av | `^16.0.8` |
| Server state | @tanstack/react-query | `^5.80.0` |
| Validation | zod + zod-validation-error | `^3.25.0` / `^3.4.0` |
| Icons | @expo/vector-icons (Ionicons + SymbolView) | `^15.0.3` |
| Font | @expo-google-fonts/inter (400/500/600/700) | `^0.4.0` |
| Notifications | expo-notifications | `^0.32.17` |
| React Compiler | babel-plugin-react-compiler | experimental beta |

### Backend / Cloud
| Service | SDK | Purpose |
|---|---|---|
| Firebase Auth | `@react-native-firebase/auth ^24.1.1` | Email, Google, Anonymous sign-in |
| Firebase Firestore | `@react-native-firebase/firestore ^24.1.1` | Cloud sync for habits, todos, calories |
| Google Sign-In | `@react-native-google-signin/google-signin ^16.1.2` | OAuth token for Firebase Auth |
| Google AdMob | `react-native-google-mobile-ads ^16.3.3` | Banner, interstitial, rewarded ads |
| Gemini AI | Google Generative Language API (REST) | Sports activity analysis (proxied) |
| USDA FoodData Central | REST API | Nutrition lookup (primary) |
| Open Food Facts | REST API | Nutrition lookup (fallback) |

> **Note:** `@react-native-firebase/analytics` and `@react-native-firebase/crashlytics` are listed as future dependencies with stub implementations in `utils/analytics.ts`. They are **not yet active**.

### Local Storage
- **AsyncStorage** (`@react-native-async-storage/async-storage 2.2.0`) — single local persistence layer for all data.
- Wrapped and type-safe via `utils/storage.ts`.

### Build system
- **EAS Build** (`eas-cli >= 19.0.5`) for production `.aab` (Android App Bundle).
- `pnpm` workspaces (mono-repo style though only one app exists).
- `metro.config.js` acts as a **development-time API proxy** for Gemini (proxies `/api/gemini` and `/api/analyze-activity`).
- `server/serve.js` is a standalone Node.js server for hosting **static Expo web builds** with the same Gemini proxy routes — used for production web hosting only.

---

## 3. FOLDER STRUCTURE

```
D:\vf\                              ← Project root (LyfeOS)
├── app/                            ← Expo Router: all screens live here
│   ├── _layout.tsx                 ← Root layout: providers, auth guard, splash, ads init
│   ├── index.tsx                   ← Entry redirect (minimal, just renders nothing)
│   ├── onboarding.tsx              ← 4-slide animated onboarding carousel (first-launch only)
│   ├── login.tsx                   ← Auth screen: Google, Email/Password, Guest, Forgot Password
│   ├── legal-consent.tsx           ← Terms/Privacy/Health disclaimer gate (CONSENT_VERSION='1.0')
│   ├── +not-found.tsx              ← 404 fallback screen
│   └── (tabs)/                     ← Bottom-tab group (authenticated users only)
│       ├── _layout.tsx             ← Tab bar layout (adaptive: iOS Liquid Glass or classic Expo Tabs)
│       ├── index.tsx               ← Home / Dashboard screen
│       ├── habits.tsx              ← Habit tracker screen
│       ├── todos.tsx               ← To-do / task list screen
│       ├── calories.tsx            ← Nutrition / calorie tracker screen
│       └── profile.tsx             ← Profile, health settings, preferences, notifications
│
├── components/                     ← Reusable UI components
│   ├── ActivityTracker.tsx         ← Full sports/activity logging modal (76 KB — very large)
│   ├── AddHabitSheet.tsx           ← Bottom sheet for creating/editing habits
│   ├── CalendarStrip.tsx           ← Horizontal scrollable calendar strip (used in habits/todos)
│   ├── CircularProgress.tsx        ← SVG circular progress ring component
│   ├── ConfettiEffect.tsx          ← Confetti animation for habit streak celebrations
│   ├── ErrorBoundary.tsx           ← React error boundary wrapper
│   ├── ErrorFallback.tsx           ← UI shown inside ErrorBoundary on crash
│   └── HabitTile.tsx               ← Individual habit card with completion toggle
│
├── context/                        ← React Context API: global state management
│   ├── AuthContext.tsx             ← Firebase auth state, Google/Email/Guest sign-in, migration
│   ├── CaloriesContext.tsx         ← Food items, water logs, daily goals, cloud sync
│   ├── HabitsContext.tsx           ← Habits, habit logs, streaks, completion rate, cloud sync
│   ├── TodosContext.tsx            ← Todos with priority/category/repeat, cloud sync
│   ├── ActivityContext.tsx         ← Activity logs, steps logs, AI coach insight, stats
│   ├── ProfileContext.tsx          ← User profile: name, health data, reminders, preferences
│   └── ThemeContext.tsx            ← Theme mode (system/dark/light), persisted to AsyncStorage
│
├── constants/
│   └── colors.ts                   ← Light/dark color tokens for the entire app
│
├── hooks/
│   ├── useAppTheme.ts              ← Returns theme tokens (DARK_TOKENS / LIGHT_TOKENS) + mode/setMode
│   └── useColors.ts                ← Returns the colors object for the current theme
│
├── utils/                          ← Pure utility functions and external API clients
│   ├── storage.ts                  ← Type-safe AsyncStorage wrapper (get/set/remove JSON/strings)
│   ├── cloudSync.ts                ← Firestore read/write for habits, todos, calories; guest migration
│   ├── analytics.ts                ← Firebase Analytics + Crashlytics stubs (TODO: activate)
│   ├── ads.ts                      ← Google AdMob: banner, interstitial, rewarded ad helpers
│   ├── notifications.ts            ← expo-notifications: permissions + daily reminder scheduling
│   ├── analyzeFoodImage.ts         ← FoodAnalysisResult interface; image scan STUBBED ("coming soon")
│   ├── nutritionSearch.ts          ← Main nutrition search: Indian DB → USDA → Open Food Facts
│   ├── indianFoodDatabase.ts       ← Bundled local database of 300+ Indian foods with nutrients
│   ├── analyzeActivity.ts          ← Client side helper that calls /api/analyze-activity proxy
│   └── date.ts                     ← getLocalDateString() — timezone-safe YYYY-MM-DD formatter
│
├── server/
│   ├── serve.js                    ← Standalone Node.js HTTP server for web/static production
│   └── templates/
│       └── landing-page.html       ← HTML landing page template for web deployment
│
├── scripts/
│   ├── build.js                    ← Custom build script for static Expo web export
│   ├── diagnose-gemini.mjs         ← Dev diagnostic: tests Gemini API key and connectivity
│   └── test-indian-db.js           ← Dev test: validates indianFoodDatabase entries
│
├── assets/
│   ├── images/                     ← App icon, splash image
│   └── sounds/                     ← (Reserved for future audio, possibly habit completion sounds)
│
├── android/                        ← Native Android project (EAS build target)
│   └── app/                        ← gradle, keystore references, google-services.json integration
│
├── app.json                        ← Expo config: name, slug, version, permissions, plugins
├── eas.json                        ← EAS Build profiles (development/preview/production/production-apk)
├── package.json                    ← Dependencies, npm scripts
├── metro.config.js                 ← Metro bundler config + dev Gemini API proxy middleware
├── babel.config.js                 ← Babel with babel-preset-expo + reanimated plugin
├── tsconfig.json                   ← TypeScript config (strict, paths: "@/*" → root)
├── .env.example                    ← Template for required environment variables
├── .env.local                      ← !! GITIGNORED !! Actual secrets (never commit)
├── google-services.json            ← Firebase config for Android (safe to commit per Firebase docs)
├── @shivam.2k__lyfeos.jks          ← Android keystore (KEEP SECURE, commit is a mistake if public)
├── build-android.sh                ← Shell script: clears EAS temp dirs, runs `eas build production`
└── pnpm-workspace.yaml             ← pnpm workspace config
```

### Naming conventions
- **Screens/components:** PascalCase (`CaloriesContext.tsx`, `ActivityTracker.tsx`)
- **Utilities:** camelCase (`cloudSync.ts`, `nutritionSearch.ts`)
- **AsyncStorage keys:** `@lyfeos_<domain>_<version>` (e.g., `@lyfeos_habits_v2`, `@lyfeos_food_v2`)
- **Routes:** Expo Router file-based — file name IS the route segment

---

## 4. CORE FEATURES & HOW THEY'RE IMPLEMENTED

### 4.1 Personal Dashboard (Home)
**File:** `app/(tabs)/index.tsx` (~69 KB)

- Shows daily summary: habit completion ring, calorie progress, active minutes, water intake
- Lists today's habits with quick completion toggles
- Shows upcoming todos
- Displays a post-activity banner (from `ActivityContext`) for 2 hours after workout
- Shows weekly coach insight (AI-generated text stored in `ActivityContext`)
- Notification scheduling runs here: morning, meal, water, evening reminders
- Progress ring colour changes dynamically based on % (0–100%): `getProgressColor()` 6-tier system
- Key hooks: `useCalories`, `useHabits`, `useTodos`, `useActivity`, `useProfile`
- Uses `ConfettiEffect` when all daily habits are completed

### 4.2 Habit Tracker
**Files:** `app/(tabs)/habits.tsx`, `components/HabitTile.tsx`, `components/AddHabitSheet.tsx`, `components/CalendarStrip.tsx`, `context/HabitsContext.tsx`

- Supports two habit types: `"build"` (build a new habit) and `"quit"` (break a bad habit)
- Three tracking methods: `"task"` (done/not done), `"amount"` (numeric target), `"time"` (timer in seconds)
- Custom colour picker (8 colours) and emoji picker (~60 emojis in 5 categories)
- Optional description field and weekday scheduling (select which days habit is active)
- Streak calculation: `getStreak()` returns `{ current, best }` using timezone-safe local date arithmetic
- Completion rate: `getCompletionRate()` = % of all scheduled days completed
- Cloud sync to Firestore on every mutation (add/update/delete)
- **Interstitial ad shown every 3rd habit completion** (`maybeShowCompletionAd()` in `HabitsContext`)
- `CalendarStrip` component handles horizontal date scrolling and date selection
- `HabitTile` handles the completion toggle with animated feedback and haptics
- Key data in `HabitsContext`: `HABITS_KEY = "@lyfeos_habits_v2"`, `HABIT_LOGS_KEY = "@lyfeos_habit_logs_v2"`

### 4.3 To-do / Task Management
**Files:** `app/(tabs)/todos.tsx`, `context/TodosContext.tsx`

- Full CRUD with priority (`urgent/high/medium/low`), category (`Work/Personal/Shopping/Health/Other`)
- Optional due date, due time, notes, repeat type (`none/daily/weekly/monthly`)
- Manual drag-to-reorder via `reorderTodos(fromIdx, toIdx)`
- Order persisted as `order: number` field on each `Todo`
- Cloud sync to Firestore on every mutation
- Key: `TODOS_KEY = "@lyfeos_todos_v2"`

### 4.4 Sports / Activity Tracker
**Files:** `components/ActivityTracker.tsx`, `context/ActivityContext.tsx`, `utils/analyzeActivity.ts`

- Large bottom-sheet modal (`ActivityTracker.tsx` ~76 KB) for logging a workout
- User selects sport (with emoji), duration (minutes), intensity (`light/moderate/intense`)
- On submission, calls `POST /api/analyze-activity` (proxied through `metro.config.js` in dev, `server/serve.js` in production)
- Proxy sends request to **Gemini 2.5 Flash** with a structured prompt requesting JSON output:
  - `calories_burned`, `hydration_needed_ml`, `hydration_glasses`, `protein_needed_g`, `carbs_needed_g`, `recovery_time_hours`, `heart_rate_zone`, `health_benefits[]`, `tips[]`, `post_activity_meal`, `sport_category`
- Results stored as `ActivityLog` in `ActivityContext` (persisted via `@lyfeos_activity_logs_v1`)
- Post-activity banner shown on home screen for 2 hours after logging (`PostActivityBanner`)
- Steps logging: separate `StepsLog` entity with `steps`, `distanceKm`, `caloriesBurned`, `activeMinutes`
- Weekly coach insight: AI-generated text stored as `WeeklyCoachInsight` (1 per week)
- Stats functions: `getWeeklySports()`, `getBestStreak()`, `getFavoriteSport()`, `getMostCalsBurned()`, `getLongestSession()`, `getMostActiveMonth()`

### 4.5 Nutrition / Calorie Tracking
**Files:** `app/(tabs)/calories.tsx` (~116 KB), `context/CaloriesContext.tsx`, `utils/analyzeFoodImage.ts`, `utils/nutritionSearch.ts`, `utils/indianFoodDatabase.ts`

- Logs food across 4 meal slots: `breakfast`, `lunch`, `dinner`, `snacks`
- Smart default meal selection based on time of day
- **BMR calculation** (Mifflin-St Jeor formula) using profile data (age, sex, height, weight)
- Activity level multipliers (`sedentary → 1.2`, `lightly → 1.375`, etc.) applied to BMR for TDEE
- Macro tracking: Calories, Carbs, Protein, Fat with progress bars
- Micro-nutrient tracking: Fiber, Sugar, Sodium, Potassium, Calcium, Iron, Magnesium, Zinc, Vitamins A/C/D/B12
- **Food search flow:**
  1. User types food name (text-based; camera scan is STUBBED — throws "Food Scan is coming soon")
  2. `analyzeFoodText(description)` → `performNutritionSearch(query)`
  3. Checks **local Indian food DB** first (`indianFoodDatabase.ts`)
  4. Falls back to **USDA FoodData Central API** (`EXPO_PUBLIC_USDA_API_KEY`)
  5. Falls back to **Open Food Facts API** (no key required, rate-limited)
  6. Returns `FoodAnalysisResult` with confidence (`"high"/"medium"/"low"`) and source tag
- Indian food quick chips: 20+ preset items shown as shortcuts for common Indian foods
- `getDayStats(date)`: aggregates all nutrients for a given day from stored `FoodItem[]`
- Cloud sync: food + water data synced to Firestore with **last-modified timestamp guard** (prevents stale cloud data from overwriting newer local data)

### 4.6 Water Tracker
**Files:** `context/CaloriesContext.tsx`, `app/(tabs)/calories.tsx`

- Tracked as `WaterLog[]` with `date` (YYYY-MM-DD) and `glasses` count
- `logWater(date, delta)`: increments/decrements glasses count for a day
- Daily goal default: 8 glasses (customisable via `DailyGoal.water`)
- Stored under `@lyfeos_water_v2`

### 4.7 Profile & Health Settings
**Files:** `app/(tabs)/profile.tsx`, `context/ProfileContext.tsx`

- User name (default: "LyfeOS User"), join date, habit goal (default: 5), activity goal (default: 30 min)
- `HealthProfile`: `age`, `sex`, `height`, `weight`, `activityLevel`, `goal` — all strings, stored in `@lyfeos_profile_health_v1`
- `Reminders`: `morning`, `meal`, `water`, `evening` booleans → controls notification scheduling
- `Preferences`: `units` (metric/imperial), `calorieDisplay` (kcal/kj), `habitEffectsEnabled` (celebration animations)
- Profile screen also shows: streak stats, total habits, total activity sessions, sign-out button, theme toggle
- `joinDate` is generated and persisted on first launch (Bug 15 fix)

### 4.8 AI Food Analysis (Text-based)
**Files:** `utils/nutritionSearch.ts`, `utils/indianFoodDatabase.ts`, `utils/analyzeFoodImage.ts`

- Text input → `performNutritionSearch(query)` → waterfall: Local DB → USDA → Open Food Facts
- Response cached in-memory (`searchCache` Map) to avoid duplicate network requests
- Deduplication of concurrent identical requests via `pendingRequests` Map
- Camera-based scan: `analyzeFoodImage(base64)` is **intentionally stubbed** — throws an error

### 4.9 Daily/Weekly/Monthly Progress
- **Daily:** `getDayStats(date)` in `CaloriesContext`, habit completion % in `HabitsContext`
- **Weekly:** `getWeeklySports()` in `ActivityContext` (last 7 days), weekly habit view in `habits.tsx`
- **Monthly:** `getMostActiveMonth()` in `ActivityContext`
- All visualised in the home dashboard and individual tab screens

### 4.10 Push Notifications
**Files:** `utils/notifications.ts`, `app/(tabs)/index.tsx`

- Uses `expo-notifications` with granular per-category toggles
- 7 scheduled daily notifications: morning (8:00), breakfast (8:30), hydration (11:00, 15:00), lunch (13:00), dinner (19:00), evening (21:00)
- Controlled by `Reminders` object from `ProfileContext`
- Android channel: `"default"` / `"LyfeOS Reminders"` (HIGH importance, vibration, `#FF6B35` LED)

### 4.11 Google AdMob Monetization
**Files:** `utils/ads.ts`, `context/HabitsContext.tsx`, `app/_layout.tsx`

- Ad SDK initialized 2 seconds after app launch (`initializeAds()` in `_layout.tsx`)
- **Interstitial ads:** shown every 3rd habit completion (`maybeShowCompletionAd()`)
- **Modal-open guard:** `setInterstitialBlocked(true)` prevents ad from firing mid-flow
- **Banner and Rewarded ads:** utilities are wired up (`showRewardedAd()`) but not yet called from any screen
- Ad unit IDs are hardcoded in `utils/ads.ts` (not environment variables — standard AdMob practice)
- AdMob App ID: `ca-app-pub-7658674851177824~1838662014` (set in `app.json` plugin config)

---

## 5. DATA MODELS / SCHEMA

### FoodItem (Nutrition entry)
```typescript
interface FoodItem {
  id: string;             // Date.now() + random suffix
  name: string;
  calories: number;
  carbs?: number;         // grams
  protein?: number;       // grams
  fat?: number;           // grams
  fiber?: number;         // grams
  sugar?: number;         // grams
  sodium?: number;        // mg
  portionSize?: string;   // e.g. "1 serving"
  meal: "breakfast" | "lunch" | "dinner" | "snacks";
  date: string;           // "YYYY-MM-DD"
  // Micro-nutrients (all optional)
  potassium?: number;     // mg
  calcium?: number;       // mg
  iron?: number;          // mg
  magnesium?: number;     // mg
  zinc?: number;          // mg
  vitaminA?: number;      // mcg
  vitaminC?: number;      // mg
  vitaminD?: number;      // mcg
  vitaminB12?: number;    // mcg
}
```

### DailyGoal
```typescript
interface DailyGoal {
  calories: number;   // kcal (default 2000)
  carbs: number;      // g (default 250)
  protein: number;    // g (default 150)
  fat: number;        // g (default 65)
  water: number;      // glasses (default 8)
}
```

### WaterLog
```typescript
interface WaterLog {
  id: string;
  date: string;     // "YYYY-MM-DD"
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
  colorId: string;          // one of 8 colour IDs
  emoji: string;
  targetAmount?: number;
  targetTimeSeconds?: number;
  weekDays: number[];       // 0–6, 0 = Sunday
  createdAt: string;        // ISO string
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
  createdAt: string;  // ISO string
  order: number;      // manual sort order
}
```

### ActivityLog
```typescript
interface ActivityLog {
  id: string;
  date: string;               // "YYYY-MM-DD"
  sport: string;
  emoji: string;
  duration: number;           // minutes
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
  height: string;           // cm (metric) or ft'in" (imperial)
  weight: string;           // kg or lb
  activityLevel: "sedentary" | "lightly" | "moderately" | "very" | "";
  goal: "lose" | "maintain" | "muscle" | "fitness" | "";
}
```

### Firestore Structure
```
users/{uid}/
  data/
    habits   → { habits: Habit[], updatedAt: Timestamp }
    todos    → { todos: Todo[], updatedAt: Timestamp }
    calories → { calories: { foodItems: FoodItem[], waterLogs: WaterLog[], lastModified: number }, updatedAt: Timestamp }
```

> **Note:** Calories sync uses a `lastModified` timestamp guard — the newer of local vs. cloud wins to prevent data loss on interrupted sync.

### AsyncStorage Key Registry
| Key | Data | Context |
|---|---|---|
| `@lyfeos_food_v2` | `FoodItem[]` | CaloriesContext |
| `@lyfeos_water_v2` | `WaterLog[]` | CaloriesContext |
| `@lyfeos_goal_v2` | `DailyGoal` | CaloriesContext |
| `@lyfeos_goals_configured_v1` | `"true"/"false"` | CaloriesContext |
| `@lyfeos_food_meta_v1` | `{ lastModified: number }` | CaloriesContext |
| `@lyfeos_habits_v2` | `Habit[]` | HabitsContext |
| `@lyfeos_habit_logs_v2` | `HabitLog[]` | HabitsContext |
| `@lyfeos_version` | `"v2_empty"` | HabitsContext (data version gate) |
| `@lyfeos_todos_v2` | `Todo[]` | TodosContext |
| `@lyfeos_activity_logs_v1` | `ActivityLog[]` | ActivityContext |
| `@lyfeos_steps_v1` | `StepsLog[]` | ActivityContext |
| `@lyfeos_activity_banner_v1` | `PostActivityBanner \| null` | ActivityContext |
| `@lyfeos_coach_insight_v1` | `WeeklyCoachInsight \| null` | ActivityContext |
| `@lyfeos_profile_name_v1` | `string` | ProfileContext |
| `@lyfeos_profile_join_v1` | ISO date string | ProfileContext |
| `@lyfeos_profile_habitgoal_v1` | `string` (number) | ProfileContext |
| `@lyfeos_profile_actgoal_v1` | `string` (number) | ProfileContext |
| `@lyfeos_profile_health_v1` | `HealthProfile` | ProfileContext |
| `@lyfeos_profile_reminders_v1` | `Reminders` | ProfileContext |
| `@lyfeos_profile_prefs_v1` | `Partial<Preferences>` | ProfileContext |
| `@lyfeos_theme_mode_v1` | `"system"\|"dark"\|"light"` | ThemeContext |
| `@lyfeos_notifications_v1` | `NotifItem[]` | index.tsx (in-app inbox) |
| `@lyfeos_notif_asked_v1` | flag string | index.tsx |
| `@lyfeos_confetti_date_v1` | date string | index.tsx |
| `hasSeenOnboarding` | `"true"` | _layout.tsx |
| `legalConsent` | `{ accepted, version, timestamp }` | _layout.tsx / legal-consent.tsx |
| `habitCompletionCount` | `string` (number) | HabitsContext (ad trigger counter) |

---

## 6. STATE MANAGEMENT

**Strategy:** React Context API only. No Redux, Zustand, MobX, or Jotai.

### Provider hierarchy (in `app/_layout.tsx`)
```
SafeAreaProvider
  └── ThemeProvider          ← theme mode + isDark
      └── ErrorBoundary
          └── QueryClientProvider   ← @tanstack/react-query (not heavily used — mostly for future)
              └── AuthProvider      ← Firebase auth user + sign-in methods
                  └── HabitsProvider
                      └── TodosProvider
                          └── CaloriesProvider
                              └── ActivityProvider
                                  └── ProfileProvider
                                      └── GestureHandlerRootView
                                          └── KeyboardProvider
                                              └── RootLayoutNav   ← routing logic
```

### Data flow pattern (all contexts follow this)
1. On mount: read from AsyncStorage → set local React state
2. If authenticated non-guest: fetch from Firestore → merge with conflict resolution → update state + AsyncStorage
3. On every mutation: update React state → write to AsyncStorage → write to Firestore (non-blocking, fire-and-forget)
4. **Stale closure fix:** All mutating callbacks use `useRef` to always access the latest `user`/`isGuest` values without triggering re-renders

### Auth-aware sync
- `CaloriesContext` and `HabitsContext` subscribe to `useAuth()` — syncing only fires when `user && !isGuest`
- Guest users get full local functionality, no cloud sync
- On sign-in from guest: `migrateGuestDataToAccount()` uploads local data to Firestore

---

## 7. NAVIGATION STRUCTURE

**Router:** Expo Router (file-based, Stack + Tabs)

```
/ (root Stack)
├── /index                   ← Minimal redirect screen (immediate, no UI)
├── /onboarding              ← Shown on first launch (sets hasSeenOnboarding)
├── /login                   ← Auth screen (shown if onboarding done but not logged in)
├── /legal-consent           ← GDPR/legal gate shown after login, before app access
└── /(tabs)                  ← Bottom tab group (all require auth + legal consent)
    ├── /                    ← Home / Dashboard (index.tsx)
    ├── /habits              ← Habit tracker
    ├── /todos               ← Task list
    ├── /calories            ← Nutrition tracker
    └── /profile             ← Profile & settings
```

### Navigation guard logic (in `app/_layout.tsx` → `RootLayoutNav`)
```
User lands →
  ├── isInitializing → wait (no redirect)
  ├── Not logged in:
  │   ├── hasSeenOnboarding = false → /onboarding
  │   └── hasSeenOnboarding = true  → /login
  └── Logged in (user or guest):
      ├── legalConsentAccepted = false → /legal-consent
      └── legalConsentAccepted = true  → /(tabs)
```
> Consent gate re-checks `CONSENT_VERSION = '1.0'` — bumping this version forces all existing users through the consent screen again.

### Tab bar adaptive rendering
- iOS with Liquid Glass available: uses `expo-router/unstable-native-tabs` (native iOS tab bar)
- All other platforms: classic Expo Router `<Tabs>` with `BlurView` background on iOS

---

## 8. API KEYS & ENVIRONMENT VARIABLES

**Source of truth:** `.env.local` (gitignored). Template: `.env.example`.

| Variable | Used In | Purpose |
|---|---|---|
| `EXPO_PUBLIC_USDA_API_KEY` | `utils/nutritionSearch.ts` | USDA FoodData Central API key. Falls back to `"DEMO_KEY"` (30 req/hour per IP). Prefix `EXPO_PUBLIC_` makes it available in the React Native bundle. |
| `GEMINI_API_KEY` | `metro.config.js`, `server/serve.js` | Google Gemini AI key. **Server-side only** — never bundled into the RN client. Used by the Metro dev proxy and the production Node.js server. |
| `EXPO_PUBLIC_DOMAIN` | `eas.json` (production profile `env`) | Domain for the deployed web server. Set in `eas.json` production env, not `.env.local`. |

> **Security note:** `GEMINI_API_KEY` is intentionally excluded from the React Native bundle by routing all Gemini calls through a server-side proxy (`metro.config.js` in dev, `server/serve.js` in production). Never move this to an `EXPO_PUBLIC_` variable.

### Other credentials (not env vars)
- `google-services.json` — Firebase Android config (stored in repo root, standard Firebase practice)
- `@shivam.2k__lyfeos.jks` — Android signing keystore (stored in repo root — **ensure this never reaches a public repo**)
- Google Sign-In `webClientId` is hardcoded in `context/AuthContext.tsx` (line 32) — consider moving to env var

---

## 9. KNOWN ISSUES / TECH DEBT

| # | Area | Issue | Location |
|---|---|---|---|
| 1 | Food Scanner | Camera-based food image scan is **intentionally stubbed** — `analyzeFoodImage()` always throws `"Food Scan is coming soon."` | `utils/analyzeFoodImage.ts:48` |
| 2 | Analytics | Firebase Analytics + Crashlytics functions are **all no-ops / stubs**. Real implementations are commented out with `TODO` notes requiring a native rebuild. | `utils/analytics.ts` |
| 3 | Analytics | `@react-native-firebase/analytics` and `@react-native-firebase/crashlytics` are not listed in `package.json` yet — must be installed before activating | `utils/analytics.ts:10-12` |
| 4 | Rewarded Ads | `showRewardedAd()` utility is implemented but **never called from any screen** | `utils/ads.ts:68` |
| 5 | Banner Ads | `BannerAd`, `BannerAdSize` are exported from `utils/ads.ts` but no banner has been placed in any screen yet | `utils/ads.ts:102` |
| 6 | Habits cloud sync | `HabitsContext.logHabit()` passes stale `habits` array to `syncHabitsToCloud` — should use the state updater function's latest value | `context/HabitsContext.tsx:236` |
| 7 | Guest migration | `handleGuestMigration` in `AuthContext` reads from AsyncStorage keys `"habits"`, `"todos"`, `"calories"` (raw, unprefixed) which differ from the actual versioned keys (`@lyfeos_habits_v2` etc.) — migration may silently migrate empty arrays | `context/AuthContext.tsx:47-53` |
| 8 | Data version | `DATA_VERSION = "v2_empty"` in `HabitsContext` clears ALL legacy storage keys on first run with the new version. This is a one-shot migration guard — any future schema change needs a new version string | `context/HabitsContext.tsx:90-118` |
| 9 | Apple Sign-In | `expo-apple-authentication` is **not in the current `package.json`** (was in the older vitaflow 0.1 project). Apple sign-in is removed from this version. | `context/AuthContext.tsx` (no Apple import) |
| 10 | iOS not deployed | iOS build is configured (`supportsTablet: false`, `ios:{}` in `app.json`) but **no production iOS build has been submitted** to the App Store | `app.json:16-18` |
| 11 | `sounds/` folder | `assets/sounds/` directory exists but is empty. Likely a placeholder for future habit completion sounds | `assets/sounds/` |
| 12 | @tanstack/react-query | `QueryClientProvider` is set up in `_layout.tsx` but React Query is not actively used anywhere in the app. It appears to be scaffolded for future feature work | `app/_layout.tsx:34` |
| 13 | Timezone streak bug (fixed) | Streak calculation previously used `new Date(dateStr)` which is UTC-based causing off-by-one errors in non-UTC timezones. Fixed with local date arithmetic using `localDateStr()` / `subtractDay()` / `addDay()` helpers | `context/HabitsContext.tsx:266-281` |
| 14 | `.jks` keystore in repo | `@shivam.2k__lyfeos.jks` is committed to the repository. This is a security risk if the repo is ever made public | root |
| 15 | webClientId hardcoded | Google Sign-In `webClientId` is a literal string in `AuthContext.tsx` rather than an env variable | `context/AuthContext.tsx:32` |

---

## 10. BUILD & DEPLOYMENT

### Prerequisites
- Node.js ≥ 18, pnpm installed globally
- EAS CLI (`npm i -g eas-cli`)
- Logged into EAS: `eas login`

### Development
```bash
pnpm dev                    # Starts Metro on localhost:5000 with Gemini proxy
pnpm android                # expo run:android (local native build)
```

### EAS Build profiles (`eas.json`)
| Profile | Output | Distribution | Notes |
|---|---|---|---|
| `development` | `.apk` (dev client) | Internal | For Expo Go / dev client testing |
| `preview` | `.apk` | Internal | QA testing without Play Store |
| `production` | `.aab` | Play Store → internal track | Auto-increments `versionCode`; sets `EXPO_PUBLIC_DOMAIN` |
| `production-apk` | `.apk` | — | Same as production but `.apk` output (for sideloading) |

### Production Android build command
```bash
# Option 1: Via script (recommended — clears EAS temp dirs first)
bash build-android.sh

# Option 2: Direct EAS
eas build --platform android --profile production --non-interactive

# Option 3: APK for sideloading
eas build --platform android --profile production-apk
```

### Signing
- Keystore file: `@shivam.2k__lyfeos.jks` (in project root)
- EAS manages keystore upload — configure in `eas.json` `android.credentialsSource` if needed

### Submitting to Play Store
```bash
eas submit --platform android --profile production
```
Submits to the `internal` track (configured in `eas.json` submit section).

### Environment variables for production
Set in EAS: `eas secret:create --scope project --name GEMINI_API_KEY --value "your_key"`
Or in `eas.json` `production.env` for non-secret build-time vars.

### Static web server deployment
```bash
node scripts/build.js       # Builds static Expo web export to ./static-build/
node server/serve.js        # Serves static build on port 3000 (reads GEMINI_API_KEY from .env)
```

---

## 11. FUTURE ROADMAP HOOKS

Based on code placeholders and commented-out sections:

| Feature | Evidence | File |
|---|---|---|
| **Camera Food Scanner** | `analyzeFoodImage()` stub throws "coming soon" | `utils/analyzeFoodImage.ts` |
| **Firebase Analytics** | Full implementation written, commented out with TODO | `utils/analytics.ts` |
| **Firebase Crashlytics** | Full implementation written, commented out with TODO | `utils/analytics.ts` |
| **Rewarded ads** | `showRewardedAd()` fully wired but never called from UI | `utils/ads.ts:68` |
| **Banner ads** | `BannerAd` / `BannerAdSize` exported, no screen uses them | `utils/ads.ts:102` |
| **iOS App Store release** | iOS config present in `app.json`; `expo-apple-authentication` removed | `app.json:16-18` |
| **React Query usage** | `QueryClientProvider` scaffolded; no queries written yet | `app/_layout.tsx:34` |
| **Habit completion sounds** | `assets/sounds/` folder is empty | `assets/sounds/` |
| **Imperial units** | `Preferences.units: "metric" | "imperial"` stored but UI only shows metric values | `context/ProfileContext.tsx:28` |
| **kJ calorie display** | `Preferences.calorieDisplay: "kcal" | "kj"` stored but UI hardcodes kcal | `context/ProfileContext.tsx:29` |
| **Habit effects toggle** | `Preferences.habitEffectsEnabled` stored, consumed in `HabitTile` | `context/ProfileContext.tsx:30` |
| **Weekly AI coach insight** | `WeeklyCoachInsight` model exists; generation call exists in `ActivityContext`, UI display on home screen | `context/ActivityContext.tsx:48-51` |
| **Consent version bumping** | `CONSENT_VERSION = '1.0'` in legal-consent.tsx — architecture supports re-prompting on version bump | `app/legal-consent.tsx:18` |
| **Gemini Vision / multimodal** | `metro.config.js` has a generic `/api/gemini` proxy endpoint (accepts arbitrary model + payload) ready for image analysis | `metro.config.js:43-62` |

---

## AI ENGINEER HANDOFF NOTES

1. **All data is local-first.** Never assume Firestore is the source of truth. AsyncStorage holds the authoritative copy on the device. Cloud sync is opportunistic and conflict-resolved by timestamp.

2. **The Gemini API key must never enter the RN bundle.** Always route AI calls through the Metro proxy (`/api/analyze-activity` or `/api/gemini`) in dev, and through `server/serve.js` in production.

3. **`@tanstack/react-query` is a ghost dependency.** It's set up but unused. Don't rely on it without wiring it up to actual queries.

4. **Analytics functions are all no-ops.** `logEvent()`, `logScreen()`, `logError()` etc. do nothing in production. To activate: install the native Firebase packages, run `npx expo run:android`, and uncomment the real implementations in `utils/analytics.ts`.

5. **Adding new persisted state:** Always add a new `@lyfeos_<domain>_v<N>` AsyncStorage key. If you change a data schema, bump the version in the key name AND add a migration in the corresponding Context's `useEffect` initializer.

6. **Interstitial ad guard:** If you add a new modal or bottom sheet, call `setInterstitialBlocked(true)` from `utils/ads.ts` when it opens and `setInterstitialBlocked(false)` when it closes to prevent the 3rd-habit-completion ad from interrupting the user.

7. **Streak calculation is timezone-sensitive.** Use `getLocalDateString()` from `utils/date.ts` for all date operations — never use `new Date(isoString).toISOString().slice(0, 10)` which uses UTC.

8. **`HabitsProvider` renders `null` until data loads** (`if (!loaded) return null`). This prevents flash of empty habit list but means children don't render until AsyncStorage is read. This is intentional.

9. **The tab bar adapts to platform.** On iOS with Liquid Glass, it uses native tabs. On Android and web, it uses Expo Router's `<Tabs>`. Don't rely on BlurView being present on Android.

10. **Food camera scan is intentionally disabled.** The infrastructure (`expo-image-picker`, `analyzeFoodImage()` interface, `FoodAnalysisResult` type with `source: "gemini"`) is all in place. To enable: implement the body of `analyzeFoodImage()` in `utils/analyzeFoodImage.ts` to call the `/api/gemini` proxy with a multimodal payload including the base64 image.
