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
  const [justSelected, setJustSelected] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const justSelectedTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only update searchValue if user is not actively typing or just selected an option
    // Add additional check to prevent updates during rapid selections
    if (!userHasInteracted && !justSelected && !isSelecting && value !== searchValue) {
      setSearchValue(value);
    }
  }, [value, userHasInteracted, justSelected, isSelecting, searchValue]);

  // Reset userHasInteracted when value prop changes from parent
  useEffect(() => {
    if (value !== searchValue && !userHasInteracted && !justSelected) {
      setUserHasInteracted(false);
    }
  }, [value, searchValue, userHasInteracted, justSelected]);

  // Reset justSelected flag after a short delay
  useEffect(() => {
    if (justSelected) {
      if (justSelectedTimeoutRef.current) {
        clearTimeout(justSelectedTimeoutRef.current);
      }
      justSelectedTimeoutRef.current = setTimeout(() => {
        setJustSelected(false);
      }, 50); // Reduced from 150ms to 50ms for faster reset
    }
  }, [justSelected]);

  // Reset isSelecting flag after a short delay
  useEffect(() => {
    if (isSelecting) {
      const timer = setTimeout(() => {
        setIsSelecting(false);
      }, 50); // Reduced from 150ms to 50ms for faster reset
      return () => clearTimeout(timer);
    }
  }, [isSelecting]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
      if (justSelectedTimeoutRef.current) {
        clearTimeout(justSelectedTimeoutRef.current);
      }
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        
        // Don't process outside clicks if we're in the middle of selecting
        if (isSelecting || justSelected) {
          return;
        }
        
        setOpen(false);
        
        // Only reset to original value if user was typing and didn't get an exact match
        if (userHasInteracted && searchValue !== value) {
          const exactMatch = options.find(option => 
            option.toLowerCase() === searchValue.toLowerCase()
          );
          if (!exactMatch) {
            if (searchValue.trim() === '' && !allowAdd) {
              // Allow empty value for fields that don't allow add
              onValueChange('');
            } else {
              // Reset to original value if no exact match
              setSearchValue(value);
            }
          }
        }
        setUserHasInteracted(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userHasInteracted, searchValue, value, options, allowAdd, isSelecting, justSelected]);

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
    // Clear ALL existing timeouts to prevent conflicts
    if (selectionTimeoutRef.current) {
      clearTimeout(selectionTimeoutRef.current);
    }
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    if (justSelectedTimeoutRef.current) {
      clearTimeout(justSelectedTimeoutRef.current);
    }
    
    // Immediately set the selecting state to prevent other handlers from interfering
    setIsSelecting(true);
    setJustSelected(true);
    setUserHasInteracted(false);
    
    // Update states synchronously
    setSearchValue(selectedValue);
    setOpen(false);
    
    // Call parent's onChange with the selected value IMMEDIATELY
    onValueChange(selectedValue);
    
    // Blur the input to close any mobile keyboards
    if (inputRef.current) {
      inputRef.current.blur();
    }
    
    // Use a much shorter timeout to reset the selection state
    // This prevents the longer timeouts from interfering with rapid selections
    justSelectedTimeoutRef.current = setTimeout(() => {
      setJustSelected(false);
      setIsSelecting(false);
    }, 50); // Reduced from 150ms to 50ms
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setUserHasInteracted(true);
    setSearchValue(newValue);
    
    // Don't call onValueChange for exact matches during typing to prevent conflicts
    // The value will be set properly when user selects from dropdown or on blur
    
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
    // Clear any existing blur timeout
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    
    // Don't process blur if we're in the middle of selecting
    if (isSelecting || justSelected) {
      return;
    }
    
    // Delay to allow clicking on dropdown items
    blurTimeoutRef.current = setTimeout(() => {
      if (!dropdownRef.current?.contains(document.activeElement)) {
        // Only close if user clicked outside the dropdown
        setOpen(false);
        
        // Only persist value if it's an exact match with existing options
        const exactMatch = options.find(option => 
          option.toLowerCase() === searchValue.toLowerCase()
        );
        
        if (exactMatch && exactMatch !== value) {
          onValueChange(exactMatch);
        } else if (!exactMatch && userHasInteracted) {
          // For fields with allowAdd=false, if user clears the value, allow it to be empty
          if (searchValue.trim() === '' && !allowAdd) {
            onValueChange('');
          } else {
            // Reset to original value if no exact match and user was typing
            setSearchValue(value);
          }
        }
        
        setUserHasInteracted(false);
      }
    }, 150); // Reduced from 200ms to 150ms
  };

  const handleAddNew = () => {
    if (searchValue.trim() && !options.includes(searchValue.trim())) {
      const trimmedValue = searchValue.trim();
      
      // Clear interaction state first
      setUserHasInteracted(false);
      setOpen(false);
      
      // Update the value immediately
      setSearchValue(trimmedValue);
      onValueChange(trimmedValue);
      
      // Call the onAddNew callback to add to the dropdown options
      // This ensures new items are tracked properly for saving
      if (onAddNew) {
        onAddNew(trimmedValue);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && allowAdd && searchValue.trim() && !exactMatch) {
      e.preventDefault();
      handleAddNew();
    } else if (e.key === 'Enter' && exactMatch) {
      e.preventDefault();
      handleSelect(exactMatch);
    } else if (e.key === 'Tab' && exactMatch) {
      // Auto-select exact match on tab
      handleSelect(exactMatch);
    } else if (e.key === 'Tab' && !exactMatch && searchValue.trim() === '') {
      // Allow empty value on tab if allowAdd is false
      if (!allowAdd) {
        onValueChange('');
      }
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
                      onMouseDown={(e) => {
                        // Use onMouseDown to ensure it fires before onBlur
                        e.preventDefault();
                        e.stopPropagation();
                        handleSelect(option);
                      }}
                      onTouchStart={(e) => {
                        // Handle touch events for mobile
                        e.stopPropagation();
                        handleSelect(option);
                      }}
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
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleAddNew();
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      handleAddNew();
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    <span className="text-sm">Add "{searchValue.trim()}"</span>
                  </div>
                </div>
              )}

              {filteredOptions.length === 0 && !searchValue && (
                <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No options available
                </div>
              )}

              {filteredOptions.length === 0 && searchValue && !exactMatch && (
                <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
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
