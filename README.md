# Mattwork — Post-Production Management Platform

Mattwork is an enterprise-grade post-production SaaS application designed to automate project intake, file organization, editor collaboration, invoicing, client payments, and real-time business financial reporting.

---

## Project Architecture Overview

```
                          ┌───────────────────────┐
                          │   Google Forms / App  │
                          │   Script (Submission) │
                          └───────────┬───────────┘
                                      │
                                      ▼ POST (Webhook API)
┌───────────────────────────────────────────────────────────────────────────┐
│ Mattwork Backend (Express, Node.js, Prisma, PostgreSQL)                   │
│                                                                           │
│  ┌──────────────────────┐  ┌───────────────────────┐  ┌────────────────┐  │
│  │  Webhook Intake      │  │  Google Drive Service │  │  Sheets Sync   │  │
│  │  Controller          ├─▶│  (Auto Folder/Assets) │─▶│  Service       │  │
│  └──────────────────────┘  └───────────────────────┘  └────────────────┘  │
│             │                                                             │
│             ▼                                                             │
│  ┌──────────────────────┐  ┌───────────────────────┐  ┌────────────────┐  │
│  │  Projects Service    │  │  Invoices & Payments  │  │  Notifications │  │
│  │  (Workflow State)    │  │  Controller           │  │  Service       │  │
│  └──────────────────────┘  └───────────────────────┘  └────────────────┘  │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      ▲ REST API
┌─────────────────────────────────────┴─────────────────────────────────────┐
│ Mattwork Frontend (Next.js App Router, TailwindCSS, React Query, Zustand)  │
│                                                                           │
│  ┌──────────────────────┐  ┌───────────────────────┐  ┌────────────────┐  │
│  │  Admin Portal        │  │  Editor Portal        │  │  Client Portal │  │
│  │  - Kanban Board      │  │  - Active Workspace   │  │  - Deliverable │  │
│  │  - Financial Dashboard│  │  - Invoice Claims    │  │    Revisions   │  │
│  └──────────────────────┘  └───────────────────────┘  └────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
```

The system is split into two independent modules:
- **`server`**: Built with Express 5, TypeScript, Prisma ORM, Winston Logger, and PostgreSQL. Integrates directly with the official Google Drive and Google Sheets APIs.
- **`client`**: Next.js 16 (App Router), TailwindCSS, TanStack React Query, and Zustand state store. Styled using clean dark aesthetics, smooth micro-animations, and consistent visual layouts.

---

## Directory Structure

```
mattwork/
├── client/           # Next.js frontend application
├── server/           # Express API backend application
│   ├── prisma/       # Database schemas, migrations, and seeds
│   └── src/          # API source code (modules, services, config)
└── README.md         # Root documentation (this file)
```

---

## Environment Variables Reference

### Backend (`server/.env`)

| Variable | Description | Default / Example |
|---|---|---|
| `NODE_ENV` | Application environment state | `development` (use `production` in prod) |
| `PORT` | Local server port | `5000` |
| `DATABASE_URL` | Connection string for PostgreSQL | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Secret token used to sign access tokens | `change-this-in-production-to-32-chars` |
| `JWT_REFRESH_SECRET` | Secret token used to sign refresh tokens | `change-this-in-production-to-32-chars` |
| `JWT_EXPIRES_IN` | Token expiration timeframe | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifespan | `7d` |
| `CORS_ORIGIN` | Allowed Client CORS origin | `http://localhost:3000` |
| `GOOGLE_FORMS_WEBHOOK_SECRET` | Security verification token for webhook | `mattwork_default_google_forms_secret_2026` |
| `GOOGLE_DRIVE_ENABLED` | Toggles real Drive API (vs simulated mock) | `false` |
| `GOOGLE_DRIVE_FOLDER_ID` | Shared root Google Drive folder ID | `1A2B3C4D5E6F7G8H9I0J` |
| `GOOGLE_CLIENT_EMAIL` | Google Cloud Service Account email | `service-account@iam.gserviceaccount.com` |
| `GOOGLE_PRIVATE_KEY` | Google Service Account Private Key | `"-----BEGIN PRIVATE KEY-----\n...\n"` |
| `GOOGLE_SHEETS_ENABLED` | Toggles real Sheets API (vs simulated mock) | `false` |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Spreadsheet ID for project synchronization | `your-google-spreadsheet-id-here` |
| `GOOGLE_SHEETS_SHEET_NAME` | Worksheet tab name | `Projects` |

### Frontend (`client/.env.local`)

| Variable | Description | Default / Example |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Base API address pointing to backend server | `http://localhost:5000/api/v1` |

---

## Installation & Setup

### Prerequisites
- Node.js 20+
- PostgreSQL database instance

### 1. Database & Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd server
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Copy environment placeholders and configure:
   ```bash
   cp .env.example .env
   ```
4. Run Prisma database migrations to create the schemas:
   ```bash
   npx prisma db push
   ```
5. Seed the database with default administrator credentials (`admin@mattwork.com` / `Admin@123456`) and mock projects:
   ```bash
   npm run seed
   ```
6. Start the backend developer server:
   ```bash
   npm run dev
   ```

### 2. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../client
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Start the Next.js developer server:
   ```bash
   npm run dev
   ```
4. Access the platform in your browser at `http://localhost:3000`.

---

## Production Build & Verification

Before deploying, verify that both applications build successfully without TypeScript or compile errors.

### Backend Verification
```bash
cd server
npm run build
```
This runs `tsc` and outputs compiled JavaScript to the `dist/` directory.

### Frontend Verification
```bash
cd client
npm run build
```
This builds and optimizes the Next.js static and dynamic page routes.

---

## Deployment Instructions

### Frontend (Vercel)
1. Sign in to your [Vercel account](https://vercel.com/) and click **Add New Project**.
2. Link your Git repository and select the `client` subdirectory as the root directory.
3. Configure the build commands:
   - **Build Command:** `next build`
   - **Output Directory:** `.next`
   - **Install Command:** `npm install`
4. Add the following Environment Variable:
   - `NEXT_PUBLIC_API_URL` = `https://your-backend-domain.com/api/v1`
5. Click **Deploy**.

### Backend (Render / AWS)
1. Sign in to your [Render account](https://render.com/) and create a **Web Service**.
2. Link your Git repository and select the `server` subdirectory.
3. Configure settings:
   - **Runtime:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
4. Add all required production environment variables (e.g. `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_DRIVE_ENABLED=true`, etc.) under the Environment section.
5. Create a PostgreSQL Database on Render (or AWS RDS) and paste the connection string into the `DATABASE_URL` field.
6. Trigger the deployment. The Prisma schema will automatically sync during start or via a build step.
