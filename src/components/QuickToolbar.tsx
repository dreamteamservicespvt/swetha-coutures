import React from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  MousePointer2, 
  Square, 
  Circle, 
  Minus, 
  ArrowRight,
  Type, 
  Image,
  Undo2,
  Redo2,
  Copy,
  Trash2,
  Save,
  Download,
  Grid3X3,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react';

interface QuickToolbarProps {
  activeTool: string;
  onToolChange: (tool: string) => void;
  onAction: (action: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  zoom: number;
  showGrid: boolean;
  saving: boolean;
}

const QuickToolbar: React.FC<QuickToolbarProps> = ({
  activeTool,
  onToolChange,
  onAction,
  canUndo,
  canRedo,
  hasSelection,
  zoom,
  showGrid,
  saving
}) => {
  const tools = [
    { id: 'select', icon: MousePointer2, label: 'Select' },
    { id: 'rectangle', icon: Square, label: 'Rectangle' },
    { id: 'circle', icon: Circle, label: 'Circle' },
    { id: 'line', icon: Minus, label: 'Line' },
    { id: 'arrow', icon: ArrowRight, label: 'Arrow' },
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'image', icon: Image, label: 'Image' }
  ];

  const actions = [
    { id: 'undo', icon: Undo2, label: 'Undo', enabled: canUndo, shortcut: 'Ctrl+Z' },
    { id: 'redo', icon: Redo2, label: 'Redo', enabled: canRedo, shortcut: 'Ctrl+Y' },
    { id: 'copy', icon: Copy, label: 'Copy', enabled: hasSelection, shortcut: 'Ctrl+C' },
    { id: 'delete', icon: Trash2, label: 'Delete', enabled: hasSelection, shortcut: 'Del' }
  ];

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2">
      <div className="flex items-center gap-2">
        {/* Tools */}
        <div className="flex items-center gap-1">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Button
                key={tool.id}
                variant={activeTool === tool.id ? 'default' : 'ghost'}
                size="sm"
                onClick={() => tool.id === 'image' ? onAction('uploadImage') : onToolChange(tool.id)}
                className="w-9 h-9 p-0"
                title={`${tool.label} ${tool.id === 'select' ? '(V)' : tool.id === 'rectangle' ? '(R)' : tool.id === 'circle' ? '(C)' : tool.id === 'text' ? '(T)' : ''}`}
              >
                <Icon className="h-4 w-4" />
              </Button>
            );
          })}
        </div>

        <Separator orientation="vertical" className="h-6 mx-2" />

        {/* Actions */}
        <div className="flex items-center gap-1">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.id}
                variant="ghost"
                size="sm"
                onClick={() => onAction(action.id)}
                disabled={!action.enabled}
                className="w-9 h-9 p-0"
                title={`${action.label} (${action.shortcut})`}
              >
                <Icon className="h-4 w-4" />
              </Button>
            );
          })}
        </div>

        <Separator orientation="vertical" className="h-6 mx-2" />

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAction('zoomOut')}
            className="w-9 h-9 p-0"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          
          <span className="text-sm font-mono w-16 text-center">
            {Math.round(zoom)}%
          </span>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAction('zoomIn')}
            className="w-9 h-9 p-0"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAction('resetZoom')}
            className="px-2 h-9 text-xs"
            title="Reset Zoom"
          >
            Fit
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6 mx-2" />

        {/* Canvas Options */}
        <Button
          variant={showGrid ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onAction('toggleGrid')}
          className="w-9 h-9 p-0"
          title="Toggle Grid"
        >
          <Grid3X3 className="h-4 w-4" />
        </Button>

        {/* Right side actions */}
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAction('exportPNG')}
            className="h-9"
            title="Export as PNG"
          >
            <Download className="h-4 w-4 mr-1" />
            PNG
          </Button>
          
          <Button
            onClick={() => onAction('save')}
            disabled={saving}
            className="h-9 bg-blue-600 hover:bg-blue-700"
            title="Save Design (Ctrl+S)"
          >
            <Save className="h-4 w-4 mr-1" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QuickToolbar;
