"""The demo's data, loaded from demo/demo.json.

scripts/seed.mjs sends exactly these strings and these steps to StudioNet, and
tests/test_runbook.py replays them offline, so the demo on the explorer and the
demo the tests check cannot drift apart.

One venue, five bookings, each a different route through the clock:

  ANN  cancels in the free window: refunded, no model asked
  BEN  cancels late because his daughter has a fever: excused, refunded
  CAL  cancels late for a better offer: not excused, the restaurant keeps it
  DEV  neither cancels in time nor turns up: a cancellation after the start is
       refused, and once the grace period has passed the restaurant keeps it
  EVE  comes, and is seated: refunded
"""

import json
import pathlib

_DATA = json.loads((pathlib.Path(__file__).absolute().parent.parent / "demo" / "demo.json").read_text(encoding="utf-8"))

VENUE = {**_DATA["venue"], "deposit": int(_DATA["venue"]["deposit"])}
STARTS_IN = _DATA["starts_in"]
WRONG_DEPOSIT = int(_DATA["wrong_deposit"])
PARTIES = _DATA["parties"]
REASONS = _DATA["reasons"]
STEPS = _DATA["steps"]

# the ruling each judged late cancellation is expected to come back with, in order
EXPECTED_RULINGS = _DATA["expected_rulings"]
