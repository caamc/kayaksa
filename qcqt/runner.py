"""Runs allowlisted check commands from the trusted policy and writes an evidence manifest."""
import datetime as dt, hashlib, json, os, subprocess, time, uuid
import xml.etree.ElementTree as ET
from .gate import policy_digest


def git(args, cwd):
    try:
        return subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, timeout=30).stdout.strip()
    except Exception:
        return ""


def tree_identity(cwd):
    head = git(["rev-parse", "HEAD"], cwd) or "unknown"
    dirty = git(["status", "--porcelain"], cwd)
    if dirty:
        diff = git(["diff", "HEAD"], cwd)
        return head, "dirty:" + hashlib.sha256((dirty + diff).encode()).hexdigest()[:16]
    return head, "clean"


def parse_junit(path):
    """Count from <testcase> elements, so reports without suite totals (Node's junit reporter) still count.
    Falls back to suite attributes when a report has totals but no testcase elements."""
    root = ET.parse(path).getroot()
    cases = list(root.iter("testcase"))
    if cases:
        tot = {"tests": len(cases), "failures": 0, "errors": 0, "skipped": 0}
        for c in cases:
            tot["failures"] += 1 if c.find("failure") is not None else 0
            tot["errors"] += 1 if c.find("error") is not None else 0
            tot["skipped"] += 1 if c.find("skipped") is not None else 0
        return tot
    suites = [root] if root.tag == "testsuite" else list(root.iter("testsuite"))
    tot = {"tests": 0, "failures": 0, "errors": 0, "skipped": 0}
    for s in suites:
        for k in tot:
            tot[k] += int(s.get(k, 0))
    return tot


def run_check(check, cwd, logdir, allowlist):
    argv = check["argv"]
    if not isinstance(argv, list) or not argv or argv[0] not in allowlist:
        return {"id": check["id"], "status": "BLOCKED", "reason": "command not in allowlist", "report_required": False}
    started = time.time()
    try:
        p = subprocess.run(argv, cwd=cwd, capture_output=True, text=True, timeout=check.get("timeout_s", 600))
        code, out = p.returncode, p.stdout + p.stderr
        status = "PASS" if code == 0 else "FAIL"
    except subprocess.TimeoutExpired as e:
        code, out, status = None, (e.stdout or "") if isinstance(e.stdout, str) else "", "TIMED_OUT"
    except FileNotFoundError:
        code, out, status = None, "executable not found", "ERROR"
    log = os.path.join(logdir, f"{check['id']}.log")
    with open(log, "w") as fh:
        fh.write(out)
    rec = {"id": check["id"], "status": status, "exit_code": code, "argv": argv,
           "duration_s": round(time.time() - started, 3), "log": log,
           "log_sha256": hashlib.sha256(out.encode()).hexdigest(), "attempts": [status],
           "provider_mode": check.get("provider_mode", "none")}
    rep = check.get("junit")
    if rep:
        rp = os.path.join(cwd, rep)
        if os.path.exists(rp):
            t = parse_junit(rp)
            rec.update(tests_discovered=t["tests"], tests_failed=t["failures"],
                       tests_errors=t["errors"], tests_skipped=t["skipped"])
            if status == "PASS" and (t["failures"] or t["errors"]):
                rec["status"] = "FAIL"
        else:
            rec["tests_discovered"] = None
            if status == "PASS":
                rec["status"] = "BLOCKED"
                rec["reason"] = "report missing"
    else:
        rec["report_required"] = False
    return rec


def run(policy, event, cwd, outdir):
    os.makedirs(outdir, exist_ok=True)
    run_id = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ-") + uuid.uuid4().hex[:8]
    logdir = os.path.join(outdir, run_id)
    os.makedirs(logdir)
    head, tree = tree_identity(cwd)
    defs = {c["id"]: c for c in policy.get("checks", [])}
    allow = set(policy.get("command_allowlist", []))
    results = []
    for cid in policy.get("events", {}).get(event, []):
        if cid not in defs:
            results.append({"id": cid, "status": "BLOCKED", "reason": "no definition in policy"})
            continue
        results.append(run_check(defs[cid], cwd, logdir, allow))
    manifest = {"run_id": run_id, "event": event, "tested_commit": head, "tree_state": tree,
                "policy_sha256": policy_digest(policy), "policy_version": policy.get("version"),
                "started": run_id[:16], "execution_status": "concluded", "checks": results,
                "findings": []}
    path = os.path.join(outdir, f"{run_id}.json")
    with open(path, "w") as fh:
        json.dump(manifest, fh, indent=2)
    return manifest, path
