"""Mutation pass: break every defence on purpose, confirm a test notices.

Passing tests prove nothing on their own. Each entry below is a small edit to
the contract that removes a defence. The suite must fail for every one of them,
and this script records WHICH test caught it, so the table in the README is
measured rather than claimed.

    python scripts/mutate.py            # run them all, print what caught what
    python scripts/mutate.py --md       # emit the markdown table for the README

An escaping mutation is a finding, not a nuisance: either a missing test, or a
later defence strict enough that an earlier test can no longer fail. The script
exits non-zero if anything escapes, and refuses to run on a red baseline.

Three rules keep the harness honest:

  * the unmutated suite must be green before anything is mutated;
  * a find string that is missing, or matches more than once, is a failure of
    the harness, never a skip, so refactoring cannot quietly turn a row off;
  * scripts/lift.py runs inside every mutated copy before the suite, so the lib
    parity test can never stand in for the behavioural test a mutation deserves.
"""

import argparse
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).absolute().parent.parent
TARGET = "noshow.py"

FENCE = '    return str(raw).replace("<", "(").replace(">", ")").replace("[", "(").replace("]", ")")'

MUTATIONS = [
    # -- the clock: what it settles, it settles before any model
    ("a free cancellation is judged",
     '        if where == "free":\n            self._settle(b, FREE, now)\n            return',
     '        if False:\n            self._settle(b, FREE, now)\n            return'),
    ("a cancellation after the start is judged", '        if where != "late":', "        if False:"),
    ("the free window ends a second late", "    if now <= starts_at - free_window:", "    if now <= starts_at - free_window + 1:"),
    ("the free window ends a second early", "    if now <= starts_at - free_window:", "    if now < starts_at - free_window:"),
    ("the late window ends a second early", '    if now <= starts_at:\n        return "late"', '    if now < starts_at:\n        return "late"'),
    ("grace ends a second early", "    if now <= starts_at + grace:", "    if now < starts_at + grace:"),
    ("a guest is seated during free cancellation",
     '        if where == "free":\n            raise', '        if False:\n            raise'),
    ("a guest is seated after grace", '        if where == "over":', "        if False:"),
    ("a no-show is settled during grace", "        if now <= int(b.grace_until):", "        if False:"),
    ("grace is not counted", "grace_until=u256(starts + int(v.grace))", "grace_until=u256(starts)"),
    ("the free window is not counted", "free_until=u256(starts - int(v.free_window))", "free_until=u256(starts)"),

    # -- who may write
    ("anyone may cancel", "        if gl.message.sender_address != b.guest:", "        if False:"),
    ("anyone may seat", "        if gl.message.sender_address != v.restaurant:", "        if False:"),
    ("the restaurant may book its own table", "        if sender == v.restaurant:", "        if False:"),
    ("a settled booking is cancelled",
     '        if str(b.status) != BOOKED:\n            raise gl.vm.UserError(f"{ERR_EXPECTED} this booking is {b.status}; only a held booking is cancelled")',
     '        if False:\n            raise gl.vm.UserError(f"{ERR_EXPECTED} this booking is {b.status}; only a held booking is cancelled")'),
    ("a settled booking is seated",
     '        if str(b.status) != BOOKED:\n            raise gl.vm.UserError(f"{ERR_EXPECTED} this booking is {b.status}; only a held booking is seated")',
     '        if False:\n            raise gl.vm.UserError(f"{ERR_EXPECTED} this booking is {b.status}; only a held booking is seated")'),
    ("a settled booking is settled again",
     '        if str(b.status) != BOOKED:\n            raise gl.vm.UserError(f"{ERR_EXPECTED} this booking is {b.status}; nothing to settle")',
     '        if False:\n            raise gl.vm.UserError(f"{ERR_EXPECTED} this booking is {b.status}; nothing to settle")'),

    # -- what register() and book() accept
    ("a name of any length is accepted", "        if not bounded(n, MIN_NAME, MAX_NAME):", "        if False:"),
    ("a policy of any length is accepted", "        if not bounded(p, MIN_POLICY, MAX_POLICY):", "        if False:"),
    ("a deposit of zero is accepted", "        if d < 1 or d > MAX_DEPOSIT:", "        if d > MAX_DEPOSIT:"),
    ("the windows are unbounded",
     "        if fw < MIN_WINDOW or fw > MAX_WINDOW or g < MIN_WINDOW or g > MAX_WINDOW:", "        if False:"),
    ("the grace period is unbounded",
     "        if fw < MIN_WINDOW or fw > MAX_WINDOW or g < MIN_WINDOW or g > MAX_WINDOW:",
     "        if fw < MIN_WINDOW or fw > MAX_WINDOW:"),
    ("a booking may start inside the free window", "        if lead <= int(v.free_window) or lead > MAX_LEAD:",
     "        if lead > MAX_LEAD:"),
    ("a booking may start any time ahead", "        if lead <= int(v.free_window) or lead > MAX_LEAD:",
     "        if lead <= int(v.free_window):"),
    ("a party of any length is accepted", "        if not bounded(who, MIN_PARTY, MAX_PARTY):", "        if False:"),
    ("any deposit is accepted", "        if paid != int(v.deposit):", "        if False:"),
    ("a late cancellation needs no reason", "        if not bounded(why, MIN_REASON, MAX_REASON_TEXT):", "        if False:"),
    ("control characters are stored", '            out.append(" ")\n        else:', "            out.append(ch)\n        else:"),

    # -- what the contract decides
    ("not excused refunds the guest",
     '    return "restaurant" if outcome == NOT_EXCUSED or outcome == NO_SHOW else "guest"',
     '    return "restaurant" if outcome == NO_SHOW else "guest"'),
    ("a no-show refunds the guest",
     '    return "restaurant" if outcome == NOT_EXCUSED or outcome == NO_SHOW else "guest"',
     '    return "restaurant" if outcome == NOT_EXCUSED else "guest"'),
    ("a refund goes to the restaurant",
     '        self._send(b.guest if to == "guest" else self.venues[int(b.venue_id)].restaurant, int(b.deposit))',
     "        self._send(self.venues[int(b.venue_id)].restaurant, int(b.deposit))"),
    ("a kept deposit goes to the guest",
     '        self._send(b.guest if to == "guest" else self.venues[int(b.venue_id)].restaurant, int(b.deposit))',
     "        self._send(b.guest, int(b.deposit))"),
    ("a refund is marked kept", '        b.status = REFUNDED if to == "guest" else KEPT', "        b.status = KEPT"),
    ("seating keeps the deposit", "        self._settle(b, SEATED, now)", "        self._settle(b, NO_SHOW, now)"),
    ("a no-show is seated", "        self._settle(b, NO_SHOW, now)", "        self._settle(b, SEATED, now)"),
    ("the reason is not stored", "        b.reason = why", "        pass"),

    # -- money
    ("the held counter is not raised", "        self.held = u256(int(self.held) + paid)", "        pass"),
    ("a payout beyond what is held is sent", "        if amount > int(self.held):", "        if False:"),
    ("the held counter is not lowered", "        self.held = u256(int(self.held) - amount)", "        pass"),
    ("the booking count is not kept", "        v.bookings = u256(int(v.bookings) + 1)", "        pass"),

    # -- the two orders
    ("the second pass is asked in the forward order",
     "            rev, _ = ask(venue, policy, why, REVERSED)", "            rev, _ = ask(venue, policy, why, FORWARD)"),
    ("the reversed order is not reversed", "REVERSED = [NOT_EXCUSED, EXCUSED]", "REVERSED = [EXCUSED, NOT_EXCUSED]"),
    ("a disagreement between the orders keeps the forward ruling",
     "    return forward if forward == reverse else NOT_EXCUSED", "    return forward"),
    ("a disagreement between the orders excuses the guest",
     "    return forward if forward == reverse else NOT_EXCUSED", "    return forward if forward == reverse else EXCUSED"),
    ("an answer is not read back through its order", "    return order[int(choice)]", "    return FORWARD[int(choice)]"),

    # -- reading the model
    ("an option past the list is accepted", "    if k < 0 or k >= n:", "    if False:"),
    ("an answer in words is read as a number",
     '    if s == "" or any(ch not in "0123456789" for ch in s) or len(s) > 2:', '    if s == "":'),
    ("an unusable answer is not retried", "    for _ in range(2):", "    for _ in range(1):"),
    ("a bare value is read as if it were an object", "        if isinstance(raw, dict):", "        if True:"),
    ("an unusable answer becomes not excused",
     '    raise gl.vm.UserError(f"{ERR_LLM} the model named neither option")', '    return NOT_EXCUSED, ""'),

    # -- the validator
    ("the validator agrees with a leader error",
     "                # An [LLM_ERROR] is never agreed with.\n                return False",
     "                # An [LLM_ERROR] is never agreed with.\n                return True"),
    ("the validator skips the free structural check", "            if not ruling_sound(proposed):", "            if False:"),
    ("the validator agrees with anything", '            return noshow_agrees(mine["ruling"], proposed)', "            return True"),
    ("the validator agrees when its own model fails",
     "            except gl.vm.UserError:\n                return False", "            except gl.vm.UserError:\n                return True"),
    ("agreement ignores the structural check",
     "    return ruling_sound(mine) and ruling_sound(theirs) and str(mine) == str(theirs)", "    return str(mine) == str(theirs)"),
    ("any word is a sound ruling", "    return ruling == EXCUSED or ruling == NOT_EXCUSED", '    return ruling != ""'),
    ("the agreed ruling is not checked again", "        if not ruling_sound(ruling):", "        if False:"),

    # -- the prompt boundary
    ("the fence does nothing", FENCE, "    return str(raw)"),
    ("the fence leaves square brackets", FENCE, '    return str(raw).replace("<", "(").replace(">", ")")'),
    ("the reason reaches the prompt unfenced", "{fence(reason)}", "{reason}"),
    ("the policy reaches the prompt unfenced", "{fence(policy)}", "{policy}"),
    ("the venue reaches the prompt unfenced", "{fence(venue)}", "{venue}"),
    ("the prompt excuses anything plausible",
     "A reason is excused only if\nit is one the policy names, or plainly an instance of one.", "Use your judgment."),
    ("the prompt weighs sympathy",
     "Do not judge\nwhether the reason is sympathetic, or whether you believe the guest; judge\nwhat the reason says against what the policy says.",
     "Judge\nwhether the reason is sympathetic."),
    ("the leader's reason is stored raw", '        b.why = sanitise_reason(res.get("because", ""))', '        b.why = str(res.get("because", ""))'),
    ("the leader's reason is not capped", '    return " ".join("".join(out).split())[:limit]', '    return " ".join("".join(out).split())'),
]


PYTEST = [sys.executable, "-m", "pytest", "tests/", "-x", "-q", "--no-header", "-p", "no:cacheprovider"]


def copy_repo(tmp):
    dst = pathlib.Path(tmp) / "repo"
    shutil.copytree(ROOT, dst, ignore=shutil.ignore_patterns(
        "__pycache__", ".pytest_cache", ".git", "artifacts", "*.pyc", "node_modules", "deployments"))
    # tests/test_vectors.py and tests/test_shape.py read ../shared; a mutant
    # must face the same vectors and the same described surface.
    shared = pathlib.Path(tmp) / "shared"
    shared.mkdir()
    for name in ("noshow-vectors.json", "contract-shape.json"):
        shutil.copy(ROOT.parent / "shared" / name, shared / name)
    return dst


def run_one(label, find, replace):
    with tempfile.TemporaryDirectory() as tmp:
        dst = copy_repo(tmp)
        target = dst / TARGET
        src = target.read_text(encoding="utf-8")
        hits = src.count(find)
        if hits == 0:
            return "PATTERN NOT FOUND", None
        if hits > 1:
            return "PATTERN NOT UNIQUE", None
        target.write_text(src.replace(find, replace, 1), encoding="utf-8", newline="\n")
        subprocess.run([sys.executable, "scripts/lift.py"], cwd=dst, capture_output=True)
        proc = subprocess.run(PYTEST, cwd=dst, capture_output=True, text=True,
                          encoding="utf-8", errors="replace")
        if proc.returncode == 0:
            return "ESCAPED", None
        text = proc.stdout + proc.stderr
        m = re.search(r"^(?:FAILED|ERROR) (\S+?)::(\S+?)(?:\[|\s|$)", text, re.M)
        if m:
            return "caught", m.group(2).split("::")[-1]
        m = re.search(r"^E\s+(\w*(?:Error|Exception))", text, re.M)
        if m:
            return "caught", m.group(1) + " at import"
        return "caught", "unnamed failure"


def baseline_is_green():
    with tempfile.TemporaryDirectory() as tmp:
        dst = copy_repo(tmp)
        proc = subprocess.run(PYTEST, cwd=dst, capture_output=True, text=True,
                          encoding="utf-8", errors="replace")
        return proc.returncode == 0, (proc.stdout + proc.stderr)[-2000:]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--md", action="store_true", help="emit the README table")
    args = ap.parse_args()

    green, tail = baseline_is_green()
    if not green:
        print("the unmutated suite is not green; every mutation would look caught:\n" + tail, file=sys.stderr)
        return 2

    rows, escaped = [], []
    for label, find, replace in MUTATIONS:
        status, test = run_one(label, find, replace)
        if status == "caught":
            rows.append((label, test))
            if not args.md:
                print("  caught   %-70s %s" % (label, test), flush=True)
        else:
            escaped.append((label, status))
            print("  %-8s %s" % (status, label), file=sys.stderr, flush=True)

    if args.md:
        print("| Mutation | Caught by |")
        print("|---|---|")
        for label, test in rows:
            print("| %s | `%s` |" % (label, test))
    else:
        print()
        print("  %d mutations, %d caught, %d escaped" % (len(MUTATIONS), len(rows), len(escaped)))
    return 1 if escaped else 0


if __name__ == "__main__":
    sys.exit(main())
