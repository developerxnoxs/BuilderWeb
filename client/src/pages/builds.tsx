import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BuildJob } from "@shared/schema";
import { Download, CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

const statusConfig = {
  pending: { icon: Clock, color: "text-muted-foreground", bg: "bg-muted/10", label: "Pending" },
  queued: { icon: Clock, color: "text-chart-3", bg: "bg-chart-3/10", label: "Queued" },
  building: { icon: Loader2, color: "text-primary", bg: "bg-primary/10", label: "Building", animate: true },
  success: { icon: CheckCircle2, color: "text-chart-2", bg: "bg-chart-2/10", label: "Success" },
  failed: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", label: "Failed" },
};

export default function Builds() {
  const { data: builds = [], isLoading, isError } = useQuery<BuildJob[]>({
    queryKey: ["/api/builds"],
  });

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Build History</h1>
          <p className="text-muted-foreground mt-1">
            Track and manage your Android app builds
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 border rounded-lg space-y-3">
                <div className="flex justify-between">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-6 w-24" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <h3 className="text-lg font-semibold mb-2">Failed to load builds</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              There was an error loading build history. Please try again.
            </p>
            <Button onClick={() => window.location.reload()}>Reload Page</Button>
          </div>
        ) : builds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 bg-muted/20 rounded-full flex items-center justify-center mb-4">
              <Loader2 className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2" data-testid="text-no-builds">
              No builds yet
            </h3>
            <p className="text-muted-foreground max-w-sm">
              Start building your Android apps to see build history here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {builds.map((build) => {
              const config = statusConfig[build.status as keyof typeof statusConfig];
              const Icon = config.icon;

              return (
                <Card key={build.id} className="hover-elevate" data-testid={`card-build-${build.id}`}>
                  <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-10 h-10 ${config.bg} rounded-md flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`h-5 w-5 ${config.color} ${config.animate ? "animate-spin" : ""}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base">Build #{build.id.slice(0, 8)}</CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(build.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`${config.bg} ${config.color}`}>
                          {config.label}
                        </Badge>
                        {build.apkUrl && (
                          <Button size="sm" data-testid={`button-download-${build.id}`}>
                            <Download className="mr-2 h-4 w-4" />
                            Download APK
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  {build.errorMessage && (
                    <CardContent>
                      <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                        <p className="text-sm text-destructive">{build.errorMessage}</p>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
