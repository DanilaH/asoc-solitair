#!/usr/bin/env python3
"""Dependency-free structural audit of a frozen Association Solitaire campaign.

Run from the consumer repository root:
  python3 tools/qa/audit-c7-opening-density.py --input src/content/campaign-v7.json
  python3 tools/qa/audit-c7-opening-density.py --input src/content/campaign-v7.json --proposed-gates

This intentionally checks composition, NOT solveability, strategic depth, player
pleasure, actual SDK behavior, or native competitor runtime. Do not confuse a
same-topic starter packet with a verified one-tap completion of a whole level.
"""
import argparse
import json
import statistics
import sys
from pathlib import Path

def root_of(card_id):
    root, sep, suffix = card_id.rpartition("_")
    return root if sep and suffix.isdigit() else card_id

def audit(deals):
    profiles = []
    for d in deals:
        b = d["initial"]
        col = b["tableau"]
        stock = b.get("stock", [])
        cards = [card for column in col for card in column] + list(stock)
        if len(cards) != len(set(cards)):
            raise ValueError("Duplicate physical cards at " + d["id"])
        card_roots = {root_of(card) for card in cards}
        leader = lambda card: card in card_roots and card == root_of(card)
        pure_columns = [
            {"column": i + 1, "cards": len(column), "category": root_of(column[0])}
            for i, column in enumerate(col) if len(column) >= 2
            and len({root_of(card) for card in column}) == 1
        ]
        prepacked_top = [
            {"column": i + 1, "category": root_of(column[-1]), "cards": 3}
            for i, column in enumerate(col) if len(column) >= 3
            and len({root_of(card) for card in column[-3:]}) == 1
            and leader(column[-1])
        ]
        multiple_leaders = [
            i + 1 for i, column in enumerate(col)
            if sum(leader(card) for card in column) >= 2
        ]
        witness = d.get("winningPath", [])
        row = {
            "level": d["campaignLevel"], "id": d["id"],
            "category_count": len(card_roots), "cards": len(cards),
            "stock": len(stock), "tableau_columns": len(col),
            "foundation_slots": len(b.get("foundations", [])),
            "draws_in_witness": sum(x["type"] == "draw" for x in witness),
            "recycles_in_witness": sum(x["type"] == "recycle" for x in witness),
            "witness_steps": len(witness), "move_budget": b.get("movesLeft"),
            "pure_columns": pure_columns, "prepacked_top": prepacked_top,
            "multiple_leaders_in_one_column": multiple_leaders,
        }
        profiles.append(row)
    return sorted(profiles, key=lambda p: p["level"])

def summary(profiles):
    first = [r for r in profiles if 1 <= r["level"] <= 15]
    return {
        "levels": len(profiles),
        "first15_mean_cards": round(statistics.mean(r["cards"] for r in first), 3),
        "first15_mean_stock": round(statistics.mean(r["stock"] for r in first), 3),
        "first15_median_stock": statistics.median(r["stock"] for r in first),
        "first15_no_stock": [r["level"] for r in first if not r["stock"]],
        "all_no_stock": [r["level"] for r in profiles if not r["stock"]],
        "max_stock": max(r["stock"] for r in profiles),
        "multi_pure_column_levels": [
            {"level": r["level"], "columns": len(r["pure_columns"])}
            for r in profiles if len(r["pure_columns"]) >= 2
        ],
        "multi_leader_column_levels": [
            r["level"] for r in profiles if r["multiple_leaders_in_one_column"]
        ],
        "level15": next((r for r in profiles if r["level"] == 15), None),
    }

def proposed_gates(profiles):
    """Prototype product limits for user review; NOT proven competitor defaults."""
    failures = []
    for r in profiles:
        level = r["level"]
        if level == 15 and (r["stock"] < 24 or r["cards"] < 36 or r["category_count"] < 6):
            failures.append({
                "level": level, "gate": "owner_level15_scale_candidate",
                "expected": "stock>=24; cards>=36; categoryCount>=6",
                "actual": {"stock": r["stock"], "cards": r["cards"], "categoryCount": r["category_count"]},
            })
        if 6 <= level <= 20 and r["stock"] == 0:
            failures.append({"level": level, "gate": "stock_missing_after_onboarding",
                             "actual": 0, "expected": "nonempty, or documented owner-approved exception"})
        if 6 <= level <= 20 and len(r["pure_columns"]) >= 2:
            failures.append({"level": level, "gate": "multiple_preassembled_category_columns",
                             "actual": len(r["pure_columns"]),
                             "expected": "fewer than 2 except explicit tutorial/REST exception"})
    return failures

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=Path("src/content/campaign-v7.json"))
    parser.add_argument("--proposed-gates", action="store_true",
                        help="add non-approved proposed gates and exit 1 if they fail")
    args = parser.parse_args()
    deals = json.loads(args.input.read_text(encoding="utf-8"))
    if not isinstance(deals, list) or not deals:
        raise SystemExit("Expected a nonempty JSON array of immutable Deal records")
    profiles = audit(deals)
    result = {"source": str(args.input), "analysis": "STRUCTURAL_ONLY",
              "summary": summary(profiles), "levels": profiles}
    if args.proposed_gates:
        result["proposed_gates"] = proposed_gates(profiles)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if args.proposed_gates and result["proposed_gates"]:
        return 1
    return 0

if __name__ == "__main__":
    sys.exit(main())
