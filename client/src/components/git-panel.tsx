import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GitBranch, GitCommit, History, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface GitCommit {
  id: string;
  commitHash: string;
  message: string;
  author: string;
  email?: string;
  branch: string;
  filesChanged?: any;
  createdAt: string;
}

interface GitStatus {
  initialized: boolean;
  currentBranch: string;
  uncommittedChanges: number;
  totalCommits: number;
}

interface GitPanelProps {
  projectId: string;
}

export function GitPanel({ projectId }: GitPanelProps) {
  const [commitMessage, setCommitMessage] = useState("");
  const [author, setAuthor] = useState(localStorage.getItem('git_author') || "");
  const [email, setEmail] = useState(localStorage.getItem('git_email') || "");
  const [isCommitDialogOpen, setIsCommitDialogOpen] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: gitStatus } = useQuery<GitStatus>({
    queryKey: [`/api/projects/${projectId}/git/status`],
    refetchInterval: 5000,
  });

  const { data: commits = [] } = useQuery<GitCommit[]>({
    queryKey: [`/api/projects/${projectId}/git/history`],
  });

  const { data: branches = [] } = useQuery<string[]>({
    queryKey: [`/api/projects/${projectId}/git/branches`],
  });

  const commitMutation = useMutation({
    mutationFn: async (data: { message: string; author: string; email?: string }) => {
      const response = await fetch(`/api/projects/${projectId}/git/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create commit');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/git`] });
      setCommitMessage("");
      setIsCommitDialogOpen(false);
      toast({
        title: "Commit created",
        description: "Your changes have been committed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Commit failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCommit = () => {
    if (!commitMessage.trim()) {
      toast({
        title: "Commit message required",
        description: "Please enter a commit message",
        variant: "destructive",
      });
      return;
    }

    if (author) {
      localStorage.setItem('git_author', author);
    }
    if (email) {
      localStorage.setItem('git_email', email);
    }

    commitMutation.mutate({
      message: commitMessage,
      author: author || 'Anonymous',
      email: email || undefined,
    });
  };

  return (
    <div className="space-y-4">
      {/* Git Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Git Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Branch:</span>
            <Badge variant="outline">{gitStatus?.currentBranch || 'main'}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Uncommitted changes:</span>
            <Badge variant={gitStatus?.uncommittedChanges ? "default" : "secondary"}>
              {gitStatus?.uncommittedChanges || 0}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total commits:</span>
            <span className="text-sm font-medium">{gitStatus?.totalCommits || 0}</span>
          </div>
          
          <Dialog open={isCommitDialogOpen} onOpenChange={setIsCommitDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full" size="sm">
                <GitCommit className="mr-2 h-4 w-4" />
                Create Commit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Commit</DialogTitle>
                <DialogDescription>
                  Save your current changes to the project history
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="message">Commit Message *</Label>
                  <Textarea
                    id="message"
                    placeholder="Add a description of your changes..."
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    rows={3}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="author">Author *</Label>
                  <Input
                    id="author"
                    placeholder="Your name"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email (optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCommitDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCommit}
                  disabled={commitMutation.isPending}
                >
                  {commitMutation.isPending ? "Creating..." : "Create Commit"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Branches */}
      {branches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GitBranch className="h-4 w-4" />
              Branches ({branches.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {branches.map((branch) => (
                <Badge
                  key={branch}
                  variant={branch === gitStatus?.currentBranch ? "default" : "outline"}
                >
                  {branch}
                  {branch === gitStatus?.currentBranch && (
                    <Check className="ml-1 h-3 w-3" />
                  )}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Commit History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Recent Commits ({commits.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {commits.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <GitCommit className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No commits yet</p>
              <p className="text-xs mt-1">Create your first commit to track changes</p>
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {commits.map((commit) => (
                  <div
                    key={commit.id}
                    className="border-l-2 border-primary pl-4 pb-3 last:pb-0"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {commit.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{commit.author}</span>
                          <span>•</span>
                          <span className="font-mono">{commit.commitHash.substring(0, 7)}</span>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(commit.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
