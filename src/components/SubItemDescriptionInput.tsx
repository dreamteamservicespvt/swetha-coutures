import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SubItemDescriptionInputProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

const SubItemDescriptionInput: React.FC<SubItemDescriptionInputProps> = ({
  value,
  onChange,
  options,
  placeholder = "Type or select description...",
  disabled = false,
  required = false,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(value);
  const [filteredOptions, setFilteredOptions] = useState<string[]>([]);
  const [justSelectedOption, setJustSelectedOption] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    
    // Don't call onChange while typing to prevent conflicts with selection
    // The value will be set on blur or when an option is selected
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleInputBlur = () => {
    // Don't run blur logic if we just selected an option
    if (justSelectedOption) {
      return; // Exit early, don't reset the flag here
    }
    
    // Small delay to allow for option clicks
    setTimeout(() => {
      // Only update if we're not in the middle of a selection
      if (!justSelectedOption && searchValue !== value && searchValue.trim() !== '') {
        onChange(searchValue);
      }
      setIsOpen(false);
    }, 200); // Increased timeout for better reliability
  };

  const handleOptionClick = (option: string) => {
    setJustSelectedOption(true);
    
    // Immediately set the search value and call onChange to prevent truncation
    setSearchValue(option);
    onChange(option);
    setIsOpen(false);
    
    // Reset the flag after a brief delay to allow any other handlers to complete
    setTimeout(() => {
      setJustSelectedOption(false);
    }, 200); // Increased timeout to ensure all handlers complete
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onChange(searchValue);
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

      {isOpen && filteredOptions.length > 0 && (
        <Card ref={dropdownRef} className="absolute top-full left-0 right-0 z-50 mt-1 shadow-lg max-h-60 overflow-hidden">
          <CardContent className="p-0">
            <div className="max-h-60 overflow-y-auto">
              <div className="py-1">
                {filteredOptions.map((option, index) => (
                  <div
                    key={`${option}-${index}`}
                    className="flex items-center px-3 py-2 cursor-pointer hover:bg-gray-100 transition-colors"
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent input blur
                      e.stopPropagation(); // Stop event bubbling
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleOptionClick(option);
                    }}
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

export default SubItemDescriptionInput;
