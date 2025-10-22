import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  MoreVertical, 
  Code2, 
  Calendar, 
  Play, 
  Settings,
  Trash2,
  Archive
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Project } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";

interface ProjectCardProps {
  project: Project;
  onDelete?: (id: string) => void;
  onArchive?: (id: string) => void;
}

const frameworkColors = {
  "react-native": "bg-blue-500/10 text-blue-500 border-blue-500/20",
  "flutter": "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  "capacitor": "bg-purple-500/10 text-purple-500 border-purple-500/20",
};

const statusColors = {
  "active": "bg-chart-2/10 text-chart-2 border-chart-2/20",
  "building": "bg-chart-3/10 text-chart-3 border-chart-3/20",
  "archived": "bg-muted text-muted-foreground border-muted",
};

export function ProjectCard({ project, onDelete, onArchive }: ProjectCardProps) {
  return (
    <Card className="hover-elevate transition-all duration-200" data-testid={`card-project-${project.id}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 bg-primary/10 rounded-md flex items-center justify-center flex-shrink-0">
            <Code2 className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate">{project.name}</CardTitle>
            <CardDescription className="text-xs truncate mt-1">
              {project.description || "No description"}
            </CardDescription>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" data-testid={`button-project-menu-${project.id}`}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem data-testid={`button-project-settings-${project.id}`}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onArchive?.(project.id)} data-testid={`button-project-archive-${project.id}`}>
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-destructive"
              onClick={() => onDelete?.(project.id)}
              data-testid={`button-project-delete-${project.id}`}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardFooter className="flex flex-wrap items-center justify-between gap-2 pt-4">
        <div className="flex gap-2 flex-wrap">
          <Badge 
            variant="outline" 
            className={frameworkColors[project.framework as keyof typeof frameworkColors]}
            data-testid={`badge-framework-${project.id}`}
          >
            {project.framework}
          </Badge>
          <Badge 
            variant="outline"
            className={statusColors[project.status as keyof typeof statusColors]}
            data-testid={`badge-status-${project.id}`}
          >
            {project.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDistanceToNow(new Date(project.lastModified), { addSuffix: true })}
          </span>
        </div>
      </CardFooter>
      <div className="p-4 pt-0">
        <Link href={`/editor/${project.id}`}>
          <Button className="w-full" data-testid={`button-open-project-${project.id}`}>
            <Play className="mr-2 h-4 w-4" />
            Open Project
          </Button>
        </Link>
      </div>
    </Card>
  );
}
