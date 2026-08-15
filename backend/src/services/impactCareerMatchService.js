import prisma from "../config/prisma.js";
import { getCanonicalProgram } from "./educativeProgramRelationsService.js";
import { getMyFootprint } from "./impactFootprintService.js";

const compareMatches = (left, right) =>
  right.matchedCapabilityCount - left.matchedCapabilityCount ||
  right.mappingWeight - left.mappingWeight ||
  right.approvedEvidenceCount - left.approvedEvidenceCount ||
  left.programName.localeCompare(right.programName, "es") ||
  left.canonicalProgramKey.localeCompare(right.canonicalProgramKey);

export async function getMyCareerMatches(userId) {
  const footprint = await getMyFootprint(userId);
  const capabilities = new Map(footprint.capabilities.map((capability) => [capability.id, capability]));
  if (!capabilities.size) {
    return { summary: { approvedProjects: footprint.summary.approvedProjects, demonstratedCapabilities: 0, matchedPrograms: 0 }, careerMatches: [] };
  }

  const mappings = await prisma.impactCareerCapability.findMany({
    where: { capabilityId: { in: [...capabilities.keys()] } },
    orderBy: [{ canonicalProgramKey: "asc" }, { capabilityId: "asc" }],
  });
  const programs = new Map();
  for (const mapping of mappings) {
    const capability = capabilities.get(mapping.capabilityId);
    const canonical = getCanonicalProgram(mapping.canonicalProgramKey);
    if (!capability || !canonical) continue;
    if (!programs.has(mapping.canonicalProgramKey)) {
      programs.set(mapping.canonicalProgramKey, {
        canonicalProgramKey: mapping.canonicalProgramKey,
        programName: canonical.displayName,
        academicLevel: canonical.level,
        matchedCapabilities: [],
        matchedCapabilityCount: 0,
        approvedEvidenceCount: 0,
        mappingWeight: 0,
      });
    }
    const match = programs.get(mapping.canonicalProgramKey);
    match.matchedCapabilities.push({ id: capability.id, slug: capability.slug, name: capability.name, evidenceCount: capability.evidenceCount, mappingWeight: mapping.weight });
    match.matchedCapabilityCount += 1;
    match.approvedEvidenceCount += capability.evidenceCount;
    match.mappingWeight += mapping.weight;
  }
  const careerMatches = [...programs.values()].map((match) => ({
    ...match,
    matchedCapabilities: match.matchedCapabilities.sort((left, right) => left.name.localeCompare(right.name, "es") || left.slug.localeCompare(right.slug)),
  })).sort(compareMatches);
  return {
    summary: { approvedProjects: footprint.summary.approvedProjects, demonstratedCapabilities: footprint.summary.demonstratedCapabilities, matchedPrograms: careerMatches.length },
    careerMatches,
  };
}
