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
import { Separator } from "@/components/ui/separator";
import { GitBranch, GitCommit, History, Check, X, Plus, FileText, FilePlus, FileEdit, FileX, Code } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface GitFileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'untracked';
}

interface GitCommit {
  id: string;
  commitHash: string;
  message: string;
  author: string;
  email?: string;
  branch: string;
  filesChanged?: GitFileChange[];
  createdAt: string;
}

interface GitStatus {
  initialized: boolean;
  currentBranch: string;
  uncommittedChanges: number;
  totalCommits: number;
  staged?: GitFileChange[];
  unstaged?: GitFileChange[];
  untracked?: string[];
}

interface GitPanelProps {
  projectId: string;
}

export function GitPanel({ projectId }: GitPanelProps) {
  const [commitMessage, setCommitMessage] = useState("");
  const [author, setAuthor] = useState(localStorage.getItem('git_author') || "");
  const [email, setEmail] = useState(localStorage.getItem('git_email') || "");
  const [isCommitDialogOpen, setIsCommitDialogOpen] = useState(false);
  const [isCreateBranchDialogOpen, setIsCreateBranchDialogOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [diffContent, setDiffContent] = useState<string | null>(null);
  const [isDiffDialogOpen, setIsDiffDialogOpen] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: gitStatus, refetch: refetchStatus } = useQuery<GitStatus>({
    queryKey: [`/api/projects/${projectId}/git/status`],
    refetchInterval: 5000,
  });

  const { data: commits = [] } = useQuery<GitCommit[]>({
    queryKey: [`/api/projects/${projectId}/git/history`],
  });

  const { data: branches = [] } = useQuery<string[]>({
    queryKey: [`/api/projects/${projectId}/git/branches`],
  });

  const initMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/git/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to initialize repository');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/git`] });
      toast({
        title: "Repository initialized",
        description: "Git repository has been initialized successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Initialization failed",
        description: error.message,
        variant: "destructive",
      });
    },
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

  const createBranchMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch(`/api/projects/${projectId}/git/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error('Failed to create branch');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/git/branches`] });
      setNewBranchName("");
      setIsCreateBranchDialogOpen(false);
      toast({
        title: "Branch created",
        description: "New branch has been created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Branch creation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const checkoutBranchMutation = useMutation({
    mutationFn: async (branch: string) => {
      const response = await fetch(`/api/projects/${projectId}/git/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch }),
      });
      if (!response.ok) throw new Error('Failed to checkout branch');
      return response.json();
    },
    onSuccess: (_, branch) => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/git`] });
      toast({
        title: "Branch switched",
        description: `Switched to branch: ${branch}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Checkout failed",
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

  const handleCreateBranch = () => {
    if (!newBranchName.trim()) {
      toast({
        title: "Branch name required",
        description: "Please enter a branch name",
        variant: "destructive",
      });
      return;
    }

    createBranchMutation.mutate(newBranchName);
  };

  const handleViewDiff = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/git/diff`);
      const data = await response.json();
      setDiffContent(data.diff || "No changes to show");
      setIsDiffDialogOpen(true);
    } catch (error) {
      toast({
        title: "Failed to get diff",
        description: "Could not retrieve file changes",
        variant: "destructive",
      });
    }
  };

  const getFileIcon = (status: string) => {
    switch (status) {
      case 'added':
        return <FilePlus className="h-3 w-3 text-green-500" />;
      case 'modified':
        return <FileEdit className="h-3 w-3 text-yellow-500" />;
      case 'deleted':
        return <FileX className="h-3 w-3 text-red-500" />;
      default:
        return <FileText className="h-3 w-3 text-blue-500" />;
    }
  };

  const hasChanges = (gitStatus?.staged?.length ?? 0) > 0 || 
                     (gitStatus?.unstaged?.length ?? 0) > 0 || 
                     (gitStatus?.untracked?.length ?? 0) > 0;

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
          {!gitStatus?.initialized ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">
                Repository not initialized
              </p>
              <Button
                onClick={() => initMutation.mutate()}
                disabled={initMutation.isPending}
                size="sm"
              >
                {initMutation.isPending ? "Initializing..." : "Initialize Repository"}
              </Button>
            </div>
          ) : (
            <>
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

              {hasChanges && (
                <Button
                  variant="outline"
                  className="w-full"
                  size="sm"
                  onClick={handleViewDiff}
                >
                  <Code className="mr-2 h-4 w-4" />
                  View Changes (Diff)
                </Button>
              )}
              
              <Dialog open={isCommitDialogOpen} onOpenChange={setIsCommitDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full" size="sm" disabled={!hasChanges}>
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
            </>
          )}
        </CardContent>
      </Card>

      {/* File Changes */}
      {gitStatus?.initialized && hasChanges && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Changed Files
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[150px]">
              <div className="space-y-2">
                {gitStatus.staged && gitStatus.staged.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-green-600">Staged</p>
                    {gitStatus.staged.map((file, idx) => (
                      <div key={`staged-${idx}`} className="flex items-center gap-2 text-sm">
                        {getFileIcon(file.status)}
                        <span className="truncate">{file.path}</span>
                      </div>
                    ))}
                  </>
                )}
                
                {gitStatus.unstaged && gitStatus.unstaged.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-yellow-600 mt-2">Unstaged</p>
                    {gitStatus.unstaged.map((file, idx) => (
                      <div key={`unstaged-${idx}`} className="flex items-center gap-2 text-sm">
                        {getFileIcon(file.status)}
                        <span className="truncate">{file.path}</span>
                      </div>
                    ))}
                  </>
                )}
                
                {gitStatus.untracked && gitStatus.untracked.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-blue-600 mt-2">Untracked</p>
                    {gitStatus.untracked.map((file, idx) => (
                      <div key={`untracked-${idx}`} className="flex items-center gap-2 text-sm">
                        {getFileIcon('untracked')}
                        <span className="truncate">{file}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Branches */}
      {gitStatus?.initialized && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <GitBranch className="h-4 w-4" />
                Branches ({branches.length})
              </CardTitle>
              <Dialog open={isCreateBranchDialogOpen} onOpenChange={setIsCreateBranchDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="ghost">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Branch</DialogTitle>
                    <DialogDescription>
                      Create a new branch from the current branch
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="branchName">Branch Name</Label>
                      <Input
                        id="branchName"
                        placeholder="feature/my-feature"
                        value={newBranchName}
                        onChange={(e) => setNewBranchName(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateBranchDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateBranch}
                      disabled={createBranchMutation.isPending}
                    >
                      {createBranchMutation.isPending ? "Creating..." : "Create Branch"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {branches.map((branch) => (
                <Badge
                  key={branch}
                  variant={branch === gitStatus?.currentBranch ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => {
                    if (branch !== gitStatus?.currentBranch) {
                      checkoutBranchMutation.mutate(branch);
                    }
                  }}
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
      {gitStatus?.initialized && (
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
                          {commit.filesChanged && commit.filesChanged.length > 0 && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {commit.filesChanged.length} file{commit.filesChanged.length > 1 ? 's' : ''} changed
                            </div>
                          )}
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
      )}

      {/* Diff Dialog */}
      <Dialog open={isDiffDialogOpen} onOpenChange={setIsDiffDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>File Changes (Diff)</DialogTitle>
            <DialogDescription>
              View all changes in your working directory
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px] w-full rounded border p-4">
            <pre className="text-xs font-mono whitespace-pre-wrap">
              {diffContent || "No changes"}
            </pre>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDiffDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
