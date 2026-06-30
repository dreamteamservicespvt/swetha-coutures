import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCategorySuggestions } from '@/hooks/useCategorySuggestions';
import { cn } from '@/lib/utils';

interface CategoryInputProps {
  value: string;
  onChange: (value: string) => void;
  type: 'income' | 'expense';
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

const CategoryInput: React.FC<CategoryInputProps> = ({
  value,
  onChange,
  type,
  placeholder = "Enter category...",
  disabled = false,
  required = false,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(value);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { suggestions, addCategorySuggestion } = useCategorySuggestions(type);

  useEffect(() => {
    setSearchValue(value);
  }, [value]);

  // Reset the keyboard highlight whenever the option list changes or the dropdown closes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [filteredSuggestions, isOpen]);

  // Keep the highlighted option scrolled into view during keyboard navigation
  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-index="${highlightedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter suggestions based on input
  useEffect(() => {
    if (searchValue && searchValue.trim()) {
      const filtered = suggestions
        .map(s => s.name)
        .filter(suggestion =>
          suggestion.toLowerCase().includes(searchValue.toLowerCase())
        )
        .slice(0, 8); // Limit to 8 suggestions
      setFilteredSuggestions(filtered);
    } else {
      // Show top 8 most frequent suggestions when no search term
      setFilteredSuggestions(suggestions.slice(0, 8).map(s => s.name));
    }
  }, [searchValue, suggestions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchValue(newValue);
    setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  // Snap a typed value to an existing category when it matches case-insensitively, so we never
  // create a casing-duplicate (e.g. "fabric" becomes "Fabric" if that already exists).
  const canonicalize = (val: string) => {
    const trimmed = val.trim();
    const match = suggestions.map(s => s.name).find(n => n.toLowerCase() === trimmed.toLowerCase());
    return match || trimmed;
  };

  const handleInputBlur = () => {
    // Small delay to allow for suggestion clicks
    setTimeout(() => {
      const canonical = canonicalize(searchValue);
      if (canonical !== value) {
        onChange(canonical);
        if (canonical.trim()) {
          addCategorySuggestion(canonical.trim());
        }
      }
    }, 150);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchValue(suggestion);
    onChange(suggestion);
    setIsOpen(false);
    addCategorySuggestion(suggestion);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      if (filteredSuggestions.length > 0) {
        setHighlightedIndex(prev => (prev + 1) % filteredSuggestions.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      if (filteredSuggestions.length > 0) {
        setHighlightedIndex(prev => (prev <= 0 ? filteredSuggestions.length - 1 : prev - 1));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
        // Select the option currently highlighted via the keyboard
        handleSuggestionClick(filteredSuggestions[highlightedIndex]);
      } else {
        const canonical = canonicalize(searchValue);
        onChange(canonical);
        if (canonical.trim()) {
          addCategorySuggestion(canonical.trim());
        }
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchValue(value);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <Input
        ref={inputRef}
        type="text"
        value={searchValue}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className="w-full"
      />

      {isOpen && filteredSuggestions.length > 0 && (
        <Card ref={dropdownRef} className="absolute top-full left-0 right-0 z-50 mt-1 shadow-lg max-h-60 overflow-hidden">
          <CardContent className="p-0">
            <div ref={listRef} className="max-h-60 overflow-y-auto">
              <div className="py-1">
                {filteredSuggestions.map((suggestion, index) => (
                  <div
                    key={`${suggestion}-${index}`}
                    data-index={index}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 cursor-pointer group transition-colors",
                      index === highlightedIndex ? "bg-purple-100 dark:bg-purple-900/40" : "hover:bg-gray-100 dark:hover:bg-gray-700"
                    )}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-sm">{suggestion}</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {suggestions.find(s => s.name === suggestion)?.frequency || 1} times
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CategoryInput;
