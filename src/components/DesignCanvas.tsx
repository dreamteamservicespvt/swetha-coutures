
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Canvas as FabricCanvas, Circle, Rect, PencilBrush, IText, Point } from 'fabric';
import * as fabric from 'fabric';
import { 
  Palette, 
  Pen, 
  Eraser, 
  Square, 
  Circle as CircleIcon, 
  Undo2, 
  Redo2, 
  Grid3X3, 
  ZoomIn, 
  ZoomOut, 
  Save,
  X,
  Layers,
  Type,
  Minus,
  Hand,
  RotateCcw
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { uploadToCloudinary } from '@/utils/cloudinaryConfig';
import { Slider } from '@/components/ui/slider';

interface DesignCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (imageUrl: string) => void;
  initialImage?: string;
}

const DesignCanvas: React.FC<DesignCanvasProps> = ({
  isOpen,
  onClose,
  onSave,
  initialImage
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [activeTool, setActiveTool] = useState<'pen' | 'eraser' | 'select' | 'rectangle' | 'circle' | 'text' | 'pan'>('pen');
  const [activeColor, setActiveColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(2);
  const [showGrid, setShowGrid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [canvasEmpty, setCanvasEmpty] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);

  const colors = [
    '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', 
    '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#FFC0CB',
    '#FFFFFF', '#808080', '#A52A2A', '#008000', '#000080'
  ];

  const initializeCanvas = useCallback(() => {
    if (!canvasRef.current || !isOpen) return null;

    try {
      const canvas = new FabricCanvas(canvasRef.current, {
        width: 800,
        height: 600,
        backgroundColor: '#ffffff',
        isDrawingMode: false, // Start with drawing disabled
        selection: false, // Disable object selection initially
      });

      // Configure the brush with better settings
      const brush = new PencilBrush(canvas);
      brush.color = activeColor;
      brush.width = brushSize;
      
      canvas.freeDrawingBrush = brush;

      // Set up canvas properties for better drawing experience
      canvas.isDrawingMode = activeTool === 'pen';
      canvas.selection = activeTool === 'select';

      const canvasElement = canvasRef.current;
      if (canvasElement) {
        canvasElement.style.touchAction = 'none';
        canvasElement.style.userSelect = 'none';
        canvasElement.style.cursor = 'crosshair';
      }

      // Enhanced event listeners for better drawing experience
      canvas.on('path:created', (e) => {
        console.log('Path created successfully');
        setCanvasEmpty(false);
        saveState(canvas);
      });

      canvas.on('object:added', (e) => {
        console.log('Object added successfully');
        setCanvasEmpty(false);
      });

      canvas.on('object:removed', () => {
        setCanvasEmpty(canvas.getObjects().length === 0);
      });

      // Force canvas to render
      canvas.renderAll();
      
      console.log('Canvas initialized successfully:', {
        width: canvas.width,
        height: canvas.height,
        isDrawingMode: canvas.isDrawingMode,
        brushColor: canvas.freeDrawingBrush?.color,
        brushWidth: canvas.freeDrawingBrush?.width
      });

      return canvas;
    } catch (error) {
      console.error('Error initializing canvas:', error);
      toast({
        title: "Canvas Error",
        description: "Failed to initialize drawing canvas. Please try refreshing.",
        variant: "destructive"
      });
      return null;
    }
  }, [isOpen, activeColor, brushSize, activeTool]);

  useEffect(() => {
    if (!isOpen) return;

    const canvas = initializeCanvas();
    if (!canvas) return;

    setFabricCanvas(canvas);

    // Load initial image if provided
    if (initialImage) {
      fabric.Image.fromURL(initialImage, {
        crossOrigin: 'anonymous'
      }).then((img) => {
        if (canvas && img) {
          canvas.add(img);
          canvas.renderAll();
          setCanvasEmpty(false);
        }
      }).catch((error) => {
        console.error('Error loading initial image:', error);
      });
    }

    // Save initial state
    setTimeout(() => {
      if (canvas) {
        saveState(canvas);
        toast({
          title: "Canvas Ready!",
          description: "Start drawing with your mouse or touch. Select the pen tool to begin.",
        });
      }
    }, 100);

    return () => {
      if (canvas) {
        canvas.dispose();
      }
    };
  }, [isOpen, initializeCanvas, initialImage]);

  useEffect(() => {
    if (!fabricCanvas) return;

    // Update drawing mode and brush settings
    const isDrawingTool = activeTool === 'pen' || activeTool === 'eraser';
    fabricCanvas.isDrawingMode = isDrawingTool;
    
    if (fabricCanvas.freeDrawingBrush && isDrawingTool) {
      fabricCanvas.freeDrawingBrush.color = activeTool === 'eraser' ? fabricCanvas.backgroundColor as string : activeColor;
      fabricCanvas.freeDrawingBrush.width = brushSize;
    }

    // Update selection mode
    fabricCanvas.selection = activeTool === 'select';

    // Set appropriate cursor styles
    const canvasElement = canvasRef.current;
    if (canvasElement) {
      switch (activeTool) {
        case 'pen':
          canvasElement.style.cursor = 'crosshair';
          fabricCanvas.defaultCursor = 'crosshair';
          break;
        case 'eraser':
          canvasElement.style.cursor = 'crosshair';
          fabricCanvas.defaultCursor = 'crosshair';
          break;
        case 'pan':
          canvasElement.style.cursor = 'grab';
          fabricCanvas.defaultCursor = 'grab';
          fabricCanvas.moveCursor = 'grabbing';
          break;
        case 'select':
          canvasElement.style.cursor = 'default';
          fabricCanvas.defaultCursor = 'default';
          break;
        default:
          canvasElement.style.cursor = 'default';
          fabricCanvas.defaultCursor = 'default';
      }
    }

    // Force render after tool changes
    fabricCanvas.renderAll();

    console.log('Tool updated:', {
      activeTool,
      isDrawingMode: fabricCanvas.isDrawingMode,
      selection: fabricCanvas.selection,
      brushColor: fabricCanvas.freeDrawingBrush?.color,
      brushWidth: fabricCanvas.freeDrawingBrush?.width
    });
  }, [activeTool, activeColor, brushSize, fabricCanvas]);

  const saveState = (canvas: FabricCanvas) => {
    const state = JSON.stringify(canvas.toJSON());
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(state);
      return newHistory.slice(-20); // Keep last 20 states
    });
    setHistoryIndex(prev => Math.min(prev + 1, 19));
  };

  const undo = () => {
    if (historyIndex > 0 && fabricCanvas) {
      const prevState = history[historyIndex - 1];
      fabricCanvas.loadFromJSON(prevState, () => {
        fabricCanvas.renderAll();
        setHistoryIndex(prev => prev - 1);
        setCanvasEmpty(fabricCanvas.getObjects().length === 0);
      });
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1 && fabricCanvas) {
      const nextState = history[historyIndex + 1];
      fabricCanvas.loadFromJSON(nextState, () => {
        fabricCanvas.renderAll();
        setHistoryIndex(prev => prev + 1);
        setCanvasEmpty(fabricCanvas.getObjects().length === 0);
      });
    }
  };

  const addShape = (type: 'rectangle' | 'circle') => {
    if (!fabricCanvas) return;

    if (type === 'rectangle') {
      const rect = new Rect({
        left: 100,
        top: 100,
        fill: 'transparent',
        width: 100,
        height: 80,
        stroke: activeColor,
        strokeWidth: 2
      });
      fabricCanvas.add(rect);
    } else if (type === 'circle') {
      const circle = new Circle({
        left: 100,
        top: 100,
        fill: 'transparent',
        radius: 50,
        stroke: activeColor,
        strokeWidth: 2
      });
      fabricCanvas.add(circle);
    }

    fabricCanvas.renderAll();
    setCanvasEmpty(false);
    saveState(fabricCanvas);
  };

  const addText = () => {
    if (!fabricCanvas) return;

    const text = new IText('Click to edit text', {
      left: 100,
      top: 100,
      fill: activeColor,
      fontSize: 20,
      fontFamily: 'Arial'
    });

    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
    text.enterEditing();
    fabricCanvas.renderAll();
    setCanvasEmpty(false);
    saveState(fabricCanvas);
  };

  const clearCanvas = () => {
    if (!fabricCanvas) return;
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = '#ffffff';
    fabricCanvas.renderAll();
    setCanvasEmpty(true);
    saveState(fabricCanvas);
  };

  const toggleGrid = () => {
    setShowGrid(!showGrid);
    // Grid implementation would go here
  };

  const zoomIn = () => {
    if (!fabricCanvas) return;
    const zoom = fabricCanvas.getZoom();
    fabricCanvas.setZoom(Math.min(zoom * 1.2, 3));
    fabricCanvas.renderAll();
  };

  const zoomOut = () => {
    if (!fabricCanvas) return;
    const zoom = fabricCanvas.getZoom();
    fabricCanvas.setZoom(Math.max(zoom * 0.8, 0.1));
    fabricCanvas.renderAll();
  };

  const resetZoom = () => {
    if (!fabricCanvas) return;
    fabricCanvas.setZoom(1);
    fabricCanvas.absolutePan(new Point(0, 0));
    fabricCanvas.renderAll();
  };

  const handleSave = async () => {
    if (!fabricCanvas || canvasEmpty) return;

    setSaving(true);
    try {
      // Convert canvas to blob
      const dataURL = fabricCanvas.toDataURL({
        format: 'png',
        quality: 0.8,
        multiplier: 1
      });
      
      // Convert dataURL to blob
      const response = await fetch(dataURL);
      const blob = await response.blob();
      
      // Create file from blob
      const file = new File([blob], 'design-sketch.png', { type: 'image/png' });
      
      // Upload to Cloudinary
      const imageUrl = await uploadToCloudinary(file);
      
      onSave(imageUrl);
      onClose();
      
      toast({
        title: "Success",
        description: "Design saved successfully",
      });
    } catch (error) {
      console.error('Error saving design:', error);
      toast({
        title: "Error",
        description: "Failed to save design",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Design Canvas</span>
            <Button variant="outline" size="sm" onClick={handleCancel}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center space-x-4">
            {/* Tools */}
            <div className="flex space-x-1 border rounded-lg p-1 bg-white dark:bg-gray-900">
              <Button
                variant={activeTool === 'select' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTool('select')}
                title="Select Tool"
              >
                Select
              </Button>
              <Button
                variant={activeTool === 'pen' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTool('pen')}
                title="Pen Tool"
              >
                <Pen className="h-4 w-4" />
              </Button>
              <Button
                variant={activeTool === 'eraser' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTool('eraser')}
                title="Eraser Tool"
              >
                <Eraser className="h-4 w-4" />
              </Button>
              <Button
                variant={activeTool === 'pan' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTool('pan')}
                title="Pan Tool"
              >
                <Hand className="h-4 w-4" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-8" />

            {/* Shapes */}
            <div className="flex space-x-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => addShape('rectangle')}
                title="Add Rectangle"
              >
                <Square className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => addShape('circle')}
                title="Add Circle"
              >
                <CircleIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={addText}
                title="Add Text"
              >
                <Type className="h-4 w-4" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-8" />

            {/* Colors */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Color:</span>
              <div className="flex space-x-1">
                {colors.map(color => (
                  <button
                    key={color}
                    className={`w-6 h-6 rounded border-2 ${
                      activeColor === color ? 'border-gray-800' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setActiveColor(color)}
                    title={`Select ${color}`}
                  />
                ))}
                <input
                  type="color"
                  value={activeColor}
                  onChange={(e) => setActiveColor(e.target.value)}
                  className="w-6 h-6 rounded border cursor-pointer"
                  title="Custom Color"
                />
              </div>
            </div>

            <Separator orientation="vertical" className="h-8" />

            {/* Brush Size */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Size:</span>
              <div className="w-20">
                <Slider
                  value={[brushSize]}
                  onValueChange={(value) => setBrushSize(value[0])}
                  max={50}
                  min={1}
                  step={1}
                />
              </div>
              <span className="text-sm w-6">{brushSize}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* History */}
            <Button
              variant="outline"
              size="sm"
              onClick={undo}
              disabled={historyIndex <= 0}
              title="Undo"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              title="Redo"
            >
              <Redo2 className="h-4 w-4" />
            </Button>

            <Separator orientation="vertical" className="h-8" />

            {/* View Controls */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleGrid}
              title="Toggle Grid"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={zoomIn}
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={zoomOut}
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={resetZoom}
              title="Reset Zoom"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>

            <Separator orientation="vertical" className="h-8" />

            {/* Clear */}
            <Button
              variant="outline"
              size="sm"
              onClick={clearCanvas}
              title="Clear Canvas"
            >
              <Minus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 flex justify-center items-center bg-gray-50 p-4 min-h-[600px]">
          <div className="border border-gray-300 shadow-lg bg-white dark:bg-gray-900">
            <canvas 
              ref={canvasRef}
              style={{ 
                touchAction: 'none', // Prevent default touch behaviors
                pointerEvents: 'auto' // Ensure pointer events work
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-4 border-t bg-gray-50 dark:bg-gray-800/50">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {canvasEmpty ? 'Canvas is empty - draw something first' : 'Ready to save'}
          </div>
          <div className="flex space-x-3">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || canvasEmpty}
              className="bg-gradient-to-r from-blue-600 to-purple-600"
              title={canvasEmpty ? "Draw something first" : "Save Design"}
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Design'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DesignCanvas;
