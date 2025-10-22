import type { Request, Response, NextFunction } from "express";

const API_KEY = process.env.DEBIAN_API_KEY || "dev-key-change-in-production";

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: "Missing authorization header" });
  }
  
  const token = authHeader.replace("Bearer ", "");
  
  if (token !== API_KEY) {
    return res.status(403).json({ error: "Invalid API key" });
  }
  
  next();
}
