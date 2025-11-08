import { Router } from "express";
import authRoutes from "./authRoutes";
import subjectRoutes from "./subjectRoutes";
import topicRoutes from "./topicRoutes";
import flashcardRoutes from "./flashcardRoutes";
import quizRoutes from "./quizRoutes";
import progressRoutes from "./progressRoutes";
import leaderboardRoutes from "./leaderboardRoutes";
import challengeRoutes from "./challengeRoutes";
import xpHistoryRoutes from "./xpHistoryRoutes";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ success: true, message: "Nunyalearn API healthy" });
});

router.use("/auth", authRoutes);
router.use("/subjects", subjectRoutes);
router.use("/topics", topicRoutes);
router.use("/flashcards", flashcardRoutes);
router.use("/quizzes", quizRoutes);
router.use("/progress", progressRoutes);
router.use("/leaderboard", leaderboardRoutes);
router.use("/challenges", challengeRoutes);
router.use("/xp-history", xpHistoryRoutes);

export default router;
