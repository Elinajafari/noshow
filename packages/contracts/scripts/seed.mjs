// Put the demo on the explorer: every route the contract has, refusals included.
//
//   pnpm seed:contract
//
// Reads the address from deployments/studionet.json (written by deploy.mjs)
// and sends the steps in demo/demo.json, in order: the restaurant registers a
// venue with its policy, five guests book and pay the deposit in, one cancels
// in the free window, two cancel late (one excused, one not), one is seated,
// and one never comes; the run waits on the chain's clock for each phase. It
// sends every write the contract exists to refuse. Everything is appended to
// the same record: each transaction hash and its sender, its status, the
// refusal sentence where there was one, the venue and every booking as the
// chain holds them, and every wallet's balance read from the chain after the
// deposits were paid in and once every payout had landed. Nothing in that
// file is typed by hand.
//
// The balances are read after the bookings, not before, because StudioNet
// keeps the value sent with a refused payable call at the contract's address:
// the demo's wrong deposit is refused, and its value is not returned. The
// contract's own `held` counts only accepted deposits, so that value is never
// paid out.
//
// Seven wallets act, each in one role: the restaurant, five guests (Ann, Ben,
// Cal, Dev and Eve) and a stranger. They come from <ROLE>_PRIVATE_KEY, or on
// studionet are made in memory for this run and never written to disk; every
// guest is funded from the StudioNet faucet. The run stops at the first step
// that does not do what the demo expects, because the record claims whatever
// it holds.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PKG, RECORD_FILE, accountFrom, balanceOf, clientFor, fundAccount, loadEnv, network, readRetry, recorder, sleep, sourceSha256 } from "./lib.mjs";

loadEnv();
const net = network();
const record = JSON.parse(readFileSync(RECORD_FILE, "utf8"));
if (record.source_sha256 !== sourceSha256()) {
  throw new Error("noshow.py has changed since it was deployed; run pnpm deploy:contract first");
}
const address = record.contract;
const demo = JSON.parse(readFileSync(path.join(PKG, "demo", "demo.json"), "utf8"));
const GEN = 10n ** 18n;

const ROLES = ["restaurant", "ann", "ben", "cal", "dev", "eve", "stranger"];
const who = Object.fromEntries(ROLES.map((k) => [k, accountFrom(`${k.toUpperCase()}_PRIVATE_KEY`, net)]));
const as = Object.fromEntries(ROLES.map((k) => [k, clientFor(net, who[k])]));
const ro = clientFor(net, null);
console.log(`\ncontract ${address}`);
for (const k of ROLES) console.log(`  ${k.padEnd(10)} ${who[k].address}`);

const rec = recorder();
const read = (fn, args = []) => readRetry(() => ro.readContract({ address, functionName: fn, args }));
const plain = (v) => JSON.parse(JSON.stringify(v, (_, x) => (typeof x === "bigint" ? Number(x) : x instanceof Map ? Object.fromEntries(x) : x)));

const existing = Number(await read("count"));
if (existing !== 0) throw new Error(`the demo expects a fresh contract; this one already has ${existing} bookings`);

if (net.name === "studionet") {
  console.log("\nfunding the guests from the StudioNet faucet");
  for (const k of ["ann", "ben", "cal", "dev", "eve", "stranger"]) await fundAccount(net, ro, who[k].address, GEN);
}

const PAID = ["restaurant", "ann", "ben", "cal", "dev", "eve"];
const balances = async () => Object.fromEntries(await Promise.all(PAID.map(async (k) => [k, await balanceOf(ro, who[k].address)])));
const expected = [...demo.expected_rulings];
const lastBook = demo.steps.map((x) => x.method).lastIndexOf("book");
let before = null;
const V = demo.venue;

console.log("\nthe demo");
for (const [i, step] of demo.steps.entries()) {
  if (step.after) {
    const [field, k] = step.after;
    const when = Date.parse(plain(await read("booking", [k]))[field]);
    for (let left = when + 20_000 - Date.now(); left > 0; left = when + 20_000 - Date.now()) {
      console.log(`  waiting ${Math.ceil(left / 1000)} s for booking ${k}'s ${field.replace("_", " ")}`);
      await sleep(Math.min(left, 30_000));
    }
  }
  let args = [step.id];
  let value = 0n;
  if (step.method === "register") {
    args = [V.name, V.policy, BigInt(V.deposit), V.free_window, V.grace];
  } else if (step.method === "book") {
    args = [0, demo.starts_in, demo.parties[step.party]];
    value = BigInt(step.wrong ? demo.wrong_deposit : V.deposit);
  } else if (step.method === "cancel") {
    args = [step.id, demo.reasons[step.reason]];
  }
  await rec.write(as[step.who], who[step.who], address, step.method, args, { step: step.step, expect: step.expect, value });
  // A ruling must come back as the demo expects, or every step after it would
  // be recorded against the wrong story: stop here instead.
  if (step.method === "cancel" && step.expect === "ok") {
    const got = plain(await read("booking", [step.id]));
    if (got.outcome === "excused" || got.outcome === "not_excused") {
      const want = expected.shift();
      console.log(`      ruled ${got.outcome}: ${got.why}`);
      if (got.outcome !== want) throw new Error(`booking ${step.id} was ruled ${got.outcome}, the demo expects ${want}`);
    } else {
      console.log(`      ${got.outcome}: no model asked`);
    }
  }
  if (i === lastBook) before = await balances();
}

const n = Number(await read("count"));
const bookings = [];
for (let k = 0; k < n; k++) bookings.push(plain(await read("booking", [k])));
const venue = plain(await read("venue", [0]));
const owed = Object.fromEntries(PAID.map((p) => [p, 0n]));
const name = Object.fromEntries(PAID.map((p) => [who[p].address.toLowerCase(), p]));
for (const b of bookings) {
  if (b.paid_to === "guest") owed[name[b.guest.toLowerCase()]] += BigInt(b.deposit);
  if (b.paid_to === "restaurant") owed.restaurant += BigInt(b.deposit);
}
// a payout is a message the chain delivers after the transaction; wait until every one has landed
let after = await balances();
for (let k = 0; k < 12 && PAID.some((p) => after[p] - before[p] !== owed[p]); k++) {
  await sleep(10_000);
  after = await balances();
}
const out = {
  ...record,
  accounts: { deployer: record.deployer, ...Object.fromEntries(ROLES.map((k) => [k, who[k].address])) },
  steps: [...record.steps.filter((st) => st.step === "deploy"), ...rec.steps],
  venue,
  bookings,
  balances: Object.fromEntries(PAID.flatMap((p) => [[`${p}_before`, String(before[p])], [`${p}_after`, String(after[p])]])),
  owed: Object.fromEntries(PAID.map((p) => [p, String(owed[p])])),
  held_after: String(await read("held_total")),
};
writeFileSync(RECORD_FILE, JSON.stringify(out, null, 2) + "\n");

const gen = (wei) => `${Number(BigInt(wei)) / 1e18} GEN`;
console.log("");
for (const b of bookings) console.log(`  booking ${b.id}  ${b.outcome.padEnd(12)} paid to ${b.paid_to}`);
for (const p of PAID) console.log(`  ${p.padEnd(10)} ${gen(before[p])} -> ${gen(after[p])}  (owed ${gen(owed[p])})`);
console.log(`  written  ${path.relative(PKG, RECORD_FILE)}\n`);
