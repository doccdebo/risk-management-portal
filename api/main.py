import os
import uuid
from pathlib import Path

from fastapi import FastAPI, Depends, Header, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

import auth
import crud
import models
import risk_fields as rf
from database import Base, engine, get_db
from schemas import (
    RiskCreate, RiskUpdate, RiskOut, CommentCreate, CommentOut,
    BusinessUnitCreate, BusinessUnitOut,
)
from export_utils import to_csv, to_excel_bytes, to_html, to_pdf_bytes

BASE_DIR = Path(__file__).parent
STORAGE_DIR = BASE_DIR / "storage" / "attachments"
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="TFS Risk Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_UPLOAD_BYTES = 200 * 1024 * 1024  # 200MB, generous enough for video evidence
BLOCKED_EXTENSIONS = {".exe", ".bat", ".cmd", ".sh", ".msi", ".dll", ".com", ".ps1", ".vbs", ".js"}


def get_risk_or_404(db: Session, risk_id: int) -> models.Risk:
    risk = db.query(models.Risk).filter(models.Risk.id == risk_id).first()
    if not risk:
        raise HTTPException(status_code=404, detail="Risk not found")
    return risk


def get_current_session(authorization: str | None = Header(default=None)) -> dict:
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:]
    session = auth.get_session(token)
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return session


def require_role(session: dict) -> dict:
    if not session.get("role"):
        raise HTTPException(status_code=403, detail="Select a role before continuing")
    return session


def require_security_engineer(session: dict = Depends(get_current_session)) -> dict:
    require_role(session)
    if session["role"] != "security_engineer":
        raise HTTPException(status_code=403, detail="Security Engineer role required for this action")
    return session


def get_current_admin(authorization: str | None = Header(default=None)) -> dict:
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:]
    session = auth.get_admin_session(token)
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated as admin")
    return session


class LoginRequest(BaseModel):
    username: str
    password: str


class RoleRequest(BaseModel):
    role: str


@app.post("/api/auth/login")
def login(data: LoginRequest):
    try:
        ok = auth.verify_tfs_credentials(data.username, data.password)
    except Exception:
        raise HTTPException(status_code=502, detail="Could not reach the TFS server. Please try again later.")
    if not ok:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = auth.create_session(data.username)
    return {"token": token, "username": data.username}


@app.post("/api/auth/role")
def choose_role(data: RoleRequest, session: dict = Depends(get_current_session)):
    if data.role not in auth.ROLES:
        raise HTTPException(status_code=400, detail="Unknown role")
    auth.set_role(session["token"], data.role)
    return {"username": session["username"], "role": data.role}


@app.get("/api/auth/me")
def me(session: dict = Depends(get_current_session)):
    return {"username": session["username"], "role": session.get("role")}


@app.post("/api/auth/logout", status_code=204)
def logout(authorization: str | None = Header(default=None)):
    if authorization and authorization.lower().startswith("bearer "):
        auth.destroy_session(authorization[7:])
    return Response(status_code=204)


@app.post("/api/admin/login")
def admin_login(data: LoginRequest):
    if not auth.verify_admin_credentials(data.username, data.password):
        raise HTTPException(status_code=401, detail="Invalid admin username or password")
    token = auth.create_admin_session(data.username)
    return {"token": token, "username": data.username}


@app.post("/api/admin/logout", status_code=204)
def admin_logout(authorization: str | None = Header(default=None)):
    if authorization and authorization.lower().startswith("bearer "):
        auth.destroy_admin_session(authorization[7:])
    return Response(status_code=204)


@app.get("/api/admin/business-units", response_model=list[BusinessUnitOut])
def list_business_units(db: Session = Depends(get_db), admin: dict = Depends(get_current_admin)):
    bus = db.query(models.BusinessUnit).order_by(models.BusinessUnit.service_name).all()
    return [
        {
            "id": b.id, "project_name": b.project_name, "service_name": b.service_name,
            "timeline": b.timeline, "users": b.users_list(), "created_at": b.created_at,
        }
        for b in bus
    ]


@app.post("/api/admin/business-units", response_model=BusinessUnitOut, status_code=201)
def create_business_unit(data: BusinessUnitCreate, db: Session = Depends(get_db), admin: dict = Depends(get_current_admin)):
    import json
    from models import utcnow

    users = [str(u).strip() for u in data.users if str(u).strip()][:200]
    existing = (
        db.query(models.BusinessUnit)
        .filter(
            models.BusinessUnit.service_name == data.service_name,
            models.BusinessUnit.timeline == data.timeline,
        )
        .first()
    )
    if existing:
        existing.project_name = data.project_name
        existing.users = json.dumps(users)
        bu = existing
    else:
        bu = models.BusinessUnit(
            project_name=data.project_name,
            service_name=data.service_name,
            timeline=data.timeline,
            users=json.dumps(users),
            created_at=utcnow(),
        )
        db.add(bu)
    db.commit()
    db.refresh(bu)
    return {
        "id": bu.id, "project_name": bu.project_name, "service_name": bu.service_name,
        "timeline": bu.timeline, "users": bu.users_list(), "created_at": bu.created_at,
    }


@app.put("/api/admin/business-units/{bu_id}", response_model=BusinessUnitOut)
def update_business_unit(bu_id: int, data: BusinessUnitCreate, db: Session = Depends(get_db), admin: dict = Depends(get_current_admin)):
    import json

    bu = db.query(models.BusinessUnit).filter(models.BusinessUnit.id == bu_id).first()
    if not bu:
        raise HTTPException(status_code=404, detail="Business unit not found")
    duplicate = (
        db.query(models.BusinessUnit)
        .filter(
            models.BusinessUnit.service_name == data.service_name,
            models.BusinessUnit.timeline == data.timeline,
            models.BusinessUnit.id != bu_id,
        )
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="A business unit with this service and time line already exists")
    bu.project_name = data.project_name
    bu.service_name = data.service_name
    bu.timeline = data.timeline
    bu.users = json.dumps([str(user).strip() for user in data.users if str(user).strip()][:200])
    db.commit()
    db.refresh(bu)
    return {
        "id": bu.id, "project_name": bu.project_name, "service_name": bu.service_name,
        "timeline": bu.timeline, "users": bu.users_list(), "created_at": bu.created_at,
    }


@app.delete("/api/admin/business-units/{bu_id}", status_code=204)
def delete_business_unit(bu_id: int, db: Session = Depends(get_db), admin: dict = Depends(get_current_admin)):
    bu = db.query(models.BusinessUnit).filter(models.BusinessUnit.id == bu_id).first()
    if not bu:
        raise HTTPException(status_code=404, detail="Business unit not found")
    db.delete(bu)
    db.commit()
    return Response(status_code=204)


@app.get("/api/meta/fields")
def get_fields(db: Session = Depends(get_db), session: dict = Depends(get_current_session)):
    bus = db.query(models.BusinessUnit).order_by(models.BusinessUnit.service_name).all()
    service_options = sorted({b.service_name for b in bus}) or rf.SERVICE_OPTIONS
    timeline_by_service: dict[str, list[str]] = {}
    users_by_service: dict[str, list[str]] = {}
    for b in bus:
        timeline_by_service.setdefault(b.service_name, [])
        if b.timeline not in timeline_by_service[b.service_name]:
            timeline_by_service[b.service_name].append(b.timeline)
        existing_users = users_by_service.setdefault(b.service_name, [])
        for u in b.users_list():
            if u not in existing_users:
                existing_users.append(u)
    timeline_options = sorted({b.timeline for b in bus}) or rf.TIMELINE_OPTIONS

    return {
        "STATES": rf.STATES,
        "LEVELS": rf.LEVELS,
        "RISK_SUB_TYPES": rf.RISK_SUB_TYPES,
        "POTENTIAL_IMPACT_ON_SAFETY": rf.POTENTIAL_IMPACT_ON_SAFETY,
        "CODE_SECURITY_RISK_CATEGORY": rf.CODE_SECURITY_RISK_CATEGORY,
        "SERVICE_OPTIONS": service_options,
        "TIMELINE_OPTIONS": timeline_options,
        "TIMELINE_BY_SERVICE": timeline_by_service,
        "USERS_BY_SERVICE": users_by_service,
        "DEPLOYMENT_TARGET_OPTIONS": rf.DEPLOYMENT_TARGET_OPTIONS,
        "EASE_OF_EXPLOIT": rf.EASE_OF_EXPLOIT,
        "EASE_OF_DISCOVERY": rf.EASE_OF_DISCOVERY,
        "AWARENESS": rf.AWARENESS,
        "DETECTABILITY": rf.DETECTABILITY,
        "THREAT_TYPES": rf.THREAT_TYPES,
        "THREAT_AGENTS": rf.THREAT_AGENTS,
        "TECHNICAL_ASSETS": rf.TECHNICAL_ASSETS,
        "TECHNICAL_IMPACT_SCALE": rf.TECHNICAL_IMPACT_SCALE,
    }


@app.get("/api/projects")
def get_projects(db: Session = Depends(get_db), session: dict = Depends(get_current_session)):
    """Project -> Service -> Timeline hierarchy with risk counts, for the Projects browser."""
    bus = db.query(models.BusinessUnit).order_by(models.BusinessUnit.project_name, models.BusinessUnit.service_name).all()
    risks = db.query(models.Risk).all()

    def count_for(service, timeline):
        return sum(1 for r in risks if r.service == service and r.timeline == timeline)

    projects: dict[str, dict] = {}
    for b in bus:
        project = projects.setdefault(b.project_name, {"project_name": b.project_name, "services": {}})
        service = project["services"].setdefault(b.service_name, {"service_name": b.service_name, "timelines": []})
        if not any(t["timeline"] == b.timeline for t in service["timelines"]):
            service["timelines"].append({"timeline": b.timeline, "risk_count": count_for(b.service_name, b.timeline)})

    return [
        {
            "project_name": p["project_name"],
            "services": [
                {"service_name": s["service_name"], "timelines": s["timelines"]}
                for s in p["services"].values()
            ],
        }
        for p in projects.values()
    ]



@app.get("/api/risks", response_model=list[RiskOut])
def list_risks(
    service: str | None = None,
    timeline: str | None = None,
    db: Session = Depends(get_db),
    session: dict = Depends(get_current_session),
):
    query = db.query(models.Risk)
    if service:
        query = query.filter(models.Risk.service == service)
    if timeline:
        query = query.filter(models.Risk.timeline == timeline)
    risks = query.order_by(models.Risk.id.desc()).all()
    return [crud.to_risk_out(r) for r in risks]


@app.post("/api/risks", response_model=RiskOut, status_code=201)
def create_risk(data: RiskCreate, db: Session = Depends(get_db), session: dict = Depends(require_security_engineer)):
    if data.state == "Postponed":
        raise HTTPException(status_code=403, detail="Only a Developer can set a risk to Postponed")
    risk = crud.create_risk(db, data, username=session["username"])
    return crud.to_risk_out(risk)


@app.get("/api/risks/{risk_id}", response_model=RiskOut)
def get_risk(risk_id: int, db: Session = Depends(get_db), session: dict = Depends(get_current_session)):
    risk = get_risk_or_404(db, risk_id)
    return crud.to_risk_out(risk)


@app.put("/api/risks/{risk_id}", response_model=RiskOut)
def update_risk(risk_id: int, data: RiskUpdate, db: Session = Depends(get_db), session: dict = Depends(get_current_session)):
    require_role(session)
    risk = get_risk_or_404(db, risk_id)
    requested_state = data.state if "state" in data.model_fields_set else risk.state
    if session["role"] == "developer":
        if requested_state != "Postponed":
            raise HTTPException(status_code=403, detail="Developers can only change a risk state to Postponed")
        rationale = (data.rationale_for_postponement or "").strip()
        if not rationale:
            raise HTTPException(status_code=422, detail="Rationale and Actions is required before postponing a risk")
        data = RiskUpdate(state="Postponed", rationale_for_postponement=rationale)
    elif requested_state == "Postponed":
        raise HTTPException(status_code=403, detail="Only a Developer can set a risk to Postponed")
    risk = crud.update_risk(db, risk, data, username=session["username"])
    return crud.to_risk_out(risk)


@app.delete("/api/risks/{risk_id}", status_code=204)
def delete_risk(risk_id: int, db: Session = Depends(get_db), session: dict = Depends(require_security_engineer)):
    risk = get_risk_or_404(db, risk_id)
    risk_dir = STORAGE_DIR / str(risk_id)
    db.delete(risk)
    db.commit()
    if risk_dir.exists():
        for f in risk_dir.iterdir():
            f.unlink(missing_ok=True)
        risk_dir.rmdir()
    return Response(status_code=204)


@app.post("/api/risks/{risk_id}/comments", response_model=CommentOut, status_code=201)
def add_comment(risk_id: int, data: CommentCreate, db: Session = Depends(get_db), session: dict = Depends(get_current_session)):
    require_role(session)
    risk = get_risk_or_404(db, risk_id)
    from models import utcnow
    author = (data.by or "").strip()[:100] or session["username"]
    comment = models.Comment(risk_id=risk.id, by=author, date=utcnow(), comment=data.comment)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@app.post("/api/risks/{risk_id}/attachments", response_model=list[dict], status_code=201)
async def upload_attachments(risk_id: int, files: list[UploadFile] = File(...), db: Session = Depends(get_db), session: dict = Depends(require_security_engineer)):
    risk = get_risk_or_404(db, risk_id)
    risk_dir = STORAGE_DIR / str(risk_id)
    risk_dir.mkdir(parents=True, exist_ok=True)

    created = []
    for upload in files:
        original_name = os.path.basename(upload.filename or "file")
        ext = Path(original_name).suffix.lower()
        if ext in BLOCKED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"File type '{ext}' is not allowed")

        contents = await upload.read()
        if len(contents) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=400, detail=f"'{original_name}' exceeds the {MAX_UPLOAD_BYTES // (1024*1024)}MB size limit")

        stored_name = f"{uuid.uuid4().hex}{ext}"
        with open(risk_dir / stored_name, "wb") as out:
            out.write(contents)

        attachment = models.Attachment(
            risk_id=risk.id,
            filename=original_name,
            stored_name=stored_name,
            size=len(contents),
            content_type=upload.content_type or "application/octet-stream",
        )
        db.add(attachment)
        created.append(attachment)

    db.commit()
    for a in created:
        db.refresh(a)
    return [
        {"id": a.id, "filename": a.filename, "size": a.size, "content_type": a.content_type, "uploaded_at": a.uploaded_at}
        for a in created
    ]


@app.get("/api/risks/{risk_id}/attachments/{attachment_id}/download")
def download_attachment(risk_id: int, attachment_id: int, inline: bool = False, db: Session = Depends(get_db)):
    # Note: intentionally not gated behind get_current_session so <img>/<a> tags can
    # load it directly without attaching an Authorization header from the SPA.
    attachment = (
        db.query(models.Attachment)
        .filter(models.Attachment.id == attachment_id, models.Attachment.risk_id == risk_id)
        .first()
    )
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    file_path = STORAGE_DIR / str(risk_id) / attachment.stored_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File missing on disk")
    return FileResponse(
        file_path,
        filename=attachment.filename,
        media_type=attachment.content_type,
        content_disposition_type="inline" if inline else "attachment",
    )


@app.delete("/api/risks/{risk_id}/attachments/{attachment_id}", status_code=204)
def delete_attachment(risk_id: int, attachment_id: int, db: Session = Depends(get_db), session: dict = Depends(require_security_engineer)):
    attachment = (
        db.query(models.Attachment)
        .filter(models.Attachment.id == attachment_id, models.Attachment.risk_id == risk_id)
        .first()
    )
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    file_path = STORAGE_DIR / str(risk_id) / attachment.stored_name
    file_path.unlink(missing_ok=True)
    db.delete(attachment)
    db.commit()
    return Response(status_code=204)


@app.get("/api/risks/export/{fmt}")
def export_risks(
    fmt: str,
    service: str | None = None,
    timeline: str | None = None,
    db: Session = Depends(get_db),
    session: dict = Depends(get_current_session),
):
    query = db.query(models.Risk)
    if service:
        query = query.filter(models.Risk.service == service)
    if timeline:
        query = query.filter(models.Risk.timeline == timeline)
    risks = [crud.to_risk_out(r) for r in query.order_by(models.Risk.id.desc()).all()]

    scope = "_".join(p.replace("\\", "-").replace("/", "-") for p in [service, timeline] if p)
    filename_base = f"Risks_export_{scope}" if scope else "Risks_export"
    title = f"Risks — {service or 'All Services'} / {timeline or 'All Timelines'}" if (service or timeline) else "Risks"

    if fmt == "csv":
        content = to_csv(risks)
        return Response(
            content=content,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename_base}.csv"'},
        )
    if fmt == "html":
        content = to_html(risks, title)
        return Response(
            content=content,
            media_type="text/html; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename_base}.html"'},
        )
    if fmt == "excel":
        content = to_excel_bytes(risks)
        return Response(
            content=content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename_base}.xlsx"'},
        )
    if fmt == "pdf":
        content = to_pdf_bytes(risks, title)
        return Response(
            content=content,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename_base}.pdf"'},
        )
    raise HTTPException(status_code=400, detail="Unsupported format")
