import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import { profilesRouter } from "./profiles";
import { matchesRouter } from "./matches";
import { messagesRouter } from "./messages";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(profilesRouter);
router.use(matchesRouter);
router.use(messagesRouter);

export default router;
