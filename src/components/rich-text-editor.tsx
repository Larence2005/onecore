
"use client";

import { Bold, Italic, Link, List, ListOrdered, Image as ImageIcon, Code, Paperclip, AlignLeft, AlignCenter, AlignRight, AlignJustify, RemoveFormatting } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { useRef, useEffect, useCallback } from "react";
import { TableIcon } from "./ui/table-icon";

interface RichTextEditorProps {
    value: string; // Now expects HTML string
    onChange: (value: string) => void;
    onAttachmentClick: () => void;
    className?: string;
}

const RichTextEditor = ({ value, onChange, onAttachmentClick, className }: RichTextEditorProps) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isResizing = useRef(false);

    const cleanupResizeHandles = useCallback(() => {
        editorRef.current?.querySelectorAll('.resize-handle').forEach(handle => handle.remove());
        editorRef.current?.querySelectorAll('img.resizable').forEach(img => img.classList.remove('resizable'));
    }, []);

    const makeImagesResizable = useCallback(() => {
        if (!editorRef.current) return;
        cleanupResizeHandles();

        editorRef.current.querySelectorAll('img').forEach(img => {
            img.addEventListener('click', (e) => {
                e.stopPropagation();
                cleanupResizeHandles();

                img.classList.add('resizable');

                const resizeHandle = document.createElement('div');
                resizeHandle.className = 'resize-handle';
                img.parentElement?.appendChild(resizeHandle);
                
                const startResize = (e: MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    isResizing.current = true;
                    const startX = e.pageX;
                    const startY = e.pageY;
                    const startWidth = img.offsetWidth;
                    const startHeight = img.offsetHeight;

                    const doResize = (e: MouseEvent) => {
                        if (!isResizing.current) return;
                        const newWidth = startWidth + (e.pageX - startX);
                        const newHeight = startHeight + (e.pageY - startY);
                        img.style.width = `${newWidth}px`;
                        img.style.height = `auto`; // Maintain aspect ratio
                    };

                    const stopResize = () => {
                        if (isResizing.current) {
                            isResizing.current = false;
                            document.removeEventListener('mousemove', doResize);
                            document.removeEventListener('mouseup', stopResize);
                            handleInput(); // Update parent component with new HTML
                        }
                    };

                    document.addEventListener('mousemove', doResize);
                    document.addEventListener('mouseup', stopResize);
                };
                
                resizeHandle.addEventListener('mousedown', startResize);
            });
        });
    }, [cleanupResizeHandles]);
    
    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            editorRef.current.innerHTML = value;
            makeImagesResizable();
        }
    }, [value, makeImagesResizable]);

    const handleInput = () => {
        if (editorRef.current && !isResizing.current) {
            onChange(editorRef.current.innerHTML);
        }
    };
    
    const insertImageFromDataUrl = (dataUrl: string) => {
        const html = `<img src="${dataUrl}" style="max-width: 100%; height: auto;" />`;
        document.execCommand('insertHTML', false, html);
        // We must call makeImagesResizable after the DOM has had a chance to update
        setTimeout(makeImagesResizable, 0);
    };

    const handleFile = (file: File) => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    insertImageFromDataUrl(e.target.result as string);
                }
            };
            reader.readAsDataURL(file);
            return true;
        }
        return false;
    }

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
            e.dataTransfer.clearData();
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
        if (e.clipboardData.files && e.clipboardData.files.length > 0) {
            if (handleFile(e.clipboardData.files[0])) {
                e.preventDefault();
            }
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            handleFile(event.target.files[0]);
        }
    };

    const handleLocalImageClick = () => {
        fileInputRef.current?.click();
    };
    
    const applyFormat = (command: string, value?: string) => {
        if (editorRef.current) {
             editorRef.current.focus();
             document.execCommand(command, false, value);
             handleInput(); // Notify parent of the change
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

    const handleTable = () => {
        const rows = prompt("Enter number of rows:");
        const cols = prompt("Enter number of columns:");
        if (rows && cols) {
            const numRows = parseInt(rows, 10);
            const numCols = parseInt(cols, 10);
            if (!isNaN(numRows) && !isNaN(numCols) && numRows > 0 && numCols > 0) {
                let table = '<table style="border-collapse: collapse; width: 100%;">';
                for (let i = 0; i < numRows; i++) {
                    table += '<tr>';
                    for (let j = 0; j < numCols; j++) {
                        table += '<td style="border: 1px solid black; padding: 8px;">&nbsp;</td>';
                    }
                    table += '</tr>';
                }
                table += '</table><p><br></p>'; // Add a line break after the table
                applyFormat('insertHTML', table);
            } else {
                alert("Please enter valid numbers for rows and columns.");
            }
        }
    };

    const toolbarButtons = [
        { icon: Bold, tooltip: "Bold", onClick: () => applyFormat('bold') },
        { icon: Italic, tooltip: "Italic", onClick: () => applyFormat('italic') },
        { icon: Link, tooltip: "Insert Link", onClick: handleLink },
        { icon: ImageIcon, tooltip: "Insert Image from Local", onClick: handleLocalImageClick },
        { icon: TableIcon, tooltip: "Insert Table", onClick: handleTable },
        { icon: List, tooltip: "Unordered List", onClick: () => applyFormat('insertUnorderedList') },
        { icon: ListOrdered, tooltip: "Ordered List", onClick: () => applyFormat('insertOrderedList') },
        { icon: AlignLeft, tooltip: "Align Left", onClick: () => applyFormat('justifyLeft') },
        { icon: AlignCenter, tooltip: "Align Center", onClick: () => applyFormat('justifyCenter') },
        { icon: AlignRight, tooltip: "Align Right", onClick: () => applyFormat('justifyRight') },
        { icon: AlignJustify, tooltip: "Align Justify", onClick: () => applyFormat('justifyFull') },
        { icon: RemoveFormatting, tooltip: "Clear Formatting", onClick: () => applyFormat('removeFormat') },
    ];
    
    useEffect(() => {
        const currentEditor = editorRef.current;
        if (currentEditor) {
            const handleClickOutside = (event: MouseEvent) => {
                if (!currentEditor.contains(event.target as Node)) {
                    cleanupResizeHandles();
                }
            };
            document.addEventListener('click', handleClickOutside);
            return () => {
                document.removeEventListener('click', handleClickOutside);
            };
        }
    }, [cleanupResizeHandles]);


  return (
    <div className={cn("rounded-md border border-input focus-within:ring-2 focus-within:ring-ring", className)}>
      <div className="p-2 border-b border-input flex justify-between items-center flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
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
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept="image/*"
      />
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onPaste={handlePaste}
        className="prose dark:prose-invert max-w-none w-full rounded-b-md bg-background p-3 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none min-h-[150px]"
      />
    </div>
  );
};

export default RichTextEditor;

