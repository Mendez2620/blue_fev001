import prisma from "../config/prisma.js";
import { ApiError } from "../utils/ApiError.js";

const PUBLISHED = "PUBLISHED";
const EDITABLE = ["DRAFT", "IN_PROGRESS", "CHANGES_REQUESTED"];
const contributionFields = ["title", "description", "processNotes", "resultUrl", "repositoryUrl", "reflection", "revision"];
const missionOrder = [{ sortOrder: "asc" }, { id: "asc" }];
const participationOrder = [{ updatedAt: "desc" }, { id: "asc" }];
const capabilityInclude = { capabilities: { include: { capability: true }, orderBy: { capabilityId: "asc" } } };
const adminOrder = [{ updatedAt: "desc" }, { id: "asc" }];
const FEEDBACK_MAX = 5000;

export function visualState(percent) {
  if (percent >= 100) return "transformed";
  if (percent >= 75) return "active";
  if (percent >= 50) return "equipped";
  if (percent >= 25) return "powered";
  return "abandoned";
}

export function missionAvailability(mission, now = new Date()) {
  const visible = mission.active === true && mission.publicationStatus === PUBLISHED && (!mission.startsAt || mission.startsAt <= now);
  const joinable = visible && (!mission.endsAt || mission.endsAt >= now) && mission.zone?.active !== false;
  return { visible, joinable };
}

export function validateAllowedPayload(body, allowed) {
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => !allowed.includes(key))) {
    throw new ApiError(400, "Payload no permitido");
  }
}

export function validateHttpUrl(value, field) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.length > 500) throw new ApiError(400, `${field} no es valida`);
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    return url.toString();
  } catch {
    throw new ApiError(400, `${field} debe usar http o https`);
  }
}

export function isContributionEditable(status) { return EDITABLE.includes(status); }

function text(value, field, { required = false, max }) {
  if (value == null) {
    if (required) throw new ApiError(400, `${field} es obligatorio`);
    return null;
  }
  if (typeof value !== "string") throw new ApiError(400, `${field} debe ser texto`);
  const result = value.trim();
  if (required && !result) throw new ApiError(400, `${field} es obligatorio`);
  if (result.length > max) throw new ApiError(400, `${field} excede el limite permitido`);
  return result || null;
}

function contributionData(body) {
  const data = {};
  if (Object.hasOwn(body, "title")) data.title = text(body.title, "title", { required: false, max: 191 }) || "";
  if (Object.hasOwn(body, "description")) data.description = text(body.description, "description", { required: false, max: 10000 }) || "";
  if (Object.hasOwn(body, "processNotes")) data.processNotes = text(body.processNotes, "processNotes", { max: 10000 });
  if (Object.hasOwn(body, "resultUrl")) data.resultUrl = validateHttpUrl(body.resultUrl, "resultUrl");
  if (Object.hasOwn(body, "repositoryUrl")) data.repositoryUrl = validateHttpUrl(body.repositoryUrl, "repositoryUrl");
  if (Object.hasOwn(body, "reflection")) data.reflection = text(body.reflection, "reflection", { max: 10000 });
  return data;
}

function revision(body, allowed) {
  validateAllowedPayload(body, allowed);
  if (!Number.isInteger(body.revision) || body.revision < 0) throw new ApiError(400, "revision es obligatoria");
  return body.revision;
}

function feedback(body, required) {
  return text(body.feedback, "feedback", { required, max: FEEDBACK_MAX });
}

const adminInclude = {
  participation: { include: { user: { select: { id: true, name: true, email: true } }, mission: { include: { zone: true, ...capabilityInclude } } } },
  auditEvents: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
};

async function reviewTransition(actor, id, body, { from, to, feedbackRequired = false, completeStatus }) {
  const expectedRevision = revision(body, feedbackRequired ? ["revision", "feedback"] : ["revision"]);
  const reason = feedbackRequired ? feedback(body, true) : null;
  return prisma.$transaction(async (transaction) => {
    const current = await transaction.impactContribution.findUnique({ where: { id }, select: { status: true, participationId: true } });
    if (!current) throw new ApiError(404, "Contribution no encontrada");
    const now = new Date();
    const result = await transaction.impactContribution.updateMany({
      where: { id, status: from, revision: expectedRevision },
      data: { status: to, reviewerId: actor.id, reviewerEmailSnapshot: actor.email || null, reviewerFeedback: reason, reviewedAt: now, revision: { increment: 1 } },
    });
    if (result.count !== 1) throw new ApiError(409, "La contribution cambio; actualiza la pantalla");
    if (completeStatus) await transaction.impactParticipation.update({ where: { id: current.participationId }, data: { status: completeStatus, completedAt: now, revision: { increment: 1 } } });
    await transaction.impactContributionEvent.create({ data: { contributionId: id, actorUserId: actor.id, actorEmailSnapshot: actor.email || null, fromStatus: from, toStatus: to, reason } });
    return transaction.impactContribution.findUnique({ where: { id }, include: adminInclude });
  });
}

function publicMission(item, detailed = false, now = new Date()) {
  const base = {
    id: item.id, slug: item.slug, title: item.title, summary: item.summary,
    difficulty: item.difficulty, estimatedMinutes: item.estimatedMinutes, points: item.points,
    evidenceType: item.evidenceType, participationMode: item.participationMode,
    zone: item.zone ? { id: item.zone.id, slug: item.zone.slug, name: item.zone.name } : undefined,
    availability: { joinable: missionAvailability(item, now).joinable },
  };
  if (!detailed) return base;
  return { ...base, problemDescription: item.problemDescription, objective: item.objective, instructions: item.instructions,
    deliverables: item.deliverables, validationCriteria: item.validationCriteria, safetyNotes: item.safetyNotes,
    capabilities: (item.capabilities || []).map((link) => ({ id: link.capability.id, slug: link.capability.slug, name: link.capability.name, weight: link.weight })) };
}

async function progressByZone() {
  const rows = await prisma.impactZoneEvent.groupBy({ by: ["zoneId"], _sum: { points: true } });
  return new Map(rows.map((row) => [row.zoneId, row._sum.points || 0]));
}

function publicZone(zone, points) {
  const percent = Math.max(0, Math.min(100, Math.round((points / zone.targetPoints) * 100)));
  return { id: zone.id, slug: zone.slug, name: zone.name, description: zone.description, targetPoints: zone.targetPoints,
    progressPoints: points, progressPercent: percent, visualState: visualState(percent), active: zone.active };
}

export async function listZones() {
  const [zones, progress] = await Promise.all([prisma.impactZone.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }), progressByZone()]);
  return zones.map((zone) => publicZone(zone, progress.get(zone.id) || 0));
}

export async function getZone(slug) {
  const now = new Date();
  const zone = await prisma.impactZone.findFirst({ where: { slug, active: true }, include: { missions: { where: { active: true, publicationStatus: PUBLISHED, OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, include: { zone: true }, orderBy: missionOrder } } });
  if (!zone) throw new ApiError(404, "Zona no encontrada");
  const sum = await prisma.impactZoneEvent.aggregate({ where: { zoneId: zone.id }, _sum: { points: true } });
  return { ...publicZone(zone, sum._sum.points || 0), missions: zone.missions.map((mission) => publicMission(mission, false, now)) };
}

export async function listMissions(query = {}) {
  validateAllowedPayload(query, ["zone"]);
  const now = new Date();
  const where = { active: true, publicationStatus: PUBLISHED, OR: [{ startsAt: null }, { startsAt: { lte: now } }], zone: { active: true } };
  if (query.zone) where.zone.slug = String(query.zone);
  const items = await prisma.impactMission.findMany({ where, include: { zone: true }, orderBy: missionOrder });
  return items.map((item) => publicMission(item, false, now));
}

export async function getMission(slug) {
  const now = new Date();
  const item = await prisma.impactMission.findFirst({ where: { slug, active: true, publicationStatus: PUBLISHED, OR: [{ startsAt: null }, { startsAt: { lte: now } }], zone: { active: true } }, include: { zone: true, ...capabilityInclude } });
  if (!item) throw new ApiError(404, "Mision no encontrada");
  return publicMission(item, true, now);
}

export async function joinMission(userId, missionId, body = {}) {
  validateAllowedPayload(body, []);
  const mission = await prisma.impactMission.findFirst({ where: { id: missionId }, include: { zone: true } });
  if (!mission) throw new ApiError(404, "Mision no encontrada");
  if (!missionAvailability(mission).joinable) throw new ApiError(409, "La mision no acepta participaciones");
  try {
    return await prisma.impactParticipation.create({ data: { userId, missionId }, include: { mission: { include: { zone: true } }, contribution: true } });
  } catch (error) {
    if (error?.code === "P2002") throw new ApiError(409, "Ya participas en esta mision");
    throw error;
  }
}

export async function listMyParticipations(userId) {
  return prisma.impactParticipation.findMany({ where: { userId }, include: { mission: { include: { zone: true } }, contribution: true }, orderBy: participationOrder });
}

export async function getMyParticipation(userId, id) {
  const item = await prisma.impactParticipation.findFirst({ where: { id, userId }, include: { contribution: true, mission: { include: { zone: true, ...capabilityInclude } } } });
  if (!item) throw new ApiError(404, "Participacion no encontrada");
  return item;
}

export async function saveContribution(userId, participationId, body = {}) {
  validateAllowedPayload(body, contributionFields);
  const participation = await prisma.impactParticipation.findFirst({ where: { id: participationId, userId }, include: { contribution: true } });
  if (!participation) throw new ApiError(404, "Participacion no encontrada");
  const data = contributionData(body);
  if (!participation.contribution) {
    if (body.revision != null && body.revision !== 0) throw new ApiError(400, "Revision invalida para crear contribution");
    try {
      return await prisma.impactContribution.create({ data: { participationId, title: data.title || "", description: data.description || "", processNotes: data.processNotes, resultUrl: data.resultUrl, repositoryUrl: data.repositoryUrl, reflection: data.reflection } });
    } catch (error) {
      if (error?.code === "P2002") throw new ApiError(409, "La contribution ya fue creada");
      throw error;
    }
  }
  if (!Number.isInteger(body.revision) || body.revision < 0) throw new ApiError(400, "revision es obligatoria");
  if (!isContributionEditable(participation.contribution.status)) throw new ApiError(409, "La contribution ya no es editable");
  const result = await prisma.impactContribution.updateMany({ where: { id: participation.contribution.id, revision: body.revision, status: { in: EDITABLE } }, data: { ...data, revision: { increment: 1 } } });
  if (result.count !== 1) throw new ApiError(409, "La contribution cambio; actualiza la pantalla");
  return prisma.impactContribution.findUnique({ where: { id: participation.contribution.id } });
}

export async function submitContribution(userId, actorEmail, id, body = {}) {
  validateAllowedPayload(body, ["revision"]);
  if (!Number.isInteger(body.revision) || body.revision < 0) throw new ApiError(400, "revision es obligatoria");
  return prisma.$transaction(async (transaction) => {
    const item = await transaction.impactContribution.findFirst({ where: { id, participation: { userId } } });
    if (!item) throw new ApiError(404, "Contribution no encontrada");
    if (!isContributionEditable(item.status)) throw new ApiError(409, "La contribution no puede enviarse");
    if (!item.title.trim()) throw new ApiError(400, "title es obligatorio para enviar");
    if (![item.description, item.resultUrl, item.repositoryUrl, item.processNotes].some((value) => String(value || "").trim())) throw new ApiError(400, "Agrega evidencia descriptiva antes de enviar");
    const result = await transaction.impactContribution.updateMany({ where: { id, revision: body.revision, status: { in: EDITABLE }, participation: { userId } }, data: { status: "SUBMITTED", submittedAt: new Date(), revision: { increment: 1 } } });
    if (result.count !== 1) throw new ApiError(409, "La contribution cambio; actualiza la pantalla");
    await transaction.impactContributionEvent.create({ data: { contributionId: id, actorUserId: userId, actorEmailSnapshot: actorEmail || null, fromStatus: item.status, toStatus: "SUBMITTED" } });
    return transaction.impactContribution.findUnique({ where: { id } });
  });
}

export async function listAdminContributions(query = {}) {
  validateAllowedPayload(query, ["status", "missionId"]);
  const where = {};
  if (query.status) where.status = String(query.status);
  if (query.missionId) where.participation = { missionId: String(query.missionId) };
  return prisma.impactContribution.findMany({ where, include: { participation: { include: { user: { select: { id: true, name: true, email: true } }, mission: { include: { zone: true } } } } }, orderBy: adminOrder });
}

export async function getAdminContribution(id) {
  const item = await prisma.impactContribution.findUnique({ where: { id }, include: adminInclude });
  if (!item) throw new ApiError(404, "Contribution no encontrada");
  return item;
}

export async function startContributionReview(actor, id, body = {}) {
  return reviewTransition(actor, id, body, { from: "SUBMITTED", to: "IN_REVIEW" });
}

export async function requestContributionChanges(actor, id, body = {}) {
  return reviewTransition(actor, id, body, { from: "IN_REVIEW", to: "CHANGES_REQUESTED", feedbackRequired: true });
}

export async function rejectContribution(actor, id, body = {}) {
  return reviewTransition(actor, id, body, { from: "IN_REVIEW", to: "REJECTED", feedbackRequired: true, completeStatus: "ABANDONED" });
}

export async function approveContribution(actor, id, body = {}) {
  const expectedRevision = revision(body, ["revision", "feedback"]);
  const reason = feedback(body, false);
  return prisma.$transaction(async (transaction) => {
    const current = await transaction.impactContribution.findUnique({
      where: { id },
      include: { participation: { include: { mission: true } } },
    });
    if (!current) throw new ApiError(404, "Contribution no encontrada");
    const now = new Date();
    const result = await transaction.impactContribution.updateMany({
      where: { id, status: "IN_REVIEW", revision: expectedRevision },
      data: { status: "APPROVED", reviewerId: actor.id, reviewerEmailSnapshot: actor.email || null, reviewerFeedback: reason, reviewedAt: now, approvedAt: now, revision: { increment: 1 } },
    });
    if (result.count !== 1) throw new ApiError(409, "La contribution cambio; actualiza la pantalla");
    await transaction.impactContributionEvent.create({ data: { contributionId: id, actorUserId: actor.id, actorEmailSnapshot: actor.email || null, fromStatus: "IN_REVIEW", toStatus: "APPROVED", reason } });
    await transaction.impactZoneEvent.create({ data: { zoneId: current.participation.mission.zoneId, contributionId: id, eventType: "CONTRIBUTION_APPROVED", points: current.participation.mission.points, description: `Contribution aprobada para ${current.participation.mission.title}` } });
    await transaction.impactParticipation.update({ where: { id: current.participationId }, data: { status: "COMPLETED", completedAt: now, revision: { increment: 1 } } });
    return transaction.impactContribution.findUnique({ where: { id }, include: adminInclude });
  });
}
