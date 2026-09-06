import json
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text,
)
from sqlalchemy.orm import relationship

from database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Risk(Base):
    __tablename__ = "risks"

    id = Column(Integer, primary_key=True, index=True)
    uid = Column(String, unique=True, index=True)

    # Header metadata
    title = Column(String, nullable=False)
    state = Column(String, default="Submitted")
    assigned_to = Column(String, default="Unassigned")
    service = Column(String, default="")
    timeline = Column(String, default="")
    tags = Column(Text, default="[]")  # JSON list

    # Detection
    risk_date = Column(String, default="")
    risk_sub_type = Column(String, default="")
    potential_impact_on_safety = Column(String, default="")
    code_security_risk_category = Column(String, default="")
    build_number = Column(String, default="")
    deployment_target = Column(Text, default="[]")  # JSON list of tags
    cloning_rule_apply = Column(Boolean, default=False)

    # Scoring (Likelihood / Impact / Initial Risk are computed & locked)
    likelihood = Column(String, default="Low")
    impact = Column(String, default="Low")
    initial_risk = Column(String, default="Low")

    # Vulnerability
    vulnerability_id = Column(String, default="")
    ease_of_exploit = Column(String, default="")
    ease_of_discovery = Column(String, default="")
    awareness = Column(String, default="")
    detectability = Column(String, default="")
    vulnerability_score = Column(Float, nullable=True)
    vulnerability_description = Column(Text, default="")
    vulnerability_cause = Column(Text, default="")

    # Threat
    threat_type = Column(String, default="")
    threat_agents = Column(Text, default="[]")  # JSON list
    threat_score = Column(Float, nullable=True)
    threat_description = Column(Text, default="")

    # Quantitative Impact
    technical_assets = Column(Text, default="[]")  # JSON list
    technical_impact_c = Column(String, default="0")
    technical_impact_i = Column(String, default="0")
    technical_impact_a = Column(String, default="0")

    # Rationale and Actions
    risk_statement = Column(Text, default="")
    rationale_for_postponement = Column(Text, default="")

    # Fix / Postpone / No Fix / Mitigations
    fix_notes = Column(Text, default="")
    fix_target_date = Column(String, default="")
    postpone_until_date = Column(String, default="")
    no_fix_justification = Column(Text, default="")
    mitigation_plan = Column(Text, default="")
    contingency_plan = Column(Text, default="")

    # Test cases (JSON list of {id, result})
    test_cases = Column(Text, default="[]")

    created_by = Column(String, default="")
    created_date = Column(DateTime, default=utcnow)
    changed_by = Column(String, default="")
    changed_date = Column(DateTime, default=utcnow)

    comments = relationship("Comment", back_populates="risk", cascade="all, delete-orphan", order_by="Comment.date")
    attachments = relationship("Attachment", back_populates="risk", cascade="all, delete-orphan", order_by="Attachment.uploaded_at")

    def _json_list(self, column_value):
        try:
            return json.loads(column_value or "[]")
        except json.JSONDecodeError:
            return []

    def technical_assets_list(self):
        return self._json_list(self.technical_assets)

    def threat_agents_list(self):
        return self._json_list(self.threat_agents)

    def test_cases_list(self):
        return self._json_list(self.test_cases)

    def tags_list(self):
        return self._json_list(self.tags)

    def deployment_target_list(self):
        return self._json_list(self.deployment_target)


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    risk_id = Column(Integer, ForeignKey("risks.id"))
    by = Column(String, default="")
    date = Column(DateTime, default=utcnow)
    comment = Column(Text, default="")

    risk = relationship("Risk", back_populates="comments")


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    risk_id = Column(Integer, ForeignKey("risks.id"))
    filename = Column(String)
    stored_name = Column(String)
    size = Column(Integer)
    content_type = Column(String)
    uploaded_at = Column(DateTime, default=utcnow)

    risk = relationship("Risk", back_populates="attachments")


class BusinessUnit(Base):
    """A BU onboarded by an admin: a project/service/timeline with assignable users.

    Uniqueness is enforced at the app level on (service_name, timeline) so a
    service can have multiple onboarded timelines.
    """
    __tablename__ = "business_units"

    id = Column(Integer, primary_key=True, index=True)
    project_name = Column(String, default="", index=True)
    service_name = Column(String, index=True)
    timeline = Column(String, default="")
    users = Column(Text, default="[]")  # JSON list
    created_at = Column(DateTime, default=utcnow)

    def users_list(self):
        try:
            return json.loads(self.users or "[]")
        except json.JSONDecodeError:
            return []
