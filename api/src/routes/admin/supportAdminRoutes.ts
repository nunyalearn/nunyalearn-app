import { Router } from "express";
import { Role } from "@prisma/client";
import {
  createSupportTicket,
  deleteSupportTicket,
  getSupportTicket,
  listSupportTickets,
  respondToTicket,
  updateSupportTicket,
} from "../../controllers/admin/adminSupportController";
import { verifyToken } from "../../middlewares/verifyToken";
import { verifyRole } from "../../middlewares/verifyRole";

const router = Router();

router.use(verifyToken, verifyRole(Role.ADMIN));

router.get("/", listSupportTickets);
router.post("/", createSupportTicket);
router.get("/:id", getSupportTicket);
router.put("/:id", updateSupportTicket);
router.post("/:id/respond", respondToTicket);
router.delete("/:id", deleteSupportTicket);

export default router;
