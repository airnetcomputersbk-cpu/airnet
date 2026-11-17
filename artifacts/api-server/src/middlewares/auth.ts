import { Request, Response, NextFunction } from "express";
import { getAdminMasterPassword } from "../lib/admin-auth-service";

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.admin_session || req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const masterPassword = await getAdminMasterPassword();
  
  if (!token || token !== masterPassword) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  
  next();
}
