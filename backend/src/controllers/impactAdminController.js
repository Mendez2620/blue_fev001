import { asyncHandler } from "../utils/asyncHandler.js";
import * as service from "../services/impactService.js";

const ok = (response, data) => response.json({ success: true, data });
const actor = (request) => ({ id: request.user.sub, email: request.user.email });

export const contributions = asyncHandler(async (request, response) => ok(response, await service.listAdminContributions(request.query)));
export const contribution = asyncHandler(async (request, response) => ok(response, await service.getAdminContribution(request.params.id)));
export const startReview = asyncHandler(async (request, response) => ok(response, await service.startContributionReview(actor(request), request.params.id, request.body)));
export const requestChanges = asyncHandler(async (request, response) => ok(response, await service.requestContributionChanges(actor(request), request.params.id, request.body)));
export const reject = asyncHandler(async (request, response) => ok(response, await service.rejectContribution(actor(request), request.params.id, request.body)));
export const approve = asyncHandler(async (request, response) => ok(response, await service.approveContribution(actor(request), request.params.id, request.body)));
