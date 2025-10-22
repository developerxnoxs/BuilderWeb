import { useRef, useEffect } from "react";
import { Editor } from "@monaco-editor/react";
import { useTheme } from "./theme-provider";
import { Loader2 } from "lucide-react";
import type * as Monaco from "monaco-editor";

interface CodeEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  language?: string;
  path?: string;
}

export function CodeEditor({ value, onChange, language = "javascript", path }: CodeEditorProps) {
  const { theme } = useTheme();
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  const handleEditorMount = (editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
    editorRef.current = editor;

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      editor.getAction('actions.find')?.run();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
      editor.getAction('editor.action.startFindReplaceAction')?.run();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG, () => {
      editor.getAction('editor.action.nextMatchFindAction')?.run();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyG, () => {
      editor.getAction('editor.action.previousMatchFindAction')?.run();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
      editor.getAction('editor.action.commentLine')?.run();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyL, () => {
      editor.getAction('editor.action.formatDocument')?.run();
    });

    monaco.languages.registerCompletionItemProvider(language || 'javascript', {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        };

        const suggestions: Monaco.languages.CompletionItem[] = [];

        if (language === 'javascript' || language === 'typescript') {
          suggestions.push(
            {
              label: 'console.log',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'console.log(${1:value});',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Log to console',
              range: range
            },
            {
              label: 'import',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: "import { ${2:component} } from '${1:module}';",
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Import statement',
              range: range
            },
            {
              label: 'function',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'function ${1:name}(${2:params}) {\n\t${3:// body}\n}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Function declaration',
              range: range
            },
            {
              label: 'arrow',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'const ${1:name} = (${2:params}) => {\n\t${3:// body}\n};',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Arrow function',
              range: range
            }
          );
        }

        return { suggestions };
      }
    });
  };

  useEffect(() => {
    return () => {
      editorRef.current?.dispose();
    };
  }, []);

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
        onMount={handleEditorMount}
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
          find: {
            addExtraSpaceOnTop: false,
            autoFindInSelection: 'never',
            seedSearchStringFromSelection: 'always',
          },
          quickSuggestions: {
            other: true,
            comments: false,
            strings: false
          },
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnCommitCharacter: true,
          acceptSuggestionOnEnter: 'on',
          snippetSuggestions: 'top',
          folding: true,
          foldingHighlight: true,
          showFoldingControls: 'always',
          bracketPairColorization: {
            enabled: true
          },
          guides: {
            bracketPairs: true,
            indentation: true
          },
          renderWhitespace: 'selection',
          renderControlCharacters: false,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
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
