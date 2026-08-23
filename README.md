<div align="center">

# 🧾 Invoice Validate AI & Financial Intelligence Platform

**Enterprise Multi-Agent Invoice Extraction, Fraud Detection, Compliance Auditing & Spend Analytics**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?style=flat&logo=FastAPI&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-16.3+-black.svg?style=flat&logo=next.js&logoColor=white)](https://nextjs.org)
[![LangGraph](https://img.shields.io/badge/LangGraph-0.2+-blue.svg?style=flat&logo=chainlink&logoColor=white)](https://langchain-ai.github.io/langgraph/)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-2.5%20Flash-4285F4.svg?style=flat&logo=google&logoColor=white)](https://ai.google.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-336791.svg?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Multi--Stage-2496ED.svg?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)

</div>

---

## 📖 Table of Contents
1. [Overview](#-overview)
2. [Key Architecture & Capabilities](#-key-architecture--capabilities)
3. [5-Node LangGraph Audit Workflow](#-5-node-langgraph-audit-workflow)
4. [Spend Intelligence & Analytics](#-spend-intelligence--analytics)
5. [Tech Stack](#-tech-stack)
6. [Project Structure](#-project-structure)
7. [Quick Start with Docker Compose](#-quick-start-with-docker-compose-recommended)
8. [Manual Local Installation](#-manual-local-installation)
9. [Environment Variables](#-environment-variables)
10. [Role-Based Access Control (RBAC)](#-role-based-access-control-rbac)
11. [API Documentation](#-api-documentation)

---

## 🌟 Overview

**Invoice Validate AI** is a full-stack, enterprise-grade invoice automation and financial compliance platform. It replaces slow, error-prone manual accounting workflows with an intelligent **5-node LangGraph orchestration pipeline** powered by **Google Gemini 2.5 Flash** vision models.

The system performs multi-modal OCR extraction, verifies itemized mathematical accuracy, validates corporate compliance policies, detects duplicate and split invoice fraud, computes risk scores with confidence ratings, enforces strict **Human-in-the-Loop (HITL)** decision sign-offs, and delivers comprehensive corporate spend analytics.

---

## 🚀 Key Architecture & Capabilities

- 🔍 **Multi-Modal Vision OCR**: Extracts vendor details, invoice numbers, line items, taxes, subtotals, currencies, and payment terms from scanned PDFs and images.
- 🧮 **Deterministic Mathematical Engine**: Validates unit prices, quantities, itemized line totals, subtotal sums, and tax percentage math.
- 🛡️ **Dynamic Compliance Rule Engine**: Enforces corporate expense limits, vendor whitelists/blacklists, category restrictions, and department-specific policies.
- 🕵️ **Multi-Dimensional Anomaly & Fraud Detection**:
  - **Duplicate Invoice Detection**: Flags duplicate invoice numbers and identical line items across previous submissions.
  - **Split Invoice Detection**: Identifies transactions intentionally split below corporate approval thresholds.
  - **Unusual Spending Spikes**: Compares submissions against historical vendor averages and department baseline velocity.
- 🔒 **Human-in-the-Loop Audit Trail & Decision Locking**:
  - Dual status tracking: `ai_status` (algorithmic verdict) and `human_status` (mandatory human approval).
  - Reviewer audit trail recording reviewer name, role, timestamp, and audit notes.
  - **Decision Locking**: Once approved or rejected by a human reviewer, actions are locked; only **Admins** have privileges to undo or override.
- 📊 **Corporate Spend Analysis & Financial Intelligence**:
  - High-level KPIs: Total Approved Spend, Pre-Tax Subtotals, Tax Paid (GST/VAT), Claim Counts, Average Claim Size, and MoM Run-rate.
  - Canonical vendor leaderboard with itemized approved invoice drilldown modals.
  - Department cost allocation & expense category classifications.
- 📑 **Comprehensive Export Suite**: Instant CSV and Excel export with audit details, reviewer notes, and tax records.

---

## 🧠 5-Node LangGraph Audit Workflow

```
[ Upload PDF / Image ]
          │
          ▼
┌────────────────────────────────────────┐
│  Node 1: OCR & Structured Extraction   │  ◄── Gemini 2.5 Flash Vision / PyPDF
└────────────────────────────────────────┘
          │
          ▼
┌────────────────────────────────────────┐
│  Node 2: Deterministic Math Validation │  ◄── Line items sum, Subtotal, Tax, Dates
└────────────────────────────────────────┘
          │
          ▼
┌────────────────────────────────────────┐
│  Node 3: Corporate Policy Engine       │  ◄── Department & Company-wide Rules
└────────────────────────────────────────┘
          │
          ▼
┌────────────────────────────────────────┐
│  Node 4: Fraud & Anomaly Detection     │  ◄── Duplicates, Split Invoices, Spikes
└────────────────────────────────────────┘
          │
          ▼
┌────────────────────────────────────────┐
│  Node 5: Decision Routing & Vector RAG │  ◄── FAISS/Pinecone indexing & Next Steps
└────────────────────────────────────────┘
          │
          ▼
[ Awaiting Mandatory Human Review (Auditor / Finance / Admin) ]
```

---

## 📈 Spend Intelligence & Analytics

The dedicated **Spend Analysis (`/dashboard/analysis`)** module computes metrics strictly from **Approved Invoices** (human approved, or system verified with pending review; human rejections are strictly excluded):

- **Canonical Vendor Normalization**: Automatically merges case and whitespace variations (e.g., `amazon`, `AMAZON`, `  Amazon  ` -> `Amazon`).
- **Interactive Vendor Ledger Drilldown**: Click on any vendor to view all itemized approved claims, submitters, amounts, and dates.
- **Time Horizons**: Toggle between `30 Days`, `90 Days`, `6 Months`, `1 Year`, and `All Time`.
- **Department Cost Allocation**: Visual progress bars showing spend distribution across internal business units.

---

## 🛠️ Tech Stack

### **Backend**
- **Framework**: FastAPI 0.115+ (Python 3.11)
- **AI & Graph Orchestration**: LangChain 0.3+, LangGraph 0.2+, Google GenAI SDK (`gemini-2.5-flash`)
- **Database & ORM**: PostgreSQL 16, SQLAlchemy 2.0, Alembic
- **Vector Stores**: FAISS (local development), Pinecone (cloud production)
- **Authentication**: JWT (JSON Web Tokens), Passlib (Bcrypt)

### **Frontend**
- **Framework**: Next.js 16.3+ (App Router, Turbopack)
- **UI Library**: React 19, Tailwind CSS, Lucide Icons, Radix UI Primitives
- **State Management**: Redux Toolkit
- **Client HTTP**: Axios with JWT interceptors

### **DevOps & Infrastructure**
- **Containerization**: Multi-stage lightweight Dockerfile (<250MB image)
- **Orchestration**: Docker Compose with `postgres:16-alpine` and low-memory tuning

---

## 📁 Project Structure

```
invoice-validate/
├── docker-compose.yml              # Multi-container orchestration (Postgres + Backend)
├── .dockerignore                   # Root docker build exclusions
├── README.md                       # Project documentation
│
├── backend/                        # FastAPI & LangGraph AI Backend
│   ├── Dockerfile                  # Multi-stage lightweight Python 3.11 image
│   ├── requirements.txt            # Python dependencies
│   ├── alembic.ini                 # Database migration config
│   ├── .env.example                # Backend environment template
│   └── app/
│       ├── main.py                 # FastAPI app entry point & CORS
│       ├── config.py               # Pydantic environment settings
│       ├── database.py             # SQLAlchemy session & column migrations
│       ├── models.py               # User, Invoice, LineItem, Anomaly, Policy models
│       ├── authentication.py       # JWT auth & get_current_user dependency
│       ├── ai/                     # AI & LangGraph workflow engine
│       │   ├── llm_factory.py      # Gemini & Ollama model provider factory
│       │   ├── ocr_service.py      # Vision OCR & document parsing
│       │   ├── vector_store.py     # FAISS & Pinecone RAG vector storage
│       │   ├── embeddings.py       # Text embedding generation
│       │   └── graph/              # 5-node LangGraph audit graph
│       │       ├── state.py        # Graph state definitions
│       │       ├── workflow.py     # StateGraph wiring & compilation
│       │       └── nodes.py        # Individual pipeline nodes
│       ├── routes/                 # REST API endpoints
│       │   ├── user_routes.py      # Auth (login, register, me)
│       │   ├── invoice_routes.py   # Upload, inspect, audit decisions, PDF view
│       │   ├── spend_analysis_routes.py # Spend intelligence & vendor breakdown
│       │   ├── dashboard_routes.py # Overview statistics & charts
│       │   ├── policy_routes.py    # Compliance policy CRUD
│       │   └── admin_routers.py    # Admin user management & settings
│       └── schemas/                # Pydantic request/response schemas
│
└── frontend/                       # Next.js 16 Responsive Web Application
    ├── package.json                # Dependencies & scripts
    ├── next.config.ts              # Next.js configuration
    ├── tailwind.config.ts          # Tailwind CSS styling configuration
    └── src/
        ├── app/                    # Next.js App Router pages
        │   ├── page.tsx            # Landing page
        │   ├── login/page.tsx      # User login
        │   ├── register/page.tsx   # User registration
        │   ├── invoice/            # Invoice upload & processing views
        │   └── dashboard/          # Authenticated user dashboard
        │       ├── page.tsx        # Executive analytics dashboard
        │       ├── analysis/       # Corporate spend intelligence page
        │       ├── invoices/       # All invoices & detailed audit inspection
        │       ├── export/         # CSV & Excel ledger export
        │       └── compliance/     # Policy management workspace
        ├── components/             # Reusable UI components & dialogs
        ├── store/                  # Redux Toolkit auth slice & Axios instance
        └── lib/                    # Utilities, formatters, and helpers
```

---

## 🐳 Quick Start with Docker Compose (Recommended)

### 1. Clone the Repository
```bash
git clone https://github.com/rohitp-18/invoice-analyze.git
cd invoice-validate
```

### 2. Configure Backend Environment
```bash
cp backend/.env.example backend/.env
```
Edit `backend/.env` and insert your **Google Gemini API Key**:
```env
GEMINI_API_KEY=your_actual_gemini_api_key
```

### 3. Launch the Stack
```bash
docker-compose up -d --build
```

### 4. Verify Services
- **Backend API & Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **PostgreSQL Database**: Port `5432`

---

## 💻 Manual Local Installation

### 1. Backend Setup

```bash
cd backend

# Create and activate Python virtual environment
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env

# Run FastAPI server with auto-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend Setup

```bash
cd frontend

# Install Node dependencies
npm install

# Start Next.js development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## ⚙️ Environment Variables

| Variable | Description | Default |
|---|---|---|
| `ENVIRONMENT` | Runtime environment (`development`, `production`) | `development` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/invoices` |
| `SECRET_KEY` | JWT signing secret | `super-secret-key...` |
| `LLM_PROVIDER` | AI provider (`gemini`, `ollama`) | `gemini` |
| `GEMINI_API_KEY` | Google Gemini API Key | *(Required for OCR & AI)* |
| `GEMINI_MODEL` | Gemini text/reasoning model | `gemini-2.5-flash` |
| `GEMINI_VISION_MODEL` | Gemini vision model | `gemini-2.5-flash` |
| `VECTOR_STORE_PROVIDER` | Vector store provider (`auto`, `faiss`, `pinecone`) | `auto` |
| `FAISS_INDEX_DIR` | Local FAISS index storage directory | `./data/faiss_index` |
| `OCR_ENGINE` | Document OCR mode (`gemini_vision`, `text_extractor`) | `gemini_vision` |

---

## 👥 Role-Based Access Control (RBAC)

The platform enforces strict enterprise roles:

- **`ADMIN` / `SUPERADMIN`**: Full platform control, user management, policy creation, audit overrides, and decision undo authority.
- **`FINANCE`**: Corporate spend review, ledger export, invoice approval/rejection sign-off.
- **`AUDITOR` / `COMPLIANCE`**: Anomaly investigation, risk analysis, compliance policy auditing, invoice sign-off.
- **`MANAGER`**: Departmental invoice oversight and claim review.
- **`EMPLOYEE`**: Invoice submission, status tracking, personal claim ledger.

---

## 📚 API Documentation

Once the backend is running, visit:
- **Interactive Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc Alternative UI**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

### Primary API Routes:
- `POST /auth/register` & `POST /auth/login` — Authentication & JWT issue
- `POST /invoice/upload-and-process` — Multi-agent OCR & 5-node audit execution
- `GET /invoice/{id}` — Itemized line items, anomalies, and audit trail
- `POST /invoice/{id}/decision` — Human-in-the-loop approval, rejection, or admin undo
- `GET /api/v1/spend-analysis/all` — Multi-dimensional corporate spend intelligence
- `GET /api/v1/spend-analysis/vendors` — Normalized vendor ranking
- `GET /api/v1/spend-analysis/vendor/{vendor_name}/invoices` — Itemized vendor ledger
- `GET /dashboard/stats` — Executive KPIs and recent activity

---

## 📄 License
This project is licensed under the MIT License.
