"""QCQT activation acceptance tests. Run: python3 -m qcqt.selftest --junit reports/qcqt-selftest.xml"""
import copy, datetime as dt, json, os, shutil, subprocess, sys, tempfile, unittest
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(HERE)))
from qcqt.gate import evaluate, policy_digest
from qcqt.runner import run

NOW = dt.datetime(2026, 11, 19, tzinfo=dt.timezone.utc)
POLICY = {
    "version": "test-1", "max_fix_revisions": 2,
    "command_allowlist": ["python3"],
    "checks": [{"id": "unit", "argv": ["python3", "run_tests.py"], "junit": "junit.xml"},
               {"id": "provider", "argv": ["python3", "-c", "print('ok')"], "provider_mode": "mock"}],
    "events": {"pull_request": ["unit", "provider"], "push": ["unit"]},
    "live_provider_required": ["provider"], "no_skips": ["unit"],
    "exception_authorities": ["product-owner"], "exceptions": [],
}


def good_evidence(policy=POLICY, head="abc"):
    return {"run_id": "r1", "event": "pull_request", "tested_commit": head,
            "policy_sha256": policy_digest(policy), "execution_status": "concluded",
            "checks": [{"id": "unit", "status": "PASS", "tests_discovered": 8, "tests_failed": 0,
                        "tests_skipped": 0, "attempts": ["PASS"]},
                       {"id": "provider", "status": "PASS", "provider_mode": "live", "report_required": False}],
            "findings": []}


class GateLogic(unittest.TestCase):
    def ev(self, ev, event="pull_request", head="abc", ledger=None, policy=POLICY):
        return evaluate(policy, ev, event, head, NOW, ledger)

    def test_13_clean_path_passes(self):
        self.assertEqual(self.ev(good_evidence())[0], "PASS")

    def test_04_missing_failed_skipped_timeout_malformed_block(self):
        for mutate in (lambda e: e["checks"].pop(0),
                       lambda e: e["checks"][0].update(status="FAIL"),
                       lambda e: e["checks"][0].update(tests_skipped=1),
                       lambda e: e["checks"][0].update(status="TIMED_OUT"),
                       lambda e: e["checks"][0].update(tests_discovered=0),
                       lambda e: e["checks"].append({"bogus": 1}),
                       lambda e: e.update(execution_status="dry_run")):
            e = good_evidence(); mutate(e)
            self.assertEqual(self.ev(e)[0], "BLOCKED", e)
        self.assertEqual(self.ev({"checks": []})[0], "BLOCKED")

    def test_05_stale_commit_and_policy_change_block(self):
        self.assertEqual(self.ev(good_evidence(head="old"))[0], "BLOCKED")
        p2 = copy.deepcopy(POLICY); p2["version"] = "test-2"
        self.assertEqual(self.ev(good_evidence(), policy=p2)[0], "BLOCKED")
        p3 = copy.deepcopy(POLICY); p3["expected_versions"] = {"model_version": "m2"}
        e = good_evidence(p3); e["model_version"] = "m1"
        self.assertEqual(self.ev(e, policy=p3)[0], "BLOCKED")

    def test_06_failed_then_passed_is_flaky(self):
        e = good_evidence(); e["checks"][0]["attempts"] = ["FAIL", "PASS"]
        v, r, _ = self.ev(e)
        self.assertEqual(v, "BLOCKED"); self.assertTrue(any("FLAKY" in x for x in r))

    def test_07_mock_cannot_substitute_live_provider(self):
        e = good_evidence(); e["checks"][1]["provider_mode"] = "mock"
        self.assertEqual(self.ev(e)[0], "BLOCKED")

    def test_08_forged_verdict_and_not_applicable_rejected(self):
        e = good_evidence(); e["verdict_claim"] = "PASS"; e["checks"][0]["status"] = "FAIL"
        self.assertEqual(self.ev(e)[0], "BLOCKED")
        e = good_evidence(); e["checks"][0]["status"] = "NOT_APPLICABLE"
        self.assertEqual(self.ev(e)[0], "BLOCKED")

    def test_10_budget_not_reset_by_rename_or_commit(self):
        e = good_evidence(); e["findings"] = [{"id": "F-new-name", "stable_id": "F1", "severity": "low",
                                               "status": "verified_fixed", "fix_revisions": 1}]
        self.assertEqual(self.ev(e, ledger={"F1": 3})[0], "BLOCKED")

    def test_high_finding_blocks_unless_valid_exception(self):
        e = good_evidence(); e["findings"] = [{"stable_id": "F2", "severity": "high", "status": "open"}]
        self.assertEqual(self.ev(e)[0], "BLOCKED")
        p = copy.deepcopy(POLICY)
        p["exceptions"] = [{"finding": "F2", "approved_by": "product-owner", "expires": "2026-12-01T00:00:00Z"}]
        self.assertEqual(self.ev(good_evidence(p) | {"findings": e["findings"]}, policy=p)[0], "PASS_WITH_CONDITIONS")
        p["exceptions"][0]["expires"] = "2026-11-01T00:00:00Z"
        self.assertEqual(self.ev(good_evidence(p) | {"findings": e["findings"]}, policy=p)[0], "BLOCKED")
        p["exceptions"] = [{"finding": "F2", "approved_by": "the-candidate", "expires": "2026-12-01T00:00:00Z"}]
        self.assertEqual(self.ev(good_evidence(p) | {"findings": e["findings"]}, policy=p)[0], "BLOCKED")


class RunnerOnSeededDefect(unittest.TestCase):
    """Acceptance 2 and 3: superficial tests pass, requirement tests expose a cross-tenant defect."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        shutil.copytree(os.path.join(HERE, "fixture_app"), self.tmp, dirs_exist_ok=True)
        for f in ("junit.xml",):
            p = os.path.join(self.tmp, f)
            if os.path.exists(p): os.remove(p)
        subprocess.run(["git", "init", "-q"], cwd=self.tmp)
        subprocess.run(["git", "-c", "user.name=qcqt", "-c", "user.email=qcqt@example.invalid",
                        "commit", "-qam", "init", "--allow-empty"], cwd=self.tmp)
        subprocess.run(["git", "add", "-A"], cwd=self.tmp)
        subprocess.run(["git", "-c", "user.name=qcqt", "-c", "user.email=qcqt@example.invalid",
                        "commit", "-qm", "fixture"], cwd=self.tmp)

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def _policy(self):
        p = copy.deepcopy(POLICY); p["events"] = {"push": ["unit"]}; return p

    def test_02_03_defect_detected_then_fixed(self):
        out = os.path.join(self.tmp, ".qcqt", "runs")
        os.environ["FIXTURE_MODULE"] = "app"
        m, _ = run(self._policy(), "push", self.tmp, out)
        self.assertEqual(m["checks"][0]["status"], "FAIL")
        self.assertGreaterEqual(m["checks"][0]["tests_failed"] + m["checks"][0]["tests_errors"], 2)
        v, r, _ = evaluate(self._policy(), m, "push", m["tested_commit"], NOW)
        self.assertEqual(v, "BLOCKED")
        os.environ["FIXTURE_MODULE"] = "fixed_app"
        m2, _ = run(self._policy(), "push", self.tmp, out)
        self.assertEqual(m2["checks"][0]["status"], "PASS")
        self.assertEqual(m2["checks"][0]["tests_discovered"], 4)
        self.assertEqual(evaluate(self._policy(), m2, "push", m2["tested_commit"], NOW)[0], "PASS")
        os.environ.pop("FIXTURE_MODULE")

    def test_missing_report_blocks(self):
        p = self._policy(); p["checks"][0]["argv"] = ["python3", "-c", "print('no report')"]
        m, _ = run(p, "push", self.tmp, os.path.join(self.tmp, ".qcqt", "runs"))
        self.assertEqual(m["checks"][0]["status"], "BLOCKED")

    def test_non_allowlisted_command_blocked(self):
        p = self._policy(); p["checks"][0]["argv"] = ["bash", "-c", "exit 0"]
        m, _ = run(p, "push", self.tmp, os.path.join(self.tmp, ".qcqt", "runs"))
        self.assertEqual(m["checks"][0]["status"], "BLOCKED")


if __name__ == "__main__":
    unittest.main()


class Hygiene(unittest.TestCase):
    def _repo(self, files):
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d, True)
        for p, body in files.items():
            os.makedirs(os.path.dirname(os.path.join(d, p)) or d, exist_ok=True)
            with open(os.path.join(d, p), "w") as fh:
                fh.write(body)
        subprocess.run(["git", "init", "-q"], cwd=d)
        subprocess.run(["git", "add", "-A"], cwd=d)
        return d

    def test_clean_repo_passes(self):
        from qcqt.hygiene import scan
        d = self._repo({"README.md": "hello", ".env.example": "KEY=\n"})
        self.assertEqual(scan(d, []), [])

    def test_planted_secrets_are_found(self):
        from qcqt.hygiene import scan
        key = "-----BEGIN " + "PRIVATE KEY-----"
        tok = "gh" + "p_" + "A" * 36
        d = self._repo({"a.txt": key + "\n", "src/b.js": "const t = '" + tok + "'\n", ".env": "X=1\n"})
        kinds = sorted(k for _, _, k in scan(d, []))
        self.assertEqual(kinds, ["github-token", "private-key-block", "tracked-env-file"])
