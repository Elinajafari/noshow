# DECISIONS

Why Noshow is built the way it is. Each section names the alternative that was
rejected and what it would have cost.

## The policy is the contract, frozen before anyone books

The policy, the deposit and both windows are written at `register()`, before
the first booking, and apply to every booking the venue ever takes. A policy
that could be edited after a cancellation could be edited to refuse it.

## The clock settles everything it can, before any model

`phase()` puts every booking in one of four places: free, late, started or
over. A cancellation in the free window is refunded at once, with no model
asked; a booking past its grace period is kept by `settle()`, with no model
asked. The model is only ever asked about a late cancellation, the one case
the clock cannot decide. That keeps inference for the judgment and nothing
else.

## Two options the contract wrote

The answer is `excused` or `not_excused`, labelled `[0]` and `[1]` inside an
`<options>` block after every caller string has been fenced. A reason cannot
forge a third option or close its block.

## Order-dependence is not excused

The options are asked in the order excused, not_excused and then reversed and
renumbered; each answer is read back through the order it was asked in. The
same option both ways stands; anything else is `not_excused`. The guest who
cancels late carries the burden of showing the reason falls under the policy.
A model that always answers "0" excuses nobody, and the tests check it.

## The policy's words, not sympathy

The prompt says a reason is excused only if it is one the policy names, or
plainly an instance of one, and tells the model not to judge whether the
reason is sympathetic or whether it believes the guest. The demo's two late
cancellations change one thing: a child's fever (illness, which the policy
names) and a better offer elsewhere (which the policy names as not excused).

## Ruled in the call that cancels

There is no separate "rule" step. The guest who cancels late is the one who
wants the answer, spends the inference, and is refunded or not in the same
transaction. A failed judgment rolls the whole call back; the booking stays
held and the guest may try again until the booking starts.

## A no-show cannot become a late cancellation

Once a booking has started, `cancel()` refuses before any model is asked. A
guest who did not come cannot argue afterwards that their reason was excused;
the time to say so was before the table was held for them.

## The restaurant seats; anyone settles

Only the restaurant knows who came, so only the restaurant may `seat()`, and
only from the end of free cancellation to the end of grace: a guest cannot be
"seated" while they could still cancel for free, and a seat cannot be claimed
long after. `settle()` reads no model and pays only what the clock says is
due, so anyone may call it, and nobody can hold the deposit by doing nothing.

## Money in, money out, counted

`book()` is the only payable method, and it takes the deposit exactly. `held`
counts every deposit in and every payout out, and a payout larger than `held`
is refused. Every payout goes through `_settle()`, which writes the status,
the outcome and the payee before `_send()` moves anything.

## A parse failure is an error, never a ruling

An unusable answer is retried once inside the block, then raised as
`[LLM_ERROR]`. The validator never agrees with an error, so the call fails and
nothing is stored. A broken model cannot keep or refund a deposit.

## The agreed ruling is checked twice

The validator refuses a ruling that is neither option before it spends a
prompt. The deterministic half checks the agreed ruling again before it pays.
That second check is unreachable through any public call today, and a
structural test keeps it there.

## Tagging untrusted text is not a fence

The venue's name and policy and every reason are written by someone with a
stake. `fence()` replaces `< > [ ]` at the prompt boundary, length preserved.
Stored text is kept verbatim; only the prompt is fenced.

## Why the tests are built the way they are

- **Each node gets its own answers**, and a leader can lie, so every validator check is reachable, and the free layer is measured at zero prompts.
- **The clock and the money are part of the stand-in.** Every phase boundary is tested on its last second and the one after; every payout is checked by the transfers the stand-in recorded, and a refused call pays nobody.
- **The runbook is a test.** The demo is replayed offline from `demo/demo.json` before a transaction is spent; once `deployments/studionet.json` exists, the recorded rulings are replayed through this contract, which must pay exactly as the deployed one did, and every wallet's balance must have moved by exactly what it was paid.
- **The port is tested against the contract.** `packages/shared/noshow-vectors.json` is generated from the contract's own functions.
- **Mutation testing.** `scripts/mutate.py` removes each defence and names the test that caught it.

## GenVM constraints this contract obeys

- the runner is pinned (`py-genlayer:1jb45aa8...`), never `test` or `latest`
- the class is named after the product, because `genvm-lint validate` does not see a class named `Contract`; the storage rows are `Venue` and `Booking`, so no dataclass shares its name
- no `int`, `list`, `dict` or `tuple` as a storage type, and no collection inside a storage dataclass
- every persistent field is declared in the class body, and every stored field is read somewhere
- the block returns a flat dict of strings, and never pays
- the clock is `gl.message_raw["datetime"]`, converted with integer arithmetic
- the deposit is returned by the views as a decimal string, so no client number type rounds it
- the file is pure ASCII
- `genvm-lint` validates against GenVM `v0.3.0-rc7`, the release that ships the pinned runner; `scripts/verify.mjs` sets `GENVM_VERSION` accordingly

## Not upgradable

There is no owner and no admin method. The policy a guest booked under is the
policy their cancellation is judged against.

## Success is read from the leader's result, not from ACCEPTED

A refusal is agreed on too. `scripts/lib.mjs` (`outcome()`) and
`scripts/evidence.mjs` read `consensus_data.leader_receipt[0].result.status`:
`return` is success, and a `rollback` carries the contract's own sentence,
which is recorded as it was raised.

## A lost answer is found, not resent

StudioNet has been measured dropping the reply to a send the node had already
accepted, and unreachable for minutes mid-run. Reads retry for up to fifteen
minutes. A send whose reply was lost is never sent again; its hash is found in
StudioNet's own index (`sim_getTransactionsForAddress`) as the newest
transaction from that wallet the run has not recorded.

## Every role is its own wallet, made in memory

The scripts make the deployer, the restaurant, the five guests and the
stranger with `generatePrivateKey()` for the run and never write them
anywhere, so on the explorer each role is a different address and every
refusal comes from the account it is about.
