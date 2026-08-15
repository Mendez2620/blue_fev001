import http from "./http";

export async function getImpactZones() { return (await http.get("/impact/zones")).data.data; }
export async function getImpactZone(slug) { return (await http.get(`/impact/zones/${encodeURIComponent(slug)}`)).data.data; }
export async function getImpactMissions(params) { return (await http.get("/impact/missions", { params })).data.data; }
export async function getImpactMission(slug) { return (await http.get(`/impact/missions/${encodeURIComponent(slug)}`)).data.data; }
export async function joinMission(id) { return (await http.post(`/impact/missions/${encodeURIComponent(id)}/participations`, {})).data.data; }
export async function getMyParticipations() { return (await http.get("/impact/my-participations")).data.data; }
export async function getMyParticipation(id) { return (await http.get(`/impact/my-participations/${encodeURIComponent(id)}`)).data.data; }
export async function saveContribution(participationId, payload) { return (await http.put(`/impact/participations/${encodeURIComponent(participationId)}/contribution`, payload)).data.data; }
export async function submitContribution(contributionId, revision) { return (await http.post(`/impact/contributions/${encodeURIComponent(contributionId)}/submit`, { revision })).data.data; }
export async function getMyFootprint() { return (await http.get("/impact/my-footprint")).data.data; }
export async function getMyCareerOptions() { return (await http.get("/impact/my-career-options")).data.data; }
