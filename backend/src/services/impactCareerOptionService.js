import prisma from "../config/prisma.js";
import { resolveCanonicalProgramOfferingsBatch } from "./educativeSearchService.js";
import { getMyCareerMatches } from "./impactCareerMatchService.js";

export async function getMyCareerOptions(userId) {
  const matches = await getMyCareerMatches(userId);
  const { offeringsByCanonicalProgramKey } = await resolveCanonicalProgramOfferingsBatch({
    prisma,
    canonicalProgramKeys: matches.careerMatches.map((match) => match.canonicalProgramKey),
  });
  const careerOptions = matches.careerMatches
    .map((match) => ({ ...match, offerings: offeringsByCanonicalProgramKey[match.canonicalProgramKey] || [] }))
    .filter((match) => match.offerings.length > 0);
  const institutionIdentities = new Set(careerOptions.flatMap((option) => option.offerings.map((offering) =>
    `${offering.institutionName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim()}|${offering.municipality.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim()}`,
  )));
  return {
    summary: {
      ...matches.summary,
      availablePrograms: careerOptions.length,
      institutions: institutionIdentities.size,
    },
    careerOptions,
  };
}
