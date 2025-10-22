import { useState } from "react";
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from "lucide-react";
import { FileTreeNode } from "@shared/schema";
import { cn } from "@/lib/utils";

interface FileTreeProps {
  nodes: FileTreeNode[];
  onFileSelect: (node: FileTreeNode) => void;
  selectedPath?: string;
}

interface FileTreeItemProps {
  node: FileTreeNode;
  level: number;
  onFileSelect: (node: FileTreeNode) => void;
  selectedPath?: string;
}

function FileTreeItem({ node, level, onFileSelect, selectedPath }: FileTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const isSelected = node.path === selectedPath;
  const isFolder = node.type === "folder";

  const getFileIcon = () => {
    if (isFolder) {
      return isExpanded ? (
        <FolderOpen className="h-4 w-4 text-chart-3" />
      ) : (
        <Folder className="h-4 w-4 text-chart-3" />
      );
    }
    return <File className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 py-1 px-2 cursor-pointer rounded-md text-sm hover-elevate active-elevate-2",
          isSelected && "bg-sidebar-accent text-sidebar-accent-foreground"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => {
          if (isFolder) {
            setIsExpanded(!isExpanded);
          } else {
            onFileSelect(node);
          }
        }}
        data-testid={`file-tree-item-${node.path}`}
      >
        {isFolder && (
          <button
            className="p-0 hover:bg-transparent"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            data-testid={`button-expand-${node.path}`}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        )}
        {!isFolder && <div className="w-3" />}
        {getFileIcon()}
        <span className="truncate flex-1">{node.name}</span>
      </div>
      {isFolder && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              level={level + 1}
              onFileSelect={onFileSelect}
              selectedPath={selectedPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({ nodes, onFileSelect, selectedPath }: FileTreeProps) {
  if (nodes.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground text-center" data-testid="text-no-files">
        No files yet
      </div>
    );
  }

  return (
    <div className="py-2" data-testid="file-tree">
      {nodes.map((node) => (
        <FileTreeItem
          key={node.path}
          node={node}
          level={0}
          onFileSelect={onFileSelect}
          selectedPath={selectedPath}
        />
      ))}
    </div>
  );
}
