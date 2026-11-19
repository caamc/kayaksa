"""Seeded-defect fixture: tenant-scoped invoice export. DEFECT: admin export skips tenant filter."""
INVOICES = [
    {"id": 1, "tenant": "t1", "amount": 100},
    {"id": 2, "tenant": "t2", "amount": 250},
]
EXPORT_ROLES = {"admin", "finance"}


def visible(user):
    return [i for i in INVOICES if i["tenant"] == user["tenant"]]


def export_csv(user):
    if user["role"] == "admin":
        rows = INVOICES  # seeded defect: cross-tenant leak
    else:
        rows = visible(user)
    return "id,amount\n" + "".join(f"{r['id']},{r['amount']}\n" for r in rows)
