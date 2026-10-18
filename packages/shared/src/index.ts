/**
 * Types and pure rules shared by the Noshow contract (packages/contracts/noshow.py)
 * and any client that reads it: a booking page, a bot, another app.
 *
 * Two kinds of thing live here:
 *
 *   1. The SHAPE of what the contract's views return, with a parser that
 *      refuses anything else. The deposit comes back as a decimal string and
 *      is parsed to bigint, because it can exceed what a number holds.
 *      genlayer-js 1.1.8 returns plain objects; older builds returned Map, so
 *      the parser accepts both.
 *
 *   2. A PORT of the contract's deterministic rules: where a booking is on its
 *      clock, who each outcome pays, how caller text is cleaned, how a model's
 *      answer is read back through the order it was asked in, and how the two
 *      orders fold into one ruling. A port that disagrees with the contract is
 *      worse than none, so it is tested against noshow-vectors.json, which is
 *      generated FROM the contract's own functions and read by its Python
 *      tests too.
 */

// ---------------------------------------------------------------- tokens

export const EXCUSED = "excused" as const;
export const NOT_EXCUSED = "not_excused" as const;
export const OUTCOMES = ["", "free", EXCUSED, NOT_EXCUSED, "seated", "no_show"] as const;
export type Outcome = (typeof OUTCOMES)[number];
export const STATUSES = ["booked", "refunded", "kept"] as const;
export type Status = (typeof STATUSES)[number];
export const PAYEES = ["", "guest", "restaurant"] as const;
export type Payee = (typeof PAYEES)[number];
export type Phase = "free" | "late" | "started" | "over";

/** The order the options are asked in first, and then reversed. */
export const FORWARD = [EXCUSED, NOT_EXCUSED] as const;
export const REVERSED = [NOT_EXCUSED, EXCUSED] as const;

// ---------------------------------------------------------------- shapes

export interface Venue {
  id: number;
  name: string;
  policy: string;
  restaurant: string;
  deposit: bigint;
  free_window: number;
  grace: number;
  registered_at: string;
  bookings: number;
}

export interface Booking {
  id: number;
  venue: number;
  guest: string;
  party: string;
  deposit: bigint;
  booked_at: string;
  starts_at: string;
  free_until: string;
  grace_until: string;
  status: Status;
  outcome: Outcome;
  /** the guest's own words for a late cancellation, verbatim */
  reason: string;
  /** leader-supplied and NOT part of consensus */
  why: string;
  reason_is_leader_supplied: boolean;
  settled_at: string;
  paid_to: Payee;
}

type Raw = Record<string, unknown>;

function record(v: unknown): Raw | null {
  if (v instanceof Map) return Object.fromEntries(v.entries()) as Raw;
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Raw;
  return null;
}

function num(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`expected a number, got ${String(v)}`);
  return n;
}

function str(v: unknown): string {
  if (typeof v !== "string") throw new Error(`expected a string, got ${typeof v}`);
  return v;
}

function wei(v: unknown): bigint {
  const s = str(v);
  if (!/^[0-9]+$/.test(s)) throw new Error(`expected an amount of wei, got ${s}`);
  return BigInt(s);
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], what: string): T {
  const s = str(v);
  if (!(allowed as readonly string[]).includes(s)) throw new Error(`unexpected ${what}: ${s}`);
  return s as T;
}

export function parseVenue(v: unknown): Venue {
  const r = record(v);
  if (!r) throw new Error("venue is not an object");
  return {
    id: num(r.id), name: str(r.name), policy: str(r.policy), restaurant: str(r.restaurant), deposit: wei(r.deposit),
    free_window: num(r.free_window), grace: num(r.grace), registered_at: str(r.registered_at), bookings: num(r.bookings),
  };
}

export function parseBooking(v: unknown): Booking {
  const r = record(v);
  if (!r) throw new Error("booking is not an object");
  const b: Booking = {
    id: num(r.id), venue: num(r.venue), guest: str(r.guest), party: str(r.party), deposit: wei(r.deposit),
    booked_at: str(r.booked_at), starts_at: str(r.starts_at), free_until: str(r.free_until),
    grace_until: str(r.grace_until), status: oneOf(r.status, STATUSES, "status"),
    outcome: oneOf(r.outcome, OUTCOMES, "outcome"), reason: str(r.reason), why: str(r.why),
    reason_is_leader_supplied: Boolean(r.reason_is_leader_supplied), settled_at: str(r.settled_at),
    paid_to: oneOf(r.paid_to, PAYEES, "payee"),
  };
  // held <-> no outcome; every outcome pays the party the port says it pays
  if ((b.status === "booked") !== (b.outcome === "")) throw new Error(`a ${b.status} booking with outcome "${b.outcome}"`);
  if (b.outcome !== "") {
    const to = payee(b.outcome);
    if (to !== b.paid_to) throw new Error(`${b.outcome} paid ${b.paid_to}`);
    if ((b.status === "refunded") !== (to === "guest")) throw new Error(`a ${b.status} booking paid to ${to}`);
  }
  if ((b.reason !== "") !== (b.outcome === EXCUSED || b.outcome === NOT_EXCUSED)) {
    throw new Error(`a ${b.outcome || "held"} booking with a reason "${b.reason}"`);
  }
  return b;
}

// ---------------------------------------------------------------- the port

/** Where a booking is on its clock, in seconds since the epoch. Pure. */
export function phase(now: number, startsAt: number, freeWindow: number, grace: number): Phase {
  if (now <= startsAt - freeWindow) return "free";
  if (now <= startsAt) return "late";
  if (now <= startsAt + grace) return "started";
  return "over";
}

/** Where a booking is now, read from the view and a clock the view does not have. */
export function phaseOf(b: Booking, venue: Venue, now: Date): Phase {
  return phase(Math.floor(now.getTime() / 1000), Math.floor(Date.parse(b.starts_at) / 1000), venue.free_window, venue.grace);
}

/** Who an outcome pays the deposit to. */
export function payee(outcome: string): "guest" | "restaurant" {
  return outcome === NOT_EXCUSED || outcome === "no_show" ? "restaurant" : "guest";
}

/** Python's str.split() whitespace, as far as cleaned text can contain it:
 * JavaScript's \s plus NEL (U+0085), which Python splits on and \s does not. */
const PY_WS = /[\s\u0085]+/;

/** The contract's clean_text: control characters become spaces, whitespace
 * collapses, nothing is truncated. */
export function cleanText(raw: string): string {
  let out = "";
  for (const ch of raw) {
    const o = ch.codePointAt(0) ?? 0;
    out += o < 32 || o === 127 ? " " : ch;
  }
  return out.split(PY_WS).filter(Boolean).join(" ");
}

/** Python's str.strip(chars): remove any of `chars` from both ends. */
function stripChars(s: string, chars: string): string {
  let a = 0;
  let b = s.length;
  while (a < b && chars.includes(s[a])) a++;
  while (b > a && chars.includes(s[b - 1])) b--;
  return s.slice(a, b);
}

/** A model's answer as an option number 0..n-1, or "" if it is not one. */
export function normaliseChoice(raw: string, n: number): string {
  const s = stripChars(raw.trim().toLowerCase(), "[]()#").trim();
  if (s === "" || s.length > 2 || !/^[0-9]+$/.test(s)) return "";
  const k = Number(s);
  if (k < 0 || k >= n) return "";
  return String(k);
}

/** An option number, read back into its token through the order it was asked in. */
export function optionOf(choice: string, order: readonly string[]): string {
  if (choice === "") return "";
  return order[Number(choice)];
}

/** Both orders into one ruling. The same option stands; anything else is not_excused. */
export function fold(forward: string, reverse: string): string {
  if (forward === "" || reverse === "") return "";
  return forward === reverse ? forward : NOT_EXCUSED;
}

/** The validator's free check: one of the two options. */
export function rulingSound(ruling: string): boolean {
  return ruling === EXCUSED || ruling === NOT_EXCUSED;
}
