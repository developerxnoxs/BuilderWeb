import type { Express, Request, Response } from "express";
import { z } from "zod";
import { submitBuild, getBuildStatus, getBuildLogs, cancelBuild, builds } from "./build-processor";
import { authMiddleware } from "./auth";
import path from "path";
import fs from "fs";

const buildRequestSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  framework: z.enum(["react-native", "flutter", "capacitor"]),
  files: z.array(z.object({
    path: z.string(),
    content: z.string(),
  })),
  buildConfig: z.record(z.any()).optional(),
});

export function registerBuildRoutes(app: Express) {
  app.post("/api/builds", authMiddleware, async (req: Request, res: Response) => {
    try {
      const data = buildRequestSchema.parse(req.body);
      const buildId = await submitBuild(data);
      
      res.status(201).json({ buildId });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request", details: error.errors });
      }
      
      console.error("Build submission error:", error);
      res.status(500).json({ 
        error: "Failed to submit build",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/builds/:buildId", authMiddleware, async (req: Request, res: Response) => {
    try {
      const status = await getBuildStatus(req.params.buildId);
      
      if (!status) {
        return res.status(404).json({ error: "Build not found" });
      }
      
      res.json(status);
    } catch (error) {
      console.error("Get build status error:", error);
      res.status(500).json({ error: "Failed to get build status" });
    }
  });

  app.get("/api/builds/:buildId/logs", authMiddleware, async (req: Request, res: Response) => {
    try {
      const logs = await getBuildLogs(req.params.buildId);
      
      if (!logs) {
        return res.status(404).json({ error: "Build not found" });
      }
      
      res.json({ logs });
    } catch (error) {
      console.error("Get build logs error:", error);
      res.status(500).json({ error: "Failed to get build logs" });
    }
  });

  app.post("/api/builds/:buildId/cancel", authMiddleware, async (req: Request, res: Response) => {
    try {
      const success = await cancelBuild(req.params.buildId);
      
      if (!success) {
        return res.status(404).json({ error: "Build not found or already completed" });
      }
      
      res.json({ success: true, message: "Build cancelled" });
    } catch (error) {
      console.error("Cancel build error:", error);
      res.status(500).json({ error: "Failed to cancel build" });
    }
  });

  app.get("/api/builds/:buildId/download", authMiddleware, async (req: Request, res: Response) => {
    try {
      const build = builds.get(req.params.buildId);
      
      if (!build) {
        return res.status(404).json({ error: "Build not found" });
      }
      
      if (build.status !== "success" || !build.apkPath) {
        return res.status(400).json({ error: "APK not available" });
      }
      
      const apkPath = path.join(process.cwd(), build.apkPath);
      
      if (!fs.existsSync(apkPath)) {
        return res.status(404).json({ error: "APK file not found" });
      }
      
      res.download(apkPath, `${build.projectName}.apk`);
    } catch (error) {
      console.error("Download APK error:", error);
      res.status(500).json({ error: "Failed to download APK" });
    }
  });

  app.get("/api/builds", authMiddleware, async (req: Request, res: Response) => {
    try {
      const allBuilds = Array.from(builds.values())
        .sort((a: Build, b: Build) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 100);
      
      res.json(allBuilds);
    } catch (error) {
      console.error("List builds error:", error);
      res.status(500).json({ error: "Failed to list builds" });
    }
  });
}
