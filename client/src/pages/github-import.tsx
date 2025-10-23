import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { GitBranch, Star, GitFork, Clock, Search, Github } from "lucide-react";
import type { GitHubRepo } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";

export default function GitHubImport() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [githubToken, setGithubToken] = useState(() => localStorage.getItem('github_token') || '');
  const [isTokenSaved, setIsTokenSaved] = useState(() => !!localStorage.getItem('github_token'));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [selectedFramework, setSelectedFramework] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');

  const { data: repos = [], isLoading: reposLoading, error: reposError } = useQuery<GitHubRepo[]>({
    queryKey: ['/api/github/repos', githubToken],
    queryFn: async () => {
      const response = await fetch('/api/github/repos', {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch repositories');
      return response.json();
    },
    enabled: isTokenSaved && !!githubToken,
  });

  const { data: branches = [] } = useQuery<{ name: string }[]>({
    queryKey: ['/api/github/branches', selectedRepo?.full_name],
    queryFn: async () => {
      if (!selectedRepo) return [];
      const [owner, repo] = selectedRepo.full_name.split('/');
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch branches');
      return response.json();
    },
    enabled: !!selectedRepo && isTokenSaved,
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRepo) throw new Error('No repository selected');
      
      return await fetch('/api/github/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${githubToken}`,
        },
        body: JSON.stringify({
          repoFullName: selectedRepo.full_name,
          branch: selectedBranch || selectedRepo.default_branch,
          framework: selectedFramework,
        }),
      });
    },
    onSuccess: async (response) => {
      const project = await response.json();
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: "Repository imported",
        description: `${selectedRepo?.name} has been imported successfully.`,
      });
      navigate(`/editor/${project.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Import failed",
        description: error.message || "Failed to import repository.",
        variant: "destructive",
      });
    },
  });

  const handleSaveToken = () => {
    if (!githubToken.trim()) {
      toast({
        title: "Error",
        description: "Please enter a GitHub token.",
        variant: "destructive",
      });
      return;
    }
    localStorage.setItem('github_token', githubToken);
    setIsTokenSaved(true);
    toast({
      title: "Token saved",
      description: "GitHub token has been saved successfully.",
    });
  };

  const handleImport = () => {
    if (!selectedRepo) {
      toast({
        title: "Error",
        description: "Please select a repository.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedFramework) {
      toast({
        title: "Error",
        description: "Please select a framework.",
        variant: "destructive",
      });
      return;
    }
    importMutation.mutate();
  };

  const filteredRepos = repos.filter(repo => 
    repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    repo.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2" data-testid="text-title">
          <Github className="h-8 w-8" />
          Import from GitHub
        </h1>
        <p className="text-muted-foreground">
          Import your GitHub repository and start building Android apps
        </p>
      </div>

      {!isTokenSaved ? (
        <Card data-testid="card-token-input">
          <CardHeader>
            <CardTitle>GitHub Access Token</CardTitle>
            <CardDescription>
              Enter your GitHub personal access token to access your repositories
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="github-token">Personal Access Token</Label>
              <Input
                id="github-token"
                type="password"
                placeholder="ghp_xxxxxxxxxxxx"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                data-testid="input-github-token"
              />
              <p className="text-xs text-muted-foreground">
                Create a token at{' '}
                <a
                  href="https://github.com/settings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  github.com/settings/tokens
                </a>
                {' '}with repo access
              </p>
            </div>
            <Button onClick={handleSaveToken} data-testid="button-save-token">
              Save Token
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card data-testid="card-repo-list">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Your Repositories</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsTokenSaved(false);
                    setGithubToken('');
                    localStorage.removeItem('github_token');
                  }}
                  data-testid="button-change-token"
                >
                  Change Token
                </Button>
              </div>
              <CardDescription>
                Select a repository to import
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search repositories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                    data-testid="input-search-repos"
                  />
                </div>
                
                {reposLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading repositories...
                  </div>
                ) : reposError ? (
                  <div className="text-center py-8 text-destructive">
                    Failed to load repositories
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-2">
                      {filteredRepos.map((repo) => (
                        <button
                          key={repo.id}
                          onClick={() => {
                            setSelectedRepo(repo);
                            setSelectedBranch(repo.default_branch);
                          }}
                          className={`
                            w-full text-left p-4 rounded-lg border transition-colors
                            hover:bg-accent hover:border-accent-foreground/20
                            ${selectedRepo?.id === repo.id ? 'bg-accent border-accent-foreground/20' : 'bg-card'}
                          `}
                          data-testid={`button-select-repo-${repo.id}`}
                        >
                          <div className="font-semibold mb-1">{repo.name}</div>
                          {repo.description && (
                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                              {repo.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {repo.language && (
                              <Badge variant="secondary" className="text-xs">
                                {repo.language}
                              </Badge>
                            )}
                            <span className="flex items-center gap-1">
                              <GitBranch className="h-3 w-3" />
                              {repo.default_branch}
                            </span>
                            {repo.private && (
                              <Badge variant="outline" className="text-xs">
                                Private
                              </Badge>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-import-config">
            <CardHeader>
              <CardTitle>Import Configuration</CardTitle>
              <CardDescription>
                Configure how to import your repository
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedRepo ? (
                <>
                  <div className="space-y-2">
                    <Label>Repository</Label>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="font-semibold">{selectedRepo.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {selectedRepo.full_name}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="branch">Branch</Label>
                    <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                      <SelectTrigger id="branch" data-testid="select-branch">
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((branch) => (
                          <SelectItem key={branch.name} value={branch.name}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="framework">Framework</Label>
                    <Select value={selectedFramework} onValueChange={setSelectedFramework}>
                      <SelectTrigger id="framework" data-testid="select-framework">
                        <SelectValue placeholder="Select framework" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="react-native">React Native</SelectItem>
                        <SelectItem value="flutter">Flutter</SelectItem>
                        <SelectItem value="capacitor">Capacitor</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Choose the framework used in your repository
                    </p>
                  </div>

                  <Separator />

                  <Button
                    className="w-full"
                    onClick={handleImport}
                    disabled={!selectedFramework || importMutation.isPending}
                    data-testid="button-import"
                  >
                    {importMutation.isPending ? 'Importing...' : 'Import Repository'}
                  </Button>
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Github className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Select a repository to configure import settings</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
