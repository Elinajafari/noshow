// A second round on the deployed contract, from two NEW wallets.
//
//   pnpm seed:activity
//
// The contract in deployments/studionet.json is not redeployed. Two wallets
// made in memory for this run, used by nothing else, run one booking from
// venue to refund, and each tries once what only the other may do:
//
//   restaurant  registers a second venue, a 0.02 GEN deposit
//   guest       books a table, paying the deposit in
//   restaurant  tries to cancel it                    refused: only the guest may cancel
//   guest       waits out the free window, then cancels late: a cancelled train
//                                                     expected excused: refunded
//
// Everything goes to deployments/studionet-activity.json, apart from the demo's
// own record, so the demo and the tests that replay it are untouched. Then
// `pnpm evidence:activity` writes EVIDENCE-ACTIVITY.md from the chain.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createAccount, generatePrivateKey } from "genlayer-js";
import { PKG, RECORD_FILE, balanceOf, clientFor, fundAccount, loadEnv, network, readRetry, recorder, sleep } from "./lib.mjs";

loadEnv();
const net = network();
if (net.name !== "studionet") throw new Error("the activity round makes throwaway wallets; run it on studionet");
const address = JSON.parse(readFileSync(RECORD_FILE, "utf8")).contract;
const data = JSON.parse(readFileSync(path.join(PKG, "demo", "activity.json"), "utf8"));
const OUT = path.join(PKG, "deployments", "studionet-activity.json");

const restaurant = createAccount(generatePrivateKey());
const guest = createAccount(generatePrivateKey());
const asRestaurant = clientFor(net, restaurant);
const asGuest = clientFor(net, guest);
const ro = clientFor(net, null);
const read = (fn, args = []) => readRetry(() => ro.readContract({ address, functionName: fn, args }));
const plain = (v) => JSON.parse(JSON.stringify(v, (_, x) => (typeof x === "bigint" ? Number(x) : x instanceof Map ? Object.fromEntries(x) : x)));

const id = Number(await read("count"));
console.log(`\ncontract ${address} (already deployed, ${id} bookings on it)\n  restaurant ${restaurant.address}\n  guest      ${guest.address}`);
await fundAccount(net, ro, guest.address, 10n ** 18n);

const V = data.venue;
const rec = recorder();
await rec.write(asRestaurant, restaurant, address, "register", [V.name, V.policy, BigInt(V.deposit), V.free_window, V.grace],
  { step: "venue 1: a new restaurant registers, a 0.02 GEN deposit" });
await rec.write(asGuest, guest, address, "book", [1, data.starts_in, data.party], { step: `booking ${id}: a new guest books`, value: BigInt(V.deposit) });
const before = await balanceOf(ro, guest.address);
await rec.write(asRestaurant, restaurant, address, "cancel", [id, data.reason], { step: "the restaurant tries to cancel it", expect: "refused" });

const free = Date.parse(plain(await read("booking", [id])).free_until);
for (let left = free + 20_000 - Date.now(); left > 0; left = free + 20_000 - Date.now()) {
  console.log(`  waiting ${Math.ceil(left / 1000)} s for free cancellation to end`);
  await sleep(Math.min(left, 30_000));
}
await rec.write(asGuest, guest, address, "cancel", [id, data.reason], { step: `a late cancellation: a cancelled train (expected ${data.expected_ruling})` });

const booking = plain(await read("booking", [id]));
let after = await balanceOf(ro, guest.address);
const owed = booking.paid_to === "guest" ? BigInt(booking.deposit) : 0n;
for (let k = 0; k < 6 && after - before !== owed; k++) {
  await sleep(10_000);
  after = await balanceOf(ro, guest.address);
}
writeFileSync(OUT, JSON.stringify({
  network: net.name,
  contract: address,
  accounts: { restaurant: restaurant.address, guest: guest.address },
  steps: rec.steps,
  bookings: { [id]: booking },
  balances: { guest_before: String(before), guest_after: String(after) },
}, null, 2) + "\n");

console.log(`  booking ${id}  ${booking.outcome}  paid to ${booking.paid_to}`);
console.log(`  written  ${path.relative(PKG, OUT)}\n`);
