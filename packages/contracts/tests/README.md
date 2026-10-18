# Contract tests

Noshow is tested at four levels, from the cheapest to the one that costs real
transactions. Each level has one command.

| Level | Command | Needs | What it proves |
|---|---|---|---|
| 1. Offline suite | `pnpm test:contract` | Python + pytest | the contract file itself behaves as specified, including against a lying leader, a moving clock and real payouts |
| 2. Mutation pass | `pnpm mutate:contract` | same | every defence is covered by a test that fails without it |
| 3. Live demo | `pnpm deploy:contract && pnpm seed:contract` | Node 20+ | the same behaviour happens on StudioNet, with real validators, real models, real GEN and the chain's own clock |
| 4. Chain checks | `pnpm e2e:contract`, `pnpm verify:contract`, `pnpm evidence:contract` | Node 20+ | what the record claims is what the chain holds, and what is deployed is this file |

## 1. The offline suite

```bash
pip install -r requirements-dev.txt
pnpm test:contract   # from the repo root, or here: python -m pytest tests -q
```

| File | What it covers |
|---|---|
| [`test_logic.py`](test_logic.py) | the pure rules: the four phases of a booking's clock on every boundary, who each outcome pays, text cleaning, reading a model's answer back through its order, the fold, the agreement, the fence and the prompt, and that `lib/noshow_consensus.py` is exactly the contract's code |
| [`test_e2e.py`](test_e2e.py) | the contract executed: `register` and its bounds; `book` (not the restaurant, the deposit exactly, a start beyond the free window); `cancel` (free with no model, excused, not excused, a reason required, only the guest, never after the start, the model never sees money or people, an order-dependent answer is not excused, a lying or malformed leader refused, a malformed one for free, an `[LLM_ERROR]` never agreed with); `seat` and `settle` on every boundary; money; and static checks over the parsed source |
| [`test_runbook.py`](test_runbook.py) | the live demo replayed offline from [`demo/demo.json`](../demo/demo.json), with the clock moved through every phase, before any transaction is spent; and once `deployments/studionet.json` exists, the validators' real rulings are replayed through this file, which must pay exactly as the deployed contract did |
| [`test_vectors.py`](test_vectors.py) | `packages/shared/noshow-vectors.json` is exactly what this contract computes, so the TypeScript port is tested against the contract's own answers (`UPDATE_VECTORS=1` regenerates it) |
| [`test_shape.py`](test_shape.py) | `packages/shared/contract-shape.json` describes every public write and view, its parameters and types, and the fields the live deployment returned, exactly |

## 2. The mutation pass

```bash
pnpm mutate:contract
```

[`scripts/mutate.py`](../scripts/mutate.py) makes small edits to a copy of the
contract, each one removing a defence ("a cancellation after the start is
judged", "not excused refunds the guest", "anyone may seat", "a disagreement
between the orders excuses the guest", ...), runs the suite against each, and
names the test that failed. A mutant that survives is a missing test, and the
script exits non-zero.

## 3. The live demo

```bash
pnpm install
pnpm deploy:contract
pnpm seed:contract
```

Eight wallets, one role each, all made in memory for the run; every guest is
funded from the StudioNet faucet:

| Wallet | Does |
|---|---|
| deployer | deploys the contract, nothing else |
| restaurant | registers Osteria Nove, tries to book its own table, seats a guest too early, seats Eve, tries to seat Dev too late |
| ann | books, then cancels in the free window |
| ben | books, then cancels late: his daughter has a fever |
| cal | books, then cancels late: a better offer elsewhere |
| dev | books, tries to cancel after the booking started, never comes |
| eve | books and comes |
| stranger | pays the wrong deposit, cancels someone else's booking, settles too early, then settles Dev's booking |

Every transaction, in order, and what it proves. The steps are
[`demo/demo.json`](../demo/demo.json), read by the seed script and by
`test_runbook.py`.

| # | Sent by | Call | Expected | What it proves |
|---|---|---|---|---|
| 1 | restaurant | `register` | executed | the policy, the 0.05 GEN deposit and both windows are frozen |
| 2 | restaurant | `book` | refused | the restaurant cannot book its own table |
| 3-7 | ann, ben, cal, dev, eve | `book` | executed | each deposit is held by the contract |
| 8 | stranger | `book` with 0.01 GEN | refused | the deposit is paid exactly |
| 9 | ann | `cancel` in the free window | **free** | refunded by the clock alone, no model asked |
| 10 | stranger | `cancel(1)` | refused | only the guest may cancel |
| 11 | restaurant | `seat(2)` | refused | nobody is seated while they could still cancel for free |
| 12 | ben | `cancel(1)` late: a child with a fever | **excused** | illness, which the policy names: refunded |
| 13 | cal | `cancel(2)` late: a better offer | **not_excused** | the policy names it: the restaurant keeps the deposit |
| 14 | dev | `cancel(3)` after the start | **refused** | a no-show cannot become a late cancellation, and no model is asked |
| 15 | restaurant | `seat(4)` | **seated** | Eve came: refunded |
| 16 | stranger | `settle(3)` | refused | Dev may still be seated until grace ends |
| 17 | restaurant | `seat(3)` after grace | refused | a seat cannot be claimed after grace |
| 18 | stranger | `settle(3)` | **no_show** | the restaurant keeps Dev's deposit |

## 4. Checking the chain, not the record

```bash
pnpm e2e:contract
pnpm verify:contract
pnpm evidence:contract
```

`e2e` fetches every recorded transaction again and checks that the chain still
says what the record says, then re-reads the venue and every booking; nothing
may still be held, and every balance must have moved by exactly what the
contract paid. `verify` compares the deployed source byte for byte with
`noshow.py` and lints it. `evidence` builds [EVIDENCE.md](../../../EVIDENCE.md)
from the chain's answers alone.

## Measuring

```bash
pnpm measure:contract
```

Runs the suite and the mutation pass now and renders their numbers, and the
live record, into the README. It writes nothing if the suite is red, a mutant
escapes, or the record is of a different contract file.
