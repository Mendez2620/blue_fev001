import http from "./http";

export async function getImpactZones() { return (await http.get("/impact/zones")).data.data; }
export async function getImpactZone(slug) { return (await http.get(`/impact/zones/${encodeURIComponent(slug)}`)).data.data; }
export async function getImpactMissions(params) { return (await http.get("/impact/missions", { params })).data.data; }
export async function getImpactMission(slug) { return (await http.get(`/impact/missions/${encodeURIComponent(slug)}`)).data.data; }
