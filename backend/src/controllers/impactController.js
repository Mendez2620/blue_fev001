import { asyncHandler } from "../utils/asyncHandler.js";
import * as service from "../services/impactService.js";

const ok = (response, data, status = 200) => response.status(status).json({ success: true, data });

export const zones = asyncHandler(async (_request, response) => ok(response, await service.listZones()));
export const zone = asyncHandler(async (request, response) => ok(response, await service.getZone(request.params.slug)));
export const missions = asyncHandler(async (request, response) => ok(response, await service.listMissions(request.query)));
export const mission = asyncHandler(async (request, response) => ok(response, await service.getMission(request.params.slug)));
export const joinMission = asyncHandler(async (request, response) => ok(response, await service.joinMission(request.user.sub, request.params.id, request.body), 201));
export const myParticipations = asyncHandler(async (request, response) => ok(response, await service.listMyParticipations(request.user.sub)));
export const myParticipation = asyncHandler(async (request, response) => ok(response, await service.getMyParticipation(request.user.sub, request.params.id)));
export const putContribution = asyncHandler(async (request, response) => ok(response, await service.saveContribution(request.user.sub, request.params.id, request.body)));
export const submitContribution = asyncHandler(async (request, response) => ok(response, await service.submitContribution(request.user.sub, request.user.email, request.params.id, request.body)));
