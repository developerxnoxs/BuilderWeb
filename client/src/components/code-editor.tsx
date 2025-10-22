import { Editor } from "@monaco-editor/react";
import { useTheme } from "./theme-provider";
import { Loader2 } from "lucide-react";

interface CodeEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  language?: string;
  path?: string;
}

export function CodeEditor({ value, onChange, language = "javascript", path }: CodeEditorProps) {
  const { theme } = useTheme();

  return (
    <div className="h-full w-full" data-testid="code-editor">
      <Editor
        height="100%"
        defaultLanguage={language}
        language={language}
        value={value}
        onChange={onChange}
        theme={theme === "dark" ? "vs-dark" : "light"}
        path={path}
        options={{
          minimap: { enabled: true },
          fontSize: 14,
          fontFamily: "var(--font-mono)",
          lineNumbers: "on",
          rulers: [],
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: "on",
          formatOnPaste: true,
          formatOnType: true,
        }}
        loading={
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }
      />
    </div>
  );
}
