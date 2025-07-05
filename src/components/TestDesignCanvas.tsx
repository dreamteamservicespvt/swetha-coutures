import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Canvas as FabricCanvas, Circle, Rect, Line, Textbox, PencilBrush } from 'fabric';
import { 
  MousePointer2, 
  Square, 
  Circle as CircleIcon, 
  Minus, 
  Type, 
  Pen,
  Save,
  Trash2
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface TestDesignCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (imageUrl: string) => void;
}

const TestDesignCanvas: React.FC<TestDesignCanvasProps> = ({
  isOpen,
  onClose,
  onSave
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [activeTool, setActiveTool] = useState<'select' | 'pencil' | 'rectangle' | 'circle' | 'line' | 'text'>('select');

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    try {
      const canvas = new FabricCanvas(canvasRef.current, {
        width: 800,
        height: 600,
        backgroundColor: '#ffffff',
      });

      // Set up pencil brush
      const brush = new PencilBrush(canvas);
      brush.color = '#000000';
      brush.width = 2;
      canvas.freeDrawingBrush = brush;

      setFabricCanvas(canvas);

      return () => {
        canvas.dispose();
      };
    } catch (error) {
      console.error('Error initializing canvas:', error);
      toast({
        title: "Canvas Error",
        description: "Failed to initialize design canvas.",
        variant: "destructive"
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!fabricCanvas) return;

    fabricCanvas.isDrawingMode = activeTool === 'pencil';
    fabricCanvas.selection = activeTool === 'select';
  }, [activeTool, fabricCanvas]);

  const addRectangle = () => {
    if (!fabricCanvas) return;
    const rect = new Rect({
      left: 100,
      top: 100,
      width: 100,
      height: 100,
      fill: 'transparent',
      stroke: '#000000',
      strokeWidth: 2
    });
    fabricCanvas.add(rect);
    fabricCanvas.renderAll();
  };

  const addCircle = () => {
    if (!fabricCanvas) return;
    const circle = new Circle({
      left: 100,
      top: 100,
      radius: 50,
      fill: 'transparent',
      stroke: '#000000',
      strokeWidth: 2
    });
    fabricCanvas.add(circle);
    fabricCanvas.renderAll();
  };

  const addText = () => {
    if (!fabricCanvas) return;
    const text = new Textbox('Click to edit', {
      left: 100,
      top: 100,
      fontSize: 20,
      fill: '#000000'
    });
    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
    fabricCanvas.renderAll();
  };

  const clearCanvas = () => {
    if (!fabricCanvas) return;
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = '#ffffff';
    fabricCanvas.renderAll();
  };

  const saveDesign = () => {
    if (!fabricCanvas) return;
    
    const dataURL = fabricCanvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 1
    });
    
    onSave(dataURL);
    toast({
      title: "Design Saved",
      description: "Your design has been saved successfully.",
    });
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Test Design Canvas</DialogTitle>
        </DialogHeader>

        <div className="flex h-[80vh]">
          {/* Toolbar */}
          <div className="w-16 bg-gray-50 border-r flex flex-col items-center py-4 gap-2">
            <Button
              variant={activeTool === 'select' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTool('select')}
              className="w-10 h-10 p-0"
            >
              <MousePointer2 className="h-4 w-4" />
            </Button>
            
            <Button
              variant={activeTool === 'pencil' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTool('pencil')}
              className="w-10 h-10 p-0"
            >
              <Pen className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={addRectangle}
              className="w-10 h-10 p-0"
            >
              <Square className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={addCircle}
              className="w-10 h-10 p-0"
            >
              <CircleIcon className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={addText}
              className="w-10 h-10 p-0"
            >
              <Type className="h-4 w-4" />
            </Button>

            <div className="mt-4 flex flex-col gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={saveDesign}
                className="w-10 h-10 p-0"
              >
                <Save className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCanvas}
                className="w-10 h-10 p-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Canvas Area */}
          <div className="flex-1 overflow-auto bg-gray-100 p-4">
            <div className="flex justify-center items-center min-h-full">
              <div className="bg-white shadow-lg rounded-lg p-4">
                <canvas
                  ref={canvasRef}
                  className="border border-gray-300 rounded"
                />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TestDesignCanvas;
