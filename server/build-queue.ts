interface QueueItem {
  buildId: string;
  projectId: string;
  priority: number;
  createdAt: Date;
  startedAt?: Date;
}

export class BuildQueue {
  private queue: QueueItem[] = [];
  private activeBuildCount = 0;
  private maxConcurrentBuilds: number;
  private processing = false;

  constructor(maxConcurrentBuilds: number = 3) {
    this.maxConcurrentBuilds = maxConcurrentBuilds;
  }

  add(buildId: string, projectId: string, priority: number = 0): void {
    this.queue.push({
      buildId,
      projectId,
      priority,
      createdAt: new Date(),
    });

    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  remove(buildId: string): boolean {
    const index = this.queue.findIndex(item => item.buildId === buildId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  getPosition(buildId: string): number {
    return this.queue.findIndex(item => item.buildId === buildId);
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getActiveBuildCount(): number {
    return this.activeBuildCount;
  }

  canStartBuild(): boolean {
    return this.activeBuildCount < this.maxConcurrentBuilds;
  }

  startBuild(buildId: string): boolean {
    const item = this.queue.find(item => item.buildId === buildId);
    if (!item) return false;

    if (!this.canStartBuild()) return false;

    this.remove(buildId);
    this.activeBuildCount++;
    item.startedAt = new Date();
    return true;
  }

  completeBuild(buildId: string): void {
    this.activeBuildCount = Math.max(0, this.activeBuildCount - 1);
  }

  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      activeBuilds: this.activeBuildCount,
      availableSlots: this.maxConcurrentBuilds - this.activeBuildCount,
      maxConcurrent: this.maxConcurrentBuilds,
      queue: this.queue.map(item => ({
        buildId: item.buildId,
        projectId: item.projectId,
        priority: item.priority,
        waitingTime: Date.now() - item.createdAt.getTime(),
      })),
    };
  }

  setMaxConcurrentBuilds(max: number): void {
    this.maxConcurrentBuilds = Math.max(1, max);
  }
}

export const buildQueue = new BuildQueue(3);
