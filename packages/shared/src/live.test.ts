import { describe, expect, it } from "vitest";
import demo from "../../contracts/demo/demo.json";
import record from "../../contracts/deployments/studionet.json";
import shape from "../contract-shape.json";
import { parseBooking, parseVenue, payee } from "./index";

// The live deployment's own answers, as packages/contracts/scripts/seed.mjs
// read them back from studionet. If the contract ever returned a shape these
// parsers refuse, a client built on this package would break on real data;
// this is where that shows up first.

describe("the parsers accept everything the live deployment returned", () => {
  it("the venue and every booking, with exactly the fields the contract describes", () => {
    expect(Object.keys(parseVenue(record.venue)).sort()).toEqual(shape.views.venue.fields);
    for (const x of record.bookings) {
      expect(Object.keys(parseBooking(x)).sort()).toEqual(shape.views.booking.fields);
    }
  });

  it("the venue's policy and deposit are the ones the demo registered", () => {
    const v = parseVenue(record.venue);
    expect(v.policy).toBe(demo.venue.policy);
    expect(v.deposit).toBe(BigInt(demo.venue.deposit));
  });

  it("every settled booking was paid to whoever the port says its outcome pays", () => {
    for (const b of record.bookings.map(parseBooking)) {
      if (b.outcome !== "") expect(b.paid_to).toBe(payee(b.outcome));
    }
  });

  it("the wallets moved by exactly what the contract paid them", () => {
    const b = record.balances as Record<string, string>;
    for (const [who, owed] of Object.entries(record.owed)) {
      expect(BigInt(b[`${who}_after`]) - BigInt(b[`${who}_before`])).toBe(BigInt(owed));
    }
  });
});
