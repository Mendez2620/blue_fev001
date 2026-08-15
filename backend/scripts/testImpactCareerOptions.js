import assert from "node:assert/strict";
import app from "../src/app.js";
import prisma from "../src/config/prisma.js";
import { resolveCanonicalProgramOfferingsBatch } from "../src/services/educativeSearchService.js";
import { getCanonicalProgram, normalizeProgramText } from "../src/services/educativeProgramRelationsService.js";

const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}/api`;
const request = async (path, { token, method = "GET", body } = {}) => {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, json: await response.json() };
};
const register = async (label, stamp) => (await request("/auth/register", { method: "POST", body: { name: label, email: `${label}-${stamp}@example.test`, password: "CareerOptions123" } })).json.data;

try {
  const mappings = await prisma.impactCareerCapability.findMany({ orderBy: { canonicalProgramKey: "asc" } });
  const keys = [...new Set(mappings.map((mapping) => mapping.canonicalProgramKey))];
  assert.equal(mappings.length, 16); assert.equal(keys.length, 15);
  let measuredQueries = 0;
  const measuredPrisma = { $queryRawUnsafe: async (...args) => { measuredQueries += 1; return prisma.$queryRawUnsafe(...args); } };
  const realCoverage = await resolveCanonicalProgramOfferingsBatch({ prisma: measuredPrisma, canonicalProgramKeys: keys });
  assert.equal(realCoverage.catalogQueryCount, 1); assert.equal(measuredQueries, 1);
  const coverage = keys.map((key) => {
    const offerings = realCoverage.offeringsByCanonicalProgramKey[key];
    const canonical = getCanonicalProgram(key);
    const allowedAliases = new Set(canonical.exactAliases.map(normalizeProgramText));
    assert.ok(offerings.every((offering) => allowedAliases.has(normalizeProgramText(offering.offeredProgramName))));
    const institutions = new Set(offerings.map((offering) => `${normalizeProgramText(offering.institutionName)}|${normalizeProgramText(offering.municipality)}`));
    return { canonicalProgramKey: key, status: offerings.length ? "AVAILABLE" : "NO_ACTIVE_NAVIGABLE_OFFERING", institutions: institutions.size, offerings: offerings.length };
  });
  const realAvailable = coverage.filter((item) => item.status === "AVAILABLE").length;
  const realOfferings = coverage.reduce((total, item) => total + item.offerings, 0);
  const realInstitutions = new Set(keys.flatMap((key) => realCoverage.offeringsByCanonicalProgramKey[key].map((offering) => `${normalizeProgramText(offering.institutionName)}|${normalizeProgramText(offering.municipality)}`))).size;

  const stamp = Date.now();
  const syntheticInstitution = `FUTURA 5B2 ${stamp}`;
  const createOffering = async ({ key, offerActive = 1, campusActive = 1, careerActive = 1, redirectUrl = "https://example.test/futura", level = "2", campusSuffix = "A" }) => {
    const program = getCanonicalProgram(key);
    const offer = await prisma.tbl_educative_offer.create({ data: { level, municipality: "Mérida", name: syntheticInstitution, short_name: "F5B2", redirect_url: redirectUrl, pdf: "fixture.pdf", active: offerActive } });
    const campus = await prisma.tbl_educative_offer_campuses.create({ data: { ev_educative_offer_id: offer.id.toString(), name: `Campus ${campusSuffix}`, municipality: "Mérida", active: campusActive } });
    const career = await prisma.tbl_educative_offer_campus_careers.create({ data: { ev_educative_offer_campus_id: campus.id, name: program.exactAliases[0], active: careerActive } });
    return { offer, campus, career };
  };
  const systemsKey = "ingenieria_sistemas_computacionales";
  const validA = await createOffering({ key: systemsKey, campusSuffix: "Valid A" });
  await prisma.tbl_educative_offer_campus_careers.create({ data: { ev_educative_offer_campus_id: validA.campus.id, name: getCanonicalProgram(systemsKey).exactAliases[0], active: 1 } });
  const validB = await createOffering({ key: systemsKey, campusSuffix: "Valid B" });
  const inactiveOffer = await createOffering({ key: systemsKey, offerActive: 0, campusSuffix: "Inactive offer" });
  const inactiveCampus = await createOffering({ key: systemsKey, campusActive: 0, campusSuffix: "Inactive campus" });
  const inactiveCareer = await createOffering({ key: systemsKey, careerActive: 0, campusSuffix: "Inactive career" });
  const nullRedirect = await createOffering({ key: systemsKey, redirectUrl: null, campusSuffix: "Null redirect" });
  const emptyRedirect = await createOffering({ key: systemsKey, redirectUrl: "", campusSuffix: "Empty redirect" });
  const whitespaceRedirect = await createOffering({ key: systemsKey, redirectUrl: "   ", campusSuffix: "Whitespace redirect" });
  const wrongLevel = await createOffering({ key: systemsKey, level: "1", campusSuffix: "Wrong level" });
  const secondProgramKey = "ingenieria_desarrollo_y_gestion_de_software";
  const sameSchoolSecondProgram = await createOffering({ key: secondProgramKey, campusSuffix: "Other program" });
  const tsuKeys = ["tsu_tecnico_superior_universitario_en_administracion_area_formulacion_y_eval", "tsu_tecnico_superior_universitario_en_logistica_area_transporte_terrestre"];
  const tsuFixtures = await Promise.all(tsuKeys.map((key, index) => createOffering({ key, campusSuffix: `TSU ${index + 1}` })));

  const directed = await resolveCanonicalProgramOfferingsBatch({ prisma, canonicalProgramKeys: [systemsKey, secondProgramKey, ...tsuKeys] });
  const systemsSynthetic = directed.offeringsByCanonicalProgramKey[systemsKey].filter((offering) => offering.institutionName === syntheticInstitution);
  assert.equal(systemsSynthetic.length, 2); assert.deepEqual(new Set(systemsSynthetic.map((offering) => offering.campusId)), new Set([validA.campus.id.toString(), validB.campus.id.toString()]));
  const rejectedOfferIds = [inactiveOffer, inactiveCampus, inactiveCareer, nullRedirect, emptyRedirect, whitespaceRedirect, wrongLevel].map((fixture) => fixture.offer.id.toString());
  assert.ok(systemsSynthetic.every((offering) => !rejectedOfferIds.includes(offering.educativeOfferId)));
  assert.ok(directed.offeringsByCanonicalProgramKey[secondProgramKey].some((offering) => offering.educativeOfferId === sameSchoolSecondProgram.offer.id.toString()));
  for (const [index, key] of tsuKeys.entries()) {
    const returned = directed.offeringsByCanonicalProgramKey[key].find((offering) => offering.educativeOfferId === tsuFixtures[index].offer.id.toString());
    assert.ok(returned); assert.match(normalizeProgramText(returned.offeredProgramName), /TECNICO SUPERIOR UNIVERSITARIO|\bTSU\b|T S U/);
  }

  const zone = await prisma.impactZone.create({ data: { slug: `career-options-${stamp}`, name: "Career options", description: "Fixture", targetPoints: 100, sortOrder: 1000 } });
  let missionIndex = 0;
  const approvedFor = async (user, capabilitySlug) => {
    const capability = await prisma.impactCapability.findUniqueOrThrow({ where: { slug: capabilitySlug } });
    const mission = await prisma.impactMission.create({ data: { zoneId: zone.id, slug: `career-options-${stamp}-${missionIndex++}`, title: "Career option fixture", summary: "Fixture", problemDescription: "Fixture", objective: "Fixture", instructions: "Fixture", deliverables: ["Fixture"], validationCriteria: ["Fixture"], safetyNotes: "Fixture", difficulty: "INITIAL", estimatedMinutes: 1, points: 1, evidenceType: "DOCUMENT", participationMode: "INDIVIDUAL", publicationStatus: "PUBLISHED", active: true, sortOrder: 1000, capabilities: { create: { capabilityId: capability.id, weight: 1 } } } });
    const participation = await prisma.impactParticipation.create({ data: { missionId: mission.id, userId: user.user.id, status: "COMPLETED", completedAt: new Date() } });
    return prisma.impactContribution.create({ data: { participationId: participation.id, title: "Private evidence", description: "Fixture", status: "APPROVED", approvedAt: new Date() } });
  };
  const owner = await register("career-options-owner", stamp); const other = await register("career-options-other", stamp); const unmapped = await register("career-options-unmapped", stamp);
  const contribution = await approvedFor(owner, "desarrollo-web"); await approvedFor(unmapped, "accesibilidad");
  assert.equal(contribution.visibility, "PRIVATE");
  assert.equal((await request("/impact/my-career-options")).status, 401);
  const empty = await request("/impact/my-career-options", { token: other.token }); assert.equal(empty.status, 200); assert.deepEqual(empty.json.data.careerOptions, []);
  const unmappedResult = await request("/impact/my-career-options", { token: unmapped.token }); assert.equal(unmappedResult.status, 200); assert.deepEqual(unmappedResult.json.data.careerOptions, []);
  assert.equal((await request(`/impact/my-career-options?userId=${other.user.id}`, { token: owner.token })).status, 400);
  const catalogBeforeRequests = { offers: await prisma.tbl_educative_offer.count(), campuses: await prisma.tbl_educative_offer_campuses.count(), careers: await prisma.tbl_educative_offer_campus_careers.count() };
  let endpointCatalogQueries = 0; const originalRaw = prisma.$queryRawUnsafe.bind(prisma);
  prisma.$queryRawUnsafe = async (...args) => { endpointCatalogQueries += 1; return originalRaw(...args); };
  const ownerResult = await request("/impact/my-career-options", { token: owner.token });
  prisma.$queryRawUnsafe = originalRaw;
  assert.equal(ownerResult.status, 200); assert.equal(endpointCatalogQueries, 1); assert.ok(ownerResult.json.data.careerOptions.length > 0);
  assert.equal(JSON.stringify(ownerResult.json.data).includes("contributionId"), false);
  assert.equal((await request("/impact/my-career-options", { token: other.token })).json.data.careerOptions.length, 0);
  assert.deepEqual({ offers: await prisma.tbl_educative_offer.count(), campuses: await prisma.tbl_educative_offer_campuses.count(), careers: await prisma.tbl_educative_offer_campus_careers.count() }, catalogBeforeRequests);

  const unavailable = coverage.find((item) => item.status === "NO_ACTIVE_NAVIGABLE_OFFERING");
  if (unavailable) {
    const semantic = mappings.find((mapping) => mapping.canonicalProgramKey === unavailable.canonicalProgramKey);
    const zeroUser = await register("career-options-zero", stamp);
    const capability = await prisma.impactCapability.findUniqueOrThrow({ where: { id: semantic.capabilityId } });
    await approvedFor(zeroUser, capability.slug);
    const [matchesResponse, optionsResponse] = await Promise.all([request("/impact/my-career-matches", { token: zeroUser.token }), request("/impact/my-career-options", { token: zeroUser.token })]);
    assert.ok(matchesResponse.json.data.careerMatches.some((match) => match.canonicalProgramKey === unavailable.canonicalProgramKey));
    assert.ok(optionsResponse.json.data.careerOptions.every((option) => option.canonicalProgramKey !== unavailable.canonicalProgramKey));
  }

  console.log(JSON.stringify({ result: "FUTURA Stage 5B.2 career options passed", catalogQueryCount: endpointCatalogQueries, coverage, totals: { candidatePrograms: keys.length, availablePrograms: realAvailable, unavailablePrograms: keys.length - realAvailable, institutions: realInstitutions, offerings: realOfferings } }));
} finally {
  server.close();
  await prisma.$disconnect();
}
