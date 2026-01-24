import Editor, { loader } from "@monaco-editor/react";
import { Copy, Check, Loader2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

// Configure Monaco loader to use CDN or local if needed, usually defaults to CDN which is fine for now/dev.
// For production apps, serving monaco locally is often preferred but CDN is easiest for instant setup.

export default function CodeViewer({ content, language, filename, onSave, currentFolder, isEditable = false }) {
    const [copied, setCopied] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editableContent, setEditableContent] = useState(content);
    const [isSaving, setIsSaving] = useState(false);
    const editorRef = useRef(null);

    // Map extension to Monaco language ID
    const getLanguageId = (ext) => {
        const map = {
            'js': 'javascript', 'jsx': 'javascript',
            'ts': 'typescript', 'tsx': 'typescript',
            'py': 'python',
            'md': 'markdown',
            'css': 'css', 'html': 'html', 'json': 'json',
            'java': 'java', 'c': 'c', 'cpp': 'cpp',
            'go': 'go', 'rs': 'rust', 'sql': 'sql',
            'xml': 'xml', 'yaml': 'yaml', 'yml': 'yaml'
        };
        return map[ext] || ext || 'plaintext';
    };

    const monacoLanguage = getLanguageId(language);

    useEffect(() => {
        setEditableContent(content);
    }, [content]);

    const handleCopy = () => {
        navigator.clipboard.writeText(isEditing ? editableContent : content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const { saveFileContent } = await import('@/app/actions');
            const result = await saveFileContent(currentFolder || '', filename, editableContent);
            if (result.success) {
                setIsEditing(false);
                if (onSave) onSave(editableContent);
            } else {
                alert('Failed to save file');
            }
        } catch (error) {
            console.error(error);
            alert('Error saving file');
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditorMount = (editor, monaco) => {
        editorRef.current = editor;
    };

    return (
        <div className="w-full h-full max-w-5xl mx-auto flex flex-col bg-card rounded-lg shadow-2xl overflow-hidden border border-border">
            {/* Editor Header */}
            <div className="flex items-center gap-4 px-4 py-2 bg-[#1e1e1e] border-b border-[#333] select-none h-12">
                {/* Traffic Lights */}
                <div className="flex gap-1.5 opacity-50 hover:opacity-100 transition-opacity">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                    <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                    <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
                </div>

                {/* Filename */}
                <span className="text-sm text-[#cccccc] font-mono opacity-80 truncate min-w-0 max-w-[200px]">
                    {filename}
                </span>

                {isEditing && (
                    <span className="text-[10px] text-yellow-500 font-mono border border-yellow-500/30 px-1.5 rounded bg-yellow-500/10">
                        Editing
                    </span>
                )}

                {/* Vertical Divider */}
                <div className="w-px h-4 bg-white/10" />

                {/* Actions */}
                <div className="flex items-center gap-2">
                    {!isEditing ? (
                        <>
                            {isEditable && (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="group flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-white/10 transition text-[#cccccc] text-xs font-medium"
                                    title="Edit File"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70 group-hover:opacity-100"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                    <span>Edit</span>
                                </button>
                            )}
                            <button
                                onClick={handleCopy}
                                className="group flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-white/10 transition text-[#cccccc] text-xs font-medium"
                                title="Copy Content"
                            >
                                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="opacity-70 group-hover:opacity-100" />}
                                <span>{copied ? 'Copied' : 'Copy'}</span>
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0e639c] hover:bg-[#1177bb] transition text-white text-xs font-medium shadow-sm active:scale-95"
                            >
                                {isSaving ? <Loader2 size={12} className="animate-spin" /> : <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>}
                                <span>{isSaving ? 'Saving...' : 'Save'}</span>
                            </button>
                            <button
                                onClick={() => { setIsEditing(false); setEditableContent(content); }}
                                disabled={isSaving}
                                className="px-3 py-1.5 rounded-md hover:bg-white/10 hover:text-red-400 transition text-[#cccccc] text-xs font-medium"
                            >
                                Cancel
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Monaco Editor */}
            <div className="flex-1 overflow-hidden relative group bg-[#1e1e1e]">
                <Editor
                    height="100%"
                    language={monacoLanguage}
                    value={isEditing ? editableContent : content}
                    theme="vs-dark"
                    options={{
                        readOnly: !isEditing,
                        minimap: { enabled: false }, // Cleaner view for small files
                        scrollBeyondLastLine: false,
                        fontSize: 14,
                        fontFamily: "'Geist Mono', monospace",
                        lineNumbers: 'on',
                        roundedSelection: false,
                        padding: { top: 16 },
                        automaticLayout: true,
                        scrollbar: {
                            vertical: 'visible',
                            horizontal: 'visible'
                        }
                    }}
                    onChange={(value) => setEditableContent(value)}
                    onMount={handleEditorMount}
                    loading={<div className="flex items-center justify-center h-full text-[#cccccc]"><Loader2 className="animate-spin mr-2" />Loading Editor...</div>}
                />
            </div>
        </div>
    );
}
