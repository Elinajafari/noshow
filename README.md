# Noshow

**A restaurant booking deposit, kept only when a late cancellation is not
excused, on GenLayer.** The clock settles what it can; the validators settle
the one thing it cannot.

A restaurant registers a venue with its cancellation policy, a deposit, a
free-cancellation window and a grace period. A guest books by paying the
deposit in. Cancel early and it comes straight back. Cancel late, and
GenLayer's validators decide one thing: does the guest's reason fall under
what the policy excuses. A guest who comes is refunded when seated; one who
neither comes nor cancels forfeits the deposit.

**Live on studionet at `0xeC765790E7BBe8F123a4daEd9204F7b6b36766d5`.**
Intelligent contract + shared type layer + scripts that deploy, seed, verify
and prove it, not a standalone contract.

> Every transaction of the live demo, and the wallet that sent it, read back
> from the chain: **[EVIDENCE.md](EVIDENCE.md)**.
> A second round from two new wallets: **[EVIDENCE-ACTIVITY.md](EVIDENCE-ACTIVITY.md)**.

---

## Why this exists

No-shows cost restaurants the table, and deposits cost guests whatever the
restaurant decides on the night. "Is a sick child a good reason?" is answered
by the party holding the money, after the fact, by phone. Asking a model
"should this guest get the deposit back?" does not fix it: it hands the model
the money and the people at once and gets back whatever seems kind.

### In plain terms

The restaurant writes its policy once, and it applies to every booking. The
deposit goes into the contract, not to the restaurant. Cancel before the free
window ends and you are refunded at once; no model is involved. Cancel later
and give your reason: the validators each read the policy and the reason,
twice, with the two options in different orders, and have to agree exactly.
If the reason is one the policy names, you are refunded; if not, the
restaurant keeps the deposit. Come, and the restaurant seats you and you are
refunded. Neither come nor cancel, and once the grace period is over anyone
can settle the booking to the restaurant.

### Why this needs GenLayer specifically

Whether "our daughter woke up with a fever of 39 and the doctor told us to
keep her at home" falls under "if you or someone in your party is ill" is a
judgment in natural language, and the restaurant that would keep the deposit
is the one party who cannot be trusted to make it. Here the reading is done by
a validator quorum, and everything that is not a judgment is kept away from
the model: the policy was fixed before the first booking, the deposit and the
people are never shown to it, the answer is one of two options the contract
wrote, and the clock settles every case it can without asking anyone.

### How you actually use it

1. **Register** (the restaurant): `register(name, policy, deposit, free_window, grace)`.
2. **Book** (a guest): `book(venue, starts_in, party)`, paying the deposit.
3. **Cancel** (the guest, before the booking starts): `cancel(booking, reason)`.
4. **Seat** (the restaurant): `seat(booking)` refunds a guest who came.
5. **Settle** (anyone, after grace): `settle(booking)` keeps a no-show's deposit.
6. **Rely on it from another contract**: `status(booking)` returns one word.

## Stack

| Layer | Tech |
|---|---|
| Contract | GenLayer Intelligent Contract, Python (GenVM): [`packages/contracts/noshow.py`](packages/contracts/noshow.py) |
| Consensus | custom leader/validator with `gl.vm.run_nondet_unsafe`: a free structural check, then exact agreement on excused or not |
| Money | `book()` is payable; every payout goes through one path, through the external message form with `value` |
| Tests | pytest on a GenVM stand-in that runs the real file, moves the chain's clock and records every transfer, plus a mutation pass that breaks every defence on purpose |
| Chain client | `genlayer-js` 1.1.8: deploy, seed, e2e, verify and evidence scripts; the StudioNet faucet funds the guests |
| Types | [`packages/shared`](packages/shared): view types, parsers and a port of the contract's deterministic rules (the booking's phase, who each outcome pays), tested against vectors generated from the contract |

---

## Quick start

```bash
pnpm install
pip install -r packages/contracts/requirements-dev.txt

pnpm test               # contract (pytest) + shared (vitest), no chain needed
```

Deploy your own copy and put the whole demo on the explorer:

```bash
pnpm deploy:contract
pnpm seed:contract      # 5 bookings, 1 free cancellation, 2 rulings, 1 seated, 1 no-show, 7 refusals
pnpm e2e:contract
pnpm evidence:contract
```

| Command | What it does |
|---|---|
| `pnpm test` | contract and shared suites |
| `pnpm mutate:contract` | removes every defence one at a time; every mutant must be caught by a named test |
| `pnpm measure:contract` | runs the suite and the mutation pass and renders the numbers into the contract README |
| `pnpm seed:contract` | the demo: every route and every refusal, recorded; waits on the chain's clock for each phase |
| `pnpm seed:activity` | a second round on the deployed contract from two new wallets, recorded apart from the demo |
| `pnpm e2e:contract` | the record checked against the live chain |
| `pnpm verify:contract` | the deployed source, byte for byte against the file, and linted |
| `pnpm evidence:contract` | EVIDENCE.md: every transaction and its sender, from the chain |

On studionet nothing needs configuring: every role gets a wallet made in
memory for the run, no key is ever written to disk, and the guests are funded
from the StudioNet faucet.

## The live demo

Osteria Nove, Leeds: a 0.05 GEN deposit, free cancellation until twenty
minutes before, ten minutes' grace. Its policy excuses illness, a cancelled
train or flight, and severe weather warnings, and says a change of plans or a
better offer is not excused. Five bookings, five routes:

| Booking | What happened | Outcome | Paid to |
|---|---|---|---|
| Ann | cancelled in the free window | **free**, no model asked | Ann |
| Ben | cancelled late: his daughter has a fever | **excused** | Ben |
| Cal | cancelled late: a better offer elsewhere | **not_excused** | the restaurant |
| Dev | tried to cancel after the start, never came | **no_show**, by settle() | the restaurant |
| Eve | came | **seated** | Eve |

Every wallet's balance was read from the chain after the deposits were paid
in and again once every payout had landed: each moved by exactly what the
contract paid it. Full detail, with every hash: [EVIDENCE.md](EVIDENCE.md) and
[`packages/contracts/README.md`](packages/contracts/README.md#verified-against-the-live-deployment).

### Second round, two new wallets

`pnpm seed:activity` ran on the same contract from two wallets that had never
been used: a new restaurant in York registered a second venue, a new guest
booked, the restaurant tried to cancel for the guest and was refused, and the
guest cancelled late because their train had been cancelled: excused, and the
deposit came back. Every hash:
[EVIDENCE-ACTIVITY.md](EVIDENCE-ACTIVITY.md).

## Repo layout

```
.
├─ packages/
│  ├─ contracts/                 the Intelligent Contract and everything that proves it
│  │  ├─ noshow.py               the contract
│  │  ├─ tests/                  pytest on a GenVM stand-in (see tests/README.md)
│  │  ├─ scripts/                deploy · seed · e2e · verify · evidence · lint · mutate · measure
│  │  ├─ demo/demo.json          the demo, read by the seed script AND the tests
│  │  ├─ deployments/            studionet.json, written by the scripts, never by hand
│  │  ├─ lib/                    the cancellation rules, generated from the contract
│  │  └─ DECISIONS.md            why every rule is the way it is
│  └─ shared/                    types, parsers, contract-shape.json, the rules port and its vectors
├─ EVIDENCE.md                   every live transaction and its sender
├─ EVIDENCE-ACTIVITY.md          the second round, two new wallets
└─ package.json · pnpm-workspace.yaml
```

## License

MIT © 2026 Elina ([@Elinajafari](https://github.com/Elinajafari))
