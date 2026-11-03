import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseContent,
  departurePhase,
  jerusalemDate,
  formatTravelDate,
  formatMoney,
  type PublicContent,
} from "../src/index.js";
const fixture: unknown = JSON.parse(
  await readFile(
    new URL("../../back/fixtures/demo-content.json", import.meta.url),
    "utf8",
  ),
);
test("retained domain-model fixture validates distinct tours/departures and an empty tour", () => {
  const c = parseContent(fixture);
  assert.equal(c.schemaVersion, 1);
  assert.equal(c.demo, true);
  assert.equal(c.tours.length, 2);
  assert.equal(c.guides.length, 2);
  assert.equal(c.posts.length, 2);
  assert.ok(c.tours.some((t) => !c.departures.some((d) => d.tourId === t.id)));
  assert.ok(c.departures.filter((d) => d.tourId === c.tours[0]?.id).length > 1);
});
const invalid: [string, (c: PublicContent) => void, RegExp][] = [
  [
    "broken guide reference",
    (c) => {
      c.tours[0]!.guideIds = ["guide-missing"];
    },
    /tours\.0\.guideIds\.0: Unknown guides reference/,
  ],
  [
    "broken image block",
    (c) => {
      c.posts[0]!.blocks.push({ type: "image", mediaId: "media-missing" });
    },
    /Unknown mediaAssets reference/,
  ],
  [
    "duplicate IDs",
    (c) => {
      c.guides[1]!.id = c.guides[0]!.id;
    },
    /Duplicate stable ID/,
  ],
  [
    "duplicate paths",
    (c) => {
      c.posts[1]!.path = c.posts[0]!.path;
    },
    /Duplicate path/,
  ],
  [
    "backwards dates",
    (c) => {
      c.departures[0]!.endDate = "2027-01-01";
    },
    /End date must be on or after/,
  ],
  [
    "impossible dates",
    (c) => {
      c.departures[0]!.startDate = "2027-02-30";
    },
    /startDate/,
  ],
  [
    "negative price",
    (c) => {
      c.departures[0]!.price!.minorUnits = -1;
    },
    /minorUnits/,
  ],
  [
    "fractional minor units",
    (c) => {
      c.departures[0]!.price!.minorUnits = 1.5;
    },
    /minorUnits/,
  ],
  [
    "invalid currency",
    (c) => {
      c.departures[0]!.price!.currency = "XYZ";
    },
    /ISO 4217/,
  ],
  [
    "unordered itinerary",
    (c) => {
      c.tours[0]!.itinerary[0]!.day = 2;
    },
    /consecutive and ordered/,
  ],
  [
    "bad navigation reference",
    (c) => {
      c.siteSettings.navigation[0]!.path = "/missing/";
    },
    /Unknown navigation path/,
  ],
  [
    "canonical mismatch",
    (c) => {
      c.posts[0]!.seo.canonicalPath = "/different/";
    },
    /Canonical path/,
  ],
  [
    "unexpected private data",
    (c) => {
      Object.assign(c, { privateToken: "never-public" });
    },
    /privateToken/,
  ],
];
for (const [name, mutate, message] of invalid)
  test(`rejects ${name} with a readable location`, () => {
    const content = structuredClone(fixture) as PublicContent;
    mutate(content);
    assert.throws(() => parseContent(content), message);
  });
test("date phase is independent of booking status and uses travel dates without shifting days", () => {
  const departure = parseContent(fixture).departures[0]!;
  assert.equal(departurePhase(departure, "2027-02-09"), "upcoming");
  assert.equal(departurePhase(departure, "2027-02-10"), "inProgress");
  assert.equal(departurePhase(departure, "2027-02-12"), "inProgress");
  assert.equal(departurePhase(departure, "2027-02-13"), "past");
  assert.equal(
    departurePhase(
      { ...departure, startDate: null, endDate: null },
      "2027-02-10",
    ),
    "unknown",
  );
  assert.equal(jerusalemDate(new Date("2027-02-09T23:30:00Z")), "2027-02-10");
  assert.equal(formatTravelDate("2027-02-10"), "10.02.2027");
  assert.match(formatMoney({ minorUnits: 125000, currency: "USD" }), /1,250/);
  assert.match(formatMoney({ minorUnits: 1000, currency: "JPY" }), /1,000/);
});
