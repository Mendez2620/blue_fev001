import { getMyFootprint } from "../services/impactFootprintService.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const myFootprint = asyncHandler(async (request, response) => {
  if (Object.keys(request.query).length) throw new ApiError(400, "La Huella no acepta parametros de usuario");
  response.json({ success: true, data: await getMyFootprint(request.user.sub) });
});
