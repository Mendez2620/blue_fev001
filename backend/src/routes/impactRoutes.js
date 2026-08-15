import { Router } from "express";
import * as controller from "../controllers/impactController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { myFootprint } from "../controllers/impactFootprintController.js";

const router = Router();

router.get("/zones", controller.zones);
router.get("/zones/:slug", controller.zone);
router.get("/missions", controller.missions);
router.get("/missions/:slug", controller.mission);

router.use(requireAuth);
router.get("/my-footprint", myFootprint);
router.post("/missions/:id/participations", controller.joinMission);
router.get("/my-participations", controller.myParticipations);
router.get("/my-participations/:id", controller.myParticipation);
router.put("/participations/:id/contribution", controller.putContribution);
router.post("/contributions/:id/submit", controller.submitContribution);

export default router;
