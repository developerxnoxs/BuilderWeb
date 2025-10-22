import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectCard } from "@/components/project-card";
import { Plus, Search, Rocket, Code2, Zap } from "lucide-react";
import { Project } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: projects = [], isLoading, isError } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const recentProjects = filteredProjects.slice(0, 6);

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-lg p-8 border border-primary/20">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2" data-testid="text-welcome">
                Build Real Android Apps
              </h1>
              <p className="text-muted-foreground text-lg">
                Professional web-based IDE for React Native, Flutter, and Capacitor
              </p>
              <div className="flex flex-wrap gap-4 mt-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-chart-2/10 flex items-center justify-center">
                    <Code2 className="h-4 w-4 text-chart-2" />
                  </div>
                  <span className="text-sm">VSCode Engine</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-chart-3/10 flex items-center justify-center">
                    <Zap className="h-4 w-4 text-chart-3" />
                  </div>
                  <span className="text-sm">Real-time Builds</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Rocket className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm">GPU Powered</span>
                </div>
              </div>
            </div>
            <Link href="/templates">
              <Button size="lg" data-testid="button-new-project">
                <Plus className="mr-2 h-5 w-5" />
                New Project
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card border border-card-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Projects</p>
                <p className="text-2xl font-bold mt-1" data-testid="text-total-projects">
                  {isLoading ? "..." : projects.length}
                </p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Code2 className="h-6 w-6 text-primary" />
              </div>
            </div>
          </div>
          <div className="bg-card border border-card-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Builds</p>
                <p className="text-2xl font-bold mt-1" data-testid="text-active-builds">
                  {isLoading ? "..." : projects.filter(p => p.status === "building").length}
                </p>
              </div>
              <div className="w-12 h-12 bg-chart-3/10 rounded-lg flex items-center justify-center">
                <Zap className="h-6 w-6 text-chart-3" />
              </div>
            </div>
          </div>
          <div className="bg-card border border-card-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Successful Builds</p>
                <p className="text-2xl font-bold mt-1" data-testid="text-successful-builds">0</p>
              </div>
              <div className="w-12 h-12 bg-chart-2/10 rounded-lg flex items-center justify-center">
                <Rocket className="h-6 w-6 text-chart-2" />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Projects */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold">Recent Projects</h2>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-projects"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-3 p-4 border rounded-lg">
                  <Skeleton className="h-10 w-10 rounded-md" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                <Code2 className="h-10 w-10 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Failed to load projects</h3>
              <p className="text-muted-foreground mb-6 max-w-sm">
                There was an error loading your projects. Please try again.
              </p>
              <Button onClick={() => window.location.reload()}>Reload Page</Button>
            </div>
          ) : recentProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 bg-muted/20 rounded-full flex items-center justify-center mb-4">
                <Code2 className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2" data-testid="text-no-projects">
                No projects yet
              </h3>
              <p className="text-muted-foreground mb-6 max-w-sm">
                Start building your first Android app by creating a new project from a template
              </p>
              <Link href="/templates">
                <Button data-testid="button-create-first-project">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Project
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onDelete={(id) => console.log("Delete", id)}
                  onArchive={(id) => console.log("Archive", id)}
                />
              ))}
            </div>
          )}

          {recentProjects.length > 0 && filteredProjects.length > 6 && (
            <div className="text-center pt-4">
              <Link href="/projects">
                <Button variant="outline" data-testid="button-view-all-projects">
                  View All Projects ({filteredProjects.length})
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
