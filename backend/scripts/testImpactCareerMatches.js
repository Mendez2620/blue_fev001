import assert from "node:assert/strict";
import app from "../src/app.js";
import prisma from "../src/config/prisma.js";
import { getCanonicalProgram } from "../src/services/educativeProgramRelationsService.js";

const expectedKeys = [
  "ingenieria_desarrollo_y_gestion_de_software", "ingenieria_sistemas_computacionales",
  "licenciatura_diseno_grafico_digital", "ingenieria_entornos_virtuales_y_negocios_digitales",
  "licenciatura_sistemas_de_informacion_administrativa", "ingenieria_ciencia_de_datos",
  "licenciatura_comunicacion", "licenciatura_ciencias_de_la_comunicacion",
  "licenciatura_diseno_industrial", "ingenieria_mecatronica", "ingenieria_gestion_de_proyectos",
  "tsu_tecnico_superior_universitario_en_administracion_area_formulacion_y_eval",
  "ingenieria_logistica", "licenciatura_logistica",
  "tsu_tecnico_superior_universitario_en_logistica_area_transporte_terrestre",
];
const unmappedSlugs = ["accesibilidad", "resolucion-problemas", "investigacion", "trabajo-colaborativo"];
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}/api`;
const request = async (path, { token, method = "GET", body } = {}) => {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, json: await response.json() };
};
const register = async (label, stamp) => (await request("/auth/register", { method: "POST", body: { name: label, email: `${label.toLowerCase().replace(/\s/g, "-")}-${stamp}@example.test`, password: "CareerMatch123" } })).json.data;

try {
  const mappings = await prisma.impactCareerCapability.findMany({ include: { capability: true } });
  assert.equal(mappings.length, 16);
  assert.equal(new Set(mappings.map((mapping) => mapping.canonicalProgramKey)).size, 15);
  assert.equal(mappings.filter((mapping) => mapping.weight === 5).length, 9);
  assert.equal(mappings.filter((mapping) => mapping.weight === 3).length, 7);
  assert.deepEqual([...new Set(mappings.map((mapping) => mapping.canonicalProgramKey))].sort(), [...expectedKeys].sort());
  assert.ok(expectedKeys.every((key) => {
    const program = getCanonicalProgram(key);
    return program && ["ingenieria", "licenciatura", "tsu"].includes(program.level);
  }));
  assert.equal(getCanonicalProgram("ingenieria_sistemas_computacionales").level, "ingenieria");
  for (const slug of unmappedSlugs) assert.equal(mappings.filter((mapping) => mapping.capability.slug === slug).length, 0);
  assert.deepEqual(mappings.filter((mapping) => mapping.canonicalProgramKey === "ingenieria_ciencia_de_datos").map((mapping) => mapping.capability.slug).sort(), ["analisis", "organizacion-informacion"]);

  const stamp = Date.now();
  const zone = await prisma.impactZone.create({ data: { slug: `career-test-${stamp}`, name: "Career test", description: "Fixture 5B.1", targetPoints: 100, sortOrder: 999 } });
  const capabilities = new Map((await prisma.impactCapability.findMany()).map((capability) => [capability.slug, capability]));
  let missionIndex = 0;
  const mission = async (slugs) => prisma.impactMission.create({ data: {
    zoneId: zone.id, slug: `career-test-mission-${stamp}-${missionIndex++}`, title: "Career fixture", summary: "Fixture", problemDescription: "Fixture", objective: "Fixture", instructions: "Fixture", deliverables: ["Fixture"], validationCriteria: ["Fixture"], safetyNotes: "Fixture", difficulty: "INITIAL", estimatedMinutes: 1, points: 1, evidenceType: "DOCUMENT", participationMode: "INDIVIDUAL", publicationStatus: "PUBLISHED", active: true, sortOrder: 999,
    capabilities: { create: slugs.map((slug) => ({ capabilityId: capabilities.get(slug).id, weight: 1 })) },
  } });
  const contribute = async (user, slugs, status = "APPROVED") => {
    const selectedMission = await mission(slugs);
    const participation = await prisma.impactParticipation.create({ data: { missionId: selectedMission.id, userId: user.user.id, status: status === "APPROVED" ? "COMPLETED" : "ACTIVE", completedAt: status === "APPROVED" ? new Date() : null } });
    return prisma.impactContribution.create({ data: { participationId: participation.id, title: `Evidence ${missionIndex}`, description: "Fixture", status, approvedAt: new Date() } });
  };
  const get = async (user) => {
    const response = await request("/impact/my-career-matches", { token: user.token });
    assert.equal(response.status, 200);
    return response.json.data;
  };

  assert.equal((await request("/impact/my-career-matches")).status, 401);
  const empty = await register("Career Empty", stamp);
  assert.deepEqual(await get(empty), { summary: { approvedProjects: 0, demonstratedCapabilities: 0, matchedPrograms: 0 }, careerMatches: [] });
  assert.equal((await request(`/impact/my-career-matches?userId=someone`, { token: empty.token })).status, 400);

  const unmapped = await register("Career Unmapped", stamp); await contribute(unmapped, unmappedSlugs);
  assert.equal((await get(unmapped)).careerMatches.length, 0);

  const one = await register("Career One", stamp); await contribute(one, ["logistica"]);
  const oneResult = await get(one); assert.equal(oneResult.careerMatches.length, 3); assert.ok(oneResult.careerMatches.every((match) => match.matchedCapabilityCount === 1));

  const multi = await register("Career Multi", stamp); await contribute(multi, ["organizacion-informacion", "analisis"]);
  const multiResult = await get(multi); const dataScience = multiResult.careerMatches.find((match) => match.canonicalProgramKey === "ingenieria_ciencia_de_datos");
  assert.equal(dataScience.matchedCapabilityCount, 2); assert.equal(dataScience.mappingWeight, 6); assert.equal(multiResult.careerMatches.filter((match) => match.canonicalProgramKey === "ingenieria_ciencia_de_datos").length, 1); assert.equal(multiResult.careerMatches[0].canonicalProgramKey, "ingenieria_ciencia_de_datos");

  const weight = await register("Career Weight", stamp); await contribute(weight, ["desarrollo-web"]);
  const weightResult = await get(weight); assert.equal(weightResult.careerMatches[0].mappingWeight, 5); assert.equal(weightResult.careerMatches[1].mappingWeight, 3);

  const evidence = await register("Career Evidence", stamp); await contribute(evidence, ["desarrollo-web", "prototipado"]); await contribute(evidence, ["desarrollo-web"]);
  const evidenceResult = await get(evidence); assert.equal(evidenceResult.careerMatches[0].canonicalProgramKey, "ingenieria_desarrollo_y_gestion_de_software"); assert.equal(evidenceResult.careerMatches[0].approvedEvidenceCount, 2); assert.equal(evidenceResult.careerMatches.find((match) => match.canonicalProgramKey === "licenciatura_diseno_industrial").approvedEvidenceCount, 1);

  const tie = await register("Career Tie", stamp); await contribute(tie, ["comunicacion"]);
  const tieFirst = await get(tie); const tieSecond = await get(tie); assert.deepEqual(tieSecond, tieFirst);
  assert.deepEqual(tieFirst.careerMatches.map((match) => match.programName), [...tieFirst.careerMatches.map((match) => match.programName)].sort((a, b) => a.localeCompare(b, "es")));

  const unapproved = await register("Career Unapproved", stamp);
  for (const status of ["DRAFT", "IN_PROGRESS", "SUBMITTED", "IN_REVIEW", "CHANGES_REQUESTED", "REJECTED"]) await contribute(unapproved, ["desarrollo-web"], status);
  assert.equal((await get(unapproved)).careerMatches.length, 0);
  assert.equal((await get(empty)).careerMatches.length, 0);

  console.log(JSON.stringify({ result: "FUTURA Stage 5B.1 career matching passed", seed: { rows: mappings.length, distinctPrograms: 15, high: 9, medium: 7 }, fixtures: { users: 8, approvedContributions: 7, unapprovedContributions: 6 } }));
} finally {
  server.close();
  await prisma.$disconnect();
}
