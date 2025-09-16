
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Card } from './ui/card';
import { cn } from '@/lib/utils';

interface Suggestion {
    name: string;
    email: string;
}

interface AutocompleteInputProps {
    suggestions: Suggestion[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    id?: string;
}

export function AutocompleteInput({ suggestions, value, onChange, placeholder, className, id }: AutocompleteInputProps) {
    const [filteredSuggestions, setFilteredSuggestions] = useState<Suggestion[]>([]);
    const [isSuggestionsVisible, setIsSuggestionsVisible] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value;
        onChange(inputValue);

        const emailParts = inputValue.split(/[,;]\s*/);
        const currentPart = emailParts[emailParts.length - 1];

        if (currentPart.trim() === '') {
            setIsSuggestionsVisible(false);
            return;
        }

        const newFiltered = suggestions.filter(
            suggestion =>
                suggestion.name.toLowerCase().includes(currentPart.toLowerCase()) ||
                suggestion.email.toLowerCase().includes(currentPart.toLowerCase())
        );

        setFilteredSuggestions(newFiltered);
        setIsSuggestionsVisible(newFiltered.length > 0);
    };

    const handleSuggestionClick = (suggestion: Suggestion) => {
        const emailParts = value.split(/[,;]\s*/);
        emailParts[emailParts.length - 1] = suggestion.email;
        onChange(emailParts.join(', ') + ', ');
        setIsSuggestionsVisible(false);
        inputRef.current?.focus();
    };

    const handleClickOutside = useCallback((event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
            setIsSuggestionsVisible(false);
        }
    }, []);

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [handleClickOutside]);

    return (
        <div className="relative w-full" ref={containerRef}>
            <Input
                id={id}
                ref={inputRef}
                type="text"
                value={value}
                onChange={handleInputChange}
                onFocus={handleInputChange}
                placeholder={placeholder}
                className={cn("w-full", className)}
                autoComplete="off"
            />
            {isSuggestionsVisible && (
                <Card className="absolute z-10 w-full mt-1 bg-background shadow-lg border">
                    <ScrollArea className="max-h-48">
                        <ul>
                            {filteredSuggestions.map((suggestion, index) => (
                                <li
                                    key={index}
                                    className="px-3 py-2 cursor-pointer hover:bg-accent"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        handleSuggestionClick(suggestion);
                                    }}
                                >
                                    <p className="font-medium text-sm">{suggestion.name}</p>
                                    <p className="text-xs text-muted-foreground">{suggestion.email}</p>
                                </li>
                            ))}
                        </ul>
                    </ScrollArea>
                </Card>
            )}
        </div>
    );
}
