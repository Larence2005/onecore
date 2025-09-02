"use client";

import { Bold, Italic, Link, List, ListOrdered, Image as ImageIcon, Code, Paperclip } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { useRef, useEffect } from "react";

interface RichTextEditorProps {
    value: string; // Now expects HTML string
    onChange: (value: string) => void;
    onAttachmentClick: () => void;
    className?: string;
}

const RichTextEditor = ({ value, onChange, onAttachmentClick, className }: RichTextEditorProps) => {
    const editorRef = useRef<HTMLDivElement>(null);

    // Keep internal state in sync with the prop, but only when it changes from the outside
    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            editorRef.current.innerHTML = value;
        }
    }, [value]);

    const handleInput = () => {
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    const applyFormat = (command: string, value?: string) => {
        if (editorRef.current) {
             editorRef.current.focus();
             document.execCommand(command, false, value);
             onChange(editorRef.current.innerHTML); // Notify parent of the change
        }
    };

    const handleLink = () => {
        const url = prompt("Enter the URL:");
        if (url) {
            applyFormat('createLink', url);
        }
    };
    
    const handleImage = () => {
        const imageUrl = prompt("Enter the image URL:");
        if (imageUrl) {
            applyFormat('insertImage', imageUrl);
        }
    }

    const toolbarButtons = [
        { icon: Bold, tooltip: "Bold", onClick: () => applyFormat('bold') },
        { icon: Italic, tooltip: "Italic", onClick: () => applyFormat('italic') },
        { icon: Link, tooltip: "Insert Link", onClick: handleLink },
        { icon: ImageIcon, tooltip: "Insert Image", onClick: handleImage },
        { icon: List, tooltip: "Unordered List", onClick: () => applyFormat('insertUnorderedList') },
        { icon: ListOrdered, tooltip: "Ordered List", onClick: () => applyFormat('insertOrderedList') },
    ];

  return (
    <div className={cn("rounded-md border border-input focus-within:ring-2 focus-within:ring-ring", className)}>
      <div className="p-2 border-b border-input flex justify-between items-center flex-wrap">
        <div className="flex items-center gap-1">
            {toolbarButtons.map(btn => (
                <Button key={btn.tooltip} variant="ghost" size="icon" className="h-8 w-8" type="button" onClick={btn.onClick} title={btn.tooltip}>
                    <btn.icon className="h-4 w-4"/>
                </Button>
            ))}
        </div>
         <Button variant="ghost" size="icon" className="h-8 w-8" type="button" onClick={onAttachmentClick} title="Attach files">
            <Paperclip className="h-4 w-4" />
        </Button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="prose dark:prose-invert max-w-none w-full rounded-b-md bg-background p-3 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none min-h-[150px]"
      />
    </div>
  );
};

export default RichTextEditor;
