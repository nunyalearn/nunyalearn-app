import { Router } from "express";
import { Role } from "@prisma/client";
import {
  archiveAdminTopic,
  createAdminTopic,
  getAdminTopic,
  listAdminTopics,
  restoreAdminTopic,
  updateAdminTopic,
} from "../../controllers/admin/adminTopicController";
import { verifyToken } from "../../middlewares/verifyToken";
import { verifyRole } from "../../middlewares/verifyRole";

const router = Router();

router.use(verifyToken, verifyRole(Role.ADMIN));

router.get("/", listAdminTopics);
router.post("/", createAdminTopic);
router.get("/:id", getAdminTopic);
router.put("/:id", updateAdminTopic);
router.post("/:id/archive", archiveAdminTopic);
router.post("/:id/restore", restoreAdminTopic);

export default router;
