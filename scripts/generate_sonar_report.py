#!/usr/bin/env python3
"""
Generate a complete SonarQube analysis PDF report for TAHDCO-OneDashboard.

Reads real analysis results from the SonarQube Web API and renders them to a
single PDF that is uploaded as a GitHub Actions artifact.

Design rules for this script:
  * SONAR_TOKEN is read from the environment ONLY. It is never printed to
    stdout/stderr, never written into the PDF, and is redacted out of any
    exception text before that text is logged or rendered.
  * Nothing is invented. If a metric is unavailable, the report says so
    explicitly ("not available") and records why under Scan Limitations.
    Coverage is never synthesised, estimated or defaulted to a number.
  * The script exits 0 in almost all cases so the PDF artifact still uploads
    when the analysis itself failed - the failure becomes report content.

Usage:
    SONAR_HOST_URL=... SONAR_TOKEN=... python scripts/generate_sonar_report.py \
        --project-key TAHDCO-OneDashboard-ss \
        --project-name "TAHDCO OneDashboard (Unified Dashboard Platform)" \
        --branch main --commit <sha> \
        --report-task-file .sonarqube/out/.sonar/report-task.txt \
        --status-file artifacts/ci-status.json \
        --output artifacts/report/TAHDCO-OneDashboard-SonarQube-Report.pdf
"""

from __future__ import annotations

import argparse
import base64
import datetime as _dt
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# --------------------------------------------------------------------------
# Constants
# --------------------------------------------------------------------------

HTTP_TIMEOUT = 60
CE_TASK_POLL_SECONDS = 5
CE_TASK_MAX_WAIT_SECONDS = 300

MEASURE_METRICS = [
    # size
    "ncloc", "ncloc_language_distribution", "lines", "files", "statements",
    "functions", "classes", "comment_lines", "comment_lines_density",
    # issues
    "bugs", "vulnerabilities", "security_hotspots", "code_smells",
    "reliability_rating", "security_rating", "security_review_rating",
    "sqale_rating", "sqale_index",
    # duplications
    "duplicated_lines", "duplicated_lines_density", "duplicated_blocks",
    "duplicated_files",
    # coverage
    "coverage", "line_coverage", "branch_coverage", "lines_to_cover",
    "uncovered_lines", "conditions_to_cover", "uncovered_conditions",
    # gate
    "alert_status",
]

# SonarQube language key -> human readable name
LANGUAGE_NAMES = {
    "cs": "C#",
    "vbnet": "VB.NET",
    "ts": "TypeScript",
    "js": "JavaScript",
    "web": "HTML",
    "css": "CSS / SCSS",
    "scss": "SCSS",
    "json": "JSON",
    "xml": "XML",
    "yaml": "YAML",
    "sql": "SQL",
    "plsql": "PL/SQL",
    "tsql": "T-SQL",
    "docker": "Dockerfile",
    "secrets": "Secrets detection",
    "text": "Text",
    "py": "Python",
    "sh": "Shell",
}

# file extension -> language bucket, used for per-language coverage aggregation
EXTENSION_LANGUAGE = {
    ".cs": "C#",
    ".ts": "TypeScript",
    ".js": "JavaScript",
    ".html": "HTML",
    ".htm": "HTML",
    ".scss": "CSS / SCSS",
    ".css": "CSS / SCSS",
    ".sql": "SQL",
    ".json": "JSON",
    ".xml": "XML",
}

RATING_LETTERS = {"1": "A", "2": "B", "3": "C", "4": "D", "5": "E"}

METRIC_LABELS = {
    "new_reliability_rating": "Reliability rating on new code",
    "new_security_rating": "Security rating on new code",
    "new_maintainability_rating": "Maintainability rating on new code",
    "new_coverage": "Coverage on new code",
    "new_duplicated_lines_density": "Duplicated lines on new code",
    "new_security_hotspots_reviewed": "Security hotspots reviewed on new code",
    "reliability_rating": "Reliability rating",
    "security_rating": "Security rating",
    "sqale_rating": "Maintainability rating",
    "coverage": "Coverage",
    "duplicated_lines_density": "Duplicated lines density",
}

NA = "not available"


# --------------------------------------------------------------------------
# Token-safe helpers
# --------------------------------------------------------------------------

_SECRETS: list[str] = []


def register_secret(value: str | None) -> None:
    """Remember a value that must never appear in output."""
    if value and len(value) >= 8:
        _SECRETS.append(value)


def redact(text: object) -> str:
    """Strip every registered secret out of ``text``."""
    out = str(text)
    for secret in _SECRETS:
        out = out.replace(secret, "***REDACTED***")
    return out


def log(message: str) -> None:
    print(redact(message), flush=True)


# --------------------------------------------------------------------------
# SonarQube Web API client
# --------------------------------------------------------------------------


class SonarClient:
    """Minimal read-only SonarQube Web API client (stdlib only)."""

    def __init__(self, host: str, token: str):
        self.host = host.rstrip("/")
        # SonarQube accepts a user token as the HTTP Basic username with an
        # empty password. This works across all supported server versions.
        raw = f"{token}:".encode("utf-8")
        self._auth = "Basic " + base64.b64encode(raw).decode("ascii")
        self.errors: list[str] = []

    def request(self, path: str, params: dict | None = None) -> tuple[dict | None, int | None, str]:
        """
        Perform one GET.

        Returns (payload, status_code, message). On success message is "".
        Nothing is recorded on self.errors here - the caller decides whether a
        failure is terminal or recoverable (see fetch_measures).
        """
        url = f"{self.host}{path}"
        if params:
            clean = {k: v for k, v in params.items() if v is not None}
            url = f"{url}?{urllib.parse.urlencode(clean)}"
        request = urllib.request.Request(url, method="GET")
        request.add_header("Authorization", self._auth)
        request.add_header("Accept", "application/json")
        try:
            with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT) as response:
                return json.loads(response.read().decode("utf-8")), 200, ""
        except urllib.error.HTTPError as exc:
            try:
                body = exc.read().decode("utf-8", "replace")[:400]
            except Exception:  # pragma: no cover - defensive
                body = ""
            return None, exc.code, redact(f"HTTP {exc.code} on {path}: {body}")
        except Exception as exc:  # noqa: BLE001 - report, never crash the run
            return None, None, redact(f"{type(exc).__name__} on {path}: {exc}")

    def get(self, path: str, params: dict | None = None) -> dict | None:
        payload, _status, message = self.request(path, params)
        if payload is None:
            self.errors.append(message)
            log(f"  ! {message}")
        return payload


def read_report_task(path: str) -> dict:
    """Parse the scanner's report-task.txt (ceTaskId, dashboardUrl, ...)."""
    result: dict[str, str] = {}
    if not path or not os.path.isfile(path):
        return result
    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                key, _, value = line.partition("=")
                result[key.strip()] = value.strip()
    return result


def wait_for_task(client: SonarClient, ce_task_id: str) -> tuple[str | None, str]:
    """Poll the compute-engine task. Returns (analysisId, status)."""
    deadline = time.time() + CE_TASK_MAX_WAIT_SECONDS
    last_status = "UNKNOWN"
    while time.time() < deadline:
        payload = client.get("/api/ce/task", {"id": ce_task_id})
        if not payload:
            return None, "UNREACHABLE"
        task = payload.get("task", {})
        last_status = task.get("status", "UNKNOWN")
        if last_status == "SUCCESS":
            return task.get("analysisId"), last_status
        if last_status in ("FAILED", "CANCELED"):
            return None, last_status
        log(f"  . compute engine task {last_status}, waiting...")
        time.sleep(CE_TASK_POLL_SECONDS)
    return None, f"TIMEOUT after {CE_TASK_MAX_WAIT_SECONDS}s (last status {last_status})"


# --------------------------------------------------------------------------
# Data collection
# --------------------------------------------------------------------------


# SonarQube answers an unknown metric key with HTTP 400 and a message such as
# "The following metric keys are not found: foo, bar". One unknown key would
# otherwise wipe out every metric in the request.
_UNKNOWN_METRIC_RE = re.compile(r"metric key(?:s)?\s+(?:are|is)\s+not\s+found\s*:?\s*([^\"}\]]+)", re.I)


def _parse_unknown_metrics(message: str, candidates: list[str]) -> list[str]:
    """Extract the metric keys SonarQube rejected, restricted to ones we asked for."""
    found: list[str] = []
    for match in _UNKNOWN_METRIC_RE.finditer(message or ""):
        for token in re.split(r"[,\s]+", match.group(1)):
            token = token.strip().strip(".\"'")
            if token in candidates and token not in found:
                found.append(token)
    return found


def _measures_request(client: SonarClient, project_key: str, metrics: list[str]):
    return client.request(
        "/api/measures/component",
        {"component": project_key, "metricKeys": ",".join(metrics)},
    )


def fetch_measures(
    client: SonarClient, project_key: str
) -> tuple[dict[str, str], list[str], str]:
    """
    Fetch project measures, degrading gracefully around unsupported metrics.

    Strategy:
      1. Ask for every metric at once (one request in the normal case).
      2. On HTTP 400, remove the metric keys named in the error and retry, so a
         deprecated/unknown key costs only itself instead of the whole report.
      3. If a 400 cannot be attributed to specific keys, probe the metrics one
         by one so whatever the server does support is still reported.

    Returns (measures, unsupported_metrics, terminal_error). No value is ever
    invented: a metric that cannot be read is simply absent from `measures`,
    which makes the report render it as "not available".
    """
    metrics = list(MEASURE_METRICS)
    unsupported: list[str] = []
    last_message = ""

    for _attempt in range(len(MEASURE_METRICS) + 1):
        if not metrics:
            break
        payload, status, message = _measures_request(client, project_key, metrics)
        if payload is not None:
            measures = payload.get("component", {}).get("measures", [])
            return ({m["metric"]: m.get("value", "") for m in measures}, unsupported, "")

        last_message = message
        if status != 400:
            # Not a metric problem (auth, network, missing project) - terminal.
            client.errors.append(message)
            log(f"  ! {message}")
            return {}, unsupported, message

        rejected = _parse_unknown_metrics(message, metrics)
        if not rejected:
            break  # 400 we cannot attribute -> fall through to per-metric probing
        unsupported.extend(rejected)
        metrics = [m for m in metrics if m not in rejected]
        log(f"  . SonarQube rejected metric(s): {', '.join(rejected)} - retrying without them")

    # Last resort: find out individually which metrics this server accepts.
    log("  . probing metrics individually to salvage the supported ones")
    measures: dict[str, str] = {}
    unsupported = [m for m in MEASURE_METRICS if m in unsupported]
    for metric in MEASURE_METRICS:
        if metric in unsupported:
            continue
        payload, _status, _message = _measures_request(client, project_key, [metric])
        if payload is None:
            if metric not in unsupported:
                unsupported.append(metric)
            continue
        for entry in payload.get("component", {}).get("measures", []):
            measures[entry["metric"]] = entry.get("value", "")

    if not measures:
        client.errors.append(last_message)
        log(f"  ! {last_message}")
        return {}, unsupported, last_message
    return measures, unsupported, ""


def fetch_quality_gate(
    client: SonarClient, project_key: str, analysis_id: str | None
) -> dict | None:
    if analysis_id:
        payload = client.get("/api/qualitygates/project_status", {"analysisId": analysis_id})
        if payload and "projectStatus" in payload:
            return payload["projectStatus"]
    payload = client.get("/api/qualitygates/project_status", {"projectKey": project_key})
    if payload:
        return payload.get("projectStatus")
    return None


def fetch_issue_facets(client: SonarClient, project_key: str) -> dict:
    payload = client.get(
        "/api/issues/search",
        {
            "componentKeys": project_key,
            "resolved": "false",
            "facets": "severities,types",
            "ps": 1,
        },
    )
    if not payload:
        return {}
    facets = {}
    for facet in payload.get("facets", []):
        facets[facet["property"]] = {v["val"]: v["count"] for v in facet.get("values", [])}
    facets["_total"] = payload.get("total", 0)
    return facets


def fetch_top_issues(client: SonarClient, project_key: str, limit: int = 25) -> list[dict]:
    payload = client.get(
        "/api/issues/search",
        {
            "componentKeys": project_key,
            "resolved": "false",
            "s": "SEVERITY",
            "asc": "false",
            "ps": limit,
        },
    )
    if not payload:
        return []
    return payload.get("issues", [])


def fetch_hotspots(client: SonarClient, project_key: str, limit: int = 20) -> list[dict]:
    payload = client.get(
        "/api/hotspots/search",
        {"projectKey": project_key, "status": "TO_REVIEW", "ps": limit},
    )
    if not payload:
        return []
    return payload.get("hotspots", [])


def fetch_coverage_by_language(client: SonarClient, project_key: str) -> tuple[dict, str | None]:
    """
    Aggregate per-file coverage measures into per-language buckets.

    SonarQube exposes no per-language coverage metric, so this walks the file
    component tree and sums lines_to_cover / uncovered_lines by extension.
    Returns (buckets, error_message).
    """
    buckets: dict[str, dict[str, int]] = {}
    page = 1
    page_size = 500
    while True:
        payload = client.get(
            "/api/measures/component_tree",
            {
                "component": project_key,
                "qualifiers": "FIL",
                "metricKeys": "lines_to_cover,uncovered_lines,ncloc",
                "ps": page_size,
                "p": page,
            },
        )
        if not payload:
            return buckets, "component tree could not be read from the SonarQube API"
        components = payload.get("components", [])
        for component in components:
            path = component.get("path") or component.get("key", "")
            _, ext = os.path.splitext(path.lower())
            language = EXTENSION_LANGUAGE.get(ext)
            if not language:
                continue
            values = {m["metric"]: m.get("value", "0") for m in component.get("measures", [])}
            bucket = buckets.setdefault(
                language, {"files": 0, "files_with_coverage": 0, "lines_to_cover": 0, "uncovered_lines": 0}
            )
            bucket["files"] += 1
            if "lines_to_cover" in values:
                bucket["files_with_coverage"] += 1
                bucket["lines_to_cover"] += int(float(values.get("lines_to_cover", 0) or 0))
                bucket["uncovered_lines"] += int(float(values.get("uncovered_lines", 0) or 0))
        paging = payload.get("paging", {})
        total = paging.get("total", 0)
        if page * page_size >= total or not components:
            break
        page += 1
    return buckets, None


# --------------------------------------------------------------------------
# Formatting helpers
# --------------------------------------------------------------------------


def fmt_int(measures: dict, key: str) -> str:
    value = measures.get(key)
    if value in (None, ""):
        return NA
    try:
        return f"{int(float(value)):,}"
    except (TypeError, ValueError):
        return str(value)


def fmt_pct(measures: dict, key: str) -> str:
    value = measures.get(key)
    if value in (None, ""):
        return NA
    try:
        return f"{float(value):.1f}%"
    except (TypeError, ValueError):
        return str(value)


def fmt_rating(measures: dict, key: str) -> str:
    value = measures.get(key)
    if value in (None, ""):
        return NA
    letter = RATING_LETTERS.get(str(value).split(".")[0])
    return letter or str(value)


def fmt_duration_minutes(measures: dict, key: str) -> str:
    value = measures.get(key)
    if value in (None, ""):
        return NA
    try:
        minutes = int(float(value))
    except (TypeError, ValueError):
        return str(value)
    days, rem = divmod(minutes, 8 * 60)
    hours, mins = divmod(rem, 60)
    parts = []
    if days:
        parts.append(f"{days}d")
    if hours:
        parts.append(f"{hours}h")
    parts.append(f"{mins}min")
    return " ".join(parts)


def parse_language_distribution(raw: str | None) -> list[tuple[str, int]]:
    """Parse 'cs=11504;ts=12250;web=6546' into sorted (language, loc) pairs."""
    if not raw:
        return []
    rows: list[tuple[str, int]] = []
    for chunk in raw.split(";"):
        if "=" not in chunk:
            continue
        key, _, value = chunk.partition("=")
        try:
            loc = int(value)
        except ValueError:
            continue
        rows.append((LANGUAGE_NAMES.get(key, key), loc))
    rows.sort(key=lambda item: item[1], reverse=True)
    return rows


# --------------------------------------------------------------------------
# PDF rendering
# --------------------------------------------------------------------------


class ReportBuilder:
    def __init__(self, output_path: str):
        self.output_path = output_path
        self.story: list = []
        styles = getSampleStyleSheet()
        self.s_title = ParagraphStyle(
            "TitleX", parent=styles["Title"], fontSize=20, leading=24,
            textColor=colors.HexColor("#12324f"), alignment=TA_LEFT, spaceAfter=2,
        )
        self.s_subtitle = ParagraphStyle(
            "SubtitleX", parent=styles["Normal"], fontSize=10.5, leading=14,
            textColor=colors.HexColor("#4b5b68"),
        )
        self.s_h1 = ParagraphStyle(
            "H1X", parent=styles["Heading1"], fontSize=13.5, leading=17,
            textColor=colors.HexColor("#12324f"), spaceBefore=14, spaceAfter=5,
        )
        self.s_body = ParagraphStyle(
            "BodyX", parent=styles["Normal"], fontSize=9, leading=12.5,
        )
        self.s_note = ParagraphStyle(
            "NoteX", parent=styles["Normal"], fontSize=8.5, leading=11.5,
            textColor=colors.HexColor("#5a6570"),
        )
        self.s_cell = ParagraphStyle(
            "CellX", parent=styles["Normal"], fontSize=8, leading=10,
        )
        self.s_cell_bold = ParagraphStyle(
            "CellBoldX", parent=self.s_cell, fontName="Helvetica-Bold",
        )

    # -- primitives --------------------------------------------------------

    def title(self, text: str, subtitle: str = "") -> None:
        self.story.append(Paragraph(text, self.s_title))
        if subtitle:
            self.story.append(Paragraph(subtitle, self.s_subtitle))
        self.story.append(Spacer(1, 4))
        self.story.append(
            HRFlowable(width="100%", thickness=1.1, color=colors.HexColor("#12324f"))
        )
        self.story.append(Spacer(1, 6))

    def heading(self, text: str) -> None:
        self.story.append(Paragraph(text, self.s_h1))

    def para(self, text: str) -> None:
        self.story.append(Paragraph(text, self.s_body))
        self.story.append(Spacer(1, 3))

    def note(self, text: str) -> None:
        self.story.append(Paragraph(text, self.s_note))
        self.story.append(Spacer(1, 3))

    def bullets(self, items: list[str]) -> None:
        for item in items:
            self.story.append(Paragraph(f"&bull;&nbsp; {item}", self.s_body))
        self.story.append(Spacer(1, 4))

    def table(self, rows: list[list], widths: list[float], header: bool = True,
              align_right: list[int] | None = None) -> None:
        if not rows:
            return
        data = []
        for r_index, row in enumerate(rows):
            style = self.s_cell_bold if (header and r_index == 0) else self.s_cell
            data.append([
                cell if isinstance(cell, Paragraph) else Paragraph(str(cell), style)
                for cell in row
            ])
        table = Table(data, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
        commands = [
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#c9d2da")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]
        if header:
            commands += [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#12324f")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1),
                 [colors.white, colors.HexColor("#f2f5f8")]),
            ]
        for col in align_right or []:
            commands.append(("ALIGN", (col, 0), (col, -1), "RIGHT"))
        table.setStyle(TableStyle(commands))
        self.story.append(table)
        self.story.append(Spacer(1, 6))

    def page_break(self) -> None:
        self.story.append(PageBreak())

    def save(self) -> None:
        os.makedirs(os.path.dirname(os.path.abspath(self.output_path)), exist_ok=True)
        doc = SimpleDocTemplate(
            self.output_path,
            pagesize=A4,
            leftMargin=16 * mm, rightMargin=16 * mm,
            topMargin=14 * mm, bottomMargin=16 * mm,
            title="TAHDCO OneDashboard - SonarQube Report",
            author="GitHub Actions",
        )

        def footer(canvas, document):
            canvas.saveState()
            canvas.setFont("Helvetica", 7.5)
            canvas.setFillColor(colors.HexColor("#7a848d"))
            canvas.drawString(16 * mm, 9 * mm,
                              "TAHDCO OneDashboard - SonarQube analysis report (generated by GitHub Actions)")
            canvas.drawRightString(A4[0] - 16 * mm, 9 * mm, f"Page {document.page}")
            canvas.restoreState()

        doc.build(self.story, onFirstPage=footer, onLaterPages=footer)


# --------------------------------------------------------------------------
# Report assembly
# --------------------------------------------------------------------------

FULL = 178 * mm


def build_report(args, ctx: dict) -> None:
    measures: dict = ctx["measures"]
    status: dict = ctx["status"]
    limitations: list[str] = ctx["limitations"]
    steps: dict = status.get("steps", {})

    pdf = ReportBuilder(args.output)

    # ---- 1. Header / identification -------------------------------------
    pdf.title(
        "SonarQube Analysis Report",
        f"{args.project_name}",
    )
    pdf.table(
        [
            ["Field", "Value"],
            ["Project name", args.project_name],
            ["Project key", args.project_key],
            ["Scan date (UTC)", ctx["scan_date"]],
            ["Git branch", args.branch or NA],
            ["Git commit", args.commit or NA],
            ["Repository", status.get("run", {}).get("repository", NA)],
            ["Workflow run", status.get("run", {}).get("run_id", NA)],
            ["SonarQube server", ctx["host_display"]],
            ["Analysis reached server", "YES" if ctx["analysis_reachable"] else "NO"],
        ],
        [45 * mm, FULL - 45 * mm],
    )

    # ---- 2. Pipeline step status ----------------------------------------
    pdf.heading("1. Pipeline step status")
    if steps:
        pdf.table(
            [["Stage", "Outcome"]] + [
                [k.replace("_", " "), (v or NA).upper()] for k, v in steps.items()
            ],
            [70 * mm, FULL - 70 * mm],
        )
    else:
        pdf.para(f"Pipeline step status: {NA} (CI status file was not produced).")

    # ---- 3. Quality Gate -------------------------------------------------
    pdf.heading("2. Quality Gate")
    gate = ctx["quality_gate"]
    if gate:
        gate_status = gate.get("status", "NONE")
        verdict = {
            "OK": "PASSED",
            "ERROR": "FAILED",
            "WARN": "WARNING",
            "NONE": "No quality gate is attached to this project",
        }.get(gate_status, gate_status)
        pdf.table(
            [["Quality Gate status", "Verdict"], [gate_status, verdict]],
            [70 * mm, FULL - 70 * mm],
        )
        conditions = gate.get("conditions", [])
        if conditions:
            rows = [["Condition", "Comparator", "Threshold", "Actual", "Result"]]
            for cond in conditions:
                metric = cond.get("metricKey", "")
                rows.append([
                    METRIC_LABELS.get(metric, metric),
                    cond.get("comparator", ""),
                    cond.get("errorThreshold", ""),
                    cond.get("actualValue", NA),
                    "PASSED" if cond.get("status") == "OK" else cond.get("status", ""),
                ])
            pdf.table(rows, [62 * mm, 22 * mm, 22 * mm, 27 * mm, FULL - 133 * mm])
        else:
            pdf.para(f"Quality Gate conditions: {NA}.")
    else:
        pdf.para(
            f"Quality Gate status: <b>{NA}</b>. The Quality Gate could not be read "
            "from the SonarQube Web API - see Scan Limitations below."
        )
    pdf.note(
        "This Quality Gate is <b>REPORTING ONLY</b> in the current pipeline. A red gate "
        "is recorded here and surfaced as a workflow warning, but it does not fail the "
        "build and does not affect deployment, which remains a separate manual process."
    )

    # ---- 4. Size / lines of code ----------------------------------------
    pdf.heading("3. Size and lines of code")
    pdf.table(
        [
            ["Measure", "Value"],
            ["Lines of code (ncloc)", fmt_int(measures, "ncloc")],
            ["Total lines", fmt_int(measures, "lines")],
            ["Files analysed", fmt_int(measures, "files")],
            ["Statements", fmt_int(measures, "statements")],
            ["Functions", fmt_int(measures, "functions")],
            ["Classes", fmt_int(measures, "classes")],
            ["Comment lines", fmt_int(measures, "comment_lines")],
            ["Comment density", fmt_pct(measures, "comment_lines_density")],
        ],
        [70 * mm, FULL - 70 * mm],
        align_right=[1],
    )

    pdf.para("<b>Lines of code by language</b>")
    distribution = parse_language_distribution(measures.get("ncloc_language_distribution"))
    if distribution:
        total = sum(loc for _, loc in distribution) or 1
        rows = [["Language", "Lines of code", "Share"]]
        for language, loc in distribution:
            rows.append([language, f"{loc:,}", f"{loc * 100.0 / total:.1f}%"])
        rows.append(["TOTAL", f"{total:,}", "100.0%"])
        pdf.table(rows, [70 * mm, 40 * mm, FULL - 110 * mm], align_right=[1, 2])
    else:
        pdf.para(f"Lines of code by language: {NA}.")

    pdf.page_break()

    # ---- 5. Issues -------------------------------------------------------
    pdf.heading("4. Issues: bugs, vulnerabilities, hotspots, code smells")
    pdf.table(
        [
            ["Metric", "Count", "Rating"],
            ["Bugs", fmt_int(measures, "bugs"), fmt_rating(measures, "reliability_rating")],
            ["Vulnerabilities", fmt_int(measures, "vulnerabilities"), fmt_rating(measures, "security_rating")],
            ["Security Hotspots", fmt_int(measures, "security_hotspots"), fmt_rating(measures, "security_review_rating")],
            ["Code Smells", fmt_int(measures, "code_smells"), fmt_rating(measures, "sqale_rating")],
            ["Technical debt", fmt_duration_minutes(measures, "sqale_index"), "-"],
        ],
        [70 * mm, 40 * mm, FULL - 110 * mm],
        align_right=[1],
    )

    facets = ctx["facets"]
    severities = facets.get("severities", {})
    types = facets.get("types", {})
    if severities or types:
        rows = [["Breakdown", "Category", "Count"]]
        for key in ["BLOCKER", "CRITICAL", "MAJOR", "MINOR", "INFO"]:
            if key in severities:
                rows.append(["By severity", key, f"{severities[key]:,}"])
        for key in ["BUG", "VULNERABILITY", "CODE_SMELL"]:
            if key in types:
                rows.append(["By type", key, f"{types[key]:,}"])
        pdf.table(rows, [40 * mm, 60 * mm, FULL - 100 * mm], align_right=[2])
    else:
        pdf.para(f"Issue severity/type breakdown: {NA}.")

    # ---- 6. Duplications -------------------------------------------------
    pdf.heading("5. Duplications")
    pdf.table(
        [
            ["Measure", "Value"],
            ["Duplicated lines density", fmt_pct(measures, "duplicated_lines_density")],
            ["Duplicated lines", fmt_int(measures, "duplicated_lines")],
            ["Duplicated blocks", fmt_int(measures, "duplicated_blocks")],
            ["Duplicated files", fmt_int(measures, "duplicated_files")],
        ],
        [70 * mm, FULL - 70 * mm],
        align_right=[1],
    )

    # ---- 7. Coverage -----------------------------------------------------
    pdf.heading("6. Coverage")
    pdf.table(
        [
            ["Measure", "Value"],
            ["Overall coverage", fmt_pct(measures, "coverage")],
            ["Line coverage", fmt_pct(measures, "line_coverage")],
            ["Branch coverage", fmt_pct(measures, "branch_coverage")],
            ["Lines to cover", fmt_int(measures, "lines_to_cover")],
            ["Uncovered lines", fmt_int(measures, "uncovered_lines")],
            ["Conditions to cover", fmt_int(measures, "conditions_to_cover")],
            ["Uncovered conditions", fmt_int(measures, "uncovered_conditions")],
        ],
        [70 * mm, FULL - 70 * mm],
        align_right=[1],
    )

    pdf.para("<b>Coverage by language</b>")
    buckets = ctx["coverage_by_language"]
    if buckets:
        rows = [["Language", "Files", "Lines to cover", "Uncovered", "Coverage"]]
        for language in sorted(buckets):
            data = buckets[language]
            ltc = data["lines_to_cover"]
            unc = data["uncovered_lines"]
            if data["files_with_coverage"] == 0 or ltc == 0:
                cov = f"{NA} (no coverage report imported)"
            else:
                cov = f"{(ltc - unc) * 100.0 / ltc:.1f}%"
            rows.append([language, f"{data['files']:,}", f"{ltc:,}", f"{unc:,}", cov])
        pdf.table(rows, [38 * mm, 20 * mm, 30 * mm, 25 * mm, FULL - 113 * mm],
                  align_right=[1, 2, 3])
    else:
        pdf.para(f"Coverage by language: {NA}.")
    pdf.note(
        "SonarQube publishes no per-language coverage metric. The table above is computed "
        "by summing the per-file <i>lines to cover</i> and <i>uncovered lines</i> measures "
        "and grouping them by file extension. A language with zero lines to cover has no "
        "coverage report imported - it is reported as unavailable, never as 0% achieved "
        "and never as an estimate."
    )

    pdf.page_break()

    # ---- 8. Test execution status ---------------------------------------
    pdf.heading("7. Test execution status")
    counters = status.get("backend_test_counters")
    backend_outcome = (steps.get("backend_tests") or NA).upper()
    if counters:
        total = counters.get("total", 0)
        passed = counters.get("passed", 0)
        failed = counters.get("failed", 0)
        pdf.table(
            [
                ["Backend (xUnit / API.Tests)", "Value"],
                ["Step outcome", backend_outcome],
                ["Total tests", f"{total:,}"],
                ["Passed", f"{passed:,}"],
                ["Failed", f"{failed:,}"],
                ["Skipped / not executed", f"{counters.get('skipped', 0):,}"],
                ["Pass rate", f"{passed * 100.0 / total:.1f}%" if total else NA],
            ],
            [70 * mm, FULL - 70 * mm],
            align_right=[1],
        )
        if failed:
            pdf.para(
                f"<b>WARNING - the backend test suite is NOT green: {failed} of {total} "
                "tests failed.</b> Backend coverage figures in this report were produced "
                "by a run containing failures and must not be presented as healthy "
                "coverage. Application code was deliberately not modified to make these "
                "tests pass; fixing them is tracked separately from this SonarQube setup."
            )
    else:
        pdf.para(
            f"Backend test results: {NA} (step outcome: {backend_outcome}). No TRX result "
            "file was produced, so no pass/fail counts can be reported."
        )

    frontend_outcome = (steps.get("frontend_tests") or NA).upper()
    pdf.table(
        [
            ["Frontend (Karma / Jasmine)", "Value"],
            ["Step outcome", frontend_outcome],
            ["Result counts", f"{NA} (Karma is not configured to emit a machine-readable "
                              "test-result file; only coverage is exported)"],
        ],
        [70 * mm, FULL - 70 * mm],
    )

    # ---- 9. Coverage generation status ----------------------------------
    pdf.heading("8. Coverage generation status")
    cov_status = status.get("coverage", {})
    backend_reports = cov_status.get("backend_opencover_reports") or []
    frontend_reports = cov_status.get("frontend_lcov_reports") or []
    rows = [["Stack", "Report format", "Generated", "Files found"]]
    rows.append([
        "Backend (C#)", "OpenCover (coverlet.collector)",
        "YES" if backend_reports else "NO", str(len(backend_reports)),
    ])
    rows.append([
        "Frontend (TypeScript)", "LCOV (karma-coverage)",
        "YES" if frontend_reports else "NO", str(len(frontend_reports)),
    ])
    pdf.table(rows, [45 * mm, 55 * mm, 25 * mm, FULL - 125 * mm])

    if not backend_reports:
        pdf.para(
            "<b>Backend coverage was NOT generated.</b> No OpenCover report was found, so "
            "SonarQube imported no C# coverage. No coverage value has been substituted."
        )
    if not frontend_reports:
        pdf.para(
            "<b>Frontend coverage was NOT generated.</b> No lcov.info was produced - the "
            "most common cause is the headless Chrome browser failing to launch or be "
            "captured on the CI runner. No coverage value has been substituted."
        )

    # ---- 10. Important findings -----------------------------------------
    pdf.heading("9. Important findings")
    issues = ctx["issues"]
    if issues:
        rows = [["Severity", "Type", "File", "Line", "Message"]]
        for issue in issues:
            component = issue.get("component", "")
            path = component.split(":", 1)[-1]
            rows.append([
                issue.get("severity", ""),
                issue.get("type", ""),
                path,
                str(issue.get("line", "-")),
                issue.get("message", ""),
            ])
        pdf.table(rows, [20 * mm, 24 * mm, 48 * mm, 11 * mm, FULL - 103 * mm])
        pdf.note(
            f"Showing the {len(issues)} highest-severity unresolved issues. The full, "
            "navigable list lives in the SonarQube project dashboard."
        )
    else:
        pdf.para(f"Important findings: {NA} (issue list could not be retrieved, or none exist).")

    hotspots = ctx["hotspots"]
    if hotspots:
        pdf.para("<b>Security Hotspots awaiting review</b>")
        rows = [["Probability", "Category", "File", "Line", "Message"]]
        for hotspot in hotspots:
            component = hotspot.get("component", "")
            path = component.split(":", 1)[-1]
            rows.append([
                hotspot.get("vulnerabilityProbability", ""),
                hotspot.get("securityCategory", ""),
                path,
                str(hotspot.get("line", "-")),
                hotspot.get("message", ""),
            ])
        pdf.table(rows, [22 * mm, 30 * mm, 44 * mm, 11 * mm, FULL - 107 * mm])

    # ---- 11. Limitations -------------------------------------------------
    pdf.heading("10. Scan limitations and errors")
    if limitations:
        pdf.bullets([redact(item) for item in limitations])
    else:
        pdf.para("No scan limitations or errors were recorded for this run.")

    pdf.note(
        "Scope note: this workflow is analysis-only. It builds and analyses the code, "
        "publishes results to SonarQube and produces this report. It performs no "
        "deployment, and it does not modify the committed production bundle in "
        "backend/API/wwwroot, the publish profiles, the Dockerfile or any application "
        "source file."
    )

    pdf.save()


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate the SonarQube PDF report.")
    parser.add_argument("--project-key", required=True)
    parser.add_argument("--project-name", required=True)
    parser.add_argument("--branch", default="")
    parser.add_argument("--commit", default="")
    parser.add_argument("--report-task-file", default=".sonarqube/out/.sonar/report-task.txt")
    parser.add_argument("--status-file", default="")
    parser.add_argument("--output", required=True)
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)

    # Token comes from the environment only, never from the command line.
    token = os.environ.get("SONAR_TOKEN", "").strip()
    host = os.environ.get("SONAR_HOST_URL", "").strip()
    register_secret(token)

    limitations: list[str] = []
    status: dict = {}

    if args.status_file and os.path.isfile(args.status_file):
        try:
            with open(args.status_file, "r", encoding="utf-8-sig") as handle:
                status = json.load(handle)
        except Exception as exc:  # noqa: BLE001
            limitations.append(f"CI status file could not be parsed: {redact(exc)}")
    elif args.status_file:
        limitations.append(
            "CI status file was not produced, so pipeline step outcomes, test counts "
            "and coverage-generation status are unavailable in this report."
        )

    steps = status.get("steps", {})
    for name, outcome in steps.items():
        if outcome and outcome not in ("success", "skipped", ""):
            limitations.append(f"Pipeline stage '{name.replace('_', ' ')}' outcome: {outcome}.")

    if not status.get("coverage", {}).get("backend_opencover_reports"):
        limitations.append(
            "No OpenCover report was produced for the backend, so SonarQube imported no "
            "C# coverage. No coverage figure has been estimated or substituted."
        )
    if not status.get("coverage", {}).get("frontend_lcov_reports"):
        limitations.append(
            "No lcov.info was produced for the frontend, so SonarQube imported no "
            "TypeScript coverage. No coverage figure has been estimated or substituted."
        )
    counters = status.get("backend_test_counters") or {}
    if counters.get("failed"):
        limitations.append(
            f"{counters['failed']} of {counters.get('total', '?')} backend unit tests "
            "FAILED. Coverage produced by this run must not be described as healthy."
        )

    limitations.append(
        "MySQL / MariaDB SQL is NOT analysed by any SonarQube analyser available for "
        "this setup. The scripts under database/ therefore contribute no lines of code, "
        "no issues and no duplications to this report. SonarQube's SQL analysers cover "
        "Oracle PL/SQL and Microsoft T-SQL only; neither parses the MySQL dialect used "
        "here, so changing the SonarQube edition or licence will not enable analysis of "
        "these files."
    )
    limitations.append(
        "backend/API/wwwroot/** (the committed, minified Angular production bundle) is "
        "excluded from analysis by design. Its ~4.2 MB of generated JS/CSS would "
        "otherwise distort lines of code, duplications and code smells."
    )

    ctx = {
        "scan_date": _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
        "status": status,
        "limitations": limitations,
        "measures": {},
        "unsupported_metrics": [],
        "quality_gate": None,
        "facets": {},
        "issues": [],
        "hotspots": [],
        "coverage_by_language": {},
        "analysis_reachable": False,
        "host_display": host or NA,
    }

    if not host or not token:
        missing = " and ".join(
            [n for n, v in (("SONAR_HOST_URL", host), ("SONAR_TOKEN", token)) if not v]
        )
        limitations.insert(
            0,
            f"{missing} was not available to the report step, so NO data could be read "
            "from the SonarQube Web API. Every SonarQube metric in this report is "
            "therefore unavailable.",
        )
        log(f"! {missing} missing - producing a report without SonarQube API data.")
        build_report(args, ctx)
        log(f"PDF written to {args.output}")
        return 0

    client = SonarClient(host, token)

    task_info = read_report_task(args.report_task_file)
    analysis_id = None
    if task_info.get("ceTaskId"):
        log(f"Waiting for SonarQube compute-engine task {task_info['ceTaskId']} ...")
        analysis_id, task_status = wait_for_task(client, task_info["ceTaskId"])
        if task_status != "SUCCESS":
            limitations.insert(
                0,
                f"The SonarQube background (compute engine) task did not succeed: "
                f"{task_status}. Metrics below may be missing or stale.",
            )
    else:
        limitations.append(
            "report-task.txt was not found, so the report could not be tied to a specific "
            "analysis id. Quality Gate and metrics were read from the project's latest "
            "available analysis instead."
        )

    log("Fetching measures ...")
    measures, unsupported_metrics, measures_error = fetch_measures(client, args.project_key)
    ctx["measures"] = measures
    ctx["unsupported_metrics"] = unsupported_metrics
    ctx["analysis_reachable"] = bool(measures)
    if unsupported_metrics:
        limitations.append(
            "This SonarQube server does not support "
            f"{len(unsupported_metrics)} of the {len(MEASURE_METRICS)} requested metrics: "
            f"{', '.join(sorted(unsupported_metrics))}. Every field that depends on them is "
            "reported as \"not available\"; no value has been substituted. All other metrics "
            "were retrieved normally."
        )
    if measures_error:
        limitations.append(
            f"Project measures could not be read from the SonarQube Web API: {measures_error}"
        )

    log("Fetching quality gate ...")
    ctx["quality_gate"] = fetch_quality_gate(client, args.project_key, analysis_id)

    log("Fetching issue facets ...")
    ctx["facets"] = fetch_issue_facets(client, args.project_key)

    log("Fetching top issues ...")
    ctx["issues"] = fetch_top_issues(client, args.project_key)

    log("Fetching security hotspots ...")
    ctx["hotspots"] = fetch_hotspots(client, args.project_key)

    log("Aggregating coverage by language ...")
    buckets, cov_error = fetch_coverage_by_language(client, args.project_key)
    ctx["coverage_by_language"] = buckets
    if cov_error:
        limitations.append(f"Per-language coverage could not be computed: {cov_error}.")

    if not ctx["analysis_reachable"]:
        limitations.insert(
            0,
            "The SonarQube Web API returned no measures for this project key. The "
            "analysis may have failed, or the project key may not exist on the server.",
        )

    for error in client.errors:
        limitations.append(f"SonarQube Web API error: {error}")

    build_report(args, ctx)
    log(f"PDF written to {args.output}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except Exception as exc:  # noqa: BLE001 - never break the artifact upload
        log(f"FATAL: report generation failed: {redact(exc)}")
        sys.exit(1)
