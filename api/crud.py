import json

from sqlalchemy.orm import Session

import models
import risk_fields as rf
from schemas import RiskCreate, RiskUpdate

CURRENT_USER = "Contoso\\Administrator"


def _valid(value, allowed, fallback=""):
    return value if value in allowed else fallback


def _json_list_field(payload, key, allowed=None, max_items=50, max_len=100):
    values = payload.get(key) or []
    cleaned = [str(v)[:max_len] for v in values]
    if allowed is not None:
        cleaned = [v for v in cleaned if v in allowed]
    return json.dumps(cleaned[:max_items])


def _apply_fields(risk: models.Risk, data, is_new: bool):
    payload = data.model_dump(exclude_unset=not is_new)

    if "title" in payload and payload["title"]:
        risk.title = payload["title"][:255]
    elif is_new:
        risk.title = "New Risk"

    if "state" in payload:
        risk.state = _valid(payload["state"], rf.STATES, risk.state or "Submitted")
    if "assigned_to" in payload:
        risk.assigned_to = (payload["assigned_to"] or "Unassigned")[:255]
    if "service" in payload:
        risk.service = (payload["service"] or "")[:255]
    if "timeline" in payload:
        risk.timeline = (payload["timeline"] or "")[:255]
    if "tags" in payload:
        risk.tags = _json_list_field(payload, "tags", max_items=30, max_len=50)

    if "risk_date" in payload:
        risk.risk_date = (payload["risk_date"] or "")[:40]
    if "risk_sub_type" in payload:
        risk.risk_sub_type = _valid(payload["risk_sub_type"], rf.RISK_SUB_TYPES, risk.risk_sub_type or "")
    if "potential_impact_on_safety" in payload:
        risk.potential_impact_on_safety = _valid(
            payload["potential_impact_on_safety"], rf.POTENTIAL_IMPACT_ON_SAFETY, ""
        )
    if "code_security_risk_category" in payload:
        risk.code_security_risk_category = _valid(
            payload["code_security_risk_category"], rf.CODE_SECURITY_RISK_CATEGORY, ""
        )
    if "build_number" in payload:
        risk.build_number = (payload["build_number"] or "")[:100]
    if "deployment_target" in payload:
        risk.deployment_target = _json_list_field(payload, "deployment_target", max_items=20, max_len=50)
    if "cloning_rule_apply" in payload:
        risk.cloning_rule_apply = bool(payload["cloning_rule_apply"])

    if "vulnerability_id" in payload:
        risk.vulnerability_id = (payload["vulnerability_id"] or "")[:100]
    if "ease_of_exploit" in payload:
        risk.ease_of_exploit = _valid(payload["ease_of_exploit"], rf.EASE_OF_EXPLOIT, "")
    if "ease_of_discovery" in payload:
        risk.ease_of_discovery = _valid(payload["ease_of_discovery"], rf.EASE_OF_DISCOVERY, "")
    if "awareness" in payload:
        risk.awareness = _valid(payload["awareness"], rf.AWARENESS, "")
    if "detectability" in payload:
        risk.detectability = _valid(payload["detectability"], rf.DETECTABILITY, "")
    if "vulnerability_description" in payload:
        risk.vulnerability_description = (payload["vulnerability_description"] or "")[:8000]
    if "vulnerability_cause" in payload:
        risk.vulnerability_cause = (payload["vulnerability_cause"] or "")[:8000]

    if "threat_type" in payload:
        risk.threat_type = _valid(payload["threat_type"], rf.THREAT_TYPES, "")
    if "threat_agents" in payload:
        risk.threat_agents = _json_list_field(payload, "threat_agents", allowed=rf.THREAT_AGENTS)
    if "threat_description" in payload:
        risk.threat_description = (payload["threat_description"] or "")[:8000]

    if "technical_assets" in payload:
        risk.technical_assets = _json_list_field(payload, "technical_assets", allowed=rf.TECHNICAL_ASSETS)
    if "technical_impact_c" in payload:
        risk.technical_impact_c = _valid(payload["technical_impact_c"], rf.TECHNICAL_IMPACT_SCALE, "0")
    if "technical_impact_i" in payload:
        risk.technical_impact_i = _valid(payload["technical_impact_i"], rf.TECHNICAL_IMPACT_SCALE, "0")
    if "technical_impact_a" in payload:
        risk.technical_impact_a = _valid(payload["technical_impact_a"], rf.TECHNICAL_IMPACT_SCALE, "0")

    if "risk_statement" in payload:
        risk.risk_statement = (payload["risk_statement"] or "")[:8000]
    if "rationale_for_postponement" in payload:
        risk.rationale_for_postponement = (payload["rationale_for_postponement"] or "")[:8000]

    if "fix_notes" in payload:
        risk.fix_notes = (payload["fix_notes"] or "")[:8000]
    if "fix_target_date" in payload:
        risk.fix_target_date = (payload["fix_target_date"] or "")[:40]
    if "postpone_until_date" in payload:
        risk.postpone_until_date = (payload["postpone_until_date"] or "")[:40]
    if "no_fix_justification" in payload:
        risk.no_fix_justification = (payload["no_fix_justification"] or "")[:4000]
    if "mitigation_plan" in payload:
        risk.mitigation_plan = (payload["mitigation_plan"] or "")[:8000]
    if "contingency_plan" in payload:
        risk.contingency_plan = (payload["contingency_plan"] or "")[:8000]

    if "test_cases" in payload:
        cases = payload["test_cases"] or []
        cleaned = [
            {"id": str(c.get("id", ""))[:50], "result": str(c.get("result", ""))[:50]}
            for c in cases if isinstance(c, dict)
        ][:200]
        risk.test_cases = json.dumps(cleaned)

    # ---- Computed / locked fields ----
    risk.vulnerability_score = rf.compute_vulnerability_score(
        risk.ease_of_exploit, risk.ease_of_discovery, risk.awareness, risk.detectability
    )
    risk.threat_score = rf.compute_threat_score(risk.threat_agents_list())
    technical_impact_score = rf.compute_technical_impact_score(
        risk.technical_impact_c, risk.technical_impact_i, risk.technical_impact_a
    )
    risk.likelihood = rf.level_from_vulnerability_score(risk.vulnerability_score)
    risk.impact = rf.level_from_technical_impact_score(technical_impact_score)
    risk.initial_risk = rf.compute_initial_risk(risk.likelihood, risk.impact)

    return risk


def create_risk(db: Session, data: RiskCreate, username: str = CURRENT_USER) -> models.Risk:
    from models import utcnow

    risk = models.Risk()
    _apply_fields(risk, data, is_new=True)
    now = utcnow()
    risk.created_by = username
    risk.created_date = now
    risk.changed_by = username
    risk.changed_date = now

    db.add(risk)
    db.flush()  # obtain risk.id
    risk.uid = f"RISK-{1000 + risk.id}"
    db.add(models.Comment(risk_id=risk.id, by=username, date=now, comment="Risk created."))
    db.commit()
    db.refresh(risk)
    return risk


def update_risk(db: Session, risk: models.Risk, data: RiskUpdate, username: str = CURRENT_USER) -> models.Risk:
    from models import utcnow

    _apply_fields(risk, data, is_new=False)
    now = utcnow()
    risk.changed_by = username
    risk.changed_date = now
    db.add(models.Comment(risk_id=risk.id, by=username, date=now, comment="Risk updated."))
    db.commit()
    db.refresh(risk)
    return risk


def to_risk_out(risk: models.Risk) -> dict:
    return {
        "id": risk.id,
        "uid": risk.uid,
        "title": risk.title,
        "state": risk.state,
        "assigned_to": risk.assigned_to,
        "service": risk.service,
        "timeline": risk.timeline,
        "tags": risk.tags_list(),
        "risk_date": risk.risk_date,
        "risk_sub_type": risk.risk_sub_type,
        "potential_impact_on_safety": risk.potential_impact_on_safety,
        "code_security_risk_category": risk.code_security_risk_category,
        "build_number": risk.build_number,
        "deployment_target": risk.deployment_target_list(),
        "cloning_rule_apply": risk.cloning_rule_apply,
        "likelihood": risk.likelihood,
        "impact": risk.impact,
        "initial_risk": risk.initial_risk,
        "vulnerability_id": risk.vulnerability_id,
        "ease_of_exploit": risk.ease_of_exploit,
        "ease_of_discovery": risk.ease_of_discovery,
        "awareness": risk.awareness,
        "detectability": risk.detectability,
        "vulnerability_score": risk.vulnerability_score,
        "vulnerability_description": risk.vulnerability_description,
        "vulnerability_cause": risk.vulnerability_cause,
        "threat_type": risk.threat_type,
        "threat_agents": risk.threat_agents_list(),
        "threat_score": risk.threat_score,
        "threat_severity": rf.severity_from_score(risk.threat_score),
        "threat_description": risk.threat_description,
        "technical_assets": risk.technical_assets_list(),
        "technical_impact_c": risk.technical_impact_c,
        "technical_impact_i": risk.technical_impact_i,
        "technical_impact_a": risk.technical_impact_a,
        "risk_statement": risk.risk_statement,
        "rationale_for_postponement": risk.rationale_for_postponement,
        "fix_notes": risk.fix_notes,
        "fix_target_date": risk.fix_target_date,
        "postpone_until_date": risk.postpone_until_date,
        "no_fix_justification": risk.no_fix_justification,
        "mitigation_plan": risk.mitigation_plan,
        "contingency_plan": risk.contingency_plan,
        "test_cases": risk.test_cases_list(),
        "created_by": risk.created_by,
        "created_date": risk.created_date,
        "changed_by": risk.changed_by,
        "changed_date": risk.changed_date,
        "comment_count": len(risk.comments),
        "attachment_count": len(risk.attachments),
        "comments": risk.comments,
        "attachments": risk.attachments,
    }
