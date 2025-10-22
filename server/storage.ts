import { 
  type Project, 
  type InsertProject,
  type File,
  type InsertFile,
  type BuildJob,
  type InsertBuildJob,
  type Template,
  type InsertTemplate,
  type FileTreeNode
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Projects
  getProject(id: string): Promise<Project | undefined>;
  getAllProjects(): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;

  // Files
  getFile(projectId: string, path: string): Promise<File | undefined>;
  getProjectFiles(projectId: string): Promise<File[]>;
  getFileTree(projectId: string): Promise<FileTreeNode[]>;
  createFile(file: InsertFile): Promise<File>;
  updateFile(projectId: string, path: string, content: string): Promise<File | undefined>;
  deleteFile(projectId: string, path: string): Promise<boolean>;

  // Build Jobs
  getBuildJob(id: string): Promise<BuildJob | undefined>;
  getProjectBuilds(projectId: string): Promise<BuildJob[]>;
  getCurrentBuild(projectId: string): Promise<BuildJob | undefined>;
  getAllBuilds(): Promise<BuildJob[]>;
  createBuildJob(buildJob: InsertBuildJob): Promise<BuildJob>;
  updateBuildJob(id: string, buildJob: Partial<BuildJob>): Promise<BuildJob | undefined>;

  // Templates
  getTemplate(id: string): Promise<Template | undefined>;
  getAllTemplates(): Promise<Template[]>;
  createTemplate(template: InsertTemplate): Promise<Template>;
}

export class MemStorage implements IStorage {
  private projects: Map<string, Project>;
  private files: Map<string, File>;
  private buildJobs: Map<string, BuildJob>;
  private templates: Map<string, Template>;

  constructor() {
    this.projects = new Map();
    this.files = new Map();
    this.buildJobs = new Map();
    this.templates = new Map();
    this.seedTemplates();
  }

  private seedTemplates() {
    const templates: InsertTemplate[] = [
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

    templates.forEach(t => {
      const id = randomUUID();
      this.templates.set(id, {
        ...t,
        id,
        createdAt: new Date(),
      });
    });
  }

  // Projects
  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async getAllProjects(): Promise<Project[]> {
    return Array.from(this.projects.values()).sort((a, b) => 
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    );
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = randomUUID();
    const now = new Date();
    const project: Project = {
      ...insertProject,
      id,
      createdAt: now,
      lastModified: now,
    };
    this.projects.set(id, project);
    return project;
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;
    
    const updated: Project = {
      ...project,
      ...updates,
      lastModified: new Date(),
    };
    this.projects.set(id, updated);
    return updated;
  }

  async deleteProject(id: string): Promise<boolean> {
    const deleted = this.projects.delete(id);
    if (deleted) {
      Array.from(this.files.values())
        .filter(f => f.projectId === id)
        .forEach(f => this.files.delete(f.id));
      
      Array.from(this.buildJobs.values())
        .filter(b => b.projectId === id)
        .forEach(b => this.buildJobs.delete(b.id));
    }
    return deleted;
  }

  // Files
  async getFile(projectId: string, path: string): Promise<File | undefined> {
    return Array.from(this.files.values()).find(
      f => f.projectId === projectId && f.path === path
    );
  }

  async getProjectFiles(projectId: string): Promise<File[]> {
    return Array.from(this.files.values()).filter(f => f.projectId === projectId);
  }

  async getFileTree(projectId: string): Promise<FileTreeNode[]> {
    const files = await this.getProjectFiles(projectId);
    const tree: FileTreeNode[] = [];
    const nodeMap = new Map<string, FileTreeNode>();

    files.forEach(file => {
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
            language: isFile ? file.language : undefined,
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
    const id = randomUUID();
    const now = new Date();
    const file: File = {
      ...insertFile,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.files.set(id, file);
    
    await this.updateProject(insertFile.projectId, {});
    return file;
  }

  async updateFile(projectId: string, path: string, content: string): Promise<File | undefined> {
    const file = await this.getFile(projectId, path);
    if (!file) return undefined;

    const updated: File = {
      ...file,
      content,
      updatedAt: new Date(),
    };
    this.files.set(file.id, updated);
    
    await this.updateProject(projectId, {});
    return updated;
  }

  async deleteFile(projectId: string, path: string): Promise<boolean> {
    const file = await this.getFile(projectId, path);
    if (!file) return false;
    
    const deleted = this.files.delete(file.id);
    if (deleted) {
      await this.updateProject(projectId, {});
    }
    return deleted;
  }

  // Build Jobs
  async getBuildJob(id: string): Promise<BuildJob | undefined> {
    return this.buildJobs.get(id);
  }

  async getProjectBuilds(projectId: string): Promise<BuildJob[]> {
    return Array.from(this.buildJobs.values())
      .filter(b => b.projectId === projectId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getCurrentBuild(projectId: string): Promise<BuildJob | undefined> {
    const builds = await this.getProjectBuilds(projectId);
    return builds.find(b => b.status === 'building' || b.status === 'queued') || builds[0];
  }

  async getAllBuilds(): Promise<BuildJob[]> {
    return Array.from(this.buildJobs.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async createBuildJob(insertBuildJob: InsertBuildJob): Promise<BuildJob> {
    const id = randomUUID();
    const now = new Date();
    const buildJob: BuildJob = {
      ...insertBuildJob,
      id,
      createdAt: now,
      completedAt: null,
    };
    this.buildJobs.set(id, buildJob);
    return buildJob;
  }

  async updateBuildJob(id: string, updates: Partial<BuildJob>): Promise<BuildJob | undefined> {
    const buildJob = this.buildJobs.get(id);
    if (!buildJob) return undefined;

    const updated: BuildJob = {
      ...buildJob,
      ...updates,
    };
    this.buildJobs.set(id, updated);
    return updated;
  }

  // Templates
  async getTemplate(id: string): Promise<Template | undefined> {
    return this.templates.get(id);
  }

  async getAllTemplates(): Promise<Template[]> {
    return Array.from(this.templates.values());
  }

  async createTemplate(insertTemplate: InsertTemplate): Promise<Template> {
    const id = randomUUID();
    const template: Template = {
      ...insertTemplate,
      id,
      createdAt: new Date(),
    };
    this.templates.set(id, template);
    return template;
  }
}

export const storage = new MemStorage();
