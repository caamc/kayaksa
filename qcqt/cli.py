"""qcqt CLI: doctor | plan | run | gate | report. Nonzero exit when a gate is blocked."""
import argparse, json, os, shutil, sys
from . import __version__
from .gate import evaluate, policy_digest
from .runner import run, tree_identity


def load(p):
    with open(p) as fh:
        return json.load(fh)


def cmd_doctor(a):
    ok = True
    print(f"qcqt {__version__}; python {sys.version.split()[0]}")
    for tool in ("git",):
        found = shutil.which(tool)
        print(f"{tool}: {'found' if found else 'MISSING'}")
        ok &= bool(found)
    if os.path.exists(a.policy):
        pol = load(a.policy)
        print(f"policy {a.policy}: version {pol.get('version')} sha256 {policy_digest(pol)[:16]}")
        print("events:", ", ".join(pol.get("events", {})))
    else:
        print(f"policy {a.policy}: MISSING"); ok = False
    head, tree = tree_identity(a.cwd)
    print(f"tree: {head} ({tree})")
    return 0 if ok else 1


def cmd_plan(a):
    pol = load(a.policy)
    req = pol.get("events", {}).get(a.event)
    if req is None:
        print(f"no checks defined for event '{a.event}' (gate will BLOCK)"); return 1
    defs = {c["id"]: c for c in pol.get("checks", [])}
    for cid in req:
        d = defs.get(cid)
        print(f"- {cid}: {' '.join(d['argv']) if d else 'UNDEFINED'}")
    return 0


def cmd_run(a):
    pol = load(a.policy)
    m, path = run(pol, a.event, a.cwd, a.out)
    print(path)
    for c in m["checks"]:
        print(f"{c['id']}: {c['status']}")
    return 0 if all(c["status"] == "PASS" for c in m["checks"]) else 1


def cmd_gate(a):
    try:
        pol, ev = load(a.policy), load(a.evidence)
        ledger = load(a.ledger) if a.ledger else None
        v, r, c = evaluate(pol, ev, a.event, a.head, ledger=ledger)
    except Exception as exc:
        pol, v, r, c = {}, "BLOCKED", [f"evaluator error: {exc}"], []
    print(json.dumps({"verdict": v, "reasons": r, "conditions": c}, indent=2))
    if v == "PASS" or (v == "PASS_WITH_CONDITIONS" and pol.get("conditional_is_success") is True):
        return 0
    return 1


def cmd_report(a):
    ev = load(a.evidence)
    lines = [f"# QCQT run {ev.get('run_id')}", "",
             f"Event: {ev.get('event')} | Commit: {ev.get('tested_commit')} | Tree: {ev.get('tree_state')}",
             f"Policy: {ev.get('policy_version')} ({str(ev.get('policy_sha256'))[:16]})", "",
             "| Check | Status | Exit | Tests | Failed | Skipped |", "|---|---|---|---|---|---|"]
    for c in ev.get("checks", []):
        lines.append(f"| {c['id']} | {c['status']} | {c.get('exit_code')} | {c.get('tests_discovered')} | "
                     f"{c.get('tests_failed')} | {c.get('tests_skipped')} |")
    print("\n".join(lines))
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(prog="qcqt")
    sub = ap.add_subparsers(dest="cmd", required=True)
    def common(p, ev=True):
        p.add_argument("--policy", default=".qcqt/policy.json")
        p.add_argument("--cwd", default=".")
        if ev: p.add_argument("--event", required=True)
    p = sub.add_parser("doctor"); common(p, ev=False); p.set_defaults(f=cmd_doctor)
    p = sub.add_parser("plan"); common(p); p.set_defaults(f=cmd_plan)
    p = sub.add_parser("run"); common(p); p.add_argument("--out", default=".qcqt/runs"); p.set_defaults(f=cmd_run)
    p = sub.add_parser("gate"); common(p); p.add_argument("--evidence", required=True)
    p.add_argument("--head", required=True); p.add_argument("--ledger"); p.set_defaults(f=cmd_gate)
    p = sub.add_parser("report"); p.add_argument("--evidence", required=True); p.set_defaults(f=cmd_report)
    a = ap.parse_args(argv)
    return a.f(a)


if __name__ == "__main__":
    sys.exit(main())
