import { Router, type IRouter } from "express";
import healthRouter from "./health";
import apiRouter from "./api";
import authRouter from "./auth";
import operationsRouter from "./operations";

const router: IRouter = Router();

router.use(healthRouter);
router.use((req, res, next) => {
  // There are two intentionally isolated identity stores:
  // - modern staff auth: no `role` field, handled by authRouter, bearer token
  // - legacy camp records: requires `role`, handled by apiRouter, cookie/bearer
  // Never infer one identity from the other or let a token cross these stores.
  const isPersistenceLogin =
    req.path === "/auth/login" &&
    Object.prototype.hasOwnProperty.call(req.body ?? {}, "role");
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
