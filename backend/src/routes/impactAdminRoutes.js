import { Router } from "express";
import * as controller from "../controllers/impactAdminController.js";
import { requireAdmin } from "../middlewares/adminMiddleware.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();
router.use(requireAuth, requireAdmin);
router.get("/contributions", controller.contributions);
router.get("/contributions/:id", controller.contribution);
router.post("/contributions/:id/start-review", controller.startReview);
router.post("/contributions/:id/request-changes", controller.requestChanges);
router.post("/contributions/:id/reject", controller.reject);
router.post("/contributions/:id/approve", controller.approve);

export default router;
