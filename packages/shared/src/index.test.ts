import { describe, expect, it } from "vitest";
import vectors from "../noshow-vectors.json";
import {
  FORWARD,
  REVERSED,
  cleanText,
  fold,
  normaliseChoice,
  optionOf,
  parseBooking,
  parseVenue,
  payee,
  phase,
  phaseOf,
  rulingSound,
} from "./index";

// noshow-vectors.json is generated from the contract's own functions
// (see packages/contracts/tests/test_vectors.py), so every case below is the
// contract's answer, not a hand-written expectation.

describe("the port agrees with the contract on every vector", () => {
  it.each(vectors.clean_text)("clean_text %#", ({ raw, clean }) => expect(cleanText(raw)).toBe(clean));
  it.each(vectors.normalise_choice)("normalise_choice %#", ({ raw, n, choice }) => expect(normaliseChoice(raw, n)).toBe(choice));
  it.each(vectors.option_of)("option_of %#", ({ choice, order, option }) => expect(optionOf(choice, order)).toBe(option));
  it.each(vectors.fold)("fold %#", ({ forward, reverse, folded }) => expect(fold(forward, reverse)).toBe(folded));
  it.each(vectors.ruling_sound)("ruling_sound %#", ({ ruling, sound }) => expect(rulingSound(ruling)).toBe(sound));
  it.each(vectors.phase)("phase %#", ({ now, starts_at, free_window, grace, phase: want }) =>
    expect(phase(now, starts_at, free_window, grace)).toBe(want));
  it.each(vectors.payee)("payee %#", ({ outcome, payee: want }) => expect(payee(outcome)).toBe(want));
});

describe("the two orders", () => {
  it("are each other's reverse", () => {
    expect([...REVERSED]).toEqual([...FORWARD].reverse());
  });
});

describe("parsers refuse what the contract never returns", () => {
  const venue = {
    id: 0, name: "Osteria Nove", policy: "Illness is excused.", restaurant: "0x" + "11".repeat(20),
    deposit: "50000000000000000", free_window: 600, grace: 600, registered_at: "t", bookings: 1,
  };
  const base = {
    id: 0, venue: 0, guest: "0x" + "22".repeat(20), party: "Ben, four", deposit: "50000000000000000", booked_at: "t",
    starts_at: "2026-10-18T20:00:00Z", free_until: "2026-10-18T19:50:00Z", grace_until: "2026-10-18T20:10:00Z",
    status: "refunded", outcome: "excused", reason: "A fever.", why: "", reason_is_leader_supplied: true,
    settled_at: "t", paid_to: "guest",
  };
  it("parses a venue and a booking from an object or a Map, with the deposit as bigint", () => {
    expect(parseVenue(venue).deposit).toBe(5n * 10n ** 16n);
    expect(parseBooking(base).deposit).toBe(5n * 10n ** 16n);
    expect(parseBooking(new Map(Object.entries(base))).paid_to).toBe("guest");
  });
  it("refuses an outcome, a status or a payee the contract never returns", () => {
    expect(() => parseBooking({ ...base, outcome: "forgiven" })).toThrow("unexpected outcome");
    expect(() => parseBooking({ ...base, status: "cancelled" })).toThrow("unexpected status");
    expect(() => parseBooking({ ...base, deposit: "5e16" })).toThrow("amount of wei");
  });
  it("refuses a payout that contradicts the outcome", () => {
    expect(() => parseBooking({ ...base, paid_to: "restaurant" })).toThrow();
    expect(() => parseBooking({ ...base, status: "kept" })).toThrow();
    expect(() => parseBooking({ ...base, outcome: "free" })).toThrow();
    expect(parseBooking({ ...base, outcome: "not_excused", status: "kept", paid_to: "restaurant" }).paid_to).toBe("restaurant");
    expect(parseBooking({ ...base, outcome: "no_show", status: "kept", paid_to: "restaurant", reason: "" }).outcome).toBe("no_show");
    expect(parseBooking({ ...base, outcome: "", status: "booked", paid_to: "", reason: "", settled_at: "" }).status).toBe("booked");
  });
  it("tells where a booking is, with the clock the view does not have", () => {
    const b = parseBooking(base);
    const v = parseVenue(venue);
    expect(phaseOf(b, v, new Date("2026-10-18T19:50:00Z"))).toBe("free");
    expect(phaseOf(b, v, new Date("2026-10-18T19:50:01Z"))).toBe("late");
    expect(phaseOf(b, v, new Date("2026-10-18T20:00:01Z"))).toBe("started");
    expect(phaseOf(b, v, new Date("2026-10-18T20:10:01Z"))).toBe("over");
  });
});
