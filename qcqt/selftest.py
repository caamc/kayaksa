"""Run QCQT's own acceptance tests and write a JUnit report (stdlib only).

python3 -m qcqt.selftest --junit reports/qcqt-selftest.xml
"""
import argparse, os, sys, unittest, xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))


def main(argv=None):
    ap = argparse.ArgumentParser(prog="qcqt.selftest")
    ap.add_argument("--junit", required=True)
    a = ap.parse_args(argv)
    suite = unittest.defaultTestLoader.discover(os.path.join(HERE, "tests"), pattern="test_qcqt.py",
                                                top_level_dir=os.path.dirname(HERE))
    res = unittest.TextTestRunner(verbosity=2).run(suite)
    os.makedirs(os.path.dirname(os.path.abspath(a.junit)), exist_ok=True)
    ts = ET.Element("testsuite", name="qcqt-selftest", tests=str(res.testsRun),
                    failures=str(len(res.failures)), errors=str(len(res.errors)), skipped=str(len(res.skipped)))
    for case, tb in res.failures + res.errors:
        ET.SubElement(ET.SubElement(ts, "testcase", name=str(case)), "failure").text = tb
    ET.ElementTree(ts).write(a.junit, encoding="utf-8", xml_declaration=True)
    return 0 if res.wasSuccessful() and res.testsRun > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
