import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { 
  insertProjectSchema,
  insertFileSchema,
  insertBuildJobSchema,
  type BuildLogEntry
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // WebSocket server for real-time build logs
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  const buildConnections = new Map<string, Set<WebSocket>>();

  wss.on('connection', (ws: WebSocket, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const buildId = url.searchParams.get('buildId');

    if (buildId) {
      if (!buildConnections.has(buildId)) {
        buildConnections.set(buildId, new Set());
      }
      buildConnections.get(buildId)!.add(ws);

      ws.on('close', () => {
        const connections = buildConnections.get(buildId);
        if (connections) {
          connections.delete(ws);
          if (connections.size === 0) {
            buildConnections.delete(buildId);
          }
        }
      });
    }
  });

  // Helper to broadcast build updates
  const broadcastBuildUpdate = (buildId: string, projectId: string, build: any) => {
    const connections = buildConnections.get(buildId);
    if (connections) {
      const message = JSON.stringify({
        type: 'build_update',
        projectId,
        buildId,
        build,
      });
      connections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    }
  };

  // Projects
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getAllProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const data = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(data);
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create project" });
    }
  });

  app.post("/api/projects/from-template", async (req, res) => {
    try {
      const { name, templateId } = req.body;
      const template = await storage.getTemplate(templateId);
      
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      const project = await storage.createProject({
        name,
        description: template.description,
        framework: template.framework,
        status: "active",
      });

      const templateFiles = (template.files as any[]) || [];
      for (const file of templateFiles) {
        await storage.createFile({
          projectId: project.id,
          path: file.path,
          content: file.content,
          type: file.type,
          language: file.language,
        });
      }

      res.status(201).json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to create project from template" });
    }
  });

  app.put("/api/projects/:id", async (req, res) => {
    try {
      const data = insertProjectSchema.partial().parse(req.body);
      const project = await storage.updateProject(req.params.id, data);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteProject(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // Files
  app.get("/api/projects/:id/files", async (req, res) => {
    try {
      const fileTree = await storage.getFileTree(req.params.id);
      res.json(fileTree);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch file tree" });
    }
  });

  app.get("/api/projects/:id/files/:path(*)", async (req, res) => {
    try {
      const file = await storage.getFile(req.params.id, req.params.path);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      res.json(file);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch file" });
    }
  });

  app.post("/api/projects/:id/files", async (req, res) => {
    try {
      const data = insertFileSchema.parse({
        ...req.body,
        projectId: req.params.id,
      });
      const file = await storage.createFile(data);
      res.status(201).json(file);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create file" });
    }
  });

  app.put("/api/projects/:id/files", async (req, res) => {
    try {
      const { path, content } = req.body;
      const file = await storage.updateFile(req.params.id, path, content);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      res.json(file);
    } catch (error) {
      res.status(500).json({ error: "Failed to update file" });
    }
  });

  app.delete("/api/projects/:id/files/:path(*)", async (req, res) => {
    try {
      const deleted = await storage.deleteFile(req.params.id, req.params.path);
      if (!deleted) {
        return res.status(404).json({ error: "File not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // Build Jobs
  app.get("/api/builds", async (req, res) => {
    try {
      const builds = await storage.getAllBuilds();
      res.json(builds);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch builds" });
    }
  });

  app.get("/api/projects/:id/builds", async (req, res) => {
    try {
      const builds = await storage.getProjectBuilds(req.params.id);
      res.json(builds);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project builds" });
    }
  });

  app.get("/api/projects/:id/current-build", async (req, res) => {
    try {
      const build = await storage.getCurrentBuild(req.params.id);
      res.json(build || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch current build" });
    }
  });

  app.post("/api/projects/:id/build", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      await storage.updateProject(req.params.id, { status: "building" });

      const build = await storage.createBuildJob({
        projectId: req.params.id,
        status: "queued",
        logs: [],
        buildConfig: req.body.config || {},
      });

      setTimeout(async () => {
        const buildingUpdate = await storage.updateBuildJob(build.id, { 
          status: "building",
          logs: [
            { timestamp: new Date().toISOString(), level: "info", message: "Build started" },
            { timestamp: new Date().toISOString(), level: "info", message: "Initializing build environment..." }
          ] as any
        });
        if (buildingUpdate) {
          broadcastBuildUpdate(build.id, req.params.id, buildingUpdate);
        }

        setTimeout(async () => {
          const success = Math.random() > 0.3;
          
          if (success) {
            const completedBuild = await storage.updateBuildJob(build.id, {
              status: "success",
              completedAt: new Date(),
              apkUrl: `/downloads/${project.name.replace(/\s+/g, '-')}.apk`,
              logs: [
                { timestamp: new Date().toISOString(), level: "info", message: "Build started" },
                { timestamp: new Date().toISOString(), level: "info", message: "Compiling sources..." },
                { timestamp: new Date().toISOString(), level: "info", message: "Processing resources..." },
                { timestamp: new Date().toISOString(), level: "info", message: "Generating APK..." },
                { timestamp: new Date().toISOString(), level: "success", message: "Build completed successfully!" }
              ] as any
            });
            await storage.updateProject(req.params.id, { status: "active" });
            if (completedBuild) {
              broadcastBuildUpdate(build.id, req.params.id, completedBuild);
            }
          } else {
            const failedBuild = await storage.updateBuildJob(build.id, {
              status: "failed",
              completedAt: new Date(),
              errorMessage: "Build failed: Compilation error in MainActivity.java",
              logs: [
                { timestamp: new Date().toISOString(), level: "info", message: "Build started" },
                { timestamp: new Date().toISOString(), level: "info", message: "Compiling sources..." },
                { timestamp: new Date().toISOString(), level: "error", message: "Error: Cannot find symbol MainActivity" },
                { timestamp: new Date().toISOString(), level: "error", message: "Build failed" }
              ] as any
            });
            await storage.updateProject(req.params.id, { status: "active" });
            if (failedBuild) {
              broadcastBuildUpdate(build.id, req.params.id, failedBuild);
            }
          }
        }, 8000);
      }, 2000);

      res.status(201).json(build);
    } catch (error) {
      res.status(500).json({ error: "Failed to start build" });
    }
  });

  // Templates
  app.get("/api/templates", async (req, res) => {
    try {
      const templates = await storage.getAllTemplates();
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  app.get("/api/templates/:id", async (req, res) => {
    try {
      const template = await storage.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });

  return httpServer;
}
