# LABLINK — The Intelligent Laboratory Resource Network

> **A GenAI-Powered Campus Research & Laboratory Resource Allocation Platform with FAIRALLOC™**

[![Tests](https://img.shields.io/badge/tests-57%20passed-brightgreen.svg)]()
[![Gemini](https://img.shields.io/badge/Gemini%20API-%40google%2Fgenai-blue.svg)]()
[![OAuth 2.0](https://img.shields.io/badge/Google%20Calendar-OAuth%202.0%20Sync-green.svg)]()
[![Encryption](https://img.shields.io/badge/Token%20Security-AES--256--GCM-red.svg)]()
[![Timezone](https://img.shields.io/badge/Timezone-Asia%2FKolkata-teal.svg)]()
[![Container](https://img.shields.io/badge/Container-Cloud%20Run%20Ready-blueviolet.svg)]()

---

## 🌟 Architecture Overview

LabLink is a campus research laboratory resource ecosystem designed to maximize equipment access, prevent scheduling bottlenecks, eliminate resource hoarding, and fairly allocate high-value university instrumentation.

```
                    ┌────────────────────────────────────────────────────────┐
                    │               STUDENT / RESEARCHER REQUEST              │
                    │      "Characterize 500 kHz GaN switching transients"   │
                    └───────────────────────────┬────────────────────────────┘
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. INTELLIGENT PROJECT EXTRACTION & CATALOGUE GROUNDING                                     │
│    • Live Google Gemini Flash API (@google/genai SDK) with Strict Institutional Grounding   │
│    • Automatic Fallback: Deterministic Rule Extractor (Runs seamlessly when offline)       │
│    • Extracts: Bandwidth, Magnification, VRAM, Repeatability, Session Duration, Deadlines   │
│    • Grounding Rule: Zero hallucination. Matches only against verified campus catalogue.   │
│    • Separates operational machines from instruments currently under maintenance.           │
└───────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                                │ Verified Matches & Specs
                                                ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 2. FAIRALLOC™ MULTI-FACTOR CONSTRAINT & ALLOCATION ENGINE                                    │
│    • Pure Deterministic Authority over slot allocation, conflict detection & priority.      │
│    • Factors:                                                                               │
│      1. Academic Tier Weight (Capstone, Master's Thesis, PhD Research, Independent)         │
│      2. Milestone Urgency (Non-linear decay towards deliverable deadline)                   │
│      3. Historical Fairness Penalty (Balances resources away from heavy past users)        │
│      4. Faculty Endorsement Boost (Validated necessity by laboratory custodian)             │
│    • Non-overlapping interval math with buffer times & operating hour validation.           │
│    • Automatic Feasible Alternative Slot Finder for zero-frustration rescheduling.          │
└───────────────────────────────────────────────┬─────────────────────────────────────────────┘
                        ┌───────────────────────┴───────────────────────┐
                        ▼                                               ▼
┌──────────────────────────────────────────────┐ ┌──────────────────────────────────────────┐
│ 3. LABLINK IoT INTELLIGENCE                  │ │ 4. REAL GOOGLE CALENDAR SYNC (OAUTH 2.0) │
│    • Hardware Telemetry Simulation           │ │    • Official googleapis OAuth2 client   │
│    • Monitored nodes: CS, ECE, Mech, Robo    │ │    • AES-256-GCM authenticated token vault│
│    • Real-time temp, watts, utilization      │ │    • Zero plaintext tokens on disk/memory│
│    • Rule-based threshold alerts (overheat)  │ │    • Bidirectional push/incremental sync │
│    • Emergency maintenance booking lockout   │ │    • External tamper & conflict detection│
└──────────────────────────────────────────────┘ └──────────────────────────────────────────┘
```

---

## 🚀 Key Modules & Engineering Implementations

### 1. Live Google Gemini API Integration (`@google/genai`)
- **Official SDK:** Built using Google's `@google/genai` JavaScript SDK.
- **Configurable Model:** Governed by `GEMINI_MODEL` (defaults to `gemini-2.5-flash`).
- **Structured JSON Schema:** Defensive schema validation with fallback to markdown-resilient parsing.
- **Catalogue Grounding:** Passes real equipment metadata (`eq_1` through `eq_8`) directly into the prompt. Models are strictly forbidden from inventing equipment IDs. Any unrecognized ID is filtered out before reaching users.
- **Unavailable Equipment Handling:** Instruments in `maintenance` state (e.g. Instron 5969) are flagged and segregated from active recommendations.
- **Dual-Mode Fallback:** If `GEMINI_API_KEY` is not present, or if an API call times out (>10s), encounters rate limits (429), or fails authentication (401), LabLink seamlessly falls back to the deterministic rule engine with zero downtime.
- **Security & Privacy:** Server-side only; inputs sanitized to 4000 characters; email, phone, and student ID sequences redacted before API transit.

### 2. FAIRALLOC™ Explainable Engine
- **Deterministic Math:** AI suggests; FAIRALLOC approves.
- **Multi-Factor Score ($0 - 100$):**
  $$\text{Score} = w_{\text{tier}} \cdot S_{\text{tier}} + w_{\text{urgency}} \cdot S_{\text{urgency}} - w_{\text{fairness}} \cdot P_{\text{prior}} + S_{\text{endorsement}}$$
- **Feasible Alternative Generator:** Automatically computes next available conflict-free slots on conflict.

### 3. LABLINK IoT Intelligence
- Simulated telemetry across 4 engineering departments.
- Rule-based threshold alerts (e.g. Oscilloscope thermal warning > 65°C).
- Bidirectional maintenance integration: placing a machine under maintenance locks out new bookings and flags existing reservations.

### 4. LABLINK Calendar Connect & Real Google Calendar Sync
- **Official Google OAuth 2.0:** Built with the official `googleapis` Node.js client (`google.auth.OAuth2`).
- **AES-256-GCM Encrypted Token Vault:** Tokens are encrypted with authenticated AES-256-GCM (`iv:tag:cipher`) before persisting to disk. Plaintext credentials never exist in storage, logs, or frontend code.
- **Strict User Isolation:** OAuth credentials, sync tokens, and event mappings are strictly keyed by internal LabLink `userId`. Student A can never access or sync Student B's calendar.
- **Deterministic Sync Authority:** LabLink and FAIRALLOC remain the sole authority over reservations. If an external user moves or alters an event on Google Calendar, LabLink detects the tamper, logs an actionable discrepancy, and leaves the official reservation untouched.
- **Bidirectional Lifecycle Sync:** Approved bookings are automatically inserted into Google Calendar; cancelled bookings are automatically removed.
- **Incremental Sync with Auto-Recovery:** Uses Google Calendar `syncToken` pagination. Handles HTTP 410 (Gone / Expired Sync Token) by automatically purging stale tokens and resynchronizing cleanly.
- **Push Notifications & Polling:** Supports Google Calendar `events.watch` webhooks with HMAC verification and a graceful manual/polling fallback.
- **Standard Exports:** Downloadable standard `.ics` calendar events and Google Calendar quick-add URLs with `Asia/Kolkata` timezone.

---

## 📦 Getting Started

### Prerequisites
- Node.js 18+ (tested on Node 20 / 22)
- npm

### 1. Install Dependencies
```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Environment Configuration
Create `.env` in the root or server directory (see `.env.example` for full reference):
```env
PORT=8080
NODE_ENV=production

# Gemini AI Integration
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# Google Calendar OAuth 2.0 Integration
GOOGLE_CLIENT_ID=your_oauth_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_oauth_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8080/api/calendar/oauth/callback

# Token Vault & Security
CALENDAR_ENCRYPTION_KEY=64_character_hex_or_passphrase_for_aes_256_gcm
OAUTH_STATE_SECRET=random_secret_for_csrf_state_signing
STORAGE_BACKEND=vault
```

### 3. Run Tests
The comprehensive pre-deployment test suite runs 57 automated tests across 15 suites in under 1 second:
```bash
cd server
npm test
```

### 4. Standalone Gemini API Smoke Test
To verify live Gemini API connectivity with your API key:
```bash
# Windows PowerShell:
$env:GEMINI_API_KEY="your_api_key"; node server/scripts/smokeTestGemini.js

# Linux / macOS:
GEMINI_API_KEY="your_api_key" node server/scripts/smokeTestGemini.js
```

### 5. Production Build & Run
```bash
# Build client
cd client
npm run build

# Start server
cd ../server
npm start
```
Access the application at `http://localhost:8080`.

---

## ☁️ Cloud Run & Docker Deployment

A multi-stage `Dockerfile` is provided for Google Cloud Run:
```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/lablink
gcloud run deploy lablink \
  --image gcr.io/PROJECT_ID/lablink \
  --platform managed \
  --port 8080 \
  --set-env-vars GEMINI_MODEL=gemini-2.5-flash \
  --update-secrets GEMINI_API_KEY=lablink-gemini-key:latest
```

---

## 🛡️ Pre-Deployment Verification Summary

| Category | Status | Details |
| :--- | :---: | :--- |
| **All 57 Tests** | ✅ PASSED | 35 Core/IoT/Calendar tests + 9 Gemini tests + 13 OAuth & Bidirectional Sync tests |
| **Production Build** | ✅ PASSED | Vite client build in 762ms |
| **Gemini Integration** | ✅ PASSED | Official `@google/genai`, strict grounding, 10s timeout, PII redaction |
| **OAuth 2.0 & Token Vault** | ✅ PASSED | AES-256-GCM encrypted vault, CSRF signed state, user isolation |
| **Bidirectional Sync** | ✅ PASSED | Lifecycle sync, syncToken incremental updates, 410 auto-recovery, tamper detection |
| **Zero Hallucination** | ✅ PASSED | Real catalogue validation; rogue IDs filtered |
| **Deterministic Fallback** | ✅ PASSED | Seamless transition when offline or unconfigured |
| **Cloud Run Readiness** | ✅ PASSED | Dynamic `$PORT`, `/health` endpoint, Docker multi-stage |
