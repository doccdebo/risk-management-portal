# TFS Risk Dashboard — Setup & Usage Guide

A TFS/Azure DevOps–style dashboard for creating, tracking and exporting
security **Risk** work items, with role-based access (Developer / Security
Engineer), an Admin console for onboarding business units, and a
Projects → Services → Timelines risk browser.

- **Backend:** Python (FastAPI) — `api/`
- **Frontend:** React + Vite — `client/`

---

## 1. Prerequisites

- **Python 3.10+** (tested with 3.13) available as `py` or `python`
- **Node.js 18+** and `npm`
- Windows PowerShell (commands below use PowerShell syntax)

---

## 2. First-time setup

### 2.1 Backend (`api/`)

```powershell
cd api
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

This installs FastAPI, SQLAlchemy, Pydantic, openpyxl, reportlab, Jinja2,
`requests` + `requests-ntlm` (for the optional real TFS credential check).

### 2.2 Frontend (`client/`)

```powershell
cd client
npm install
```

---

## 3. Running the app

You need **two terminals** running at the same time (backend + frontend).

### 3.1 Start the backend API (port 8000)

```powershell
cd api
.\.venv\Scripts\python.exe -m uvicorn main:app --port 8000
```

> ⚠️ **Do not add `--reload`.** The auto-reloader watches the whole `api/`
> folder including `.venv/`, `data/` (the SQLite file) and `storage/`
> (uploaded attachments), which causes it to restart the server on every
> database write or file upload. Just restart the command manually after
> changing backend code.

On first run this creates:
- `api/data/risks.db` — SQLite database (risks, comments, attachments, business units)
- `api/storage/attachments/` — uploaded evidence files, one folder per risk id

### 3.2 Start the frontend dev server (port 5173)

```powershell
cd client
npm run dev
```

Vite proxies all `/api/*` requests to `http://localhost:8000` (see
`client/vite.config.js`), so you only need to open the frontend URL:

```
http://localhost:5173/
```

---

## 4. Using the app

### 4.1 Sign in

The main dashboard requires sign-in with an IAM/DOMAIN username and password.

- **Right now, any non-empty username/password is accepted** (real TFS
  verification is temporarily bypassed for local use without VPN/TFS
  access). See [section 6](#6-enabling-real-tfs-authentication-optional)
  to turn on real verification.
- After signing in, choose your role for the session:
  - **Security Engineer** — full access: create/edit/delete risks, manage
    attachments, post comments, and set **Postponed Accepted** once a
    postponement has been reviewed.
  - **Developer** — read-only on all risk fields except **Rationale and
    Actions**. Developers can set a risk to **Postponed**, but a rationale
    is required before it can be saved; they can also post **Comments**.

### 4.2 Boards (Risks list)

- **+ New Risk** (Security Engineer only) opens the risk work-item form.
  - **Summary** tab: Detection, Scoring (Likelihood/Impact/Initial Risk —
    auto-calculated), Vulnerability, Threat, and Quantitative Impact fields.
  - **Comments** tab: enter your name + role once (remembered), then post
    comments visible to the whole team.
  - **Attachments** tab: drag-and-drop images/videos/documents (up to
    200MB each) — works even before the risk is saved; files upload
    automatically once you hit Save.
- Click any row to open/edit a risk.
- **Export** button (top right) downloads all risks as HTML, PDF, CSV or
  Excel.

### 4.3 Projects (Project → Service → Timeline browser)

- Click **Projects** in the left nav.
- Expand a project → service → timeline to see risks reported against that
  exact service/timeline combination.
- Each timeline has its own scoped **Export** button (HTML/PDF/CSV/Excel)
  for just those risks.
- Services, timelines and users shown here come from BUs onboarded in the
  **Admin Console** (see below) — before onboarding anything, this page
  will say no projects exist yet.

### 4.4 Admin Console — onboarding a Business Unit (BU)

Go to: **`http://localhost:5173/admin`**

- Sign in with `admin` / `admin` (default; see below to change it).
- Fill in **Project Name**, **Service Name**, **Time Line**, and add one or
  more **Users**, then click **Onboard**.
  - Onboarding the same Service + Time Line again updates that entry
    (upsert) instead of duplicating it.
  - A single service can have multiple onboarded time lines (onboard it
    twice with a different Time Line each time).
- Onboarded data immediately powers the main app's risk form:
  - **Service** dropdown = all onboarded service names.
  - Picking a Service filters **Time Line** and **Assigned To** to that
    service's onboarded time lines/users.
- To change the admin credentials, set environment variables before
  starting the backend:
  ```powershell
  $env:RISK_DASHBOARD_ADMIN_USERNAME = "myadmin"
  $env:RISK_DASHBOARD_ADMIN_PASSWORD = "my-strong-password"
  .\.venv\Scripts\python.exe -m uvicorn main:app --port 8000
  ```

---

## 5. Resetting data

Everything is stored locally in SQLite. To wipe all risks, comments,
attachments and onboarded BUs and start fresh:

```powershell
# stop the backend first (Ctrl+C), then:
Remove-Item "api\data\risks.db" -Force -ErrorAction SilentlyContinue
Remove-Item "api\storage\attachments\*" -Recurse -Force -ErrorAction SilentlyContinue
# restart the backend — it recreates the schema automatically
```

Sessions (login tokens/roles) are kept in memory only, so restarting the
backend also signs everyone out.

---

## 6. Enabling real TFS authentication (optional)

By default, sign-in accepts any username/password. To require a real TFS
username/password (validated via NTLM against a live TFS server):

```powershell
$env:RISK_DASHBOARD_REQUIRE_TFS_AUTH = "1"
$env:TFS_BASE_URL = "https://<your-tfs-server>/tfs/<Collection>/<Project>"
.\.venv\Scripts\python.exe -m uvicorn main:app --port 8000
```

With this enabled, login calls `GET {TFS_BASE_URL}/_apis/connectionData`
using the entered credentials over NTLM; a `200` response means valid
credentials, anything else is rejected.

---

## 7. Project structure

```
tfs_automation/
├── api/                     # FastAPI backend
│   ├── main.py              # all HTTP routes
│   ├── auth.py               # NTLM login, sessions, admin auth
│   ├── models.py             # SQLAlchemy models (Risk, Comment, Attachment, BusinessUnit)
│   ├── schemas.py            # Pydantic request/response schemas
│   ├── crud.py                # create/update logic + computed fields
│   ├── risk_fields.py         # dropdown enums + scoring calculations
│   ├── export_utils.py        # CSV / Excel / HTML / PDF export
│   ├── templates/              # Jinja2 HTML export template
│   ├── data/risks.db            # SQLite database (created at runtime)
│   ├── storage/attachments/     # uploaded evidence files (created at runtime)
│   └── requirements.txt
└── client/                   # React + Vite frontend
    ├── src/
    │   ├── App.jsx             # main dashboard shell (Boards/Projects views)
    │   ├── main.jsx            # routes "/" -> App, "/admin" -> AdminPage
    │   ├── api/                # risksApi.js, adminApi.js (fetch wrappers)
    │   └── components/
    │       ├── LoginPage.jsx / RoleSelect.jsx   # Philips-branded auth screens
    │       ├── TopBar.jsx / SideNav.jsx
    │       ├── RiskGrid.jsx / RiskForm.jsx      # risk list + work-item form
    │       ├── ProjectsView.jsx                 # Project/Service/Timeline browser
    │       ├── ExportMenu.jsx
    │       └── AdminPage.jsx                    # BU onboarding console
    └── vite.config.js          # dev server + /api proxy to port 8000
```
