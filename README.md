# LABLINK — The Intelligent Laboratory Resource Network

> **A GenAI-Powered Campus Research & Laboratory Resource Allocation Platform with FAIRALLOC™**

[![Tests](https://img.shields.io/badge/tests-44%20passed-brightgreen.svg)]()
[![Gemini](https://img.shields.io/badge/Gemini%20API-%40google%2Fgenai-blue.svg)]()
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
│ 3. LABLINK IoT INTELLIGENCE                  │ │ 4. LABLINK CALENDAR CONNECT              │
│    • Hardware Telemetry Simulation           │ │    • Instant Google Calendar Integration │
│    • Monitored nodes: CS, ECE, Mech, Robo    │ │    • RFC 5545 Compliant .ics Export      │
│    • Real-time temp, watts, utilization      │ │    • Strict Asia/Kolkata Timezone        │
│    • Rule-based threshold alerts (overheat)  │ │    • Status Gating: Only approved/       │
│    • Emergency maintenance booking lockout   │ │      confirmed bookings can export       │
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

### 4. LABLINK Calendar Connect
- One-click "Add to Google Calendar" with pre-filled laboratory, equipment, and reference details.
- Downloadable standard `.ics` calendar events with CRLF line endings, special character escaping, and `Asia/Kolkata` timezone.
- State-gated: only confirmed reservations can export calendar events.

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
Create `.env` in the root or server directory:
```env
PORT=8080
NODE_ENV=production

# Optional Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

### 3. Run Tests
The comprehensive pre-deployment test suite runs 44 automated tests in under 1 second:
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
| **All 44 Tests** | ✅ PASSED | 35 Core/IoT/Calendar tests + 9 Gemini resilience tests |
| **Production Build** | ✅ PASSED | Vite client build in 762ms |
| **Gemini Integration** | ✅ PASSED | Official `@google/genai`, strict grounding, 10s timeout, PII redaction |
| **Zero Hallucination** | ✅ PASSED | Real catalogue validation; rogue IDs filtered |
| **Deterministic Fallback** | ✅ PASSED | Seamless transition when offline or unconfigured |
| **Cloud Run Readiness** | ✅ PASSED | Dynamic `$PORT`, `/health` endpoint, Docker multi-stage |
