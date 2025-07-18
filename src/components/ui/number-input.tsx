import React, { useState, useEffect, forwardRef } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value?: number | string | null;
  onChange?: (value: number | null) => void;
  onValueChange?: (value: string) => void; // For compatibility with existing code
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  allowNegative?: boolean;
  allowEmpty?: boolean;
  emptyValue?: number | null;
  className?: string;
}

const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(({
  value = '',
  onChange,
  onValueChange,
  min,
  max,
  step = 1,
  decimals = 2,
  allowNegative = false,
  allowEmpty = true,
  emptyValue = null,
  className,
  onBlur,
  onFocus,
  placeholder,
  required,
  disabled,
  ...props
}, ref) => {
  const [displayValue, setDisplayValue] = useState<string>('');
  const [isFocused, setIsFocused] = useState(false);

  // Initialize display value
  useEffect(() => {
    if (value === null || value === undefined || value === '') {
      setDisplayValue('');
    } else {
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      if (!isNaN(numValue)) {
        setDisplayValue(numValue.toString());
      } else {
        setDisplayValue('');
      }
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Allow empty input
    if (inputValue === '') {
      setDisplayValue('');
      if (allowEmpty) {
        onChange?.(emptyValue);
        onValueChange?.(inputValue);
      }
      return;
    }

    // Allow typing minus sign at the beginning if negative numbers are allowed
    if (allowNegative && inputValue === '-') {
      setDisplayValue('-');
      return;
    }

    // Allow typing decimal point
    if (inputValue.endsWith('.') || inputValue.endsWith(',')) {
      setDisplayValue(inputValue.replace(',', '.'));
      return;
    }

    // Validate numeric input with regex
    const numericRegex = allowNegative 
      ? /^-?\d*\.?\d*$/ 
      : /^\d*\.?\d*$/;
    
    if (!numericRegex.test(inputValue)) {
      return; // Reject invalid input
    }

    setDisplayValue(inputValue);

    // Parse and validate the number
    const numValue = parseFloat(inputValue);
    if (!isNaN(numValue)) {
      // Check min/max constraints while typing (optional - can be disabled for better UX)
      if (min !== undefined && numValue < min && !isFocused) {
        return;
      }
      if (max !== undefined && numValue > max && !isFocused) {
        return;
      }

      onChange?.(numValue);
      onValueChange?.(inputValue);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    
    let finalValue = displayValue;
    
    // Handle empty value on blur
    if (finalValue === '' || finalValue === '-') {
      if (allowEmpty) {
        setDisplayValue('');
        onChange?.(emptyValue);
        onValueChange?.('');
      } else {
        // Use emptyValue if specified, otherwise fall back to min or 0
        const fallbackValue = emptyValue !== null && emptyValue !== undefined ? emptyValue : (min !== undefined ? min : 0);
        setDisplayValue(fallbackValue.toString());
        onChange?.(fallbackValue);
        onValueChange?.(fallbackValue.toString());
      }
      onBlur?.(e);
      return;
    }

    const numValue = parseFloat(finalValue);
    
    if (isNaN(numValue)) {
      // Invalid number, reset to empty or fallback
      if (allowEmpty) {
        setDisplayValue('');
        onChange?.(emptyValue);
        onValueChange?.('');
      } else {
        // Use emptyValue if specified, otherwise fall back to min or 0
        const fallbackValue = emptyValue !== null && emptyValue !== undefined ? emptyValue : (min !== undefined ? min : 0);
        setDisplayValue(fallbackValue.toString());
        onChange?.(fallbackValue);
        onValueChange?.(fallbackValue.toString());
      }
    } else {
      // Apply min/max constraints
      let constrainedValue = numValue;
      
      if (min !== undefined && constrainedValue < min) {
        constrainedValue = min;
      }
      if (max !== undefined && constrainedValue > max) {
        constrainedValue = max;
      }

      // Format to specified decimal places if step has decimals
      let formattedValue = constrainedValue;
      if (step < 1 && !Number.isInteger(constrainedValue)) {
        formattedValue = parseFloat(constrainedValue.toFixed(decimals));
      }

      setDisplayValue(formattedValue.toString());
      onChange?.(formattedValue);
      onValueChange?.(formattedValue.toString());
    }

    onBlur?.(e);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const getValidationClasses = () => {
    if (!required || allowEmpty) return '';
    
    const isEmpty = displayValue === '';
    const isInvalid = displayValue !== '' && isNaN(parseFloat(displayValue));
    
    if (isEmpty || isInvalid) {
      return 'border-red-500 focus:border-red-500 focus:ring-red-500';
    }
    
    return '';
  };

  return (
    <Input
      ref={ref}
      type="text"
      inputMode="numeric"
      pattern={allowNegative ? "[0-9.-]*" : "[0-9.]*"}
      value={displayValue}
      onChange={handleInputChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(getValidationClasses(), className)}
      {...props}
    />
  );
});

NumberInput.displayName = "NumberInput";

export { NumberInput };
export type { NumberInputProps };
