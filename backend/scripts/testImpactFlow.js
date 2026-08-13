import assert from "node:assert/strict";
import { isContributionEditable, missionAvailability, validateAllowedPayload, validateHttpUrl, visualState } from "../src/services/impactService.js";

assert.equal(visualState(0), "abandoned"); assert.equal(visualState(25), "powered"); assert.equal(visualState(50), "equipped"); assert.equal(visualState(75), "active"); assert.equal(visualState(100), "transformed");
const now = new Date("2026-08-12T12:00:00Z");
assert.deepEqual(missionAvailability({ active: true, publicationStatus: "PUBLISHED", startsAt: null, endsAt: null, zone: { active: true } }, now), { visible: true, joinable: true });
assert.equal(missionAvailability({ active: true, publicationStatus: "PUBLISHED", startsAt: new Date("2026-08-13T00:00:00Z"), endsAt: null, zone: { active: true } }, now).visible, false);
assert.equal(missionAvailability({ active: true, publicationStatus: "PUBLISHED", startsAt: null, endsAt: new Date("2026-08-11T00:00:00Z"), zone: { active: true } }, now).joinable, false);
validateAllowedPayload({ revision: 0 }, ["revision"]);
assert.throws(() => validateAllowedPayload({ status: "APPROVED" }, ["revision"]), /Payload/);
assert.match(validateHttpUrl("https://example.test/path", "url"), /^https:/);
assert.throws(() => validateHttpUrl("javascript:alert(1)", "url"), /http/);
assert.equal(isContributionEditable("DRAFT"), true); assert.equal(isContributionEditable("SUBMITTED"), false);
console.log("Impact flow service tests: 14 passed");
