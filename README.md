# Ants In Your Plants

A mobile-first garden planning and tracking web application built with vanilla JavaScript and Firebase. Designed to support gardeners of all experience levels — from first-time growers to seasoned horticulturists.

![Garden planning app](https://img.shields.io/badge/status-active-brightgreen) ![Firebase](https://img.shields.io/badge/backend-Firebase-orange) ![PWA](https://img.shields.io/badge/PWA-enabled-blue)

---

## Overview

Ants In Your Plants provides a visual grid-based interface for planning garden beds, tracking tasks and harvests, and managing the full lifecycle of a garden season. The app supports multiple users, shared gardens with collaborator permissions, and a tiered feature system that scales from a simple beginner experience to a comprehensive advanced toolkit.

---

## Features

### Core (all users)
- **Visual garden grid** — plan and label plots with custom colors, tile merging, and companion planting warnings
- **Plant library** — 22+ plants with growing guides, difficulty ratings, care schedules, and OpenFarm API fallback for extended lookup
- **Task management** — priority levels, due dates, recurring tasks, collaborator assignment, and tile linking
- **Weather widget** — 5-day forecast via Open-Meteo (no API key required)
- **Frost date alerts** — calculated from two years of historical climate data based on user location

### Standard
- **Harvest & spending tracker** — log yields and expenses with Chart.js visualizations
- **Garden journal** — timestamped diary entries per garden
- **Consolidated calendar** — all tasks across all gardens in a single monthly view
- **Plant care reminders** — automatically generated tasks based on planting date and plant type
- **Photo timeline** — dated photo history per plot

### Advanced
- **Crop rotation tracker** — plant family classification with rotation warnings and multi-year history
- **Succession planting** — staggered sowing plans with automatic calendar task generation
- **Soil amendment log** — track compost, fertilizer, lime, and other inputs per bed
- **Seed inventory** — cross-garden seed tracking with low-stock and expiry alerts
- **Pest & disease log** — severity-rated incident records with treatment and outcome tracking
- **Yield analytics** — multi-view charts including yield per sq ft, by plant, ROI, and monthly timeline

### Collaboration & Messaging
- **Shared gardens** — invite collaborators by email with granular permission levels (view / task / edit)
- **Direct messaging** — 1:1 DMs between garden collaborators
- **Garden group chat** — per-garden group conversation for all collaborators
- **Notifications** — in-app alerts for garden shares, task assignments, and new messages

### Technical
- **Offline support** — Firestore offline persistence + service worker app shell caching
- **PWA** — installable on iOS and Android home screens
- **PDF export** — full garden layout, plot details, and open tasks as a downloadable PDF
- **Three experience modes** — Simple / Standard / Advanced with per-feature toggles

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JavaScript (ES2020), HTML5, CSS3 |
| Backend / Database | Firebase Firestore |
| Authentication | Firebase Auth (Google Sign-In) |
| File Storage | Firebase Storage |
| Weather | Open-Meteo API (free, no key required) |
| Plant Data | Local database + OpenFarm API |
| Charts | Chart.js |
| PDF Generation | jsPDF |
| Offline | Firebase Persistence + Service Worker |
| Hosting | Firebase Hosting / any static host |

---

## Getting Started

### Prerequisites
- A [Firebase](https://console.firebase.google.com) project with Firestore, Authentication, and Storage enabled
- Google Sign-In enabled under Authentication → Sign-in method

### Installation

1. Clone or download this repository
2. Open `index.html` and replace the Firebase config object with your own project's credentials:

```js
firebase.initializeApp({
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
});
```

3. Deploy `firestore.rules` to your Firebase project via the Firebase Console → Firestore → Rules
4. Upload all files to your hosting provider of choice (Firebase Hosting, Netlify, Vercel, or any static file host)

### Firestore Indexes

The following composite indexes are required and must be created manually in Firebase Console → Firestore → Indexes:

| Collection | Field 1 | Field 2 |
|---|---|---|
| `gardens` | `ownerId` (Ascending) | `createdAt` (Descending) |
| `conversations` | `participants` (Arrays) | `lastMessageAt` (Descending) |
| `notifications` | `toUid` (Ascending) | `createdAt` (Descending) |

---

## Project Structure

```
├── index.html              # Application shell and all modal HTML
├── style.css               # Mobile-first stylesheet (~1700 lines)
├── manifest.json           # PWA manifest
├── service-worker.js       # Offline app shell caching
├── firestore.rules         # Firestore security rules
├── icons/
│   ├── icon-192.png        # PWA icon (192×192) — add your own
│   └── icon-512.png        # PWA icon (512×512) — add your own
└── js/
    ├── utils.js            # Shared helpers and constants
    ├── mode.js             # Simple / Standard / Advanced feature flag system
    ├── app.js              # Auth, navigation, global state
    ├── onboarding.js       # First-login flow, frost date fetching, profile sheet
    ├── settings.js         # Garden settings, collaborator management, permissions
    ├── gardens.js          # Garden list, card rendering, create modal
    ├── plant-library.js    # Browsable plant library, care reminder generation
    ├── plants.js           # Plant lookup, OpenFarm API, companion planting logic
    ├── tiles.js            # Grid rendering, tile editing, merge/split, photo timeline
    ├── tasks.js            # Task system, recurring logic, assignment, comments
    ├── calendar.js         # Per-garden and consolidated calendar views
    ├── tracking.js         # Harvest log, spending tracker, Chart.js charts, journal
    ├── weather.js          # Open-Meteo weather integration
    ├── advanced.js         # Crop rotation, succession planting, soil amendment log
    ├── batch4.js           # Seed inventory, pest/disease log, yield analytics
    ├── messaging.js        # DMs, garden group chat, notifications
    └── batch6.js           # Offline wiring, PDF export, keyboard shortcuts, polish
```

---

## Data Model

```
users/{uid}
  └── seeds/{seedId}           # Per-user seed inventory

gardens/{gardenId}
  ├── tiles/{tileId}
  │   └── photos/{photoId}
  ├── tasks/{taskId}
  │   └── comments/{commentId}
  ├── journal/{entryId}
  ├── harvests/{harvestId}
  ├── expenses/{expenseId}
  ├── cropRotation/{recordId}
  ├── successionPlans/{planId}
  ├── soilLogs/{logId}
  └── pestLogs/{logId}

conversations/{convId}          # DMs and garden group chats
  └── messages/{msgId}

notifications/{notifId}         # Per-user in-app notifications
```

---

## Permission Model

| Role | View | Edit Tiles | Edit Tasks | Settings |
|---|---|---|---|---|
| Owner | ✅ | ✅ | ✅ | ✅ |
| Collaborator | ✅ | ✅ | ✅ | ❌ |
| Public (task permission) | ✅ | ❌ | ✅ | ❌ |
| Public (open edit) | ✅ | ✅ | ✅ | ❌ |
| Public (view only) | ✅ | ❌ | ❌ | ❌ |

---

## License

MIT License — free to use, modify, and distribute.

---

*Built with 🌱 for the gardening community.*
