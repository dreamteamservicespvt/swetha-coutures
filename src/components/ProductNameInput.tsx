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
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleInputBlur = () => {
    // Small delay to allow for option clicks
    setTimeout(() => {
      if (searchValue !== value) {
        onChange(searchValue);
      }
      setIsOpen(false);
    }, 150);
  };

  const handleOptionClick = (option: string) => {
    setSearchValue(option);
    onChange(option);
    setIsOpen(false);
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
