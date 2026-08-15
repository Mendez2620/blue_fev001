import { getMyCareerMatches } from "../services/impactCareerMatchService.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const myCareerMatches = asyncHandler(async (request, response) => {
  if (Object.keys(request.query).length) throw new ApiError(400, "Career matches no acepta parametros de usuario");
  response.json({ success: true, data: await getMyCareerMatches(request.user.sub) });
});
