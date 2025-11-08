import { Router } from "express";
import { completeChallenge, getChallenges, joinChallenge } from "../controllers/challengeController";
import { verifyToken } from "../middlewares/verifyToken";

const router = Router();

router.get("/", getChallenges);
router.post("/join", verifyToken, joinChallenge);
router.post("/complete", verifyToken, completeChallenge);

export default router;
