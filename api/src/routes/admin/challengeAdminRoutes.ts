import { Router } from "express";
import {
  createChallenge,
  deleteChallenge,
  getChallengeParticipants,
  listChallenges,
  updateChallenge,
} from "../../controllers/admin/adminChallengeController";
import { verifyToken } from "../../middlewares/verifyToken";
import { verifyRole } from "../../middlewares/verifyRole";
import { Role } from "@prisma/client";

const router = Router();

router.use(verifyToken, verifyRole(Role.ADMIN));

router.post("/", createChallenge);
router.get("/", listChallenges);
router.get("/:id/participants", getChallengeParticipants);
router.put("/:id", updateChallenge);
router.delete("/:id", deleteChallenge);

export default router;
