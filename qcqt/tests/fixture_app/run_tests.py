"""Runs the fixture suite and writes JUnit XML (stdlib only)."""
import sys, unittest, xml.etree.ElementTree as ET
pattern = sys.argv[1] if len(sys.argv) > 1 else "test_*.py"
suite = unittest.defaultTestLoader.discover(".", pattern=pattern)
res = unittest.TextTestRunner(verbosity=2).run(suite)
ts = ET.Element("testsuite", tests=str(res.testsRun), failures=str(len(res.failures)),
                errors=str(len(res.errors)), skipped=str(len(res.skipped)))
ET.ElementTree(ts).write("junit.xml")
sys.exit(0 if res.wasSuccessful() else 1)
