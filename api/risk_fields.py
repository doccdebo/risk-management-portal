"""Enumerations and calculation helpers for the Risk domain model.

Dropdown option strings intentionally embed their numeric weight, e.g.
"Automated tools available (9)", matching the real TFS instance. The
weight is parsed out of the trailing "(N)" / "(N.N)" for calculations.
"""
import re

STATES = ["Submitted", "Active", "Resolved", "Closed", "Postponed", "Postponed Accepted"]
LEVELS = ["Low", "Medium", "High"]

RISK_SUB_TYPES = ["DCA", "Hardware", "Open Source Risk", "SCA", "SAST"]

POTENTIAL_IMPACT_ON_SAFETY = ["Impact", "No Impact", "N/A with Justification"]

CODE_SECURITY_RISK_CATEGORY = [
    "OWASP - A1 Broken Access Control/ Improper Authorization",
    "OWASP - A2 Cryptographic Failures",
    "OWASP - A3 Injection",
    "OWASP - A4 Insecure Design",
    "OWASP - A5 Security Misconfiguration",
    "OWASP - A6 Vulnerable and Outdated Components",
    "OWASP - A7 Identification and Authentication Failures",
    "OWASP - A8 Software and Data Integrity Failures",
    "OWASP - A9 Security Logging and Monitoring Failures",
    "OWASP - A10 Server-Side Request Forgery (SSRF)",
]

SERVICE_OPTIONS = ["DHP\\Recycle Bin", "DHP\\Release 3.1"]
TIMELINE_OPTIONS = ["DHP\\Recycle Bin", "DHP\\Release 3.1"]

DEPLOYMENT_TARGET_OPTIONS = ["Cloud", "On-Premise", "Hybrid", "Mobile", "Embedded"]

EASE_OF_EXPLOIT = [
    "Default (0)", "Theoretical (1)", "2", "Easy (3)", "4", "5", "6", "7", "8",
    "Automated tools available (9)",
]
EASE_OF_DISCOVERY = [
    "Default (0)", "Practically impossible (1)", "2", "Difficult (3)", "4", "5", "6",
    "Easy (7)", "8", "Automated tools available (9)",
]
AWARENESS = [
    "Unknown (1)", "2", "3", "Hidden (4)", "5", "6", "Public Knowledge (7)", "8", "Obvious (9)",
]
DETECTABILITY = [
    "Active detection in application (1)", "2", "Logged and reviewed (3)", "4", "5", "6", "7",
    "Logged without review (8)", "Not Logged (9)",
]

THREAT_TYPES = [
    "Denial of Service", "Elevation of Privilege", "Information Disclosure",
    "Repudiation", "Spoofing", "Tampering",
]

THREAT_AGENTS = [
    "Automated or remote access (3.0)", "Clinical Users (0)", "Engineer (0.0)",
    "Hardware defects (0)", "Infrastructure outage (7.2)", "Insider (0.0)",
    "Intruder (7.0)", "Malicious code (7.2)", "Natural or man-made disaster (4.2)",
    "Outsider (0.0)", "Security Researcher (6.0)", "Software defects (0)",
    "System Admin (0.0)", "Trusted Insider (6.2)",
]

TECHNICAL_ASSETS = [
    "Audit trail data", "Configuration / calibration / control data", "Hardware",
    "Hospital network", "Logging data", "Network Data", "Personal Data", "Product Data",
    "Product Documentation", "Removable media and manuals", "Sensitive data", "System software",
]

TECHNICAL_IMPACT_SCALE = [str(n) for n in range(0, 8)]  # "0".."7"


def parse_score(value):
    """Extract the trailing numeric weight from an option string like 'Easy (3)'."""
    if value is None:
        return None
    match = re.search(r"\(([\d.]+)\)\s*$", str(value))
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def compute_vulnerability_score(ease_of_exploit, ease_of_discovery, awareness, detectability):
    values = [parse_score(v) for v in [ease_of_exploit, ease_of_discovery, awareness, detectability]]
    values = [v for v in values if v is not None]
    if not values:
        return None
    return round(sum(values) / len(values), 1)


def compute_threat_score(threat_agents):
    values = [parse_score(a) for a in (threat_agents or [])]
    values = [v for v in values if v is not None]
    if not values:
        return None
    return round(sum(values) / len(values), 1)


def compute_technical_impact_score(c, i, a):
    values = [parse_score(v) for v in [c, i, a] if v is not None and v != ""]
    if not values:
        return None
    return round(sum(values) / len(values), 1)


def level_from_vulnerability_score(score):
    if score is None:
        return "Low"
    if score < 3:
        return "Low"
    if score < 6:
        return "Medium"
    return "High"


def level_from_technical_impact_score(score):
    if score is None:
        return "Low"
    if score < 3:
        return "Low"
    if score < 5:
        return "Medium"
    return "High"


_MATRIX_SCORE = {"Low": 1, "Medium": 2, "High": 3}
_SCORE_TO_LEVEL = {1: "Low", 2: "Low", 3: "Medium", 4: "Medium", 6: "High", 9: "High"}


def compute_initial_risk(likelihood, impact):
    p = _MATRIX_SCORE.get(likelihood, 1)
    i = _MATRIX_SCORE.get(impact, 1)
    return _SCORE_TO_LEVEL.get(p * i, "Low")


def severity_from_score(score):
    if score is None:
        return None
    if score < 3:
        return "Low"
    if score < 6:
        return "Medium"
    if score < 8:
        return "High"
    return "Critical"
