from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class RiskBase(BaseModel):
    title: Optional[str] = None
    state: Optional[str] = "Submitted"
    assigned_to: Optional[str] = "Unassigned"
    service: Optional[str] = ""
    timeline: Optional[str] = ""
    tags: Optional[List[str]] = []

    risk_date: Optional[str] = ""
    risk_sub_type: Optional[str] = ""
    potential_impact_on_safety: Optional[str] = ""
    code_security_risk_category: Optional[str] = ""
    build_number: Optional[str] = ""
    deployment_target: Optional[List[str]] = []
    cloning_rule_apply: Optional[bool] = False

    vulnerability_id: Optional[str] = ""
    ease_of_exploit: Optional[str] = ""
    ease_of_discovery: Optional[str] = ""
    awareness: Optional[str] = ""
    detectability: Optional[str] = ""
    vulnerability_description: Optional[str] = ""
    vulnerability_cause: Optional[str] = ""

    threat_type: Optional[str] = ""
    threat_agents: Optional[List[str]] = []
    threat_description: Optional[str] = ""

    technical_assets: Optional[List[str]] = []
    technical_impact_c: Optional[str] = "0"
    technical_impact_i: Optional[str] = "0"
    technical_impact_a: Optional[str] = "0"

    risk_statement: Optional[str] = ""
    rationale_for_postponement: Optional[str] = ""

    fix_notes: Optional[str] = ""
    fix_target_date: Optional[str] = ""
    postpone_until_date: Optional[str] = ""
    no_fix_justification: Optional[str] = ""
    mitigation_plan: Optional[str] = ""
    contingency_plan: Optional[str] = ""

    test_cases: Optional[List[dict]] = []

    @field_validator("title")
    @classmethod
    def strip_title(cls, v):
        return v.strip() if v else v


class RiskCreate(RiskBase):
    title: str = Field(..., min_length=1, max_length=255)


class RiskUpdate(RiskBase):
    pass


class CommentCreate(BaseModel):
    comment: str = Field(..., min_length=1, max_length=2000)
    by: Optional[str] = Field(None, max_length=100)


class CommentOut(BaseModel):
    id: int
    by: str
    date: datetime
    comment: str

    model_config = {"from_attributes": True}


class AttachmentOut(BaseModel):
    id: int
    filename: str
    size: int
    content_type: str
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class BusinessUnitCreate(BaseModel):
    project_name: str = Field(..., min_length=1, max_length=200)
    service_name: str = Field(..., min_length=1, max_length=200)
    timeline: str = Field(..., min_length=1, max_length=200)
    users: List[str] = []


class BusinessUnitOut(BaseModel):
    id: int
    project_name: str
    service_name: str
    timeline: str
    users: List[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class RiskOut(BaseModel):
    id: int
    uid: str
    title: str
    state: str
    assigned_to: str
    service: str
    timeline: str
    tags: List[str]

    risk_date: str
    risk_sub_type: str
    potential_impact_on_safety: str
    code_security_risk_category: str
    build_number: str
    deployment_target: List[str]
    cloning_rule_apply: bool

    likelihood: str
    impact: str
    initial_risk: str

    vulnerability_id: str
    ease_of_exploit: str
    ease_of_discovery: str
    awareness: str
    detectability: str
    vulnerability_score: Optional[float] = None
    vulnerability_description: str
    vulnerability_cause: str

    threat_type: str
    threat_agents: List[str]
    threat_score: Optional[float] = None
    threat_severity: Optional[str] = None
    threat_description: str

    technical_assets: List[str]
    technical_impact_c: str
    technical_impact_i: str
    technical_impact_a: str

    risk_statement: str
    rationale_for_postponement: str

    fix_notes: str
    fix_target_date: str
    postpone_until_date: str
    no_fix_justification: str
    mitigation_plan: str
    contingency_plan: str

    test_cases: List[dict]

    created_by: str
    created_date: datetime
    changed_by: str
    changed_date: datetime

    comment_count: int = 0
    attachment_count: int = 0
    comments: List[CommentOut] = []
    attachments: List[AttachmentOut] = []

    model_config = {"from_attributes": True}
