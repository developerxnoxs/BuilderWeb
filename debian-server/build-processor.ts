import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface BuildLogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
}

export interface Build {
  buildId: string;
  projectId: string;
  projectName: string;
  framework: string;
  status: "pending" | "queued" | "building" | "success" | "failed";
  logs: BuildLogEntry[];
  apkPath?: string;
  apkUrl?: string;
  errorMessage?: string;
  progress?: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface BuildRequest {
  projectId: string;
  projectName: string;
  framework: string;
  files: Array<{
    path: string;
    content: string;
  }>;
  buildConfig?: Record<string, any>;
}

export const builds = new Map<string, Build>();
const buildQueue: string[] = [];
let isProcessing = false;

const BUILDS_DIR = process.env.BUILDS_DIR || path.join(process.cwd(), "builds");
const APKS_DIR = process.env.APKS_DIR || path.join(process.cwd(), "apks");

async function ensureDirs() {
  await fs.mkdir(BUILDS_DIR, { recursive: true });
  await fs.mkdir(APKS_DIR, { recursive: true });
}

ensureDirs();

function addLog(buildId: string, level: BuildLogEntry["level"], message: string) {
  const build = builds.get(buildId);
  if (!build) return;
  
  build.logs.push({
    timestamp: new Date().toISOString(),
    level,
    message,
  });
}

export async function submitBuild(request: BuildRequest): Promise<string> {
  const buildId = randomUUID();
  
  const build: Build = {
    buildId,
    projectId: request.projectId,
    projectName: request.projectName,
    framework: request.framework,
    status: "queued",
    logs: [
      {
        timestamp: new Date().toISOString(),
        level: "info",
        message: "Build queued on Debian server",
      },
    ],
    createdAt: new Date(),
  };
  
  builds.set(buildId, build);
  buildQueue.push(buildId);
  
  const buildDir = path.join(BUILDS_DIR, buildId);
  await fs.mkdir(buildDir, { recursive: true });
  
  for (const file of request.files) {
    const filePath = path.join(buildDir, file.path);
    const fileDir = path.dirname(filePath);
    await fs.mkdir(fileDir, { recursive: true });
    await fs.writeFile(filePath, file.content, "utf-8");
  }
  
  processQueue();
  
  return buildId;
}

async function processQueue() {
  if (isProcessing || buildQueue.length === 0) {
    return;
  }
  
  isProcessing = true;
  
  while (buildQueue.length > 0) {
    const buildId = buildQueue.shift();
    if (!buildId) break;
    
    await processBuild(buildId);
  }
  
  isProcessing = false;
}

async function processBuild(buildId: string) {
  const build = builds.get(buildId);
  if (!build) return;
  
  try {
    build.status = "building";
    build.startedAt = new Date();
    addLog(buildId, "info", "Build started");
    
    const buildDir = path.join(BUILDS_DIR, buildId);
    
    switch (build.framework) {
      case "react-native":
        await buildReactNative(buildId, buildDir);
        break;
      case "flutter":
        await buildFlutter(buildId, buildDir);
        break;
      case "capacitor":
        await buildCapacitor(buildId, buildDir);
        break;
      default:
        throw new Error(`Unsupported framework: ${build.framework}`);
    }
    
    build.status = "success";
    build.completedAt = new Date();
    build.progress = 100;
    addLog(buildId, "success", "Build completed successfully!");
    
  } catch (error) {
    build.status = "failed";
    build.completedAt = new Date();
    build.errorMessage = error instanceof Error ? error.message : "Build failed";
    addLog(buildId, "error", `Build failed: ${build.errorMessage}`);
  }
}

async function buildReactNative(buildId: string, buildDir: string) {
  const build = builds.get(buildId);
  if (!build) return;
  
  addLog(buildId, "info", "Installing dependencies...");
  build.progress = 10;
  
  await simulateCommand(buildId, "npm install", 3000);
  
  addLog(buildId, "info", "Configuring Android build...");
  build.progress = 30;
  
  await simulateCommand(buildId, "react-native bundle", 2000);
  
  addLog(buildId, "info", "Compiling Java sources...");
  build.progress = 50;
  
  await simulateCommand(buildId, "gradlew assembleRelease", 5000);
  
  addLog(buildId, "info", "Processing resources...");
  build.progress = 70;
  
  await simulateCommand(buildId, "aapt package", 2000);
  
  addLog(buildId, "info", "Generating APK...");
  build.progress = 90;
  
  const apkName = `${build.projectName.replace(/\s+/g, '-')}-${buildId}.apk`;
  const apkPath = path.join(APKS_DIR, apkName);
  
  await createMockAPK(apkPath, build.projectName);
  
  build.apkPath = path.relative(process.cwd(), apkPath);
  build.apkUrl = `/api/builds/${buildId}/download`;
  
  addLog(buildId, "info", `APK generated: ${apkName}`);
}

async function buildFlutter(buildId: string, buildDir: string) {
  const build = builds.get(buildId);
  if (!build) return;
  
  addLog(buildId, "info", "Getting Flutter dependencies...");
  build.progress = 10;
  
  await simulateCommand(buildId, "flutter pub get", 3000);
  
  addLog(buildId, "info", "Building Flutter Android app...");
  build.progress = 40;
  
  await simulateCommand(buildId, "flutter build apk", 8000);
  
  addLog(buildId, "info", "Optimizing APK...");
  build.progress = 80;
  
  const apkName = `${build.projectName.replace(/\s+/g, '-')}-${buildId}.apk`;
  const apkPath = path.join(APKS_DIR, apkName);
  
  await createMockAPK(apkPath, build.projectName);
  
  build.apkPath = path.relative(process.cwd(), apkPath);
  build.apkUrl = `/api/builds/${buildId}/download`;
  
  addLog(buildId, "info", `APK generated: ${apkName}`);
}

async function buildCapacitor(buildId: string, buildDir: string) {
  const build = builds.get(buildId);
  if (!build) return;
  
  addLog(buildId, "info", "Installing dependencies...");
  build.progress = 10;
  
  await simulateCommand(buildId, "npm install", 3000);
  
  addLog(buildId, "info", "Building web assets...");
  build.progress = 30;
  
  await simulateCommand(buildId, "npm run build", 4000);
  
  addLog(buildId, "info", "Syncing with Capacitor...");
  build.progress = 50;
  
  await simulateCommand(buildId, "npx cap sync android", 3000);
  
  addLog(buildId, "info", "Building Android app...");
  build.progress = 70;
  
  await simulateCommand(buildId, "gradlew assembleRelease", 5000);
  
  const apkName = `${build.projectName.replace(/\s+/g, '-')}-${buildId}.apk`;
  const apkPath = path.join(APKS_DIR, apkName);
  
  await createMockAPK(apkPath, build.projectName);
  
  build.apkPath = path.relative(process.cwd(), apkPath);
  build.apkUrl = `/api/builds/${buildId}/download`;
  
  addLog(buildId, "info", `APK generated: ${apkName}`);
}

async function simulateCommand(buildId: string, command: string, duration: number) {
  addLog(buildId, "info", `Running: ${command}`);
  
  await new Promise(resolve => setTimeout(resolve, duration));
  
  if (Math.random() < 0.05) {
    throw new Error(`Command failed: ${command}`);
  }
}

async function createMockAPK(apkPath: string, projectName: string) {
  const apkContent = Buffer.from(`Mock APK for ${projectName}\nGenerated at: ${new Date().toISOString()}`);
  await fs.writeFile(apkPath, apkContent);
}

export async function getBuildStatus(buildId: string) {
  const build = builds.get(buildId);
  
  if (!build) {
    return null;
  }
  
  return {
    buildId: build.buildId,
    status: build.status,
    progress: build.progress,
    logs: build.logs,
    apkUrl: build.apkUrl,
    errorMessage: build.errorMessage,
  };
}

export async function getBuildLogs(buildId: string) {
  const build = builds.get(buildId);
  return build?.logs || null;
}

export async function cancelBuild(buildId: string): Promise<boolean> {
  const build = builds.get(buildId);
  
  if (!build || build.status === "success" || build.status === "failed") {
    return false;
  }
  
  const queueIndex = buildQueue.indexOf(buildId);
  if (queueIndex !== -1) {
    buildQueue.splice(queueIndex, 1);
  }
  
  build.status = "failed";
  build.completedAt = new Date();
  build.errorMessage = "Build cancelled by user";
  addLog(buildId, "error", "Build cancelled");
  
  return true;
}

export async function cleanupOldBuilds() {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000;
  
  for (const [buildId, build] of builds.entries()) {
    const age = now - build.createdAt.getTime();
    
    if (age > maxAge && (build.status === "success" || build.status === "failed")) {
      try {
        if (build.apkPath) {
          const apkPath = path.join(process.cwd(), build.apkPath);
          await fs.unlink(apkPath).catch(() => {});
        }
        
        const buildDir = path.join(BUILDS_DIR, buildId);
        await fs.rm(buildDir, { recursive: true, force: true }).catch(() => {});
        
        builds.delete(buildId);
        console.log(`Cleaned up old build: ${buildId}`);
      } catch (error) {
        console.error(`Failed to cleanup build ${buildId}:`, error);
      }
    }
  }
}
