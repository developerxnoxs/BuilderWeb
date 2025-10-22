import type { BuildLogEntry } from "@shared/schema";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

export interface DebianServerConfig {
  url: string;
  apiKey?: string;
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

export interface BuildStatusResponse {
  buildId: string;
  status: "pending" | "queued" | "building" | "success" | "failed";
  progress?: number;
  logs?: BuildLogEntry[];
  apkUrl?: string;
  errorMessage?: string;
}

export class DebianBuildService {
  private config: DebianServerConfig | null = null;

  setConfig(config: DebianServerConfig) {
    this.config = config;
  }

  getConfig(): DebianServerConfig | null {
    return this.config;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    
    if (this.config?.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }
    
    return headers;
  }

  private async makeRequest<T>(
    endpoint: string,
    method: string = "GET",
    body?: any
  ): Promise<T> {
    if (!this.config) {
      throw new Error("Debian server not configured");
    }

    const url = `${this.config.url.replace(/\/$/, "")}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method,
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Debian server error (${response.status}): ${errorText}`
        );
      }

      return await response.json() as T;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to communicate with Debian server: ${error.message}`);
      }
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.makeRequest("/health", "GET");
      return true;
    } catch (error) {
      return false;
    }
  }

  async submitBuild(request: BuildRequest): Promise<string> {
    const response = await this.makeRequest<{ buildId: string }>(
      "/api/builds",
      "POST",
      request
    );
    return response.buildId;
  }

  async getBuildStatus(buildId: string): Promise<BuildStatusResponse> {
    return await this.makeRequest<BuildStatusResponse>(
      `/api/builds/${buildId}`,
      "GET"
    );
  }

  async getBuildLogs(buildId: string): Promise<BuildLogEntry[]> {
    const response = await this.makeRequest<{ logs: BuildLogEntry[] }>(
      `/api/builds/${buildId}/logs`,
      "GET"
    );
    return response.logs;
  }

  async cancelBuild(buildId: string): Promise<void> {
    await this.makeRequest(
      `/api/builds/${buildId}/cancel`,
      "POST"
    );
  }

  async downloadAPK(apkUrl: string, destinationPath: string): Promise<void> {
    if (!this.config) {
      throw new Error("Debian server not configured");
    }

    const url = apkUrl.startsWith("http") 
      ? apkUrl 
      : `${this.config.url.replace(/\/$/, "")}${apkUrl}`;

    const response = await fetch(url, {
      headers: this.config.apiKey 
        ? { Authorization: `Bearer ${this.config.apiKey}` }
        : {},
    });

    if (!response.ok) {
      throw new Error(`Failed to download APK: ${response.statusText}`);
    }

    const fileStream = createWriteStream(destinationPath);
    await pipeline(Readable.from(response.body as any), fileStream);
  }

  async pollBuildStatus(
    buildId: string,
    onUpdate: (status: BuildStatusResponse) => void,
    intervalMs: number = 2000
  ): Promise<BuildStatusResponse> {
    return new Promise((resolve, reject) => {
      const pollInterval = setInterval(async () => {
        try {
          const status = await this.getBuildStatus(buildId);
          onUpdate(status);

          if (status.status === "success" || status.status === "failed") {
            clearInterval(pollInterval);
            resolve(status);
          }
        } catch (error) {
          clearInterval(pollInterval);
          reject(error);
        }
      }, intervalMs);
    });
  }
}

export const debianBuildService = new DebianBuildService();
