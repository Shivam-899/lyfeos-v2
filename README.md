# Lyfe-OS

![LyfeOS Banner](https://via.placeholder.com/1200x300?text=LyfeOS+-+Your+Personal+Lifestyle+OS)

LyfeOS is a comprehensive, AI-powered health, productivity, and lifestyle management application built with React Native and Expo. It combines nutrition tracking, habit building, task management, and AI-driven activity analysis to help users maintain a balanced and optimized daily routine.

---

## 🌟 Features

### 🍎 Nutrition & Health
* **AI Food Scanning**: Automatically analyze food images to estimate calories and macronutrients using Gemini AI.
* **Calorie Tracking**: Log daily food intake and monitor macronutrient goals.
* **Indian Food Database**: Built-in support and local database for searching and logging regional Indian cuisines.

### 🏃‍♂️ Fitness & Activity
* **AI Activity Analysis**: Log sports or exercises (duration, intensity) and receive AI-calculated calories burned, hydration needs, and recovery times based on your physical profile.
* **Contextual Health Advice**: Receive tailored post-activity meal suggestions and heart-rate zone estimations.

### 📈 Productivity & Habits
* **Habit Tracker**: Build consistency with custom habits, streak tracking, and visual calendar strips.
* **Celebration Effects**: Engaging micro-animations and confetti drops when completing habits to boost dopamine and retention.
* **To-Do Management**: A streamlined daily task manager to stay on top of your schedule.

### ⚙️ System & Profile
* **Personalized Dashboard**: A centralized hub (`/`) combining today's calories, habits, and tasks.
* **Offline-First Storage**: User data (profile, habits, tasks) is saved locally via Async Storage for blazing-fast access.
* **Dark/Light Theme Support**: System-aware theming context for optimal viewing day or night.

---

## 📸 Screenshots

> **Note:** Add actual screenshots of your application here.

| Dashboard | Nutrition Tracker | Habit Tracker |
| :---: | :---: | :---: |
| ![Dashboard](https://via.placeholder.com/250x500?text=Dashboard+Screen) | ![Nutrition](https://via.placeholder.com/250x500?text=Nutrition+Screen) | ![Habits](https://via.placeholder.com/250x500?text=Habits+Screen) |

---

## 💻 Tech Stack

| Category | Technology |
| :--- | :--- |
| **Frontend** | React Native, Expo (`expo-router`) |
| **Backend** | Node.js (Standalone production server) |
| **Database** | `@react-native-async-storage/async-storage` (Local) |
| **State Management**| React Context API, React Query |
| **AI / APIs** | Google Gemini API (`gemini-2.5-flash`) |
| **Styling & UI** | Expo Vector Icons, React Native Reanimated |
| **Tooling** | TypeScript, Zod, React Compiler (Beta) |

---

## 🏗️ Project Architecture

```text
vitaflow/
├── app/                  # Expo Router navigation and screens
│   ├── (tabs)/           # Main tab navigation (index, calories, habits, todos, profile)
│   └── _layout.tsx       # Root layout and context providers
├── components/           # Reusable UI components
│   ├── ActivityTracker.tsx
│   ├── AddHabitSheet.tsx
│   ├── HabitTile.tsx
│   └── ConfettiEffect.tsx
├── context/              # Global state management
│   ├── ActivityContext.tsx
│   ├── CaloriesContext.tsx
│   └── HabitsContext.tsx
├── hooks/                # Custom React hooks (theming, etc.)
├── server/               # Custom Node.js production server
│   ├── serve.js          # API proxy & static file server
│   └── templates/        # Web landing page templates
├── utils/                # Helper functions & API utilities
│   ├── analyzeActivity.ts
│   ├── analyzeFoodImage.ts
│   └── storage.ts
├── assets/               # Local images, fonts, and icons
└── package.json          # Project dependencies and scripts
```

---

## 🚀 Installation

### Prerequisites
* Node.js (v18 or newer)
* `pnpm` (Package manager)
* Expo Go app (for testing on a physical device) or an iOS/Android emulator.

### Clone Repository
```bash
git clone https://github.com/yourusername/lyfeos.git
cd lyfeos
```

### Install Dependencies
```bash
pnpm install
```

### Environment Variables
Create a `.env` file in the root directory and add the following variables:

```env
# .env.example

# Your Google Gemini API Key for AI Analysis
GEMINI_API_KEY="your_google_gemini_api_key_here"

# (Optional) Port for the local production server
PORT=3000
```

### Run Locally (Development)
Start the Expo development server:
```bash
pnpm dev
```

### Build for Production
To build the static web version and run the custom production server:
```bash
pnpm build
pnpm serve
```
To compile the Android APK:
```bash
pnpm build:android
```

---

## 📖 Usage Guide

1. **Dashboard (`/`)**: View your daily summary.
2. **Calories (`/calories`)**: Use the camera to scan food or manually search the database to log your meals. 
3. **Habits (`/habits`)**: Add new habits, tap to complete them for the day, and watch your streak grow.
4. **To-Dos (`/todos`)**: Manage your daily tasks.
5. **Profile (`/profile`)**: Set your age, weight, and goals to ensure the AI provides accurate health metrics during activity analysis.

---

## 🔌 API Documentation

The project uses a custom Node.js backend to securely proxy requests to the Gemini API, ensuring your API keys are never exposed to the client.

### `POST /api/analyze-activity`
Analyzes physical activity to return health metrics.
* **Body parameters**: `sport`, `duration`, `intensity`, `weightKg`, `age`
* **Response**: JSON object containing `calories_burned`, `hydration_needed_ml`, `recovery_time_hours`, etc.

### `POST /api/gemini`
A secure proxy route for direct prompt generation (used primarily for food image analysis).
* **Body parameters**: Standard Gemini API payload structure.

---

## 🗄️ Database Schema Overview

Data is currently stored locally on the device using Async Storage. The core entities include:
* **Profile**: `weight`, `age`, `goals`, `theme_preference`
* **Habits**: `id`, `title`, `frequency`, `streakCount`, `completedDates`
* **Todos**: `id`, `task`, `isCompleted`, `createdAt`
* **Calories/Nutrition**: `date`, `foodItems[]`, `totalCalories`, `macros`

---

## 🔒 Security

* **API Key Protection**: The Gemini API key is securely stored on the backend server (`server/serve.js`). Client requests are routed through this server to prevent client-side credential leaking.
* **Environment Variables**: Robust `.env` parsing ensures secrets are loaded securely into the Node process.

---

## ⚡ Performance Optimizations

* **React Compiler**: Utilizes the new React Compiler (beta) to automatically memoize components, reducing unnecessary re-renders.
* **Local Caching**: App relies on persistent local storage, meaning it works instantaneously without waiting for network requests (except for AI analysis).
* **Animations**: Uses `react-native-reanimated` running animations on the UI thread to prevent JavaScript thread blocking and maintain 60 FPS.

---

## 🗺️ Roadmap

- [ ] **Cloud Syncing**: Implement Firebase or Supabase to sync user data across multiple devices.
- [ ] **Social Features**: Allow users to share habit streaks and activity achievements with friends.
- [ ] **Push Notifications**: Reminders to drink water, log meals, and complete daily habits.
- [ ] **Wearable Integration**: Sync steps and heart rate directly from Apple Health / Google Fit.

---

## 🤝 Contributing

Contributions are always welcome! 

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## ✍️ Author

**Your Name / Organization**
* GitHub: [@yourusername](https://github.com/Shivam-899)
* Twitter: [@yourhandle](https://twitter.com/yourhandle)
