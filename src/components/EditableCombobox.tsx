import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Check, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditableComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowAdd?: boolean;
  onAddNew?: (value: string) => void;
  onDelete?: (value: string) => void;
  allowDelete?: boolean;
}

const EditableCombobox: React.FC<EditableComboboxProps> = ({
  value,
  onValueChange,
  options,
  placeholder = "Type or select...",
  disabled = false,
  className = "",
  allowAdd = true,
  onAddNew,
  onDelete,
  allowDelete = false
}) => {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(value);
  const [filteredOptions, setFilteredOptions] = useState<string[]>(options);
  const [userHasInteracted, setUserHasInteracted] = useState(false);
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
        setOpen(false);
        // Reset to original value if user didn't select anything
        if (userHasInteracted && searchValue !== value) {
          setSearchValue(value);
          setUserHasInteracted(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userHasInteracted, searchValue, value]);

  useEffect(() => {
    // Always filter from the full master list (options), not the current filtered list
    if (searchValue && searchValue.trim()) {
      const filtered = options.filter(option =>
        option.toLowerCase().includes(searchValue.toLowerCase())
      );
      setFilteredOptions(filtered);
    } else {
      setFilteredOptions(options);
    }
  }, [searchValue, options]);

  const handleSelect = (selectedValue: string) => {
    onValueChange(selectedValue);
    setSearchValue(selectedValue);
    setOpen(false);
    setUserHasInteracted(false);
    
    // Ensure the dropdown closes and value is set
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setUserHasInteracted(true);
    setSearchValue(newValue);
    
    // Immediately call onValueChange to persist the typed value
    onValueChange(newValue);
    
    if (!open) {
      setOpen(true);
    }
  };

  const handleInputFocus = () => {
    if (!open && !disabled) {
      setOpen(true);
    }
  };

  const handleInputBlur = () => {
    // Delay to allow clicking on dropdown items
    setTimeout(() => {
      if (!dropdownRef.current?.contains(document.activeElement)) {
        // Only close if user clicked outside the dropdown
        setOpen(false);
        // Ensure the final value is persisted
        if (userHasInteracted && searchValue !== value) {
          onValueChange(searchValue);
        }
        setUserHasInteracted(false);
      }
    }, 150);
  };

  const handleAddNew = () => {
    if (searchValue.trim() && !options.includes(searchValue.trim())) {
      const trimmedValue = searchValue.trim();
      
      // Update the value immediately
      onValueChange(trimmedValue);
      setSearchValue(trimmedValue);
      
      // Call the onAddNew callback to add to the dropdown options
      if (onAddNew) {
        onAddNew(trimmedValue);
      }
      
      setOpen(false);
      setUserHasInteracted(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && allowAdd && searchValue.trim() && !exactMatch) {
      e.preventDefault();
      handleAddNew();
    } else if (e.key === 'Enter' && exactMatch) {
      e.preventDefault();
      handleSelect(exactMatch);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setSearchValue(value);
      setUserHasInteracted(false);
    } else if (e.key === 'ArrowDown' && !open) {
      e.preventDefault();
      setOpen(true);
    }
  };

  const exactMatch = options.find(option => 
    option.toLowerCase() === searchValue.toLowerCase()
  );

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Input
          ref={inputRef}
          value={searchValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="pr-8"
          autoComplete="off"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full px-2 hover:bg-transparent"
          onClick={() => setOpen(!open)}
          disabled={disabled}
        >
          <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", open && "rotate-180")} />
        </Button>
      </div>

      {open && (
        <Card ref={dropdownRef} className="absolute top-full left-0 right-0 z-50 mt-1 shadow-lg max-h-60 overflow-hidden">
          <CardContent className="p-0">
            <div className="max-h-60 overflow-y-auto">
              {filteredOptions.length > 0 && (
                <div className="py-1">
                  {filteredOptions.map((option) => (
                    <div
                      key={option}
                      className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-100 group"
                      onClick={() => handleSelect(option)}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-sm">{option}</span>
                        {value === option && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      {allowDelete && onDelete && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(option);
                          }}
                        >
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add new option */}
              {allowAdd && searchValue.trim() && !exactMatch && (
                <div className="border-t py-1">
                  <div
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-blue-50 text-primary"
                    onClick={handleAddNew}
                  >
                    <Plus className="h-4 w-4" />
                    <span className="text-sm">Add "{searchValue.trim()}"</span>
                  </div>
                </div>
              )}

              {filteredOptions.length === 0 && !searchValue && (
                <div className="px-3 py-4 text-center text-sm text-gray-500">
                  No options available
                </div>
              )}

              {filteredOptions.length === 0 && searchValue && !exactMatch && (
                <div className="px-3 py-4 text-center text-sm text-gray-500">
                  No options match your search
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EditableCombobox;
