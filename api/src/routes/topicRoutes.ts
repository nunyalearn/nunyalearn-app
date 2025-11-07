import { Router } from "express";
import { createTopic, getTopics } from "../controllers/topicController";
import { verifyToken } from "../middlewares/verifyToken";

const router = Router();

router.get("/", getTopics);
router.post("/", verifyToken, createTopic);

export default router;
