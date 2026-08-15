import assert from "node:assert/strict";
import app from "../src/app.js";
import prisma from "../src/config/prisma.js";

const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}/api`;
const request = async (path, { token, method = "GET", body } = {}) => {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, json: await response.json() };
};
const register = async (name, email) => (await request("/auth/register", { method: "POST", body: { name, email, password: "FootprintTest123" } })).json.data;
const createSubmitted = async (user, mission, title) => {
  const joined = await request(`/impact/missions/${mission.id}/participations`, { token: user.token, method: "POST", body: {} }); assert.equal(joined.status, 201);
  const saved = await request(`/impact/participations/${joined.json.data.id}/contribution`, { token: user.token, method: "PUT", body: { title, description: "Evidencia verificable" } }); assert.equal(saved.status, 200);
  const submitted = await request(`/impact/contributions/${saved.json.data.id}/submit`, { token: user.token, method: "POST", body: { revision: saved.json.data.revision } }); assert.equal(submitted.status, 200);
  return { participation: joined.json.data, contribution: submitted.json.data };
};
const review = (admin, id, action, revision, feedback) => request(`/admin/impact/contributions/${id}/${action}`, { token: admin.token, method: "POST", body: { revision, ...(feedback === undefined ? {} : { feedback }) } });
const approve = async (admin, submitted) => {
  const started = await review(admin, submitted.contribution.id, "start-review", submitted.contribution.revision); assert.equal(started.status, 200);
  const approved = await review(admin, submitted.contribution.id, "approve", started.json.data.revision); assert.equal(approved.status, 200);
  return approved.json.data;
};

try {
  const stamp = Date.now();
  const [owner, other, rejectedOwner, changesOwner, admin] = await Promise.all([
    register("Footprint Owner", `footprint-owner-${stamp}@example.test`), register("Footprint Other", `footprint-other-${stamp}@example.test`),
    register("Footprint Rejected", `footprint-rejected-${stamp}@example.test`), register("Footprint Changes", `footprint-changes-${stamp}@example.test`),
    register("Footprint Admin", "futura-stage5a-admin@example.test"),
  ]);
  assert.equal((await request("/impact/my-footprint")).status, 401);
  const empty = await request("/impact/my-footprint", { token: owner.token }); assert.equal(empty.status, 200); assert.deepEqual(empty.json.data, { summary: { approvedProjects: 0, demonstratedCapabilities: 0, evidenceItems: 0 }, capabilities: [] });
  assert.equal((await request(`/impact/my-footprint?userId=${other.user.id}`, { token: owner.token })).status, 400);
  assert.equal((await request(`/impact/my-footprint?email=x&ownerId=${other.user.id}`, { token: owner.token })).status, 400);

  const missions = await prisma.impactMission.findMany({ include: { capabilities: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  let pair;
  for (let i = 0; i < missions.length && !pair; i += 1) for (let j = i + 1; j < missions.length && !pair; j += 1) if (missions[i].capabilities.some((left) => missions[j].capabilities.some((right) => right.capabilityId === left.capabilityId))) pair = [missions[i], missions[j]];
  assert.ok(pair, "Seed must contain two missions with a shared capability");
  const remaining = missions.filter((mission) => !pair.some((selected) => selected.id === mission.id));
  for (const [index, state] of ["DRAFT", "IN_PROGRESS", "SUBMITTED", "IN_REVIEW", "CHANGES_REQUESTED", "REJECTED"].entries()) {
    const participation = await prisma.impactParticipation.create({ data: { userId: owner.user.id, missionId: remaining[index].id, status: state === "REJECTED" ? "ABANDONED" : "ACTIVE" } });
    await prisma.impactContribution.create({ data: { participationId: participation.id, title: `No cuenta ${state}`, description: "No aprobada", status: state, approvedAt: state === "REJECTED" ? new Date() : null } });
  }
  assert.equal((await request("/impact/my-footprint", { token: owner.token })).json.data.summary.evidenceItems, 0);

  const first = await approve(admin, await createSubmitted(owner, pair[0], "Aprobado uno"));
  const afterFirst = (await request("/impact/my-footprint", { token: owner.token })).json.data; assert.equal(afterFirst.summary.approvedProjects, 1);
  const second = await approve(admin, await createSubmitted(owner, pair[1], "Aprobado dos"));
  const footprint = (await request("/impact/my-footprint", { token: owner.token })).json.data; assert.equal(footprint.summary.approvedProjects, 2); assert.ok(footprint.capabilities.some((capability) => capability.evidenceCount === 2));
  const keys = footprint.capabilities.flatMap((capability) => capability.evidence.map((evidence) => `${capability.id}:${evidence.contributionId}`)); assert.equal(new Set(keys).size, keys.length); assert.equal(footprint.summary.evidenceItems, keys.length);
  assert.deepEqual((await request("/impact/my-footprint", { token: owner.token })).json.data, footprint);
  assert.equal((await request("/impact/my-footprint", { token: other.token })).json.data.summary.evidenceItems, 0);

  const rejected = await createSubmitted(rejectedOwner, missions[0], "Rechazado");
  const rejectedReview = await review(admin, rejected.contribution.id, "start-review", rejected.contribution.revision); assert.equal(rejectedReview.status, 200);
  assert.equal((await review(admin, rejected.contribution.id, "reject", rejectedReview.json.data.revision, "No cumple")).status, 200);
  assert.equal((await request("/impact/my-footprint", { token: rejectedOwner.token })).json.data.summary.evidenceItems, 0);

  const changes = await createSubmitted(changesOwner, missions[1], "Cambios");
  const changesReview = await review(admin, changes.contribution.id, "start-review", changes.contribution.revision); assert.equal(changesReview.status, 200);
  const requested = await review(admin, changes.contribution.id, "request-changes", changesReview.json.data.revision, "Corrige"); assert.equal(requested.status, 200);
  assert.equal((await request("/impact/my-footprint", { token: changesOwner.token })).json.data.summary.evidenceItems, 0);
  const edited = await request(`/impact/participations/${changes.participation.id}/contribution`, { token: changesOwner.token, method: "PUT", body: { revision: requested.json.data.revision, reflection: "Corregida" } }); assert.equal(edited.status, 200);
  const resubmitted = await request(`/impact/contributions/${changes.contribution.id}/submit`, { token: changesOwner.token, method: "POST", body: { revision: edited.json.data.revision } }); assert.equal(resubmitted.status, 200);
  await approve(admin, { contribution: resubmitted.json.data });
  assert.equal((await request("/impact/my-footprint", { token: changesOwner.token })).json.data.summary.approvedProjects, 1);

  const counts = { users: await prisma.user.count({ where: { email: { endsWith: "@example.test" } } }), participations: await prisma.impactParticipation.count(), contributions: await prisma.impactContribution.count(), approvedContributions: await prisma.impactContribution.count({ where: { status: "APPROVED" } }), contributionEvents: await prisma.impactContributionEvent.count(), zoneEvents: await prisma.impactZoneEvent.count() };
  console.log(JSON.stringify({ result: "FUTURA Stage 5A footprint passed", counts, footprint: footprint.summary, approvedIds: [first.id, second.id] }));
} finally {
  server.close();
  await prisma.$disconnect();
}
