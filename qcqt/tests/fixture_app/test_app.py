import importlib, os, unittest
app = importlib.import_module(os.environ.get("FIXTURE_MODULE", "app"))


class Superficial(unittest.TestCase):
    def test_visible_scoped(self):
        self.assertEqual([i["id"] for i in app.visible({"tenant": "t1", "role": "admin"})], [1])

    def test_csv_header(self):
        self.assertTrue(app.export_csv({"tenant": "t1", "role": "finance"}).startswith("id,amount"))


class RequirementBased(unittest.TestCase):
    def test_admin_export_is_tenant_scoped(self):
        out = app.export_csv({"tenant": "t1", "role": "admin"})
        self.assertNotIn("2,250", out)

    def test_viewer_cannot_export(self):
        with self.assertRaises(PermissionError):
            app.export_csv({"tenant": "t1", "role": "viewer"})
