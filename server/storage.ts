import { 
  type Project, 
  type InsertProject,
  type File,
  type InsertFile,
  type BuildJob,
  type InsertBuildJob,
  type Template,
  type InsertTemplate,
  type GitCommit,
  type InsertGitCommit,
  type FileTreeNode,
  projects,
  files,
  buildJobs,
  templates,
  gitCommits
} from "@shared/schema";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, desc, and, or } from "drizzle-orm";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

export interface IStorage {
  getProject(id: string): Promise<Project | undefined>;
  getAllProjects(): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;

  getFile(projectId: string, path: string): Promise<File | undefined>;
  getProjectFiles(projectId: string): Promise<File[]>;
  getFileTree(projectId: string): Promise<FileTreeNode[]>;
  createFile(file: InsertFile): Promise<File>;
  updateFile(projectId: string, path: string, content: string): Promise<File | undefined>;
  renameFile(projectId: string, oldPath: string, newPath: string): Promise<File | undefined>;
  deleteFile(projectId: string, path: string): Promise<boolean>;

  getBuildJob(id: string): Promise<BuildJob | undefined>;
  getProjectBuilds(projectId: string): Promise<BuildJob[]>;
  getCurrentBuild(projectId: string): Promise<BuildJob | undefined>;
  getAllBuilds(): Promise<BuildJob[]>;
  createBuildJob(buildJob: InsertBuildJob): Promise<BuildJob>;
  updateBuildJob(id: string, buildJob: Partial<BuildJob>): Promise<BuildJob | undefined>;

  getTemplate(id: string): Promise<Template | undefined>;
  getAllTemplates(): Promise<Template[]>;
  createTemplate(template: InsertTemplate): Promise<Template>;
  seedTemplates(): Promise<void>;

  getGitCommit(id: string): Promise<GitCommit | undefined>;
  getProjectCommits(projectId: string, branch?: string): Promise<GitCommit[]>;
  createGitCommit(commit: InsertGitCommit): Promise<GitCommit>;
  getProjectBranches(projectId: string): Promise<string[]>;
  deleteProjectCommits(projectId: string, branch: string): Promise<boolean>;
}

export class DbStorage implements IStorage {
  constructor() {
    this.init();
  }

  private async init() {
    const existingTemplates = await this.getAllTemplates();
    if (existingTemplates.length === 0) {
      await this.seedTemplates();
    }
  }

  async seedTemplates() {
    const templateData: InsertTemplate[] = [
      {
        name: "React Native Blank",
        description: "A minimal React Native app with navigation setup",
        framework: "react-native",
        files: [
          { path: "App.js", content: "import React from 'react';\nimport { View, Text } from 'react-native';\n\nexport default function App() {\n  return (\n    <View>\n      <Text>Hello React Native!</Text>\n    </View>\n  );\n}", type: "file", language: "javascript" },
          { path: "package.json", content: '{\n  "name": "react-native-app",\n  "version": "1.0.0"\n}', type: "file", language: "json" }
        ],
      },
      {
        name: "Flutter Starter",
        description: "Basic Flutter application template",
        framework: "flutter",
        files: [
          { path: "main.dart", content: "import 'package:flutter/material.dart';\n\nvoid main() {\n  runApp(MyApp());\n}\n\nclass MyApp extends StatelessWidget {\n  @override\n  Widget build(BuildContext context) {\n    return MaterialApp(\n      home: Scaffold(\n        body: Center(\n          child: Text('Hello Flutter!'),\n        ),\n      ),\n    );\n  }\n}", type: "file", language: "dart" }
        ],
      },
      {
        name: "Capacitor App",
        description: "Web app with Capacitor for native features",
        framework: "capacitor",
        files: [
          { path: "index.html", content: "<!DOCTYPE html>\n<html>\n<head>\n  <title>Capacitor App</title>\n</head>\n<body>\n  <h1>Hello Capacitor!</h1>\n</body>\n</html>", type: "file", language: "html" }
        ],
      },
    ];

    for (const template of templateData) {
      await db.insert(templates).values(template);
    }
  }

  async getProject(id: string): Promise<Project | undefined> {
    const result = await db.select().from(projects).where(eq(projects.id, id));
    return result[0];
  }

  async getAllProjects(): Promise<Project[]> {
    return await db.select().from(projects).orderBy(desc(projects.lastModified));
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const result = await db.insert(projects).values(insertProject).returning();
    return result[0];
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const result = await db
      .update(projects)
      .set({ ...updates, lastModified: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return result[0];
  }

  async deleteProject(id: string): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id)).returning();
    return result.length > 0;
  }

  async getFile(projectId: string, path: string): Promise<File | undefined> {
    const result = await db
      .select()
      .from(files)
      .where(and(eq(files.projectId, projectId), eq(files.path, path)));
    return result[0];
  }

  async getProjectFiles(projectId: string): Promise<File[]> {
    return await db.select().from(files).where(eq(files.projectId, projectId));
  }

  async getFileTree(projectId: string): Promise<FileTreeNode[]> {
    const projectFiles = await this.getProjectFiles(projectId);
    const tree: FileTreeNode[] = [];
    const nodeMap = new Map<string, FileTreeNode>();

    projectFiles.forEach(file => {
      const parts = file.path.split('/');
      let currentPath = '';

      parts.forEach((part, index) => {
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const isFile = index === parts.length - 1 && file.type === 'file';

        if (!nodeMap.has(currentPath)) {
          const node: FileTreeNode = {
            id: file.id,
            name: part,
            path: currentPath,
            type: isFile ? 'file' : 'folder',
            language: isFile ? file.language || undefined : undefined,
            children: isFile ? undefined : [],
          };

          nodeMap.set(currentPath, node);

          if (parentPath) {
            const parent = nodeMap.get(parentPath);
            if (parent && parent.children) {
              parent.children.push(node);
            }
          } else {
            tree.push(node);
          }
        }
      });
    });

    return tree;
  }

  async createFile(insertFile: InsertFile): Promise<File> {
    const result = await db.insert(files).values(insertFile).returning();
    await this.updateProject(insertFile.projectId, {});
    return result[0];
  }

  async updateFile(projectId: string, path: string, content: string): Promise<File | undefined> {
    const result = await db
      .update(files)
      .set({ content, updatedAt: new Date() })
      .where(and(eq(files.projectId, projectId), eq(files.path, path)))
      .returning();
    
    if (result[0]) {
      await this.updateProject(projectId, {});
    }
    
    return result[0];
  }

  async renameFile(projectId: string, oldPath: string, newPath: string): Promise<File | undefined> {
    const result = await db
      .update(files)
      .set({ path: newPath, updatedAt: new Date() })
      .where(and(eq(files.projectId, projectId), eq(files.path, oldPath)))
      .returning();
    
    if (result[0]) {
      await this.updateProject(projectId, {});
    }
    
    return result[0];
  }

  async deleteFile(projectId: string, path: string): Promise<boolean> {
    const result = await db
      .delete(files)
      .where(and(eq(files.projectId, projectId), eq(files.path, path)))
      .returning();
    
    if (result.length > 0) {
      await this.updateProject(projectId, {});
    }
    
    return result.length > 0;
  }

  async getBuildJob(id: string): Promise<BuildJob | undefined> {
    const result = await db.select().from(buildJobs).where(eq(buildJobs.id, id));
    return result[0];
  }

  async getProjectBuilds(projectId: string): Promise<BuildJob[]> {
    return await db
      .select()
      .from(buildJobs)
      .where(eq(buildJobs.projectId, projectId))
      .orderBy(desc(buildJobs.createdAt));
  }

  async getCurrentBuild(projectId: string): Promise<BuildJob | undefined> {
    const activeBuilds = await db
      .select()
      .from(buildJobs)
      .where(
        and(
          eq(buildJobs.projectId, projectId),
          or(eq(buildJobs.status, 'building'), eq(buildJobs.status, 'queued'))
        )
      )
      .orderBy(desc(buildJobs.createdAt));
    
    if (activeBuilds.length > 0) {
      return activeBuilds[0];
    }

    const allBuilds = await this.getProjectBuilds(projectId);
    return allBuilds[0];
  }

  async getAllBuilds(): Promise<BuildJob[]> {
    return await db.select().from(buildJobs).orderBy(desc(buildJobs.createdAt));
  }

  async createBuildJob(insertBuildJob: InsertBuildJob): Promise<BuildJob> {
    const result = await db.insert(buildJobs).values(insertBuildJob).returning();
    return result[0];
  }

  async updateBuildJob(id: string, updates: Partial<BuildJob>): Promise<BuildJob | undefined> {
    const result = await db
      .update(buildJobs)
      .set(updates)
      .where(eq(buildJobs.id, id))
      .returning();
    return result[0];
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    const result = await db.select().from(templates).where(eq(templates.id, id));
    return result[0];
  }

  async getAllTemplates(): Promise<Template[]> {
    return await db.select().from(templates);
  }

  async createTemplate(insertTemplate: InsertTemplate): Promise<Template> {
    const result = await db.insert(templates).values(insertTemplate).returning();
    return result[0];
  }

  async getGitCommit(id: string): Promise<GitCommit | undefined> {
    const result = await db.select().from(gitCommits).where(eq(gitCommits.id, id));
    return result[0];
  }

  async getProjectCommits(projectId: string, branch?: string): Promise<GitCommit[]> {
    if (branch) {
      return await db
        .select()
        .from(gitCommits)
        .where(and(eq(gitCommits.projectId, projectId), eq(gitCommits.branch, branch)))
        .orderBy(desc(gitCommits.createdAt));
    }
    
    return await db
      .select()
      .from(gitCommits)
      .where(eq(gitCommits.projectId, projectId))
      .orderBy(desc(gitCommits.createdAt));
  }

  async createGitCommit(insertCommit: InsertGitCommit): Promise<GitCommit> {
    const result = await db.insert(gitCommits).values(insertCommit).returning();
    return result[0];
  }

  async getProjectBranches(projectId: string): Promise<string[]> {
    const commits = await db
      .select({ branch: gitCommits.branch })
      .from(gitCommits)
      .where(eq(gitCommits.projectId, projectId));
    
    const uniqueBranches = Array.from(new Set(commits.map(c => c.branch)));
    return uniqueBranches;
  }

  async deleteProjectCommits(projectId: string, branch: string): Promise<boolean> {
    const result = await db
      .delete(gitCommits)
      .where(and(eq(gitCommits.projectId, projectId), eq(gitCommits.branch, branch)))
      .returning();
    
    return result.length > 0;
  }
}

export const storage = new DbStorage();
