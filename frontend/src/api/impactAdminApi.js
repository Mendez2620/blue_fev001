import http from "./http";

const contributionPath = (id) => `/admin/impact/contributions/${encodeURIComponent(id)}`;

export async function getAdminContributions(params) { return (await http.get("/admin/impact/contributions", { params })).data.data; }
export async function getAdminContribution(id) { return (await http.get(contributionPath(id))).data.data; }
export async function startReview(id, revision) { return (await http.post(`${contributionPath(id)}/start-review`, { revision })).data.data; }
export async function requestChanges(id, revision, feedback) { return (await http.post(`${contributionPath(id)}/request-changes`, { revision, feedback })).data.data; }
export async function rejectContribution(id, revision, feedback) { return (await http.post(`${contributionPath(id)}/reject`, { revision, feedback })).data.data; }
export async function approveContribution(id, revision, feedback) { return (await http.post(`${contributionPath(id)}/approve`, { revision, feedback })).data.data; }
