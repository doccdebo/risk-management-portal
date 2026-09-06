# Risk Management Portal

A Philips-branded security risk management portal inspired by Azure DevOps/TFS work items. It supports risk creation and scoring, role-based workflows, evidence attachments, comments, exports, Business Unit onboarding, and a project/service/timeline risk browser.

## Technology

- Frontend: React and Vite
- Backend: Python, FastAPI, SQLAlchemy, and SQLite
- Exports: CSV, Excel, HTML, and PDF

## Quick Start

### Prerequisites

- Windows PowerShell
- Python 3.10 or later
- Node.js 18 or later

From the project root, run:

```powershell
.\script.ps1
```

The launcher creates `api/.venv` when required, installs Python and npm dependencies, starts the API on port `8000`, and runs the frontend on port `5173`.

Open [http://localhost:5173/](http://localhost:5173/) in a browser.

If local script execution is blocked for the current PowerShell session:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\script.ps1
```

## Manual Start

Use two PowerShell terminals.

```powershell
# Terminal 1: backend
cd api
.\.venv\Scripts\python.exe -m uvicorn main:app --port 8000
```

```powershell
# Terminal 2: frontend
cd client
npm install
npm run dev
```

Do not run Uvicorn with `--reload`: local SQLite writes and attachment uploads can repeatedly trigger reloads.

## Sign In and Roles

For local use, the portal accepts any non-empty user name and password. After signing in, select a role.

| Role | Permissions |
| --- | --- |
| Security Engineer | Create, edit, delete, attach evidence, comment, export, and set `Postponed Accepted`. |
| Developer | Read risk details, comment, provide Rationale and Actions, and request `Postponed`. |

A Developer must supply **Rationale and Actions** before a risk can move to `Postponed`. Only a Security Engineer can set `Postponed Accepted`.

## Admin Console

Open [http://localhost:5173/admin](http://localhost:5173/admin) to onboard Business Units.

Default admin credentials:

```text
Username: admin
Password: admin
```

Business Unit onboarding defines the project, service, timeline, and assignable users that appear in risk creation. Existing entries can be edited or deleted.

To customize admin credentials, set these environment variables before starting the backend:

```powershell
$env:RISK_DASHBOARD_ADMIN_USERNAME = "myadmin"
$env:RISK_DASHBOARD_ADMIN_PASSWORD = "my-strong-password"
```

## Main Workflows

- **Boards**: Create, view, edit, filter, delete, and export risks.
- **Projects**: Browse risks by Project, Service, and Timeline, with scoped exports.
- **Risk form**: Capture detection details, vulnerability and threat scores, quantitative impact, rationale, comments, and attachments.
- **Attachments**: Images, videos, and documents up to 200 MB are supported. Files selected for a new risk are uploaded after it is saved.
- **Exports**: Download risks as CSV, Excel, HTML, or PDF.

## Project Structure

```text
api/                  FastAPI application
  main.py             API routes
  auth.py             login sessions and optional TFS NTLM validation
  models.py           SQLite models
  risk_fields.py      dropdown values and scoring calculations
  export_utils.py     export generation
client/               React and Vite application
  src/components/     portal screens and reusable UI
script.ps1            dependency installer and application launcher
SETUP.md              detailed operational setup guide
```

## Local Data

Runtime data is not committed to Git:

- `api/data/risks.db`: SQLite risks, comments, attachments, and Business Units
- `api/storage/attachments/`: uploaded evidence files

To reset the local application, stop the backend and remove these files:

```powershell
Remove-Item "api\data\risks.db" -Force -ErrorAction SilentlyContinue
Remove-Item "api\storage\attachments\*" -Recurse -Force -ErrorAction SilentlyContinue
```

Start the backend again to recreate the database schema.

## Optional TFS Authentication

Local login bypasses real TFS verification by default. To validate credentials over NTLM against a TFS server, set:

```powershell
$env:RISK_DASHBOARD_REQUIRE_TFS_AUTH = "1"
$env:TFS_BASE_URL = "https://<your-tfs-server>/tfs/<Collection>/<Project>"
```

See [SETUP.md](SETUP.md) for expanded setup and operating instructions.