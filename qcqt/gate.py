"""Deterministic gate evaluator. Trusts only the policy; never executes evidence."""
import datetime as dt, hashlib, json

OUTCOMES = {"PASS", "FAIL", "NOT_RUN", "BLOCKED", "NOT_APPLICABLE", "FLAKY",
            "SKIPPED", "CANCELLED", "TIMED_OUT", "ERROR"}
BLOCKING_SEVERITIES = {"critical", "high"}
OPEN_STATES = {"open", "blocked", "fixed_not_verified"}


def canonical(obj):
    return json.dumps(obj, sort_keys=True, separators=(",", ":")).encode()


def policy_digest(policy):
    return hashlib.sha256(canonical(policy)).hexdigest()


def _parse_time(s):
    return dt.datetime.fromisoformat(s.replace("Z", "+00:00"))


def _valid_exception(policy, finding_id, now):
    for e in policy.get("exceptions", []):
        if e.get("finding") != finding_id:
            continue
        if e.get("approved_by") not in policy.get("exception_authorities", []):
            continue
        try:
            if _parse_time(e["expires"]) > now:
                return e
        except (KeyError, ValueError, AttributeError):
            continue
    return None


def evaluate(policy, evidence, event, head, now=None, ledger=None):
    """Return (verdict, reasons, conditions).

    ledger: optional trusted remediation ledger {stable_finding_id: revisions_used}
    kept outside the candidate, so renaming or new commits cannot reset budgets.
    """
    reasons, conditions = [], []
    now = now or dt.datetime.now(dt.timezone.utc)
    if not isinstance(evidence, dict):
        return "BLOCKED", ["evidence manifest is not an object"], []
    missing = [k for k in ("run_id", "event", "tested_commit", "policy_sha256", "checks") if k not in evidence]
    if missing:
        return "BLOCKED", [f"evidence missing field '{k}'" for k in missing], []
    if evidence.get("execution_status") in {"dry_run", "partial", "cancelled", "interrupted"}:
        reasons.append(f"execution status '{evidence['execution_status']}' cannot pass a mandatory gate")
    if evidence["policy_sha256"] != policy_digest(policy):
        reasons.append("evidence was produced under a different policy version")
    if evidence["event"] != event:
        reasons.append(f"evidence event '{evidence['event']}' does not match '{event}'")
    if evidence["tested_commit"] != head:
        reasons.append("stale evidence: tested commit is not the current candidate")
    for k in ("model_version", "config_version", "dataset_version"):
        exp = policy.get("expected_versions", {}).get(k)
        if exp is not None and evidence.get(k) != exp:
            reasons.append(f"{k} '{evidence.get(k)}' differs from policy '{exp}'; evidence invalidated")
    if "verdict_claim" in evidence:
        conditions.append("ignored candidate-supplied verdict_claim")

    required = policy.get("events", {}).get(event)
    if required is None:
        return "BLOCKED", reasons + [f"policy defines no required checks for event '{event}'"], conditions
    checks = {}
    for c in evidence["checks"]:
        if not isinstance(c, dict) or "id" not in c or "status" not in c:
            reasons.append("malformed check record")
            continue
        if c["id"] in checks:
            reasons.append(f"duplicate check record '{c['id']}'")
        checks[c["id"]] = c
    na_allowed = set(policy.get("not_applicable_allowed", {}).get(event, []))
    live_required = set(policy.get("live_provider_required", []))
    no_skips = set(policy.get("no_skips", []))
    for rid in required:
        c = checks.get(rid)
        if c is None:
            reasons.append(f"required check '{rid}' missing")
            continue
        st = c["status"]
        if st not in OUTCOMES:
            reasons.append(f"check '{rid}' has unknown status '{st}'")
            continue
        if st == "NOT_APPLICABLE":
            if rid not in na_allowed:
                reasons.append(f"check '{rid}' marked NOT_APPLICABLE without policy permission")
            continue
        if st != "PASS":
            reasons.append(f"required check '{rid}' is {st}")
            continue
        attempts = c.get("attempts") or ["PASS"]
        if attempts[0] != "PASS" and not c.get("flake_explained"):
            reasons.append(f"check '{rid}' failed then passed without explanation (FLAKY)")
        if c.get("report_required", True) and c.get("tests_discovered") in (None, 0):
            reasons.append(f"check '{rid}' has no discovered tests or no report")
        if c.get("tests_failed", 0) > 0 or c.get("tests_errors", 0) > 0:
            reasons.append(f"check '{rid}' reports failures despite PASS status")
        if c.get("tests_skipped", 0) > 0 and rid in no_skips:
            reasons.append(f"check '{rid}' skipped {c['tests_skipped']} mandatory tests")
        if rid in live_required and c.get("provider_mode") != "live":
            reasons.append(f"check '{rid}' provider mode '{c.get('provider_mode', 'unknown')}'; live evidence required")
        if c.get("tested_commit", evidence["tested_commit"]) != evidence["tested_commit"]:
            reasons.append(f"check '{rid}' ran on a different commit")

    budget = policy.get("max_fix_revisions", 2)
    ledger = ledger or {}
    for f in evidence.get("findings", []):
        key = f.get("stable_id") or f.get("id")
        used = max(f.get("fix_revisions", 0), ledger.get(key, 0))
        if used > budget:
            reasons.append(f"finding '{key}' exceeded the fix revision budget ({used}>{budget})")
        if f.get("status") in OPEN_STATES:
            if f.get("severity") in BLOCKING_SEVERITIES:
                exc = _valid_exception(policy, key, now)
                if exc:
                    conditions.append(f"finding '{key}' accepted by {exc['approved_by']} until {exc['expires']}")
                else:
                    reasons.append(f"unresolved {f.get('severity')} finding '{key}'")
            else:
                conditions.append(f"open {f.get('severity', 'unclassified')} finding '{key}'")
    if reasons:
        return "BLOCKED", reasons, conditions
    if any(not c.startswith("ignored") for c in conditions):
        return "PASS_WITH_CONDITIONS", [], conditions
    return "PASS", [], conditions
