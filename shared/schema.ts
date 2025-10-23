import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  framework: text("framework").notNull(), // 'react-native' | 'flutter' | 'capacitor'
  status: text("status").notNull().default("active"), // 'active' | 'building' | 'archived'
  settings: jsonb("settings"), // project-specific build settings
  githubRepo: text("github_repo"), // GitHub repo full name (owner/repo)
  githubBranch: text("github_branch"), // GitHub branch name
  githubUrl: text("github_url"), // GitHub repo URL
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastModified: timestamp("last_modified").notNull().defaultNow(),
});

export const files = pgTable("files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: 'cascade' }),
  path: text("path").notNull(), // relative path like 'src/App.js'
  content: text("content").notNull().default(""),
  type: text("type").notNull(), // 'file' | 'folder'
  language: text("language"), // 'javascript' | 'typescript' | 'java' | 'kotlin' | 'xml' | 'json'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const buildJobs = pgTable("build_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: 'cascade' }),
  status: text("status").notNull().default("pending"), // 'pending' | 'queued' | 'building' | 'success' | 'failed'
  logs: jsonb("logs").notNull().default([]), // array of log entries
  apkUrl: text("apk_url"),
  errorMessage: text("error_message"),
  buildConfig: jsonb("build_config"), // build configuration options
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const templates = pgTable("templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  framework: text("framework").notNull(),
  thumbnail: text("thumbnail"),
  files: jsonb("files").notNull(), // array of file objects
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const gitCommits = pgTable("git_commits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: 'cascade' }),
  commitHash: text("commit_hash").notNull(),
  message: text("message").notNull(),
  author: text("author").notNull(),
  email: text("email"),
  branch: text("branch").notNull().default("main"),
  filesChanged: jsonb("files_changed"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Insert schemas
export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  lastModified: true,
});

export const insertFileSchema = createInsertSchema(files).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBuildJobSchema = createInsertSchema(buildJobs).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertTemplateSchema = createInsertSchema(templates).omit({
  id: true,
  createdAt: true,
});

export const insertGitCommitSchema = createInsertSchema(gitCommits).omit({
  id: true,
  createdAt: true,
});

// Types
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type File = typeof files.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;

export type BuildJob = typeof buildJobs.$inferSelect;
export type InsertBuildJob = z.infer<typeof insertBuildJobSchema>;

export type Template = typeof templates.$inferSelect;
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;

export type GitCommit = typeof gitCommits.$inferSelect;
export type InsertGitCommit = z.infer<typeof insertGitCommitSchema>;

// Additional types for UI
export interface FileTreeNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  language?: string;
  children?: FileTreeNode[];
}

export interface BuildLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export interface ServerConfig {
  url: string;
  apiKey?: string;
}

export interface ProjectSettings {
  buildVersion?: string;
  minSdkVersion?: number;
  targetSdkVersion?: number;
  packageName?: string;
  enableProguard?: boolean;
  enableR8?: boolean;
  customGradleConfig?: string;
  environmentVariables?: Record<string, string>;
}

export interface SearchResult {
  fileId: string;
  filePath: string;
  lineNumber: number;
  lineContent: string;
  matchStart: number;
  matchEnd: number;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  default_branch: string;
  language: string;
  updated_at: string;
  private: boolean;
}

export interface GitHubFile {
  path: string;
  content: string;
  type: string;
}

export interface GitHubAuth {
  accessToken: string;
  username: string;
  avatarUrl?: string;
}
