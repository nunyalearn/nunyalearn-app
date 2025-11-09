import { Router } from "express";
import { Role } from "@prisma/client";
import { createTopic, getTopics } from "../controllers/topicController";
import { verifyToken } from "../middlewares/verifyToken";
import { verifyRole } from "../middlewares/verifyRole";

const router = Router();

router.get("/", getTopics);
router.post("/", verifyToken, verifyRole(Role.ADMIN), createTopic);

export default router;
