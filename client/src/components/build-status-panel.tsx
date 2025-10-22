import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { BuildJob, BuildLogEntry } from "@shared/schema";
import { Download, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface BuildStatusPanelProps {
  buildJob?: BuildJob;
  onDownloadApk?: (url: string) => void;
}

const statusConfig = {
  pending: {
    icon: Clock,
    color: "text-muted-foreground",
    bg: "bg-muted/10",
    label: "Pending",
  },
  queued: {
    icon: Clock,
    color: "text-chart-3",
    bg: "bg-chart-3/10",
    label: "Queued",
  },
  building: {
    icon: Loader2,
    color: "text-primary",
    bg: "bg-primary/10",
    label: "Building",
    animate: true,
  },
  success: {
    icon: CheckCircle2,
    color: "text-chart-2",
    bg: "bg-chart-2/10",
    label: "Success",
  },
  failed: {
    icon: XCircle,
    color: "text-destructive",
    bg: "bg-destructive/10",
    label: "Failed",
  },
};

export function BuildStatusPanel({ buildJob, onDownloadApk }: BuildStatusPanelProps) {
  if (!buildJob) {
    return (
      <Card className="h-full" data-testid="build-status-empty">
        <CardHeader>
          <CardTitle>Build Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Loader2 className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-sm">No active build</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const config = statusConfig[buildJob.status as keyof typeof statusConfig];
  const Icon = config.icon;
  const logs = (buildJob.logs as unknown as BuildLogEntry[]) || [];
  const progress = buildJob.status === "building" ? 50 : buildJob.status === "success" ? 100 : 0;

  return (
    <Card className="h-full flex flex-col" data-testid="build-status-panel">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          Build Status
          <Badge 
            variant="outline" 
            className={`${config.bg} ${config.color}`}
            data-testid="badge-build-status"
          >
            <Icon className={`mr-1 h-3 w-3 ${config.animate ? "animate-spin" : ""}`} />
            {config.label}
          </Badge>
        </CardTitle>
        {buildJob.apkUrl && (
          <Button 
            size="sm" 
            onClick={() => onDownloadApk?.(buildJob.apkUrl!)}
            data-testid="button-download-apk"
          >
            <Download className="mr-2 h-4 w-4" />
            Download APK
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4 min-h-0">
        {buildJob.status === "building" && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" data-testid="progress-build" />
            <p className="text-xs text-muted-foreground">Building your Android application...</p>
          </div>
        )}

        {buildJob.errorMessage && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md" data-testid="text-build-error">
            <p className="text-sm text-destructive font-medium">Build Error</p>
            <p className="text-xs text-destructive/90 mt-1">{buildJob.errorMessage}</p>
          </div>
        )}

        <div className="flex-1 min-h-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium">Build Logs</h4>
            <span className="text-xs text-muted-foreground">
              {buildJob.createdAt && formatDistanceToNow(new Date(buildJob.createdAt), { addSuffix: true })}
            </span>
          </div>
          <ScrollArea className="h-full border rounded-md bg-card" data-testid="scroll-build-logs">
            <div className="p-3 font-mono text-xs space-y-1">
              {logs.length === 0 ? (
                <p className="text-muted-foreground">Waiting for build logs...</p>
              ) : (
                logs.map((log, index) => (
                  <div
                    key={index}
                    className={`flex gap-2 ${
                      log.level === "error"
                        ? "text-destructive"
                        : log.level === "warn"
                        ? "text-chart-3"
                        : log.level === "success"
                        ? "text-chart-2"
                        : "text-foreground"
                    }`}
                    data-testid={`log-entry-${index}`}
                  >
                    <span className="text-muted-foreground">[{log.timestamp}]</span>
                    <span className="uppercase text-[10px] font-bold min-w-[50px]">
                      {log.level}
                    </span>
                    <span className="flex-1">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
