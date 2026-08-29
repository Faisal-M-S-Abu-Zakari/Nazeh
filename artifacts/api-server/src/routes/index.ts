import { Router, type IRouter } from "express";
import healthRouter from "./health";
import apiRouter from "./api";
import authRouter from "./auth";
import operationsRouter from "./operations";

const router: IRouter = Router();

router.use(healthRouter);
router.use((req, res, next) => {
  const isPersistenceLogin = req.path === "/auth/login" && Boolean(req.body?.role);
  const isPersistenceLogout =
    req.path === "/auth/logout" && Boolean(req.cookies?.aqsa_session) && !req.get("authorization");
  if (isPersistenceLogin || isPersistenceLogout) {
    next();
    return;
  }
  authRouter(req, res, next);
});
router.use("/sync", (req, res, next) => {
  if (!req.get("authorization")?.startsWith("Bearer ")) {
    next();
    return;
  }
  operationsRouter(req, res, next);
});
router.use(apiRouter);
export default router;
