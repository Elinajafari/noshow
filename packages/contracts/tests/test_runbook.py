"""
The demo, replayed offline.

scripts/seed.mjs puts the demo on StudioNet from demo/demo.json, step by step.
This file replays the same steps through the real contract in the simulator,
so a demo that could not succeed is caught before a transaction is spent on it.

When deployments/studionet.json exists, the replay goes further: it feeds the
simulator the rulings the validators actually agreed on, and checks that this
repository's contract pays exactly as the deployed one did and refuses exactly
where it refused.

    pytest tests/test_runbook.py -v
"""

import collections
import hashlib
import json
import pathlib

import pytest

import glsim as S

CONTRACT_PATH = "noshow.py"
M = S.load_contract(CONTRACT_PATH)
RECORD = pathlib.Path("deployments/studionet.json")

import demo as D  # noqa: E402

WHO = {"restaurant": "0x" + "a1" * 20, "ann": "0x" + "b2" * 20, "ben": "0x" + "c3" * 20, "cal": "0x" + "d4" * 20,
       "dev": "0x" + "e5" * 20, "eve": "0x" + "f6" * 20, "stranger": "0x" + "07" * 20}
T0 = 1_790_000_000
V = D.VENUE
PAID = ("restaurant", "ann", "ben", "cal", "dev", "eve")


def call_for(step):
    """The method, arguments and value seed.mjs sends for one step."""
    m = step["method"]
    if m == "register":
        return [V["name"], V["policy"], V["deposit"], V["free_window"], V["grace"]], 0
    if m == "book":
        return [0, D.STARTS_IN, D.PARTIES[step["party"]]], D.WRONG_DEPOSIT if step.get("wrong") else V["deposit"]
    if m == "cancel":
        return [step["id"], D.REASONS[step["reason"]]], 0
    return [step["id"]], 0


def replay(rulings, who=WHO):
    """Run the steps. `rulings` are what the judged late cancellations come back with, in order."""
    c = S.deploy(CONTRACT_PATH)
    S.reset_transfers()
    outcomes = []
    clock = T0
    queue = list(rulings)
    for step in D.STEPS:
        clock += 30
        if "after" in step:
            field, k = step["after"]
            clock = max(clock, M.seconds(c.booking(k)[field]) + 20)
        S.set_time(M.iso(clock))
        S.set_mocks()
        judged = step["method"] == "cancel" and step["expect"] == "ok" and step["reason"] != "ann"
        if judged:
            want = queue.pop(0)
            S.set_mocks(leader_prompts={
                "[0] excused:": {"option": str(M.FORWARD.index(want)), "because": "replayed"},
                "[0] not_excused:": {"option": str(M.REVERSED.index(want)), "because": "replayed"}})
        args, value = call_for(step)
        S.set_sender(who[step["who"]])
        try:
            S.call(c, step["method"], *args, value=value)
            outcomes.append(("ok", ""))
        except S.UserError as e:
            outcomes.append(("refused", e.message))
    return c, outcomes


def received(who=WHO):
    by = {a.lower(): n for n, a in who.items()}
    out = collections.Counter()
    for to, v in S.transfers():
        out[by[str(to).lower()]] += v
    return out


class TestDemoData:
    def test_every_string_and_amount_the_demo_sends_passes_the_bounds(self):
        assert M.bounded(M.clean_text(V["name"]), M.MIN_NAME, M.MAX_NAME)
        assert M.bounded(M.clean_text(V["policy"]), M.MIN_POLICY, M.MAX_POLICY)
        for w in (V["free_window"], V["grace"]):
            assert M.MIN_WINDOW <= w <= M.MAX_WINDOW
        assert V["free_window"] < D.STARTS_IN <= M.MAX_LEAD and D.WRONG_DEPOSIT != V["deposit"]
        for text in D.PARTIES.values():
            assert M.bounded(M.clean_text(text), M.MIN_PARTY, M.MAX_PARTY)
        for text in D.REASONS.values():
            assert M.bounded(M.clean_text(text), M.MIN_REASON, M.MAX_REASON_TEXT)

    def test_each_reason_changes_one_thing(self):
        """The policy excuses illness and refuses a better offer; Ben's reason is
        a child's fever, Cal's a better offer."""
        assert "ill or injured" in V["policy"] and "a better offer elsewhere" in V["policy"]
        assert "fever" in D.REASONS["ben"] and "different restaurant" in D.REASONS["cal"]

    def test_the_clocks_leave_room_for_the_steps_meant_to_land_inside_them(self):
        """Eight steps after the first booking are meant to land in the free
        window; two judged cancellations in the late window."""
        late = V["free_window"]
        assert D.STARTS_IN - late >= 8 * 60 + 120 and late >= 2 * 180 + 120 and V["grace"] >= 3 * 60 + 120


class TestReplay:
    def test_the_demo_succeeds_and_refuses_exactly_where_it_says(self):
        _, outcomes = replay(D.EXPECTED_RULINGS)
        assert [o for o, _ in outcomes] == [s["expect"] for s in D.STEPS]

    def test_the_refusals_say_why(self):
        _, outcomes = replay(D.EXPECTED_RULINGS)
        msgs = [m for o, m in outcomes if o == "refused"]
        wants = ["cannot book its own table", "pay the deposit exactly", "only the guest may cancel", "seated from",
                 "never judged", "may cancel or be seated until", "grace period ended"]
        assert len(msgs) == len(wants)
        for msg, want in zip(msgs, wants):
            assert want in msg, (want, msg)

    def test_the_expected_rulings_pay_every_party_its_due(self):
        c, _ = replay(D.EXPECTED_RULINGS)
        assert [(c.booking(k)["outcome"], c.booking(k)["paid_to"]) for k in range(5)] == [
            ("free", "guest"), ("excused", "guest"), ("not_excused", "restaurant"), ("no_show", "restaurant"),
            ("seated", "guest")]
        d = V["deposit"]
        assert received() == {"ann": d, "ben": d, "eve": d, "restaurant": 2 * d}
        assert c.held_total() == 0


@pytest.mark.skipif(not RECORD.exists(), reason="no deployment recorded yet: pnpm deploy:contract && pnpm seed:contract")
class TestTheRecord:
    def _record(self):
        return json.loads(RECORD.read_text(encoding="utf-8"))

    def test_the_record_is_of_this_source(self):
        here = hashlib.sha256(pathlib.Path(CONTRACT_PATH).read_bytes().replace(b"\r\n", b"\n")).hexdigest()
        assert self._record()["source_sha256"] == here, "the deployed contract is not this file; redeploy"

    def test_every_step_on_chain_did_what_the_demo_expected(self):
        steps = [s for s in self._record()["steps"] if s["step"] != "deploy"]
        assert [("ok" if s["ok"] else "refused") for s in steps] == [s["expect"] for s in D.STEPS]

    def test_this_contract_pays_as_the_deployed_one_did(self):
        rec = self._record()
        rulings = [x["outcome"] for x in rec["bookings"] if x["outcome"] in ("excused", "not_excused")]
        c, outcomes = replay(rulings)
        assert [o for o, _ in outcomes] == [s["expect"] for s in D.STEPS]
        for x in rec["bookings"]:
            mine = c.booking(x["id"])
            for f in ("status", "outcome", "paid_to", "deposit", "reason"):
                assert mine[f] == x[f], (x["id"], f)

    def test_the_payouts_reached_the_wallets(self):
        rec = self._record()
        b = rec["balances"]
        for who in rec["owed"]:
            assert int(b[f"{who}_after"]) - int(b[f"{who}_before"]) == int(rec["owed"][who]), who
        assert rec["held_after"] == "0"
