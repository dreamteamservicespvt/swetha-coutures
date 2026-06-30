import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ProductNameInputProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

const ProductNameInput: React.FC<ProductNameInputProps> = ({
  value,
  onChange,
  options,
  placeholder = "Type or select product name...",
  disabled = false,
  required = false,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(value);
  const [filteredOptions, setFilteredOptions] = useState<string[]>([]);
  const [justSelectedOption, setJustSelectedOption] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchValue(value);
  }, [value]);

  // Reset the keyboard highlight whenever the option list changes or the dropdown closes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [filteredOptions, isOpen]);

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

  // Filter options based on input
  useEffect(() => {
    if (searchValue && searchValue.trim()) {
      const filtered = options
        .filter(option =>
          option.toLowerCase().includes(searchValue.toLowerCase())
        )
        .slice(0, 10); // Limit to 10 suggestions
      setFilteredOptions(filtered);
    } else {
      // Show all options when no search term
      setFilteredOptions(options.slice(0, 10));
    }
  }, [searchValue, options]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchValue(newValue);
    setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  // Snap a typed value to an existing option when it matches case-insensitively, so we never
  // create a casing-duplicate (e.g. "stitching" becomes "Stitching" if that already exists).
  const canonicalize = (val: string) => {
    const trimmed = val.trim();
    const match = options.find(o => o.toLowerCase() === trimmed.toLowerCase());
    return match || trimmed;
  };

  const handleInputBlur = () => {
    // Don't run blur logic if we just selected an option
    if (justSelectedOption) {
      return; // Exit early, don't reset the flag here
    }

    // Small delay to allow for option clicks
    setTimeout(() => {
      // Only update if we're not in the middle of a selection
      if (!justSelectedOption && searchValue.trim() !== '') {
        const canonical = canonicalize(searchValue);
        if (canonical !== value) onChange(canonical);
      }
      setIsOpen(false);
    }, 200); // Increased timeout for better reliability
  };

  const handleOptionClick = (option: string) => {
    setJustSelectedOption(true);
    setSearchValue(option);
    onChange(option);
    setIsOpen(false);
    
    // Reset the flag after a brief delay to allow any other handlers to complete
    setTimeout(() => {
      setJustSelectedOption(false);
    }, 200); // Increased timeout to ensure all handlers complete
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      if (filteredOptions.length > 0) {
        setHighlightedIndex(prev => (prev + 1) % filteredOptions.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      if (filteredOptions.length > 0) {
        setHighlightedIndex(prev => (prev <= 0 ? filteredOptions.length - 1 : prev - 1));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        // Select the option currently highlighted via the keyboard
        handleOptionClick(filteredOptions[highlightedIndex]);
      } else {
        onChange(canonicalize(searchValue));
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

      {isOpen && filteredOptions.length > 0 && (
        <Card ref={dropdownRef} className="absolute top-full left-0 right-0 z-50 mt-1 shadow-lg max-h-60 overflow-hidden">
          <CardContent className="p-0">
            <div ref={listRef} className="max-h-60 overflow-y-auto">
              <div className="py-1">
                {filteredOptions.map((option, index) => (
                  <div
                    key={`${option}-${index}`}
                    data-index={index}
                    className={cn(
                      "flex items-center px-3 py-2 cursor-pointer transition-colors",
                      index === highlightedIndex ? "bg-purple-100 dark:bg-purple-900/40" : "hover:bg-gray-100 dark:hover:bg-gray-700"
                    )}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onMouseDown={(e) => e.preventDefault()} // Prevent input blur
                    onClick={() => handleOptionClick(option)}
                  >
                    <span className="text-sm">{option}</span>
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

export default ProductNameInput;
