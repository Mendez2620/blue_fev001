import prisma from "../config/prisma.js";

const evidenceOrder = (left, right) => {
  const byDate = new Date(right.approvedAt).getTime() - new Date(left.approvedAt).getTime();
  return byDate || left.contributionId.localeCompare(right.contributionId);
};

export async function getMyFootprint(userId) {
  const approved = await prisma.impactContribution.findMany({
    where: { status: "APPROVED", participation: { userId } },
    select: {
      id: true, title: true, approvedAt: true,
      participation: { select: { mission: { select: {
        id: true, slug: true, title: true,
        zone: { select: { id: true, slug: true, name: true } },
        capabilities: { select: { weight: true, capability: { select: { id: true, slug: true, name: true, description: true, category: true } } } },
      } } } },
    },
    orderBy: [{ approvedAt: "desc" }, { id: "asc" }],
  });

  const capabilities = new Map();
  const evidenceKeys = new Set();
  for (const contribution of approved) {
    const mission = contribution.participation.mission;
    for (const relation of mission.capabilities) {
      const capability = relation.capability;
      const evidenceKey = `${capability.id}:${contribution.id}`;
      if (evidenceKeys.has(evidenceKey)) continue;
      evidenceKeys.add(evidenceKey);
      if (!capabilities.has(capability.id)) capabilities.set(capability.id, { ...capability, evidenceCount: 0, evidence: [] });
      const item = capabilities.get(capability.id);
      item.evidence.push({ contributionId: contribution.id, contributionTitle: contribution.title, missionId: mission.id, missionSlug: mission.slug, missionTitle: mission.title, zoneId: mission.zone.id, zoneSlug: mission.zone.slug, zoneName: mission.zone.name, approvedAt: contribution.approvedAt, weight: relation.weight });
      item.evidenceCount += 1;
    }
  }

  const result = [...capabilities.values()]
    .map((capability) => ({ ...capability, evidence: capability.evidence.sort(evidenceOrder) }))
    .sort((left, right) => right.evidenceCount - left.evidenceCount || left.name.localeCompare(right.name) || left.slug.localeCompare(right.slug));
  return { summary: { approvedProjects: approved.length, demonstratedCapabilities: result.length, evidenceItems: evidenceKeys.size }, capabilities: result };
}
