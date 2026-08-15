import { getMyCareerOptions } from "../services/impactCareerOptionService.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const myCareerOptions = asyncHandler(async (request, response) => {
  if (Object.keys(request.query).length) throw new ApiError(400, "Career options no acepta parametros de usuario");
  response.json({ success: true, data: await getMyCareerOptions(request.user.sub) });
});
