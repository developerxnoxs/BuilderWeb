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

// Types
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type File = typeof files.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;

export type BuildJob = typeof buildJobs.$inferSelect;
export type InsertBuildJob = z.infer<typeof insertBuildJobSchema>;

export type Template = typeof templates.$inferSelect;
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;

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
