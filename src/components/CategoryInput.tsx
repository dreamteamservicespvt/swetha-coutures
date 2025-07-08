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
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { suggestions, addCategorySuggestion } = useCategorySuggestions(type);

  useEffect(() => {
    setSearchValue(value);
  }, [value]);

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

  const handleInputBlur = () => {
    // Small delay to allow for suggestion clicks
    setTimeout(() => {
      if (searchValue !== value) {
        onChange(searchValue);
        if (searchValue.trim()) {
          addCategorySuggestion(searchValue.trim());
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
    if (e.key === 'Enter') {
      e.preventDefault();
      onChange(searchValue);
      if (searchValue.trim()) {
        addCategorySuggestion(searchValue.trim());
      }
      setIsOpen(false);
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
            <div className="max-h-60 overflow-y-auto">
              <div className="py-1">
                {filteredSuggestions.map((suggestion, index) => (
                  <div
                    key={`${suggestion}-${index}`}
                    className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-100 group"
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
