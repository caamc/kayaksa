"""Repository hygiene check: tracked files must not contain obvious secrets or committed env files.

python3 -m qcqt.hygiene --junit reports/qcqt-hygiene.xml

Heuristic only. It catches private-key blocks, common cloud and GitHub token shapes, and
tracked .env files. It does not replace secret scanning on the hosting platform.
"""
import argparse, os, re, subprocess, sys, xml.etree.ElementTree as ET

PATTERNS = {
    "private-key-block": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----"),
    "aws-access-key-id": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "github-token": re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{60,}\b"),
    "slack-token": re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}\b"),
    "anthropic-key": re.compile(r"\bsk-ant-[A-Za-z0-9_-]{20,}\b"),
    "openai-key": re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9]{32,}\b"),
    "google-api-key": re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b"),
}
ENV_FILE = re.compile(r"(^|/)\.env(\.[^/]*)?$")
ENV_OK = re.compile(r"\.(example|sample|template)$")
MAX_BYTES = 2_000_000


def tracked(cwd):
    out = subprocess.run(["git", "ls-files", "-z"], cwd=cwd, capture_output=True, check=True).stdout
    return [p for p in out.decode().split("\0") if p]


def scan(cwd, allow):
    findings = []
    for path in tracked(cwd):
        if any(re.search(a, path) for a in allow):
            continue
        if ENV_FILE.search(path) and not ENV_OK.search(path):
            findings.append((path, 0, "tracked-env-file"))
        full = os.path.join(cwd, path)
        try:
            if not os.path.isfile(full) or os.path.getsize(full) > MAX_BYTES:
                continue
            with open(full, "rb") as fh:
                data = fh.read()
        except OSError:
            continue
        if b"\0" in data[:4096]:
            continue
        text = data.decode("utf-8", "replace")
        for n, line in enumerate(text.splitlines(), 1):
            for name, rx in PATTERNS.items():
                if rx.search(line):
                    findings.append((path, n, name))
    return findings


def main(argv=None):
    ap = argparse.ArgumentParser(prog="qcqt.hygiene")
    ap.add_argument("--junit", required=True)
    ap.add_argument("--cwd", default=".")
    ap.add_argument("--allow", action="append", default=[r"^qcqt/hygiene\.py$", r"^qcqt/tests/"],
                    help="regex of tracked paths to skip (repeatable)")
    a = ap.parse_args(argv)
    files = tracked(a.cwd)
    findings = scan(a.cwd, a.allow)
    os.makedirs(os.path.dirname(os.path.abspath(a.junit)), exist_ok=True)
    ts = ET.Element("testsuite", name="qcqt-hygiene", tests=str(len(PATTERNS) + 1),
                    failures=str(len(findings)), errors="0", skipped="0")
    for name in list(PATTERNS) + ["tracked-env-file"]:
        tc = ET.SubElement(ts, "testcase", name=name)
        for path, line, kind in findings:
            if kind == name:
                ET.SubElement(tc, "failure").text = f"{path}:{line}"
    ET.ElementTree(ts).write(a.junit, encoding="utf-8", xml_declaration=True)
    print(f"scanned {len(files)} tracked files; {len(findings)} finding(s)")
    for path, line, kind in findings:
        print(f"  {kind}: {path}:{line}")
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
