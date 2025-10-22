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
import { debianBuildService, type DebianServerConfig } from "./debian-build-service";
import { buildQueue } from "./build-queue";
import { gitService } from "./git-service";
import { realGitService } from "./real-git-service";
import multer from "multer";
import archiver from "archiver";
import { createWriteStream, createReadStream } from "fs";
import { mkdir, unlink, rm } from "fs/promises";
import { join } from "path";
import unzipper from "unzipper";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Configure multer for file uploads
  const upload = multer({
    dest: 'uploads/',
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max
    },
    fileFilter: (_req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|svg|webp|ttf|otf|woff|woff2|mp3|wav|json|xml/;
      const extname = allowedTypes.test(file.originalname.toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
      
      if (mimetype && extname) {
        return cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only images, fonts, audio, and config files allowed.'));
      }
    }
  });

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

      const serverConfig = debianBuildService.getConfig();
      if (!serverConfig) {
        return res.status(400).json({ 
          error: "Debian server not configured. Please configure in Settings." 
        });
      }

      const build = await storage.createBuildJob({
        projectId: req.params.id,
        status: "queued",
        logs: [
          { timestamp: new Date().toISOString(), level: "info", message: "Build queued" }
        ] as any,
        buildConfig: req.body.config || {},
      });

      buildQueue.add(build.id, req.params.id, req.body.priority || 0);

      const processBuild = async () => {
        try {
          if (!buildQueue.canStartBuild()) {
            const queuePos = buildQueue.getPosition(build.id);
            await storage.updateBuildJob(build.id, {
              logs: [
                { timestamp: new Date().toISOString(), level: "info", message: `Build queued (position: ${queuePos + 1})` }
              ] as any
            });
            const updatedBuild = await storage.getBuildJob(build.id);
            if (updatedBuild) {
              broadcastBuildUpdate(build.id, req.params.id, updatedBuild);
            }
            
            setTimeout(processBuild, 5000);
            return;
          }

          if (!buildQueue.startBuild(build.id)) {
            return;
          }

          await storage.updateProject(req.params.id, { status: "building" });

          const projectFiles = await storage.getProjectFiles(req.params.id);
          const files = projectFiles.map(f => ({
            path: f.path,
            content: f.content
          }));

          const updatedBuild1 = await storage.updateBuildJob(build.id, {
            status: "queued",
            logs: [
              { timestamp: new Date().toISOString(), level: "info", message: "Submitting build to Debian server..." }
            ] as any
          });
          if (updatedBuild1) {
            broadcastBuildUpdate(build.id, req.params.id, updatedBuild1);
          }

          const debianBuildId = await debianBuildService.submitBuild({
            projectId: project.id,
            projectName: project.name,
            framework: project.framework,
            files,
            buildConfig: req.body.config || {}
          });

          const updatedBuild2 = await storage.updateBuildJob(build.id, {
            status: "building",
            logs: [
              { timestamp: new Date().toISOString(), level: "info", message: "Build submitted successfully" },
              { timestamp: new Date().toISOString(), level: "info", message: `Debian Build ID: ${debianBuildId}` },
              { timestamp: new Date().toISOString(), level: "info", message: "Waiting for build to start..." }
            ] as any
          });
          if (updatedBuild2) {
            broadcastBuildUpdate(build.id, req.params.id, updatedBuild2);
          }

          const finalStatus = await debianBuildService.pollBuildStatus(
            debianBuildId,
            async (status) => {
              const updateData: any = {
                status: status.status,
              };
              
              if (status.logs && status.logs.length > 0) {
                updateData.logs = status.logs;
              }
              
              if (status.apkUrl) {
                updateData.apkUrl = status.apkUrl;
              }
              
              if (status.errorMessage) {
                updateData.errorMessage = status.errorMessage;
              }

              const updatedBuild = await storage.updateBuildJob(build.id, updateData);
              
              if (updatedBuild) {
                broadcastBuildUpdate(build.id, req.params.id, updatedBuild);
              }
            }
          );

          const finalUpdateData: any = {
            status: finalStatus.status,
            completedAt: new Date(),
          };
          
          if (finalStatus.logs && finalStatus.logs.length > 0) {
            finalUpdateData.logs = finalStatus.logs;
          }
          
          if (finalStatus.apkUrl) {
            finalUpdateData.apkUrl = finalStatus.apkUrl;
          }
          
          if (finalStatus.errorMessage) {
            finalUpdateData.errorMessage = finalStatus.errorMessage;
          }

          const completedBuild = await storage.updateBuildJob(build.id, finalUpdateData);
          await storage.updateProject(req.params.id, { status: "active" });
          
          if (completedBuild) {
            broadcastBuildUpdate(build.id, req.params.id, completedBuild);
          }

          buildQueue.completeBuild(build.id);

        } catch (error) {
          const failedBuild = await storage.updateBuildJob(build.id, {
            status: "failed",
            completedAt: new Date(),
            errorMessage: error instanceof Error ? error.message : "Build failed",
            logs: [
              { timestamp: new Date().toISOString(), level: "error", message: "Build failed" },
              { timestamp: new Date().toISOString(), level: "error", message: error instanceof Error ? error.message : "Unknown error" }
            ] as any
          });
          await storage.updateProject(req.params.id, { status: "active" });
          
          if (failedBuild) {
            broadcastBuildUpdate(build.id, req.params.id, failedBuild);
          }

          buildQueue.completeBuild(build.id);
        }
      };

      processBuild();

      res.status(201).json(build);
    } catch (error) {
      res.status(500).json({ error: "Failed to start build" });
    }
  });

  // Build Queue Status
  app.get("/api/queue/status", async (req, res) => {
    try {
      res.json(buildQueue.getQueueStatus());
    } catch (error) {
      res.status(500).json({ error: "Failed to get queue status" });
    }
  });

  // Server Configuration
  app.get("/api/server/config", async (req, res) => {
    try {
      const config = debianBuildService.getConfig();
      if (!config) {
        return res.json({ configured: false });
      }
      res.json({ 
        configured: true, 
        url: config.url,
        hasApiKey: !!config.apiKey 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get server config" });
    }
  });

  app.post("/api/server/config", async (req, res) => {
    try {
      const { url, apiKey } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: "Server URL is required" });
      }

      debianBuildService.setConfig({ url, apiKey });
      
      res.json({ 
        success: true, 
        message: "Server configuration updated" 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update server config" });
    }
  });

  app.get("/api/server/health", async (req, res) => {
    try {
      const config = debianBuildService.getConfig();
      if (!config) {
        return res.status(400).json({ 
          healthy: false, 
          error: "Server not configured" 
        });
      }

      const healthy = await debianBuildService.healthCheck();
      res.json({ healthy });
    } catch (error) {
      res.status(500).json({ 
        healthy: false, 
        error: error instanceof Error ? error.message : "Health check failed" 
      });
    }
  });

  // Dashboard Statistics
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const projects = await storage.getAllProjects();
      const builds = await storage.getAllBuilds();
      
      const totalProjects = projects.length;
      const activeBuilds = builds.filter(b => b.status === 'building' || b.status === 'queued').length;
      const successfulBuilds = builds.filter(b => b.status === 'success').length;
      const failedBuilds = builds.filter(b => b.status === 'failed').length;
      const totalBuilds = builds.length;
      
      const frameworkCounts = projects.reduce((acc, p) => {
        acc[p.framework] = (acc[p.framework] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      res.json({
        totalProjects,
        activeBuilds,
        successfulBuilds,
        failedBuilds,
        totalBuilds,
        frameworkCounts,
        successRate: totalBuilds > 0 ? (successfulBuilds / totalBuilds * 100).toFixed(1) : "0",
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard statistics" });
    }
  });

  // Project Duplication
  app.post("/api/projects/:id/duplicate", async (req, res) => {
    try {
      const sourceProject = await storage.getProject(req.params.id);
      if (!sourceProject) {
        return res.status(404).json({ error: "Project not found" });
      }

      const newName = req.body.name || `${sourceProject.name} (Copy)`;
      
      const newProject = await storage.createProject({
        name: newName,
        description: sourceProject.description,
        framework: sourceProject.framework,
        status: "active",
      });

      const sourceFiles = await storage.getProjectFiles(req.params.id);
      for (const file of sourceFiles) {
        await storage.createFile({
          projectId: newProject.id,
          path: file.path,
          content: file.content,
          type: file.type,
          language: file.language,
        });
      }

      res.status(201).json(newProject);
    } catch (error) {
      res.status(500).json({ error: "Failed to duplicate project" });
    }
  });

  // File Rename/Move
  app.put("/api/projects/:id/files/rename", async (req, res) => {
    try {
      const { oldPath, newPath } = req.body;
      
      if (!oldPath || !newPath) {
        return res.status(400).json({ error: "Both oldPath and newPath are required" });
      }

      const file = await storage.renameFile(req.params.id, oldPath, newPath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      
      res.json(file);
    } catch (error) {
      res.status(500).json({ error: "Failed to rename file" });
    }
  });

  // Build Cancellation
  app.post("/api/builds/:id/cancel", async (req, res) => {
    try {
      const build = await storage.getBuildJob(req.params.id);
      if (!build) {
        return res.status(404).json({ error: "Build not found" });
      }

      if (build.status !== 'queued' && build.status !== 'building') {
        return res.status(400).json({ error: "Can only cancel queued or building builds" });
      }

      buildQueue.remove(req.params.id);

      const updatedBuild = await storage.updateBuildJob(req.params.id, {
        status: "failed",
        completedAt: new Date(),
        errorMessage: "Build cancelled by user",
        logs: [
          ...(build.logs as BuildLogEntry[] || []),
          { timestamp: new Date().toISOString(), level: "warn", message: "Build cancelled by user" }
        ] as any
      });

      if (build.projectId) {
        await storage.updateProject(build.projectId, { status: "active" });
        if (updatedBuild) {
          broadcastBuildUpdate(req.params.id, build.projectId, updatedBuild);
        }
      }

      res.json(updatedBuild);
    } catch (error) {
      res.status(500).json({ error: "Failed to cancel build" });
    }
  });

  // Advanced Project Search/Filter
  app.get("/api/projects/search", async (req, res) => {
    try {
      const { query, framework, status } = req.query;
      let projects = await storage.getAllProjects();

      if (query && typeof query === 'string') {
        projects = projects.filter(p => 
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          (p.description && p.description.toLowerCase().includes(query.toLowerCase()))
        );
      }

      if (framework && typeof framework === 'string') {
        projects = projects.filter(p => p.framework === framework);
      }

      if (status && typeof status === 'string') {
        projects = projects.filter(p => p.status === status);
      }

      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: "Failed to search projects" });
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

  // Git Operations
  app.get("/api/projects/:id/git/status", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      try {
        const files = await storage.getProjectFiles(req.params.id);
        await realGitService.syncFiles(req.params.id, files);
        
        const status = await realGitService.getStatus(req.params.id);
        const commits = await realGitService.getCommitHistory(req.params.id);
        
        res.json({
          initialized: commits.length > 0,
          currentBranch: status.branch,
          uncommittedChanges: status.staged.length + status.unstaged.length + status.untracked.length,
          totalCommits: commits.length,
          staged: status.staged,
          unstaged: status.unstaged,
          untracked: status.untracked,
        });
      } catch (error) {
        const commits = await storage.getProjectCommits(req.params.id);
        const files = await storage.getProjectFiles(req.params.id);
        const uncommittedChanges = files.length;
        const status = gitService.generateGitStatus(commits, uncommittedChanges);
        res.json(status);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to get git status" });
    }
  });

  app.get("/api/projects/:id/git/commits", async (req, res) => {
    try {
      const { branch } = req.query;
      
      try {
        const commits = await realGitService.getCommitHistory(
          req.params.id,
          typeof branch === 'string' ? branch : undefined
        );
        
        const formattedCommits = commits.map(c => ({
          id: c.hash,
          commitHash: c.hash,
          message: c.message,
          author: c.author,
          email: c.email,
          branch: typeof branch === 'string' ? branch : 'main',
          filesChanged: c.filesChanged,
          createdAt: c.date,
        }));
        
        res.json(formattedCommits);
      } catch (error) {
        const commits = await storage.getProjectCommits(
          req.params.id,
          typeof branch === 'string' ? branch : undefined
        );
        res.json(commits);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch commits" });
    }
  });

  app.post("/api/projects/:id/git/commit", async (req, res) => {
    try {
      const { message, author, email, branch } = req.body;
      
      const validation = gitService.validateCommitMessage(message);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      if (branch) {
        const branchValidation = gitService.validateBranchName(branch);
        if (!branchValidation.valid) {
          return res.status(400).json({ error: branchValidation.error });
        }
      }

      try {
        const files = await storage.getProjectFiles(req.params.id);
        await realGitService.syncFiles(req.params.id, files);
        
        const commitInfo = await realGitService.commit(
          req.params.id,
          message,
          author || 'Anonymous',
          email
        );

        const commit = await storage.createGitCommit({
          projectId: req.params.id,
          commitHash: commitInfo.hash,
          message: commitInfo.message,
          author: commitInfo.author,
          email: commitInfo.email,
          branch: branch || 'main',
          filesChanged: commitInfo.filesChanged as any,
        });

        res.status(201).json(commit);
      } catch (gitError: any) {
        const files = await storage.getProjectFiles(req.params.id);
        const filesChanged = files.map(f => ({
          path: f.path,
          type: f.type,
        }));

        const commitData = gitService.createCommit({
          projectId: req.params.id,
          message,
          author: author || 'Anonymous',
          email,
          branch,
          filesChanged,
        });

        const commit = await storage.createGitCommit(commitData);
        res.status(201).json(commit);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to create commit" });
    }
  });

  app.get("/api/projects/:id/git/branches", async (req, res) => {
    try {
      try {
        const branches = await realGitService.getBranches(req.params.id);
        res.json(branches.length > 0 ? branches : ['main']);
      } catch (error) {
        const branches = await storage.getProjectBranches(req.params.id);
        res.json(branches.length > 0 ? branches : ['main']);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch branches" });
    }
  });

  app.get("/api/projects/:id/git/history", async (req, res) => {
    try {
      const { branch, limit } = req.query;
      const limitNum = limit ? parseInt(limit as string, 10) : 50;
      
      try {
        const commits = await realGitService.getCommitHistory(
          req.params.id,
          typeof branch === 'string' ? branch : undefined,
          limitNum
        );
        
        const history = commits.map(commit => ({
          id: commit.hash,
          commitHash: commit.hash,
          message: commit.message,
          author: commit.author,
          email: commit.email,
          branch: typeof branch === 'string' ? branch : 'main',
          filesChanged: commit.filesChanged,
          createdAt: commit.date,
        }));
        
        res.json(history);
      } catch (error) {
        const commits = await storage.getProjectCommits(
          req.params.id,
          typeof branch === 'string' ? branch : undefined
        );
        
        const history = commits.slice(0, limitNum).map(commit => ({
          id: commit.id,
          commitHash: commit.commitHash,
          message: commit.message,
          author: commit.author,
          email: commit.email,
          branch: commit.branch,
          filesChanged: commit.filesChanged,
          createdAt: commit.createdAt,
        }));
        
        res.json(history);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch git history" });
    }
  });

  app.delete("/api/projects/:id/git/branches/:branch", async (req, res) => {
    try {
      const { branch } = req.params;
      
      if (branch === 'main' || branch === 'master') {
        return res.status(400).json({ error: "Cannot delete main branch" });
      }

      try {
        await realGitService.deleteBranch(req.params.id, branch);
        await storage.deleteProjectCommits(req.params.id, branch);
        res.status(204).send();
      } catch (error) {
        const deleted = await storage.deleteProjectCommits(req.params.id, branch);
        if (!deleted) {
          return res.status(404).json({ error: "Branch not found" });
        }
        res.status(204).send();
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to delete branch" });
    }
  });

  app.post("/api/projects/:id/git/init", async (req, res) => {
    try {
      const files = await storage.getProjectFiles(req.params.id);
      await realGitService.initializeRepository(req.params.id, files);
      
      res.json({ success: true, message: "Repository initialized" });
    } catch (error) {
      res.status(500).json({ error: "Failed to initialize repository" });
    }
  });

  app.get("/api/projects/:id/git/diff", async (req, res) => {
    try {
      const { filePath } = req.query;
      
      const diff = await realGitService.getDiff(
        req.params.id,
        typeof filePath === 'string' ? filePath : undefined
      );
      
      res.json({ diff });
    } catch (error) {
      res.status(500).json({ error: "Failed to get diff" });
    }
  });

  app.post("/api/projects/:id/git/branches", async (req, res) => {
    try {
      const { name } = req.body;
      
      const validation = gitService.validateBranchName(name);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      await realGitService.createBranch(req.params.id, name);
      res.status(201).json({ success: true, branch: name });
    } catch (error) {
      res.status(500).json({ error: "Failed to create branch" });
    }
  });

  app.post("/api/projects/:id/git/checkout", async (req, res) => {
    try {
      const { branch } = req.body;
      
      if (!branch) {
        return res.status(400).json({ error: "Branch name is required" });
      }

      await realGitService.checkoutBranch(req.params.id, branch);
      res.json({ success: true, currentBranch: branch });
    } catch (error) {
      res.status(500).json({ error: "Failed to checkout branch" });
    }
  });

  // File Upload
  app.post("/api/projects/:id/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { path: filePath } = req.body;
      const fs = await import('fs/promises');
      
      const fileContent = await fs.readFile(req.file.path, 'base64');
      
      const file = await storage.createFile({
        projectId: req.params.id,
        path: filePath || `assets/${req.file.originalname}`,
        content: fileContent,
        type: 'file',
        language: req.file.mimetype.startsWith('image/') ? 'image' : 'asset'
      });

      await unlink(req.file.path).catch(() => {});
      
      res.status(201).json(file);
    } catch (error) {
      if (req.file?.path) {
        await unlink(req.file.path).catch(() => {});
      }
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Project Export
  app.get("/api/projects/:id/export", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const files = await storage.getProjectFiles(req.params.id);
      const exportDir = join('exports', project.id + '-' + Date.now());
      
      await mkdir('exports', { recursive: true });
      await mkdir(exportDir, { recursive: true });
      
      const archive = archiver('zip', { zlib: { level: 9 } });
      const outputPath = join(exportDir, `${project.name.replace(/\s+/g, '-')}.zip`);
      const output = createWriteStream(outputPath);

      output.on('close', async () => {
        res.download(outputPath, `${project.name}.zip`, async (err) => {
          if (err) console.error('Download error:', err);
          await rm(exportDir, { recursive: true, force: true });
        });
      });

      archive.on('error', (err) => {
        throw err;
      });

      archive.pipe(output);
      
      archive.append(JSON.stringify(project, null, 2), { name: 'project.json' });
      
      for (const file of files) {
        if (file.type === 'file') {
          archive.append(file.content, { name: file.path });
        }
      }

      await archive.finalize();
    } catch (error) {
      res.status(500).json({ error: "Failed to export project" });
    }
  });

  // Project Import
  app.post("/api/projects/import", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      await mkdir('uploads', { recursive: true });
      const extractDir = join('uploads', 'extract-' + Date.now());
      await mkdir(extractDir, { recursive: true });

      const fs = await import('fs');
      await fs.createReadStream(req.file.path)
        .pipe(unzipper.Extract({ path: extractDir }))
        .promise();

      const projectDataPath = join(extractDir, 'project.json');
      const projectData = JSON.parse(await import('fs/promises').then(fs => 
        fs.readFile(projectDataPath, 'utf-8')
      ));

      const newProject = await storage.createProject({
        name: req.body.name || projectData.name + ' (Imported)',
        description: projectData.description,
        framework: projectData.framework,
        status: 'active',
      });

      const fsPromises = await import('fs/promises');
      const files = await fsPromises.readdir(extractDir);
      
      for (const fileName of files) {
        if (fileName === 'project.json') continue;
        
        const filePath = join(extractDir, fileName);
        const content = await fsPromises.readFile(filePath, 'utf-8');
        
        await storage.createFile({
          projectId: newProject.id,
          path: fileName,
          content,
          type: 'file',
          language: 'javascript'
        });
      }

      await rm(extractDir, { recursive: true, force: true }).catch(() => {});
      await unlink(req.file.path).catch(() => {});

      res.status(201).json(newProject);
    } catch (error) {
      if (req.file?.path) {
        await unlink(req.file.path).catch(() => {});
      }
      res.status(500).json({ error: "Failed to import project" });
    }
  });

  // Project Settings
  app.get("/api/projects/:id/settings", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project.settings || {});
    } catch (error) {
      res.status(500).json({ error: "Failed to get project settings" });
    }
  });

  app.put("/api/projects/:id/settings", async (req, res) => {
    try {
      const project = await storage.updateProject(req.params.id, {
        settings: req.body as any
      });
      
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      res.json(project.settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to update project settings" });
    }
  });

  // Search in Files
  app.get("/api/projects/:id/search", async (req, res) => {
    try {
      const { query, caseSensitive } = req.query;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: "Search query is required" });
      }

      const files = await storage.getProjectFiles(req.params.id);
      const results: any[] = [];

      const searchRegex = new RegExp(
        query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        caseSensitive === 'true' ? 'g' : 'gi'
      );

      for (const file of files) {
        if (file.type !== 'file') continue;

        const lines = file.content.split('\n');
        lines.forEach((line, index) => {
          const matches = Array.from(line.matchAll(searchRegex));
          matches.forEach(match => {
            if (match.index !== undefined) {
              results.push({
                fileId: file.id,
                filePath: file.path,
                lineNumber: index + 1,
                lineContent: line,
                matchStart: match.index,
                matchEnd: match.index + match[0].length,
              });
            }
          });
        });
      }

      res.json({
        query,
        totalResults: results.length,
        results: results.slice(0, 100)
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to search files" });
    }
  });

  // Batch File Operations
  app.post("/api/projects/:id/files/batch", async (req, res) => {
    try {
      const { operation, files } = req.body;
      
      if (!operation || !Array.isArray(files)) {
        return res.status(400).json({ error: "Invalid batch operation" });
      }

      const results = [];

      switch (operation) {
        case 'create':
          for (const fileData of files) {
            const file = await storage.createFile({
              projectId: req.params.id,
              ...fileData
            });
            results.push(file);
          }
          break;

        case 'delete':
          for (const filePath of files) {
            await storage.deleteFile(req.params.id, filePath);
          }
          break;

        default:
          return res.status(400).json({ error: "Unsupported operation" });
      }

      res.json({
        operation,
        count: results.length,
        results
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to execute batch operation" });
    }
  });

  return httpServer;
}
