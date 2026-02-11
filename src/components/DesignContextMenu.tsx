import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Copy, 
  Trash2, 
  MoveUp, 
  MoveDown, 
  FlipHorizontal, 
  FlipVertical,
  RotateCcw,
  Lock,
  Unlock,
  Group,
  Ungroup,
  Eye,
  EyeOff
} from 'lucide-react';

interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  selectedObjects: any[];
  onAction: (action: string) => void;
}

const DesignContextMenu: React.FC<ContextMenuProps> = ({
  isOpen,
  position,
  onClose,
  selectedObjects,
  onAction
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('contextmenu', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('contextmenu', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen || selectedObjects.length === 0) return null;

  const hasSelection = selectedObjects.length > 0;
  const hasMultipleSelection = selectedObjects.length > 1;
  const hasGroup = selectedObjects.some(obj => obj.type === 'group');
  const firstObject = selectedObjects[0];
  const isLocked = firstObject?.lockMovementX || firstObject?.lockMovementY;
  const isVisible = firstObject?.visible !== false;

  const menuItems = [
    {
      label: 'Copy',
      icon: Copy,
      action: 'copy',
      enabled: hasSelection,
      shortcut: 'Ctrl+C'
    },
    {
      label: 'Delete',
      icon: Trash2,
      action: 'delete',
      enabled: hasSelection,
      shortcut: 'Del',
      destructive: true
    },
    { type: 'separator' },
    {
      label: 'Bring to Front',
      icon: MoveUp,
      action: 'bringToFront',
      enabled: hasSelection
    },
    {
      label: 'Send to Back',
      icon: MoveDown,
      action: 'sendToBack',
      enabled: hasSelection
    },
    { type: 'separator' },
    {
      label: 'Flip Horizontal',
      icon: FlipHorizontal,
      action: 'flipHorizontal',
      enabled: hasSelection
    },
    {
      label: 'Flip Vertical',
      icon: FlipVertical,
      action: 'flipVertical',
      enabled: hasSelection
    },
    {
      label: 'Rotate 90°',
      icon: RotateCcw,
      action: 'rotate90',
      enabled: hasSelection
    },
    { type: 'separator' },
    {
      label: hasGroup ? 'Ungroup' : 'Group',
      icon: hasGroup ? Ungroup : Group,
      action: hasGroup ? 'ungroup' : 'group',
      enabled: hasGroup || hasMultipleSelection
    },
    { type: 'separator' },
    {
      label: isLocked ? 'Unlock' : 'Lock',
      icon: isLocked ? Unlock : Lock,
      action: isLocked ? 'unlock' : 'lock',
      enabled: hasSelection
    },
    {
      label: isVisible ? 'Hide' : 'Show',
      icon: isVisible ? EyeOff : Eye,
      action: isVisible ? 'hide' : 'show',
      enabled: hasSelection
    }
  ];

  const handleAction = (action: string) => {
    onAction(action);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px]"
      style={{
        left: Math.min(position.x, window.innerWidth - 200),
        top: Math.min(position.y, window.innerHeight - 300)
      }}
    >
      {menuItems.map((item, index) => {
        if (item.type === 'separator') {
          return <div key={index} className="border-t border-gray-100 my-1" />;
        }

        if (!item.enabled) return null;

        const Icon = item.icon;
        
        return (
          <button
            key={index}
            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-3 transition-colors ${
              item.destructive ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 dark:text-gray-300'
            }`}
            onClick={() => handleAction(item.action)}
            disabled={!item.enabled}
          >
            <Icon className="h-4 w-4" />
            <span className="flex-1">{item.label}</span>
            {item.shortcut && (
              <span className="text-xs text-gray-400">{item.shortcut}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default DesignContextMenu;
