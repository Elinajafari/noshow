# Noshow - GenLayer Intelligent Contract

[`noshow.py`](./noshow.py) is the whole protocol: a restaurant registers a
venue with its cancellation policy, a deposit, a free-cancellation window and
a grace period, all frozen; a guest books by paying the deposit in; a
cancellation in the free window is refunded by the clock alone; a late
cancellation is ruled in the same call by validators, in two orders, as
excused or not under the policy; a guest who comes is refunded when seated,
and one who neither comes nor cancels forfeits the deposit once the grace
period has passed.

## Core rule

```
the policy, the deposit and every window are frozen at register(), before the first booking
the clock settles everything it can: a free cancellation is refunded with no model, a no-show is kept after grace
a late cancellation is one of two options the contract wrote: excused or not_excused; the model never sees money or people
excused refunds the guest; not_excused pays the restaurant; the two orders must agree, else not_excused
a cancellation after the booking starts is refused before any model: a no-show cannot become a late cancellation
```

## Lifecycle

```
restaurant: register(name, policy, deposit, free_window, grace)     everything frozen for every booking
guest:      book(venue, starts_in, party)   pays the deposit in, exactly; the booking's clocks are fixed
guest:      cancel(booking, reason)         free window: refunded, no model
                                            late window: [validators, both orders] -> excused: refunded
                                                                                      not_excused: restaurant paid
                                            after the start: refused before any model
restaurant: seat(booking)                   from the end of free cancellation to the end of grace -> refunded
anyone:     settle(booking)                 after grace, nobody cancelled or seated -> restaurant paid
anyone:     count, held_total, status, venue, booking
```

Judgment fails **closed**: an unusable model answer is retried once inside
the block and then raised as `[LLM_ERROR]`, which no validator agrees with.
It never moves money. Every waiting state has a clock, and every clock ends in
someone being paid.

## Deploy

```bash
pnpm install                          # from the repo root
pnpm deploy:contract                  # studionet, a deployer key made for this run
pnpm seed:contract                    # the demo, recorded in deployments/studionet.json
pnpm e2e:contract                     # the record checked against the chain
pnpm verify:contract                  # deployed source == noshow.py, and genvm-lint on it
pnpm evidence:contract                # EVIDENCE.md at the repo root, from the chain
```

Every script reads a transaction's outcome from the leader's result
(`return` or `rollback`), never from `ACCEPTED` alone: the committee accepts a
refusal too. Sends are nonce-guarded, and a send whose answer was lost is
found again in StudioNet's own index rather than sent twice. On studionet the
guests are funded from the StudioNet faucet, and the payouts are checked by
reading every wallet's balance from the chain after the deposits were paid in
and once every payout has landed. Why each rule is the way it is:
[DECISIONS.md](DECISIONS.md).

## Surface

| Write | Caller | Why |
|---|---|---|
| `register(name, policy, deposit, free_window, grace)` | anyone | the caller becomes the restaurant |
| `book(venue, starts_in, party)` *payable* | anyone but the restaurant, paying the deposit exactly | the deposit is held by the contract, not the restaurant |
| `cancel(booking, reason)` | the guest, before the booking starts | only the guest can say why they cannot come |
| `seat(booking)` | the restaurant, between the end of free cancellation and the end of grace | only the restaurant knows who came |
| `settle(booking)` | anyone, deliberately, after grace | it reads no model and pays only what the clock already says is due |

| View | Returns |
|---|---|
| `count()` | number of bookings |
| `held_total()` | wei held for unsettled bookings |
| `status(booking)` | `booked`, `refunded` or `kept`: one word for another contract |
| `venue(id)` | the frozen policy, deposit and windows, and how many bookings it has taken |
| `booking(id)` | the guest, the party, every clock, the outcome, the guest's reason, who was paid |

## Threat model

| Attack | What stops it |
|---|---|
| A policy edited after a cancellation | it is frozen at `register()`, before the first booking |
| A "better offer" passed off as an emergency | the prompt excuses only a reason the policy names, or plainly an instance of one; the demo's better offer is ruled `not_excused` on chain |
| A sympathetic story outside the policy | the model is told not to judge whether the reason is sympathetic or whether it believes the guest |
| The model deciding who deserves the money | it never sees the deposit, the guest or the restaurant, and only picks one of two options the contract wrote |
| A reason that is only excused when "excused" is listed first | both orders inside one block; a difference is `not_excused` |
| A no-show who cancels after the fact | `cancel()` refuses once the booking has started, before any model |
| A free cancellation that costs a model call | the clock refunds it with no model asked |
| A restaurant that holds a deposit forever | the guest is refunded when seated; anyone may settle after grace |
| A guest seated before they could have cancelled | `seat()` refuses during free cancellation |
| A leader that invents or hides an excuse | every validator asks both orders itself and must match exactly |
| A broken model moves money by failing | an unusable answer is retried once, then raised as `[LLM_ERROR]` |
| Prompt injection inside a policy or a reason | `fence()` replaces `< > [ ]` at the prompt boundary and the contract numbers the options itself |

## Tests

The suite runs on [`tests/glsim.py`](tests/glsim.py), a small GenVM stand-in
that executes the real contract file, gives the leader and the validator their
own mock answers, can make a leader lie, sets the chain's clock, carries the
value a call sends and the transfers it makes, and refuses what GenVM refuses.
What each file covers, and what every demo transaction proves, is in
[tests/README.md](tests/README.md).

<!-- measured:tests:start -->
Measured: **126 passed**, 0 skipped, including the checks of the live record in `deployments/studionet.json`, which run once `pnpm seed:contract` has written it. The same record is checked against the chain itself by `pnpm e2e:contract`.
<!-- measured:tests:end -->

**The tests have teeth.** [`scripts/mutate.py`](scripts/mutate.py) removes every
defence one at a time and names the test that caught each mutant. It refuses to
run on a red baseline and exits non-zero if anything escapes.

<!-- measured:mutations:start -->
Measured: **66 mutations, 66 caught, 0 escaped.**

| Mutation | Caught by |
|---|---|
| a free cancellation is judged | `test_a_cancellation_in_the_free_window_is_refunded_with_no_model` |
| a cancellation after the start is judged | `test_a_late_cancellation_on_the_last_second_is_judged_and_one_after_is_refused_for_free` |
| the free window ends a second late | `test_an_excused_late_cancellation_is_refunded` |
| the free window ends a second early | `test_a_cancellation_in_the_free_window_is_refunded_with_no_model` |
| the late window ends a second early | `test_a_late_cancellation_on_the_last_second_is_judged_and_one_after_is_refused_for_free` |
| grace ends a second early | `test_a_guest_is_seated_until_the_last_second_of_grace_and_not_after` |
| a guest is seated during free cancellation | `test_a_seated_guest_is_refunded_from_the_end_of_free_cancellation_to_the_end_of_grace` |
| a guest is seated after grace | `test_a_guest_is_seated_until_the_last_second_of_grace_and_not_after` |
| a no-show is settled during grace | `test_a_no_show_is_settled_to_the_restaurant_after_grace` |
| grace is not counted | `test_a_booking_holds_the_deposit_with_its_clocks_fixed` |
| the free window is not counted | `test_a_booking_holds_the_deposit_with_its_clocks_fixed` |
| anyone may cancel | `test_only_the_guest_may_cancel` |
| anyone may seat | `test_only_the_restaurant_seats` |
| the restaurant may book its own table | `test_the_restaurant_cannot_book_its_own_table` |
| a settled booking is cancelled | `test_a_settled_booking_is_not_cancelled_again` |
| a settled booking is seated | `test_a_settled_booking_is_neither_seated_nor_settled_again` |
| a settled booking is settled again | `test_a_settled_booking_is_neither_seated_nor_settled_again` |
| a name of any length is accepted | `test_every_bound_is_refused` |
| a policy of any length is accepted | `test_every_bound_is_refused` |
| a deposit of zero is accepted | `test_every_bound_is_refused` |
| the windows are unbounded | `test_every_bound_is_refused` |
| the grace period is unbounded | `test_every_bound_is_refused` |
| a booking may start inside the free window | `test_a_booking_starts_beyond_the_free_window` |
| a booking may start any time ahead | `test_a_booking_starts_beyond_the_free_window` |
| a party of any length is accepted | `test_the_party_is_described` |
| any deposit is accepted | `test_the_deposit_is_paid_exactly` |
| a late cancellation needs no reason | `test_a_late_cancellation_needs_a_reason` |
| control characters are stored | `test_clean_text_collapses_whitespace_and_control_characters` |
| not excused refunds the guest | `test_a_late_cancellation_not_excused_pays_the_restaurant` |
| a no-show refunds the guest | `test_a_no_show_is_settled_to_the_restaurant_after_grace` |
| a refund goes to the restaurant | `test_a_cancellation_in_the_free_window_is_refunded_with_no_model` |
| a kept deposit goes to the guest | `test_a_late_cancellation_not_excused_pays_the_restaurant` |
| a refund is marked kept | `test_a_cancellation_in_the_free_window_is_refunded_with_no_model` |
| seating keeps the deposit | `test_a_seated_guest_is_refunded_from_the_end_of_free_cancellation_to_the_end_of_grace` |
| a no-show is seated | `test_a_no_show_is_settled_to_the_restaurant_after_grace` |
| the reason is not stored | `test_an_excused_late_cancellation_is_refunded` |
| the held counter is not raised | `test_a_booking_holds_the_deposit_with_its_clocks_fixed` |
| a payout beyond what is held is sent | `test_a_payout_beyond_what_is_held_is_refused` |
| the held counter is not lowered | `test_a_cancellation_in_the_free_window_is_refunded_with_no_model` |
| the booking count is not kept | `test_a_booking_holds_the_deposit_with_its_clocks_fixed` |
| the second pass is asked in the forward order | `test_the_options_are_asked_in_both_orders` |
| the reversed order is not reversed | `test_the_options_are_asked_in_both_orders` |
| a disagreement between the orders keeps the forward ruling | `test_a_model_that_always_answers_0_excuses_nobody` |
| a disagreement between the orders excuses the guest | `test_a_model_that_always_answers_0_excuses_nobody` |
| an answer is not read back through its order | `test_an_excused_late_cancellation_is_refunded` |
| an option past the list is accepted | `test_an_unusable_answer_is_an_error_and_never_a_ruling` |
| an answer in words is read as a number | `test_an_unusable_answer_is_an_error_and_never_a_ruling` |
| an unusable answer is not retried | `test_an_unusable_answer_is_an_error_and_never_a_ruling` |
| a bare value is read as if it were an object | `test_an_unusable_answer_is_an_error_and_never_a_ruling` |
| an unusable answer becomes not excused | `test_an_unusable_answer_is_an_error_and_never_a_ruling` |
| the validator agrees with a leader error | `test_an_unusable_answer_is_an_error_and_never_a_ruling` |
| the validator skips the free structural check | `test_a_ruling_that_is_neither_option_is_refused_for_free` |
| the validator agrees with anything | `test_nodes_that_rule_differently_do_not_agree` |
| the validator agrees when its own model fails | `test_a_validator_whose_model_fails_does_not_agree` |
| agreement ignores the structural check | `test_agreement_is_exact_symmetric_and_over_sound_rulings` |
| any word is a sound ruling | `test_a_ruling_that_is_neither_option_is_refused_for_free` |
| the agreed ruling is not checked again | `test_the_agreed_ruling_is_checked_again_before_it_pays` |
| the fence does nothing | `test_caller_text_is_stored_verbatim_and_fenced_only_at_the_prompt` |
| the fence leaves square brackets | `test_caller_text_is_stored_verbatim_and_fenced_only_at_the_prompt` |
| the reason reaches the prompt unfenced | `test_caller_text_is_stored_verbatim_and_fenced_only_at_the_prompt` |
| the policy reaches the prompt unfenced | `test_caller_text_is_stored_verbatim_and_fenced_only_at_the_prompt` |
| the venue reaches the prompt unfenced | `test_every_value_interpolated_into_the_prompt_is_fenced_or_ours` |
| the prompt excuses anything plausible | `test_the_prompt_judges_the_policy_and_never_shows_money` |
| the prompt weighs sympathy | `test_the_prompt_judges_the_policy_and_never_shows_money` |
| the leader's reason is stored raw | `test_the_reason_is_not_compared_and_is_stored_sanitised` |
| the leader's reason is not capped | `test_the_reason_is_not_compared_and_is_stored_sanitised` |
<!-- measured:mutations:end -->

## Verified against the live deployment

<!-- measured:deployment:start -->
Deployed on studionet at [`0xeC765790E7BBe8F123a4daEd9204F7b6b36766d5`](https://explorer-studio.genlayer.com/address/0xeC765790E7BBe8F123a4daEd9204F7b6b36766d5) (deploy [`0x4c720b0d...`](https://explorer-studio.genlayer.com/tx/0x4c720b0d3e7b8387baa06236545a3670ee5884ca303ec0e88aac0da7e275afe6)). Every value below was read back from the chain by `scripts/seed.mjs` and written to [`deployments/studionet.json`](deployments/studionet.json); none of it is typed by hand.

The venue: **Osteria Nove, Leeds**, a deposit of 0.05 GEN, free cancellation until 1200 s before a booking, a grace period of 600 s. Its policy, frozen at register(): *Cancel up to the free window before your booking and your deposit comes back in full. A later cancellation is excused, and the deposit refunded, if you or someone in your party is ill or injured, if a train or flight you were booked on is cancelled, or if a severe weather warning advises against travel. A change of plans, a better offer elsewhere, or forgetting is not excused.*

| Booking | Party | Outcome | Paid to | The guest's reason | Reason the leader gave (not consensus) |
|---|---|---|---|---|---|
| 0 | Ann, a table for two at 8 pm | **free** | guest | - | - |
| 1 | Ben, a table for four at 8 pm | **excused** | guest | Our daughter woke up with a fever of 39 degrees and the doctor told us to keep her at home tonight. | The policy excuses illness in the party. The daughter has a fever and a doctor confirmed she must stay home. |
| 2 | Cal, a table for two at 8 pm | **not_excused** | restaurant | Some friends invited us to a different restaurant tonight, so we will not need the table after all. | The guest's reason is a change of plans or a better offer elsewhere, which the policy explicitly states is not excused. |
| 3 | Dev, a table for three at 8 pm | **no_show** | restaurant | - | - |
| 4 | Eve, a table for two at 8 pm | **seated** | guest | - | - |

Every wallet's balance was read from the chain after the deposits were paid in and once every payout had landed, against what the contract says it paid:

| Wallet | Before | After | The contract paid |
|---|---|---|---|
| restaurant | 0 GEN | 0.1 GEN | 0.1 GEN |
| ann | 0.95 GEN | 1 GEN | 0.05 GEN |
| ben | 0.95 GEN | 1 GEN | 0.05 GEN |
| cal | 0.95 GEN | 0.95 GEN | 0 GEN |
| dev | 0.95 GEN | 0.95 GEN | 0 GEN |
| eve | 0.95 GEN | 1 GEN | 0.05 GEN |

Every transaction, in order, refusals included, with the wallet that sent it:

| Step | From | Outcome | Transaction |
|---|---|---|---|
| venue 0: Osteria Nove, a 0.05 GEN deposit | restaurant | ok | [`0xa7cd05bb...`](https://explorer-studio.genlayer.com/tx/0xa7cd05bb11f594c617814c80607487492eb9b136facb2145473cf2219b8a8834) |
| the restaurant books its own table | restaurant | refused: the restaurant cannot book its own table | [`0xf76a6440...`](https://explorer-studio.genlayer.com/tx/0xf76a6440fdce27708a8c4a595faffcc9af4d05a2668128f4b2590972ca1667b7) |
| booking 0: Ann | ann | ok | [`0xe500d078...`](https://explorer-studio.genlayer.com/tx/0xe500d078a947d0a0f67ec159997aca249ed8ca4f136b832bb988a8619abc8bcc) |
| booking 1: Ben | ben | ok | [`0xdee2ad5c...`](https://explorer-studio.genlayer.com/tx/0xdee2ad5c065f99a41c9319ccd3bea9b1ba736484efb16605f908362c3e354949) |
| booking 2: Cal | cal | ok | [`0xb2f1f979...`](https://explorer-studio.genlayer.com/tx/0xb2f1f97960f77a124bb2edaebf3653309bedac38a0120bc8d709680f3b526453) |
| booking 3: Dev | dev | ok | [`0xb49f2c51...`](https://explorer-studio.genlayer.com/tx/0xb49f2c511b727369b886721640c26fed66c593457cb81ba8cc86054ca2b96e06) |
| booking 4: Eve | eve | ok | [`0x376b6975...`](https://explorer-studio.genlayer.com/tx/0x376b69759bc9b2921388c72084150f3e455b966b423c1ef9a9643eaa1cbab895) |
| a booking paying the wrong deposit | stranger | refused: pay the deposit exactly: 50000000000000000 wei, not 10000000000000000 | [`0x191d5f4c...`](https://explorer-studio.genlayer.com/tx/0x191d5f4c43af015036f4c96d86ce227415e52d2be5cb7e62d82fa05319f8e760) |
| Ann cancels in the free window | ann | ok | [`0xe054a315...`](https://explorer-studio.genlayer.com/tx/0xe054a315a6f6e08df6bc40fbb55334eef0af3b4272eaef50ab01fd28a08b03f4) |
| a stranger cancels Ben's booking | stranger | refused: only the guest may cancel | [`0x73625bcb...`](https://explorer-studio.genlayer.com/tx/0x73625bcbb8b151761333b77329613e843e59a8246380f1717ad20d3a693912ef) |
| a guest seated during free cancellation | restaurant | refused: a guest is seated from 2026-10-18T22:40:30Z, when free cancellation ends | [`0x92383191...`](https://explorer-studio.genlayer.com/tx/0x923831918a703ec51c430f6f75c12a15057356a4584e51fb2a15dacb7750c561) |
| Ben cancels late: a child with a fever | ben | ok | [`0x1423327b...`](https://explorer-studio.genlayer.com/tx/0x1423327bc888b063a678a4004186171259b913f55b657c08dd73bbf0e34079a6) |
| Cal cancels late: a better offer | cal | ok | [`0x9c29d973...`](https://explorer-studio.genlayer.com/tx/0x9c29d9735d5a935e7e5146a1374b664123715c77d9f2036cb816917a3d454dc0) |
| Dev cancels after the booking started | dev | refused: the booking started at 2026-10-18T23:00:41Z; a cancellation after that is never judged | [`0x12c7b2cb...`](https://explorer-studio.genlayer.com/tx/0x12c7b2cb7df62a1992d8fd85d6729f1aaf3f3c2da6461b7c47db8f4b4bfd0f89) |
| Eve is seated | restaurant | ok | [`0x96fc961c...`](https://explorer-studio.genlayer.com/tx/0x96fc961cd6a9ef9499615201527fe7486eb80e6da10f1c51443e0898e39e61b8) |
| a settlement during Dev's grace period | stranger | refused: the guest may cancel or be seated until 2026-10-18T23:10:41Z | [`0x59e6725e...`](https://explorer-studio.genlayer.com/tx/0x59e6725e54a31b014b6f0ca84c6acbaa7851b80ffe2519f6fc1b7e3f4f265928) |
| Dev seated after the grace period | restaurant | refused: the grace period ended at 2026-10-18T23:10:41Z | [`0x775aae8d...`](https://explorer-studio.genlayer.com/tx/0x775aae8dee8107904f15ccd52f6b7eeb40f0e9ba6d7117a42f60ae21f4005745) |
| Dev's booking settled: a no-show | stranger | ok | [`0x2577f3e4...`](https://explorer-studio.genlayer.com/tx/0x2577f3e45fe65fdaba1fb6706b7c10d79df7b297b1d468c2f3eec3e02ef54b5e) |

`tests/test_runbook.py::TestTheRecord` replays these rulings through this repository's contract and fails unless it pays exactly as the deployed one did.
<!-- measured:deployment:end -->

On top of the record: `pnpm e2e:contract` asks the chain again for every
transaction, the venue and every booking and checks each against the record,
along with every wallet's balance, and `pnpm verify:contract` reads the
deployed source back with `gen_getContractCode`, compares it byte for byte
with `packages/contracts/noshow.py`, and runs genvm-lint on the deployed bytes.

## Known limits

- Validators judge what the guest says, not whether it is true; the reason is public and permanent next to the refund.
- Whether a guest came is the restaurant's word, by `seat()`; a restaurant that refuses to seat a guest who came is outside what the contract can see.
- One deposit per booking, the native token only, whole wei.
- On StudioNet the value sent with a refused payable call stays at the contract's address. `held` counts only accepted deposits, so that value is never paid out.
- StudioNet is a test network; its state can be reset.

## Path forward

- A guest's own check-in, signed at the table, alongside the restaurant's `seat()`.
- A partial refund schedule: the later the cancellation, the more the restaurant keeps, by the clock alone.
- A booking page that shows each booking's phase and what a cancellation now would do.
