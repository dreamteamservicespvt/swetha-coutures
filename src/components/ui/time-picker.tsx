import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimePickerProps {
  value?: string;
  onChange: (time: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

const TimePicker: React.FC<TimePickerProps> = ({
  value,
  onChange,
  className,
  placeholder = "Select time",
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hours, setHours] = useState(9);
  const [minutes, setMinutes] = useState(0);
  const [isDragging, setIsDragging] = useState<'hours' | 'minutes' | null>(null);
  const clockRef = useRef<HTMLDivElement>(null);

  // Parse value when component mounts or value changes
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(':').map(Number);
      setHours(h);
      setMinutes(m);
    }
  }, [value]);

  // Handle time selection
  const handleTimeChange = (newHours: number, newMinutes: number) => {
    const formattedTime = `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
    onChange(formattedTime);
  };

  // Calculate angle for clock hands
  const getAngle = (value: number, max: number) => {
    return (value * 360) / max - 90;
  };

  // Get coordinates on clock face
  const getClockCoordinates = (angle: number, radius: number) => {
    const radian = (angle * Math.PI) / 180;
    return {
      x: 100 + radius * Math.cos(radian),
      y: 100 + radius * Math.sin(radian)
    };
  };

  // Handle mouse/touch events for clock interaction
  const handleClockInteraction = (event: React.MouseEvent | React.TouchEvent) => {
    if (!clockRef.current || !isDragging) return;

    const rect = clockRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;
    
    let angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;

    if (isDragging === 'hours') {
      const newHours = Math.round(angle / 30) % 12;
      const actualHours = newHours === 0 ? 12 : newHours;
      const finalHours = actualHours < 9 ? actualHours + 12 : actualHours; // Prefer afternoon times
      setHours(Math.min(Math.max(finalHours, 9), 18)); // Limit to business hours
      handleTimeChange(Math.min(Math.max(finalHours, 9), 18), minutes);
    } else if (isDragging === 'minutes') {
      const newMinutes = Math.round(angle / 6) % 60;
      const snapMinutes = Math.round(newMinutes / 15) * 15; // Snap to 15-minute intervals
      setMinutes(snapMinutes);
      handleTimeChange(hours, snapMinutes);
    }
  };

  // Generate time slots for quick selection
  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30'
  ];

  const formatDisplayTime = () => {
    if (!value) return placeholder;
    return value;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <Clock className="mr-2 h-4 w-4" />
          {formatDisplayTime()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-4 space-y-4">
          {/* Clock Display */}
          <div className="flex flex-col items-center space-y-4">
            <div className="text-lg font-semibold">
              {hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}
            </div>
            
            {/* Analog Clock */}
            <div 
              ref={clockRef}
              className="relative w-48 h-48 rounded-full border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 cursor-pointer select-none"
              onMouseMove={handleClockInteraction}
              onTouchMove={handleClockInteraction}
              onMouseUp={() => setIsDragging(null)}
              onTouchEnd={() => setIsDragging(null)}
            >
              {/* Hour markers */}
              {Array.from({ length: 12 }, (_, i) => {
                const angle = (i * 30) - 90;
                const coords = getClockCoordinates(angle, 80);
                const hour = i === 0 ? 12 : i;
                return (
                  <div
                    key={i}
                    className="absolute w-6 h-6 flex items-center justify-center text-xs font-medium transform -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${coords.x}px`,
                      top: `${coords.y}px`
                    }}
                  >
                    {hour}
                  </div>
                );
              })}

              {/* Minute markers */}
              {Array.from({ length: 4 }, (_, i) => {
                const angle = (i * 90) - 90;
                const coords = getClockCoordinates(angle, 65);
                const minute = i * 15;
                return (
                  <div
                    key={`min-${i}`}
                    className="absolute w-4 h-4 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400 transform -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${coords.x}px`,
                      top: `${coords.y}px`
                    }}
                  >
                    {minute.toString().padStart(2, '0')}
                  </div>
                );
              })}

              {/* Hour hand */}
              <div
                className="absolute w-1 bg-gray-700 dark:bg-gray-300 origin-bottom transform -translate-x-1/2"
                style={{
                  height: '50px',
                  left: '50%',
                  bottom: '50%',
                  transform: `translateX(-50%) rotate(${getAngle(hours % 12, 12)}deg)`,
                }}
              />

              {/* Minute hand */}
              <div
                className="absolute w-0.5 bg-blue-600 dark:bg-blue-400 origin-bottom transform -translate-x-1/2"
                style={{
                  height: '70px',
                  left: '50%',
                  bottom: '50%',
                  transform: `translateX(-50%) rotate(${getAngle(minutes, 60)}deg)`,
                }}
              />

              {/* Center dot */}
              <div className="absolute w-3 h-3 bg-gray-700 dark:bg-gray-300 rounded-full top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />

              {/* Hour hand dragger */}
              <div
                className="absolute w-8 h-8 bg-gray-700 dark:bg-gray-300 rounded-full cursor-pointer transform -translate-x-1/2 -translate-y-1/2 opacity-80 hover:opacity-100"
                style={{
                  left: `${getClockCoordinates(getAngle(hours % 12, 12), 40).x}px`,
                  top: `${getClockCoordinates(getAngle(hours % 12, 12), 40).y}px`
                }}
                onMouseDown={() => setIsDragging('hours')}
                onTouchStart={() => setIsDragging('hours')}
              />

              {/* Minute hand dragger */}
              <div
                className="absolute w-6 h-6 bg-blue-600 dark:bg-blue-400 rounded-full cursor-pointer transform -translate-x-1/2 -translate-y-1/2 opacity-80 hover:opacity-100"
                style={{
                  left: `${getClockCoordinates(getAngle(minutes, 60), 60).x}px`,
                  top: `${getClockCoordinates(getAngle(minutes, 60), 60).y}px`
                }}
                onMouseDown={() => setIsDragging('minutes')}
                onTouchStart={() => setIsDragging('minutes')}
              />
            </div>
          </div>

          {/* Quick Time Selection */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Quick Select:</div>
            <div className="grid grid-cols-4 gap-1">
              {timeSlots.map((time) => (
                <Button
                  key={time}
                  variant={value === time ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => {
                    const [h, m] = time.split(':').map(Number);
                    setHours(h);
                    setMinutes(m);
                    handleTimeChange(h, m);
                    setIsOpen(false);
                  }}
                >
                  {time}
                </Button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                handleTimeChange(hours, minutes);
                setIsOpen(false);
              }}
              className="flex-1"
            >
              Select
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default TimePicker;
