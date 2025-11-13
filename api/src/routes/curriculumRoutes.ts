import { Router } from "express";
import { getCurriculumTree, listGrades, listSubjects, listTopics } from "../controllers/curriculumController";

const router = Router();

router.get("/grades", listGrades);
router.get("/subjects", listSubjects);
router.get("/topics", listTopics);
router.get("/tree", getCurriculumTree);

export default router;
