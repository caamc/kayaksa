"""Corrected fixture: reuse the tenant filter and enforce an export role allowlist."""
INVOICES = [
    {"id": 1, "tenant": "t1", "amount": 100},
    {"id": 2, "tenant": "t2", "amount": 250},
]
EXPORT_ROLES = {"admin", "finance"}


def visible(user):
    return [i for i in INVOICES if i["tenant"] == user["tenant"]]


def export_csv(user):
    if user.get("role") not in EXPORT_ROLES:
        raise PermissionError("role may not export")
    return "id,amount\n" + "".join(f"{r['id']},{r['amount']}\n" for r in visible(user))
