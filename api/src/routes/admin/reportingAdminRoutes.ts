import { Router } from "express";
import { Role } from "@prisma/client";
import {
  getAttemptReports,
  getEngagementReports,
  getLeaderboardReports,
  getMetricReports,
  getProgressReports,
} from "../../controllers/admin/reportingController";
import { verifyToken } from "../../middlewares/verifyToken";
import { verifyRole } from "../../middlewares/verifyRole";

const router = Router();

router.use(verifyToken, verifyRole(Role.ADMIN));

router.get("/attempts", getAttemptReports);
router.get("/progress", getProgressReports);
router.get("/engagement", getEngagementReports);
router.get("/leaderboard", getLeaderboardReports);
router.get("/metrics", getMetricReports);

export default router;
