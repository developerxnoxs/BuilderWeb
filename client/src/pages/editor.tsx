import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CodeEditor } from "@/components/code-editor";
import { FileTree } from "@/components/file-tree";
import { BuildStatusPanel } from "@/components/build-status-panel";
import { GitPanel } from "@/components/git-panel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Play, 
  Save, 
  FolderPlus,
  FilePlus,
  X,
  ChevronLeft,
  ChevronRight,
  Hammer,
  GitBranch,
  Smartphone
} from "lucide-react";
import { Project, FileTreeNode, BuildJob } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useBuildWebSocket } from "@/hooks/use-build-websocket";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

interface OpenFile {
  path: string;
  name: string;
  content: string;
  language?: string;
  isDirty: boolean;
}

export default function Editor() {
  const [, params] = useRoute("/editor/:id");
  const projectId = params?.id;
  const { toast } = useToast();

  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [fileTreeCollapsed, setFileTreeCollapsed] = useState(false);
  const [buildPanelCollapsed, setBuildPanelCollapsed] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<"build" | "git" | "preview">("build");
  const [showPreview, setShowPreview] = useState(false);
  const [newFileDialogOpen, setNewFileDialogOpen] = useState(false);
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFolderName, setNewFolderName] = useState("");

  const { data: project } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId,
  });

  const { data: fileTree = [] } = useQuery<FileTreeNode[]>({
    queryKey: ["/api/projects", projectId, "files"],
    enabled: !!projectId,
  });

  const { data: currentBuild } = useQuery<BuildJob>({
    queryKey: ["/api/projects", projectId, "current-build"],
    enabled: !!projectId,
    refetchInterval: (query) => {
      const build = query.state.data as BuildJob | undefined;
      return build?.status === "building" || build?.status === "queued" ? 2000 : false;
    },
  });

  useBuildWebSocket(currentBuild?.id);

  const saveFileMutation = useMutation({
    mutationFn: async ({ path, content }: { path: string; content: string }) => {
      return await apiRequest("PUT", `/api/projects/${projectId}/files`, { path, content });
    },
    onSuccess: (_, variables) => {
      setOpenFiles(prev => prev.map(f => 
        f.path === variables.path ? { ...f, isDirty: false } : f
      ));
      toast({
        title: "File saved",
        description: "Your changes have been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save file.",
        variant: "destructive",
      });
    },
  });

  const buildMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/projects/${projectId}/build`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "current-build"] });
      toast({
        title: "Build started",
        description: "Your Android app is being built...",
      });
    },
    onError: () => {
      toast({
        title: "Build failed",
        description: "Failed to start build process.",
        variant: "destructive",
      });
    },
  });

  const createFileMutation = useMutation({
    mutationFn: async (data: { path: string; content: string; type: string; language?: string }) => {
      return await apiRequest("POST", `/api/projects/${projectId}/files`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
      setNewFileDialogOpen(false);
      setNewFileName("");
      toast({
        title: "File created",
        description: "New file has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create file.",
        variant: "destructive",
      });
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: async (data: { path: string; type: string }) => {
      return await apiRequest("POST", `/api/projects/${projectId}/files`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
      setNewFolderDialogOpen(false);
      setNewFolderName("");
      toast({
        title: "Folder created",
        description: "New folder has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create folder.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = async (node: FileTreeNode) => {
    if (node.type === "folder") return;

    const existingFile = openFiles.find(f => f.path === node.path);
    if (existingFile) {
      setActiveTab(node.path);
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/files/${encodeURIComponent(node.path)}`);
      const data = await response.json();
      
      const newFile: OpenFile = {
        path: node.path,
        name: node.name,
        content: data.content || "",
        language: node.language,
        isDirty: false,
      };

      setOpenFiles(prev => [...prev, newFile]);
      setActiveTab(node.path);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load file.",
        variant: "destructive",
      });
    }
  };

  const handleFileChange = (path: string, content: string | undefined) => {
    if (content === undefined) return;
    setOpenFiles(prev => prev.map(f => 
      f.path === path ? { ...f, content, isDirty: true } : f
    ));
  };

  const handleCloseFile = (path: string) => {
    setOpenFiles(prev => prev.filter(f => f.path !== path));
    if (activeTab === path) {
      const remainingFiles = openFiles.filter(f => f.path !== path);
      setActiveTab(remainingFiles.length > 0 ? remainingFiles[0].path : null);
    }
  };

  const handleSaveFile = () => {
    const activeFile = openFiles.find(f => f.path === activeTab);
    if (activeFile && activeFile.isDirty) {
      saveFileMutation.mutate({
        path: activeFile.path,
        content: activeFile.content,
      });
    }
  };

  const handleBuild = () => {
    buildMutation.mutate();
  };

  const handleCreateFile = () => {
    if (!newFileName.trim()) return;
    
    const language = newFileName.endsWith('.js') || newFileName.endsWith('.jsx') ? 'javascript' :
                    newFileName.endsWith('.ts') || newFileName.endsWith('.tsx') ? 'typescript' :
                    newFileName.endsWith('.java') ? 'java' :
                    newFileName.endsWith('.kt') ? 'kotlin' :
                    newFileName.endsWith('.xml') ? 'xml' :
                    newFileName.endsWith('.json') ? 'json' : undefined;

    createFileMutation.mutate({
      path: newFileName.trim(),
      content: "",
      type: "file",
      language,
    });
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    
    createFolderMutation.mutate({
      path: newFolderName.trim(),
      type: "folder",
    });
  };

  const activeFile = openFiles.find(f => f.path === activeTab);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveFile();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, openFiles]);

  if (!project) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loading project...</h2>
          <p className="text-muted-foreground">Please wait</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Toolbar */}
      <div className="border-b border-border px-4 py-2 flex items-center justify-between gap-4 bg-card/50">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h2 className="font-semibold truncate" data-testid="text-project-name">{project.name}</h2>
          <Separator orientation="vertical" className="h-6" />
          <span className="text-xs text-muted-foreground truncate">{project.framework}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFileTreeCollapsed(!fileTreeCollapsed)}
            data-testid="button-toggle-files"
          >
            {fileTreeCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setNewFolderDialogOpen(true)}
            data-testid="button-new-folder"
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setNewFileDialogOpen(true)}
            data-testid="button-new-file"
          >
            <FilePlus className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveFile}
            disabled={!activeFile?.isDirty || saveFileMutation.isPending}
            data-testid="button-save"
          >
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
          <Button
            size="sm"
            onClick={handleBuild}
            disabled={buildMutation.isPending || currentBuild?.status === "building"}
            data-testid="button-build"
          >
            {currentBuild?.status === "building" ? (
              <>
                <Hammer className="h-4 w-4 mr-2 animate-spin" />
                Building...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Build APK
              </>
            )}
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button
            variant={showPreview ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setShowPreview(!showPreview);
              setRightPanelTab("preview");
              setBuildPanelCollapsed(false);
            }}
            data-testid="button-toggle-preview"
          >
            <Smartphone className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBuildPanelCollapsed(!buildPanelCollapsed)}
            data-testid="button-toggle-build-panel"
          >
            {buildPanelCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal">
          {/* File Tree */}
          {!fileTreeCollapsed && (
            <>
              <ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
                <div className="h-full border-r border-border bg-card/30">
                  <div className="p-2 border-b border-border">
                    <h3 className="font-semibold text-sm px-2">Files</h3>
                  </div>
                  <ScrollArea className="h-[calc(100%-41px)]">
                    <FileTree
                      nodes={fileTree}
                      onFileSelect={handleFileSelect}
                      selectedPath={activeTab || undefined}
                    />
                  </ScrollArea>
                </div>
              </ResizablePanel>
              <ResizableHandle />
            </>
          )}

          {/* Code Editor */}
          <ResizablePanel defaultSize={buildPanelCollapsed ? 80 : 50}>
            <div className="h-full flex flex-col">
              {openFiles.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center p-8">
                  <div>
                    <FilePlus className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-20" />
                    <h3 className="text-lg font-semibold mb-2" data-testid="text-no-files-open">
                      No files open
                    </h3>
                    <p className="text-muted-foreground max-w-sm">
                      Select a file from the file tree to start editing
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* File Tabs */}
                  <div className="border-b border-border bg-card/30">
                    <ScrollArea className="w-full">
                      <div className="flex items-center gap-px p-1">
                        {openFiles.map((file) => (
                          <button
                            key={file.path}
                            className={`
                              flex items-center gap-2 px-3 py-1.5 rounded-md text-sm whitespace-nowrap
                              hover-elevate active-elevate-2
                              ${activeTab === file.path 
                                ? "bg-background text-foreground" 
                                : "text-muted-foreground"
                              }
                            `}
                            onClick={() => setActiveTab(file.path)}
                            data-testid={`tab-file-${file.path}`}
                          >
                            <span className="truncate max-w-[150px]">
                              {file.name}
                              {file.isDirty && "*"}
                            </span>
                            <button
                              className="hover:text-foreground p-0.5 rounded hover-elevate"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCloseFile(file.path);
                              }}
                              data-testid={`button-close-${file.path}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Editor */}
                  <div className="flex-1 min-h-0">
                    {activeFile && (
                      <CodeEditor
                        value={activeFile.content}
                        onChange={(value) => handleFileChange(activeFile.path, value)}
                        language={activeFile.language}
                        path={activeFile.path}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          </ResizablePanel>

          {/* Right Panel (Build & Git) */}
          {!buildPanelCollapsed && (
            <>
              <ResizableHandle />
              <ResizablePanel defaultSize={30} minSize={25} maxSize={40}>
                <div className="h-full bg-card/30">
                  <Tabs value={rightPanelTab} onValueChange={(v) => setRightPanelTab(v as "build" | "git" | "preview")} className="h-full flex flex-col">
                    <div className="border-b border-border px-2 py-1 bg-card/50">
                      <TabsList className="w-full justify-start">
                        <TabsTrigger value="build" className="flex items-center gap-2">
                          <Hammer className="h-4 w-4" />
                          Build
                        </TabsTrigger>
                        <TabsTrigger value="git" className="flex items-center gap-2">
                          <GitBranch className="h-4 w-4" />
                          Git
                        </TabsTrigger>
                        <TabsTrigger value="preview" className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4" />
                          Preview
                        </TabsTrigger>
                      </TabsList>
                    </div>
                    
                    <TabsContent value="build" className="flex-1 p-4 m-0 overflow-auto">
                      <BuildStatusPanel
                        buildJob={currentBuild}
                        onDownloadApk={(url) => window.open(url, "_blank")}
                      />
                    </TabsContent>
                    
                    <TabsContent value="git" className="flex-1 p-4 m-0 overflow-auto">
                      {projectId && <GitPanel projectId={projectId} />}
                    </TabsContent>

                    <TabsContent value="preview" className="flex-1 p-4 m-0 overflow-auto flex items-center justify-center">
                      <div className="relative">
                        <div className="bg-gray-900 dark:bg-gray-800 rounded-[2.5rem] p-4 shadow-2xl border-8 border-gray-800 dark:border-gray-900">
                          <div className="bg-background rounded-[1.5rem] overflow-hidden" style={{ width: '280px', height: '580px' }}>
                            <div className="h-full flex items-center justify-center text-center p-8">
                              <div className="space-y-4">
                                <Smartphone className="h-16 w-16 mx-auto text-muted-foreground opacity-20" />
                                <div>
                                  <h3 className="font-semibold mb-2">Mobile Preview</h3>
                                  <p className="text-sm text-muted-foreground mb-4">
                                    Build your app to see the preview here
                                  </p>
                                  {currentBuild?.apkUrl && (
                                    <div className="space-y-2">
                                      <p className="text-xs text-muted-foreground">
                                        Download the APK to test on your device
                                      </p>
                                      <Button
                                        size="sm"
                                        onClick={() => window.open(currentBuild.apkUrl!, "_blank")}
                                        data-testid="button-download-apk-preview"
                                      >
                                        Download APK
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="absolute top-8 left-1/2 transform -translate-x-1/2 w-16 h-1 bg-gray-700 rounded-full"></div>
                        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-12 h-12 rounded-full border-2 border-gray-700"></div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

      {/* Create File Dialog */}
      <Dialog open={newFileDialogOpen} onOpenChange={setNewFileDialogOpen}>
        <DialogContent data-testid="dialog-new-file">
          <DialogHeader>
            <DialogTitle>Create New File</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="file-name">File Name</Label>
              <Input
                id="file-name"
                placeholder="example.js"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateFile();
                  }
                }}
                data-testid="input-file-name"
              />
              <p className="text-xs text-muted-foreground">
                Include path like: src/components/Button.tsx
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewFileDialogOpen(false)}
              data-testid="button-cancel-file"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateFile}
              disabled={!newFileName.trim() || createFileMutation.isPending}
              data-testid="button-create-file"
            >
              Create File
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Folder Dialog */}
      <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
        <DialogContent data-testid="dialog-new-folder">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="folder-name">Folder Name</Label>
              <Input
                id="folder-name"
                placeholder="components"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateFolder();
                  }
                }}
                data-testid="input-folder-name"
              />
              <p className="text-xs text-muted-foreground">
                Include path like: src/components
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewFolderDialogOpen(false)}
              data-testid="button-cancel-folder"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim() || createFolderMutation.isPending}
              data-testid="button-create-folder"
            >
              Create Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
