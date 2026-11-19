# QCQT quality gate

QCQT (Quality Check and Quality Testing) runs this repository's checks from a policy kept on `main`, records an evidence manifest per run, and fails closed: a missing report, a stale commit, an unexplained flaky result, skipped mandatory tests or an unknown status all give BLOCKED.

## Files

| Path | Purpose |
|---|---|
| `.qcqt/policy.json` | The checks and which events require them. CI reads the copy on `main`, so a pull request cannot loosen its own gate. |
| `qcqt/` | Runner and evaluator, Python standard library only (`doctor`, `plan`, `run`, `gate`, `report`), plus `qcqt.selftest` and `qcqt.hygiene` |
| `qcqt/tests/` | QCQT's own acceptance tests and a seeded-defect fixture |
| `.github/workflows/qcqt.yml` | Runs the checks, then the `qcqt-gate` job evaluates the evidence |
| `.claude/skills/qcqt/SKILL.md` | The `/qcqt` skill for Claude sessions in this repository |

## Run locally

```
python3 -m qcqt doctor
python3 -m qcqt plan --event pull_request
python3 -m qcqt run  --event pull_request --out .qcqt/runs
python3 -m qcqt gate --event pull_request --evidence .qcqt/runs/<run>.json --head "$(git rev-parse HEAD)"
python3 -m qcqt report --evidence .qcqt/runs/<run>.json
```

## Enforcement

The gate only blocks merges once `qcqt-gate` is a required status check on `main` (Settings > Branches, needs a repository admin). Until this change is on `main`, CI runs in bootstrap mode and says so in a warning, because the policy and evaluator then come from the candidate itself.

## Changing the gate

Edit `.qcqt/policy.json` in a pull request. The new policy takes effect only after it merges to `main`. Exceptions need an `approved_by` listed in `exception_authorities` and an `expires` date.

## Limits

`qcqt.hygiene` is a pattern check for obvious secrets and tracked `.env` files; it is not a full secret scanner. QCQT does not replace any existing workflow in this repository.

## Removal

Delete `qcqt/`, `.qcqt/`, `.claude/skills/qcqt/` and `.github/workflows/qcqt.yml`, and remove `qcqt-gate` from required checks.
