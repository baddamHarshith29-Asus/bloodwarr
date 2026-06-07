# BloodMind — Autonomous Blood Coordination Network

AI-powered blood support network for **Blood Warriors** hackathon. Connects voluntary blood donors with Thalassemia patients across India.

## Quick Start

### 1. Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8095
```

API docs: http://localhost:8095/docs

On first start, the app auto-seeds SQLite from `Dataset.csv` and runs the daily prediction service.

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173

## UI Modules

- **Dashboard** — KPIs, upcoming predictions, critical alerts
- **Request Center** — All blood requests (Pending / Matched / Critical / Fulfilled)
- **Patient Management** — CRUD patients with transfusion gap tracking
- **Donor Management** — 4,442 donor profiles with language/channel/response rate
- **Prediction Center** — Daily prediction service, auto-request within 3 days
- **Donor Matching** — Top 5 ranked donors per request, no double-assignment
- **Outreach Studio** — AI messages (SMS/Email/WhatsApp), responses, escalation

## Features

| Feature | Description | AWS Target |
|---------|-------------|------------|
| **Transfusion Cycle Predictor** | Daily run for all patients, auto Pending requests | SageMaker + EventBridge |
| **Smart Donor Matching** | Score + rank top 5, lock busy donors | SageMaker Ranking |
| **AI Outreach & Escalation** | Personalized messages, round-based escalation | Bedrock + SNS/SES |

## Dataset

- **7,033 records** from Blood Warriors
- 4,529 donors (Emergency + Bridge + Volunteer)
- 80 blood bridges
- Blood groups, transfusion cycles, eligibility, engagement metrics

## API Endpoints (v2)

- `GET /api/v1/dashboard/v2` — Live dashboard with predictions
- `GET/POST /api/v1/patients` — Patient management
- `GET /api/v1/donors/v2` — Donor profiles from DB
- `POST /api/v1/predictions/run` — Run daily prediction for all patients
- `GET /api/v1/predictions/upcoming` — Upcoming transfusion forecasts
- `GET/POST /api/v1/requests` — Blood request center
- `POST /api/v1/requests/{id}/match` — Top 5 donor matching
- `POST /api/v1/requests/{id}/outreach` — Send AI notifications
- `POST /api/v1/requests/{id}/escalate` — Escalate to next donor round
- `POST /api/v1/notifications/{id}/respond` — Record donor response

## Architecture

```
React UI → FastAPI → CSV Dataset (MVP)
                  ↓
         [AWS Integration Layer]
    Bedrock | SageMaker | DynamoDB | EventBridge
```

## Team

Built for Blood Warriors AI Hackathon 2025.
