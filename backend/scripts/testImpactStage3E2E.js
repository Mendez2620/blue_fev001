import assert from "node:assert/strict";
import app from "../src/app.js";
import prisma from "../src/config/prisma.js";

const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}/api`;
const request = async (path, { token, method = "GET", body } = {}) => {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, json: await response.json() };
};
const register = async (name, email) => (await request("/auth/register", { method: "POST", body: { name, email, password: "FuturaTest123" } })).json.data;
const createSubmitted = async (user, mission, suffix) => {
  const joined = await request(`/impact/missions/${mission.id}/participations`, { token: user.token, method: "POST", body: {} }); assert.equal(joined.status, 201);
  const saved = await request(`/impact/participations/${joined.json.data.id}/contribution`, { token: user.token, method: "PUT", body: { title: `Proyecto ${suffix}`, description: `Evidencia ${suffix}`, reflection: `Reflexion ${suffix}` } }); assert.equal(saved.status, 200);
  const submitted = await request(`/impact/contributions/${saved.json.data.id}/submit`, { token: user.token, method: "POST", body: { revision: saved.json.data.revision } }); assert.equal(submitted.status, 200);
  return { participation: joined.json.data, contribution: submitted.json.data };
};
const action = (admin, id, name, revision, feedback) => request(`/admin/impact/contributions/${id}/${name}`, { token: admin.token, method: "POST", body: { revision, ...(feedback === undefined ? {} : { feedback }) } });

try {
  const stamp = Date.now();
  const [authorA, authorB, adminA, adminB] = await Promise.all([
    register("Futura Author A", `futura-stage3-author-a-${stamp}@example.test`),
    register("Futura Author B", `futura-stage3-author-b-${stamp}@example.test`),
    register("Futura Reviewer A", `futura-stage3-admin-a@example.test`),
    register("Futura Reviewer B", `futura-stage3-admin-b@example.test`),
  ]);
  const missions = (await request("/impact/missions")).json.data;
  const initialZones = (await request("/impact/zones")).json.data;
  assert.equal((await request("/admin/impact/contributions")).status, 401);
  assert.equal((await request("/admin/impact/contributions", { token: authorA.token })).status, 403);
  assert.equal((await request("/admin/impact/contributions", { token: adminA.token })).status, 200);

  const cycle = await createSubmitted(authorA, missions[0], "ciclo");
  assert.equal((await action(adminA, cycle.contribution.id, "start-review", cycle.contribution.revision)).status, 200);
  let current = await prisma.impactContribution.findUniqueOrThrow({ where: { id: cycle.contribution.id } });
  const changes = await action(adminA, current.id, "request-changes", current.revision, "Aclara el resultado"); assert.equal(changes.status, 200);
  const edited = await request(`/impact/participations/${cycle.participation.id}/contribution`, { token: authorA.token, method: "PUT", body: { revision: changes.json.data.revision, reflection: "Reflexion corregida" } }); assert.equal(edited.status, 200);
  const resubmitted = await request(`/impact/contributions/${current.id}/submit`, { token: authorA.token, method: "POST", body: { revision: edited.json.data.revision } }); assert.equal(resubmitted.status, 200);
  const secondReview = await action(adminB, current.id, "start-review", resubmitted.json.data.revision); assert.equal(secondReview.status, 200);
  const rejected = await action(adminB, current.id, "reject", secondReview.json.data.revision, "No satisface criterios"); assert.equal(rejected.status, 200);
  assert.equal(rejected.json.data.participation.status, "ABANDONED"); assert.equal(rejected.json.data.approvedAt, null);
  assert.deepEqual(rejected.json.data.auditEvents.map((event) => event.toStatus), ["SUBMITTED", "IN_REVIEW", "CHANGES_REQUESTED", "SUBMITTED", "IN_REVIEW", "REJECTED"]);

  const first = await createSubmitted(authorA, missions[1], "aprobacion uno");
  assert.equal((await action(adminA, first.contribution.id, "start-review", first.contribution.revision, undefined)).status, 200);
  current = await prisma.impactContribution.findUniqueOrThrow({ where: { id: first.contribution.id } });
  assert.equal((await action(adminA, current.id, "approve", current.revision, undefined)).status, 200);
  const approved = await prisma.impactContribution.findUniqueOrThrow({ where: { id: current.id }, include: { participation: true } });
  assert.equal(approved.status, "APPROVED"); assert.equal(approved.visibility, "PRIVATE"); assert.equal(approved.publicAuthorizedAt, null); assert.equal(approved.participation.status, "COMPLETED");

  const second = await createSubmitted(authorB, missions[1], "aprobacion dos");
  const starts = await Promise.all([action(adminA, second.contribution.id, "start-review", second.contribution.revision), action(adminB, second.contribution.id, "start-review", second.contribution.revision)]);
  assert.deepEqual(starts.map((item) => item.status).sort(), [200, 409]);
  current = await prisma.impactContribution.findUniqueOrThrow({ where: { id: second.contribution.id } });
  const approvals = await Promise.all([action(adminA, current.id, "approve", current.revision, "Bien"), action(adminB, current.id, "approve", current.revision, "Bien")]);
  assert.deepEqual(approvals.map((item) => item.status).sort(), [200, 409]);
  assert.equal(await prisma.impactZoneEvent.count({ where: { contributionId: current.id, eventType: "CONTRIBUTION_APPROVED" } }), 1);
  assert.equal(await prisma.impactContributionEvent.count({ where: { contributionId: current.id, toStatus: "APPROVED" } }), 1);

  const race = await createSubmitted(authorB, missions[2], "carrera");
  const raceReview = await action(adminA, race.contribution.id, "start-review", race.contribution.revision); assert.equal(raceReview.status, 200);
  const raceActions = await Promise.all([action(adminA, race.contribution.id, "approve", raceReview.json.data.revision, undefined), action(adminB, race.contribution.id, "reject", raceReview.json.data.revision, "Rechazo concurrente")]);
  assert.deepEqual(raceActions.map((item) => item.status).sort(), [200, 409]);
  const raceFinal = await prisma.impactContribution.findUniqueOrThrow({ where: { id: race.contribution.id } });
  assert.ok(["APPROVED", "REJECTED"].includes(raceFinal.status));
  assert.equal(await prisma.impactContributionEvent.count({ where: { contributionId: race.contribution.id, toStatus: { in: ["APPROVED", "REJECTED"] } } }), 1);
  assert.equal(await prisma.impactZoneEvent.count({ where: { contributionId: race.contribution.id } }), raceFinal.status === "APPROVED" ? 1 : 0);

  assert.equal((await action(adminA, cycle.contribution.id, "start-review", rejected.json.data.revision, undefined)).status, 409);
  const attackTarget = await createSubmitted(authorB, missions[3], "ataque");
  assert.equal((await request(`/admin/impact/contributions/${attackTarget.contribution.id}/start-review`, { token: adminA.token, method: "POST", body: { revision: attackTarget.contribution.revision, points: 999, reviewerId: adminB.user.id } })).status, 400);
  const detail = await request(`/admin/impact/contributions/${first.contribution.id}`, { token: adminA.token }); assert.equal(detail.status, 200); assert.ok(detail.json.data.participation.mission.capabilities.length > 0);
  const listed = await request("/admin/impact/contributions?status=APPROVED", { token: adminA.token }); assert.equal(listed.status, 200); assert.ok(listed.json.data.length >= 2);

  const finalZones = (await request("/impact/zones")).json.data;
  const zoneId = missions[1].zone.id;
  const before = initialZones.find((zone) => zone.id === zoneId); const after = finalZones.find((zone) => zone.id === zoneId);
  assert.equal(before.progressPoints, 0); assert.equal(before.visualState, "abandoned");
  assert.equal(after.progressPoints, missions[1].points * 2); assert.equal(after.visualState, "equipped");
  const counts = { zones: await prisma.impactZone.count(), missions: await prisma.impactMission.count(), capabilities: await prisma.impactCapability.count(), participations: await prisma.impactParticipation.count(), contributions: await prisma.impactContribution.count(), contributionEvents: await prisma.impactContributionEvent.count(), zoneEvents: await prisma.impactZoneEvent.count() };
  const sums = await prisma.impactZoneEvent.groupBy({ by: ["zoneId"], _sum: { points: true } });
  console.log(JSON.stringify({ result: "Impact Stage 3 E2E passed", counts, sums, progress: { before: { points: before.progressPoints, visualState: before.visualState }, after: { points: after.progressPoints, visualState: after.visualState } } }));
} finally {
  server.close();
  await prisma.$disconnect();
}
