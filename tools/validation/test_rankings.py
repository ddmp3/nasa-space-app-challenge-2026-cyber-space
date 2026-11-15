import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import rankings as rk  # noqa: E402


def site(i, role, total, excluded=None, missing=0):
    criteria = [{"verdict": "missing" if k < missing else "match"} for k in range(4)]
    s = {"id": i, "name": i.title(), "role": role, "total": total, "criteria": criteria}
    if excluded:
        s["excluded"] = excluded
    return s


def test_expected_by_mode():
    exp = rk.expected_by_mode([{"id": "a", "known_for": ["robotics", "colony"]}, {"id": "b", "known_for": []}, {"id": "c"}])
    assert exp["robotics"] == {"a"} and exp["colony"] == {"a"} and exp["calibration"] == set()


def test_check_mode_counts_only_expected_analogs():
    sites = [site("a", "validation", 90), site("c", "validation", 88), site("b", "candidate", 85),
             site("hot", "validation", 40, missing=2), site("neg", "negative", 0, excluded="vegetation")]
    s = rk.check_mode(sites, expected={"a", "c"})      # « hot » n'est pas attendu dans ce mode : pas d'échec
    assert s["ranked"] == 4 and s["excluded"] == ["neg"] and s["negative_ok"]
    assert s["expected_met"] == ["a", "c"] and s["expected_missed"] == []
    assert s["top_candidates"][0] == ("b", "B", 85)
    assert s["mean_coverage"] == 0.875


def test_check_mode_missed_and_negative_not_last():
    sites = [site("x", "candidate", 99), site("neg", "negative", 50), site("y", "candidate", 40), site("a", "validation", 10)]
    s = rk.check_mode(sites, expected={"a"})
    assert s["expected_missed"] == [("a", 4)] and not s["negative_ok"]


def test_overall_threshold():
    good = {"expected_met": ["a", "b", "c"], "expected_missed": [("d", 9)], "negative_ok": True}
    assert rk.overall({"m": good})["passes"]                          # 3/4 = 75 %
    bad = {"expected_met": ["a"], "expected_missed": [("d", 9)], "negative_ok": True}
    assert not rk.overall({"m": bad})["passes"]
    assert not rk.overall({"m": {**good, "negative_ok": False}})["passes"]
