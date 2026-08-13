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

try {
  const stamp = Date.now();
  const [a, b] = await Promise.all([register("Futura User A", `futura-a-${stamp}@example.test`), register("Futura User B", `futura-b-${stamp}@example.test`)]);
  const zones = await request("/impact/zones"); assert.equal(zones.status, 200); assert.equal(zones.json.data.length, 4);
  const missions = await request("/impact/missions"); assert.equal(missions.status, 200); assert.equal(missions.json.data.length, 8);
  const mission = missions.json.data[0]; assert.equal((await request(`/impact/missions/${mission.slug}`)).status, 200);
  assert.equal((await request(`/impact/missions/${mission.id}/participations`, { method: "POST", body: {} })).status, 401);
  const joins = await Promise.all([request(`/impact/missions/${mission.id}/participations`, { token: a.token, method: "POST", body: {} }), request(`/impact/missions/${mission.id}/participations`, { token: a.token, method: "POST", body: {} })]);
  assert.deepEqual(joins.map((item) => item.status).sort(), [201, 409]);
  const participation = joins.find((item) => item.status === 201).json.data;
  assert.equal(await prisma.impactParticipation.count({ where: { userId: a.user.id, missionId: mission.id } }), 1);
  assert.equal((await request("/impact/my-participations", { token: a.token })).json.data.length, 1);
  assert.equal((await request(`/impact/my-participations/${participation.id}`, { token: b.token })).status, 404);
  const created = await request(`/impact/participations/${participation.id}/contribution`, { token: a.token, method: "PUT", body: { title: "Proyecto FUTURA", description: "Evidencia descriptiva inicial", resultUrl: "https://example.test/result" } }); assert.equal(created.status, 200); assert.equal(created.json.data.visibility, "PRIVATE");
  assert.equal((await request(`/impact/participations/${participation.id}/contribution`, { token: a.token, method: "PUT", body: { status: "APPROVED", visibility: "PUBLIC", reviewerId: b.user.id, userId: b.user.id, points: 999 } })).status, 400);
  assert.equal((await request(`/impact/participations/${participation.id}/contribution`, { token: b.token, method: "PUT", body: { title: "Ajeno", revision: 0 } })).status, 404);
  assert.equal((await request(`/impact/participations/${participation.id}/contribution`, { token: a.token, method: "PUT", body: { title: "Proyecto actualizado", description: "Evidencia actualizada", resultUrl: "javascript:alert(1)", revision: 0 } })).status, 400);
  assert.equal((await request(`/impact/participations/${participation.id}/contribution`, { token: a.token, method: "PUT", body: { resultUrl: "data:text/plain,test", revision: 0 } })).status, 400);
  assert.equal((await request(`/impact/participations/${participation.id}/contribution`, { token: a.token, method: "PUT", body: { resultUrl: "file:///tmp/test", revision: 0 } })).status, 400);
  const updated = await request(`/impact/participations/${participation.id}/contribution`, { token: a.token, method: "PUT", body: { title: "Proyecto actualizado", description: "Evidencia actualizada", repositoryUrl: "http://example.test/repo", revision: 0 } }); assert.equal(updated.status, 200); assert.equal(updated.json.data.revision, 1);
  assert.equal((await request(`/impact/participations/${participation.id}/contribution`, { token: a.token, method: "PUT", body: { title: "Obsoleto", revision: 0 } })).status, 409);
  assert.equal((await request(`/impact/contributions/${created.json.data.id}/submit`, { token: b.token, method: "POST", body: { revision: 1 } })).status, 404);
  const submits = await Promise.all([request(`/impact/contributions/${created.json.data.id}/submit`, { token: a.token, method: "POST", body: { revision: 1 } }), request(`/impact/contributions/${created.json.data.id}/submit`, { token: a.token, method: "POST", body: { revision: 1 } })]);
  assert.deepEqual(submits.map((item) => item.status).sort(), [200, 409]);
  const submitted = await prisma.impactContribution.findUniqueOrThrow({ where: { id: created.json.data.id } }); assert.equal(submitted.status, "SUBMITTED"); assert.equal(submitted.revision, 2); assert.ok(submitted.submittedAt);
  assert.equal((await request(`/impact/participations/${participation.id}/contribution`, { token: a.token, method: "PUT", body: { title: "No editable", revision: 2 } })).status, 409);
  assert.equal(await prisma.impactContributionEvent.count({ where: { contributionId: created.json.data.id, toStatus: "SUBMITTED" } }), 1);
  assert.equal(await prisma.impactZoneEvent.count(), 0);
  const incompleteJoin = await request(`/impact/missions/${missions.json.data[1].id}/participations`, { token: a.token, method: "POST", body: {} });
  const incomplete = await request(`/impact/participations/${incompleteJoin.json.data.id}/contribution`, { token: a.token, method: "PUT", body: { title: "" } });
  assert.equal((await request(`/impact/contributions/${incomplete.json.data.id}/submit`, { token: a.token, method: "POST", body: { revision: 0 } })).status, 400);
  const concurrentJoin = await request(`/impact/missions/${missions.json.data[2].id}/participations`, { token: a.token, method: "POST", body: {} });
  const creations = await Promise.all([request(`/impact/participations/${concurrentJoin.json.data.id}/contribution`, { token: a.token, method: "PUT", body: { title: "Concurrente", description: "Evidencia" } }), request(`/impact/participations/${concurrentJoin.json.data.id}/contribution`, { token: a.token, method: "PUT", body: { title: "Concurrente", description: "Evidencia" } })]);
  assert.deepEqual(creations.map((item) => item.status).sort(), [200, 409]); assert.equal(await prisma.impactContribution.count({ where: { participationId: concurrentJoin.json.data.id } }), 1);
  await prisma.impactMission.update({ where: { id: missions.json.data[3].id }, data: { startsAt: new Date(Date.now() + 86400000) } });
  assert.equal((await request(`/impact/missions/${missions.json.data[3].id}/participations`, { token: b.token, method: "POST", body: {} })).status, 409);
  await prisma.impactMission.update({ where: { id: missions.json.data[3].id }, data: { startsAt: null } });
  const counts = { zones: await prisma.impactZone.count(), missions: await prisma.impactMission.count(), capabilities: await prisma.impactCapability.count(), users: await prisma.user.count(), participations: await prisma.impactParticipation.count(), contributions: await prisma.impactContribution.count(), zoneEvents: await prisma.impactZoneEvent.count() };
  console.log(JSON.stringify({ result: "Impact E2E matrix passed", counts }));
} finally {
  server.close();
  await prisma.$disconnect();
}
