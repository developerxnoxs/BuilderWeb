import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { getOrCreateKeystore, signAPK } from "./keystore-generator";

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
  
  await runCommand(buildId, buildDir, "npm install --legacy-peer-deps");
  
  addLog(buildId, "info", "Initializing Android project...");
  build.progress = 20;
  
  const androidDir = path.join(buildDir, "android");
  const assetsDir = path.join(androidDir, "app/src/main/assets");
  await fs.mkdir(assetsDir, { recursive: true });
  
  addLog(buildId, "info", "Bundling JavaScript...");
  build.progress = 30;
  
  await runCommand(
    buildId,
    buildDir,
    `npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output ${assetsDir}/index.android.bundle --assets-dest ${androidDir}/app/src/main/res/`
  );
  
  addLog(buildId, "info", "Building Android APK...");
  build.progress = 50;
  
  await runCommand(buildId, androidDir, "chmod +x gradlew");
  
  addLog(buildId, "info", "Compiling with Gradle (this may take a while)...");
  build.progress = 60;
  
  await runCommand(buildId, androidDir, "./gradlew assembleRelease", 600000);
  
  addLog(buildId, "info", "Locating generated APK...");
  build.progress = 85;
  
  const apkSourcePath = path.join(androidDir, "app/build/outputs/apk/release/app-release.apk");
  const tempApkPath = path.join(APKS_DIR, `temp-rn-${buildId}.apk`);
  
  await fs.copyFile(apkSourcePath, tempApkPath);
  
  addLog(buildId, "info", "Signing APK...");
  build.progress = 90;
  
  const keystoreConfig = await getOrCreateKeystore(build.projectId);
  const signedApkPath = await signAPK(tempApkPath, keystoreConfig);
  
  const apkName = `${build.projectName.replace(/\s+/g, '-')}-${buildId}.apk`;
  const finalApkPath = path.join(APKS_DIR, apkName);
  await fs.rename(signedApkPath, finalApkPath);
  
  build.apkPath = path.relative(process.cwd(), finalApkPath);
  build.apkUrl = `/api/builds/${buildId}/download`;
  
  addLog(buildId, "success", `APK generated and signed successfully: ${apkName}`);
}

async function buildFlutter(buildId: string, buildDir: string) {
  const build = builds.get(buildId);
  if (!build) return;
  
  addLog(buildId, "info", "Getting Flutter dependencies...");
  build.progress = 10;
  
  await runCommand(buildId, buildDir, "flutter pub get");
  
  addLog(buildId, "info", "Building Flutter Android app (this may take several minutes)...");
  build.progress = 30;
  
  await runCommand(buildId, buildDir, "flutter build apk --release", 900000);
  
  addLog(buildId, "info", "Locating generated APK...");
  build.progress = 85;
  
  const apkSourcePath = path.join(buildDir, "build/app/outputs/flutter-apk/app-release.apk");
  const tempApkPath = path.join(APKS_DIR, `temp-flutter-${buildId}.apk`);
  
  await fs.copyFile(apkSourcePath, tempApkPath);
  
  addLog(buildId, "info", "Signing APK...");
  build.progress = 90;
  
  const keystoreConfig = await getOrCreateKeystore(build.projectId);
  const signedApkPath = await signAPK(tempApkPath, keystoreConfig);
  
  const apkName = `${build.projectName.replace(/\s+/g, '-')}-${buildId}.apk`;
  const finalApkPath = path.join(APKS_DIR, apkName);
  await fs.rename(signedApkPath, finalApkPath);
  
  build.apkPath = path.relative(process.cwd(), finalApkPath);
  build.apkUrl = `/api/builds/${buildId}/download`;
  
  addLog(buildId, "success", `APK generated and signed successfully: ${apkName}`);
}

async function buildCapacitor(buildId: string, buildDir: string) {
  const build = builds.get(buildId);
  if (!build) return;
  
  addLog(buildId, "info", "Installing dependencies...");
  build.progress = 10;
  
  await runCommand(buildId, buildDir, "npm install --legacy-peer-deps");
  
  addLog(buildId, "info", "Building web assets...");
  build.progress = 25;
  
  await runCommand(buildId, buildDir, "npm run build");
  
  addLog(buildId, "info", "Syncing with Capacitor Android...");
  build.progress = 40;
  
  await runCommand(buildId, buildDir, "npx cap sync android");
  
  addLog(buildId, "info", "Building Android APK with Gradle...");
  build.progress = 60;
  
  const androidDir = path.join(buildDir, "android");
  await runCommand(buildId, androidDir, "chmod +x gradlew");
  await runCommand(buildId, androidDir, "./gradlew assembleRelease", 600000);
  
  addLog(buildId, "info", "Locating generated APK...");
  build.progress = 85;
  
  const apkSourcePath = path.join(androidDir, "app/build/outputs/apk/release/app-release.apk");
  const tempApkPath = path.join(APKS_DIR, `temp-cap-${buildId}.apk`);
  
  await fs.copyFile(apkSourcePath, tempApkPath);
  
  addLog(buildId, "info", "Signing APK...");
  build.progress = 90;
  
  const keystoreConfig = await getOrCreateKeystore(build.projectId);
  const signedApkPath = await signAPK(tempApkPath, keystoreConfig);
  
  const apkName = `${build.projectName.replace(/\s+/g, '-')}-${buildId}.apk`;
  const finalApkPath = path.join(APKS_DIR, apkName);
  await fs.rename(signedApkPath, finalApkPath);
  
  build.apkPath = path.relative(process.cwd(), finalApkPath);
  build.apkUrl = `/api/builds/${buildId}/download`;
  
  addLog(buildId, "success", `APK generated and signed successfully: ${apkName}`);
}

async function runCommand(
  buildId: string,
  cwd: string,
  command: string,
  timeout: number = 300000
) {
  addLog(buildId, "info", `Running: ${command}`);
  
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout,
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        ANDROID_HOME: process.env.ANDROID_HOME || "/opt/android-sdk",
        ANDROID_SDK_ROOT: process.env.ANDROID_SDK_ROOT || "/opt/android-sdk",
        JAVA_HOME: process.env.JAVA_HOME || "/usr/lib/jvm/java-17-openjdk-amd64",
        PATH: `${process.env.ANDROID_HOME || "/opt/android-sdk"}/cmdline-tools/latest/bin:${process.env.ANDROID_HOME || "/opt/android-sdk"}/platform-tools:${process.env.PATH}`,
      },
    });
    
    if (stdout) {
      const lines = stdout.trim().split('\n');
      lines.slice(0, 5).forEach(line => {
        if (line.trim()) addLog(buildId, "info", line.trim());
      });
    }
    
    if (stderr && !stderr.includes('warning')) {
      const lines = stderr.trim().split('\n');
      lines.slice(0, 3).forEach(line => {
        if (line.trim() && !line.toLowerCase().includes('deprecated')) {
          addLog(buildId, "warn", line.trim());
        }
      });
    }
  } catch (error: any) {
    if (error.stdout) addLog(buildId, "error", `stdout: ${error.stdout.substring(0, 500)}`);
    if (error.stderr) addLog(buildId, "error", `stderr: ${error.stderr.substring(0, 500)}`);
    throw new Error(error.message || "Command execution failed");
  }
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
