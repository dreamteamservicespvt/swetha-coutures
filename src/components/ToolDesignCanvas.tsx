import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Canvas as FabricCanvas, Circle, Rect, Line, Textbox, Image as FabricImage, Group, PencilBrush } from 'fabric';
import * as fabric from 'fabric';
import { 
  MousePointer2, 
  Square, 
  Circle as CircleIcon, 
  Minus, 
  ArrowRight,
  Type, 
  Image as ImageIcon,
  Undo2, 
  Redo2, 
  Copy, 
  Trash2,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  MoveUp,
  MoveDown,
  Grid3X3,
  ZoomIn,
  ZoomOut,
  Download,
  Save,
  Palette,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Group as GroupIcon,
  Ungroup,
  AlignLeft,
  AlignCenter,
  AlignRight,
  FileType,
  Printer,
  X,
  Pen
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { uploadToCloudinary } from '@/utils/cloudinaryConfig';
import jsPDF from 'jspdf';

interface ToolDesignCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (imageUrl: string) => void;
  orderId?: string;
  itemIndex?: number;
  initialDesignData?: any;
}

interface CanvasHistory {
  state: string;
  timestamp: number;
}

const ToolDesignCanvas: React.FC<ToolDesignCanvasProps> = ({
  isOpen,
  onClose,
  onSave,
  orderId,
  itemIndex = 0,
  initialDesignData
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  
  // Tool states
  const [activeTool, setActiveTool] = useState<'select' | 'pencil' | 'rectangle' | 'circle' | 'line' | 'arrow' | 'text' | 'image'>('select');
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentShape, setCurrentShape] = useState<fabric.Object | null>(null);
  
  // Style states
  const [fillColor, setFillColor] = useState('#3b82f6');
  const [strokeColor, setStrokeColor] = useState('#1f2937');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [opacity, setOpacity] = useState(100);
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [fontWeight, setFontWeight] = useState('normal');
  
  // Canvas states
  const [zoom, setZoom] = useState(100);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(20);
  
  // History management
  const [history, setHistory] = useState<CanvasHistory[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [saving, setSaving] = useState(false);
  
  // Selected object states
  const [selectedObject, setSelectedObject] = useState<fabric.Object | null>(null);
  const [selectedObjects, setSelectedObjects] = useState<fabric.Object[]>([]);

  // Color palettes
  const colors = [
    '#000000', '#ffffff', '#f3f4f6', '#9ca3af', '#6b7280', '#374151', '#1f2937',
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981',
    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e', '#dc2626', '#ea580c', '#d97706', '#ca8a04', '#65a30d'
  ];

  const fonts = [
    'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana', 
    'Georgia', 'Comic Sans MS', 'Impact', 'Lucida Console', 'Tahoma'
  ];

  // Initialize canvas with proper error handling
  const initializeCanvas = useCallback(() => {
    if (!canvasRef.current || !isOpen) return null;

    try {
      // Clear any existing canvas
      if (fabricCanvas) {
        fabricCanvas.dispose();
      }

      const canvas = new FabricCanvas(canvasRef.current, {
        width: 800,
        height: 600,
        backgroundColor: '#ffffff',
        selection: true,
        preserveObjectStacking: true,
        imageSmoothingEnabled: true,
        enableRetinaScaling: true,
      });

      // Configure canvas for professional design
      canvas.isDrawingMode = false;
      canvas.selectionColor = 'rgba(59, 130, 246, 0.1)';
      canvas.selectionBorderColor = '#3b82f6';
      canvas.selectionLineWidth = 2;

      // Set up the pencil brush
      const brush = new PencilBrush(canvas);
      brush.color = strokeColor;
      brush.width = strokeWidth;
      canvas.freeDrawingBrush = brush;

      // Add grid background
      if (showGrid) {
        addGridToCanvas(canvas);
      }

      // Event handlers with proper error checking
      canvas.on('selection:created', (e) => {
        try {
          const activeObjects = canvas.getActiveObjects();
          setSelectedObjects(activeObjects);
          setSelectedObject(activeObjects[0] || null);
          if (activeObjects[0]) {
            updateStyleFromSelection(activeObjects[0]);
          }
        } catch (error) {
          console.error('Error in selection:created:', error);
        }
      });

      canvas.on('selection:updated', (e) => {
        try {
          const activeObjects = canvas.getActiveObjects();
          setSelectedObjects(activeObjects);
          setSelectedObject(activeObjects[0] || null);
          if (activeObjects[0]) {
            updateStyleFromSelection(activeObjects[0]);
          }
        } catch (error) {
          console.error('Error in selection:updated:', error);
        }
      });

      canvas.on('selection:cleared', () => {
        try {
          setSelectedObjects([]);
          setSelectedObject(null);
        } catch (error) {
          console.error('Error in selection:cleared:', error);
        }
      });

      // Make objects interactive and selectable
      canvas.on('object:added', (e) => {
        try {
          const obj = e.target;
          if (obj && !(obj as any).isGrid) {
            obj.set({
              selectable: true,
              evented: true,
              hasControls: true,
              hasBorders: true,
              borderColor: '#3b82f6',
              cornerColor: '#3b82f6',
              cornerSize: 8,
              transparentCorners: false,
              borderScaleFactor: 2,
              cornerStyle: 'circle',
              padding: 5
            });
            
            // Enhanced hover effects
            obj.on('mouseover', () => {
              if (activeTool === 'select' && !canvas.isDrawingMode) {
                obj.set({
                  borderColor: '#1d4ed8',
                  cornerColor: '#1d4ed8'
                });
                canvas.renderAll();
              }
            });
            
            obj.on('mouseout', () => {
              if (activeTool === 'select' && !canvas.isDrawingMode) {
                obj.set({
                  borderColor: '#3b82f6',
                  cornerColor: '#3b82f6'
                });
                canvas.renderAll();
              }
            });
            
            // Enhanced double-click behavior
            obj.on('mousedblclick', () => {
              if (obj.type === 'textbox') {
                (obj as Textbox).enterEditing();
              }
            });
          }
        } catch (error) {
          console.error('Error in object:added:', error);
        }
      });

      // Save state after modifications
      canvas.on('object:modified', () => {
        try {
          saveCanvasState(canvas);
        } catch (error) {
          console.error('Error saving canvas state:', error);
        }
      });

      // Save state after path creation (pencil drawing)
      canvas.on('path:created', () => {
        try {
          saveCanvasState(canvas);
        } catch (error) {
          console.error('Error saving canvas state after path creation:', error);
        }
      });

      // Drawing event handlers
      let isDown = false;
      let origX = 0;
      let origY = 0;
      let shape: fabric.Object | null = null;

      canvas.on('mouse:down', (options) => {
        try {
          const e = options.e;
          if (!e) return;
          
          // Handle right-click for context menu
          if ((e as MouseEvent).button === 2) {
            e.preventDefault();
            return false;
          }

          // Handle pencil tool separately
          if (activeTool === 'pencil') {
            // Pencil tool is handled by fabric.js drawing mode
            return;
          }

          // Handle selection tool
          if (activeTool === 'select') {
            // Let fabric.js handle selection naturally
            return;
          }
          
          const target = options.target;
          
          // Don't start drawing if clicking on an existing object (unless it's a grid line)
          if (target && !(target as any).isGrid) {
            // If we're in a drawing tool and clicking on an object, don't start drawing
            return;
          }

          const pointer = canvas.getPointer(options.e);
          if (!pointer) return;

          isDown = true;
          origX = snapToGrid ? Math.round(pointer.x / gridSize) * gridSize : pointer.x;
          origY = snapToGrid ? Math.round(pointer.y / gridSize) * gridSize : pointer.y;

          setIsDrawing(true);
          
          // Create shape based on active tool
          switch (activeTool) {
            case 'rectangle':
              shape = new Rect({
                left: origX,
                top: origY,
                width: 1,
                height: 1,
                fill: fillColor,
                stroke: strokeColor,
                strokeWidth: strokeWidth,
                opacity: opacity / 100,
                rx: 0,
                ry: 0
              });
              canvas.add(shape);
              break;
              
            case 'circle':
              shape = new Circle({
                left: origX,
                top: origY,
                radius: 1,
                fill: fillColor,
                stroke: strokeColor,
                strokeWidth: strokeWidth,
                opacity: opacity / 100,
                originX: 'center',
                originY: 'center'
              });
              canvas.add(shape);
              break;
              
            case 'line':
              shape = new Line([origX, origY, origX, origY], {
                stroke: strokeColor,
                strokeWidth: strokeWidth,
                opacity: opacity / 100,
                strokeLineCap: 'round'
              });
              canvas.add(shape);
              break;
              
            case 'arrow':
              shape = createArrow(origX, origY, origX, origY);
              if (shape) canvas.add(shape);
              break;
              
            case 'text':
              const textShape = new Textbox('Click to edit text', {
                left: origX,
                top: origY,
                fontFamily: fontFamily,
                fontSize: fontSize,
                fontWeight: fontWeight,
                fill: fillColor,
                opacity: opacity / 100,
                editable: true,
                width: 200,
                splitByGrapheme: false,
                textAlign: 'left'
              });
              canvas.add(textShape);
              canvas.setActiveObject(textShape);
              
              // Start editing mode for text immediately
              setTimeout(() => {
                if (textShape && textShape.type === 'textbox') {
                  (textShape as Textbox).enterEditing();
                  (textShape as Textbox).selectAll();
                }
              }, 100);
              
              isDown = false;
              setIsDrawing(false);
              saveCanvasState(canvas);
              return;
          }

          canvas.renderAll();
        } catch (error) {
          console.error('Error in mouse:down drawing logic:', error);
          setIsDrawing(false);
          isDown = false;
        }
      });

      canvas.on('mouse:move', (options) => {
        try {
          if (!isDown || !shape || activeTool === 'select' || activeTool === 'pencil') return;

          const pointer = canvas.getPointer(options.e);
          if (!pointer) return;

          let currentX = snapToGrid ? Math.round(pointer.x / gridSize) * gridSize : pointer.x;
          let currentY = snapToGrid ? Math.round(pointer.y / gridSize) * gridSize : pointer.y;

          switch (activeTool) {
            case 'rectangle':
              const rect = shape as Rect;
              const width = Math.abs(currentX - origX);
              const height = Math.abs(currentY - origY);
              const left = Math.min(origX, currentX);
              const top = Math.min(origY, currentY);
              
              rect.set({ width, height, left, top });
              break;
              
            case 'circle':
              const circle = shape as Circle;
              const deltaX = currentX - origX;
              const deltaY = currentY - origY;
              const radius = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / 2;
              
              // Calculate center position for the circle
              const centerX = (origX + currentX) / 2;
              const centerY = (origY + currentY) / 2;
              
              circle.set({
                radius: Math.max(radius, 1),
                left: centerX,
                top: centerY
              });
              break;
              
            case 'line':
              const line = shape as Line;
              line.set({
                x2: currentX,
                y2: currentY
              });
              break;
              
            case 'arrow':
              if (canvas) {
                canvas.remove(shape);
                const newArrow = createArrow(origX, origY, currentX, currentY);
                if (newArrow) {
                  canvas.add(newArrow);
                  shape = newArrow;
                }
              }
              break;
          }

          canvas.renderAll();
        } catch (error) {
          console.error('Error in mouse:move:', error);
        }
      });

      canvas.on('mouse:up', () => {
        try {
          if (isDown && shape) {
            isDown = false;
            setIsDrawing(false);
            canvas.setActiveObject(shape);
            saveCanvasState(canvas);
            shape = null;
          }
        } catch (error) {
          console.error('Error in mouse:up:', error);
          setIsDrawing(false);
          isDown = false;
        }
      });

      // Load initial design data if provided
      if (initialDesignData) {
        loadCanvasState(canvas, initialDesignData);
      } else {
        saveCanvasState(canvas);
      }

      return canvas;
    } catch (error) {
      console.error('Error initializing canvas:', error);
      toast({
        title: "Canvas Error",
        description: "Failed to initialize design canvas. Please try refreshing.",
        variant: "destructive"
      });
      return null;
    }
  }, [isOpen, activeTool, fillColor, strokeColor, strokeWidth, opacity, fontSize, fontFamily, fontWeight, showGrid, snapToGrid, gridSize, initialDesignData]);

  // Helper function to create arrow
  const createArrow = (x1: number, y1: number, x2: number, y2: number) => {
    try {
      const line = new Line([x1, y1, x2, y2], {
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        opacity: opacity / 100,
        strokeLineCap: 'round'
      });

      // Create arrowhead
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const headLength = 15;
      const headAngle = Math.PI / 6;

      const arrowHead1 = new Line([
        x2,
        y2,
        x2 - headLength * Math.cos(angle - headAngle),
        y2 - headLength * Math.sin(angle - headAngle)
      ], {
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        opacity: opacity / 100,
        strokeLineCap: 'round'
      });

      const arrowHead2 = new Line([
        x2,
        y2,
        x2 - headLength * Math.cos(angle + headAngle),
        y2 - headLength * Math.sin(angle + headAngle)
      ], {
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        opacity: opacity / 100,
        strokeLineCap: 'round'
      });

      const arrowGroup = new Group([line, arrowHead1, arrowHead2], {
        left: Math.min(x1, x2) - headLength,
        top: Math.min(y1, y2) - headLength
      });

      return arrowGroup;
    } catch (error) {
      console.error('Error creating arrow:', error);
      return new Line([x1, y1, x2, y2], {
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        opacity: opacity / 100,
        strokeLineCap: 'round'
      });
    }
  };

  // Helper function to update arrow - removed since we recreate arrows
  // const updateArrow = (arrow: fabric.Object, x1: number, y1: number, x2: number, y2: number) => {
  //   // This function is no longer needed as we recreate arrows in mouse:move
  // };

  // Helper function to add grid
  const addGridToCanvas = (canvas: FabricCanvas) => {
    try {
      const canvasWidth = canvas.width!;
      const canvasHeight = canvas.height!;

      // Remove existing grid lines
      const objects = canvas.getObjects().filter(obj => (obj as any).isGrid);
      objects.forEach(obj => canvas.remove(obj));

      // Add vertical lines
      for (let i = 0; i <= canvasWidth / gridSize; i++) {
        const line = new Line([i * gridSize, 0, i * gridSize, canvasHeight], {
          stroke: '#e5e7eb',
          strokeWidth: 1,
          selectable: false,
          evented: false,
          excludeFromExport: true
        });
        (line as any).isGrid = true;
        canvas.add(line);
        canvas.sendObjectToBack(line);
      }

      // Add horizontal lines
      for (let i = 0; i <= canvasHeight / gridSize; i++) {
        const line = new Line([0, i * gridSize, canvasWidth, i * gridSize], {
          stroke: '#e5e7eb',
          strokeWidth: 1,
          selectable: false,
          evented: false,
          excludeFromExport: true
        });
        (line as any).isGrid = true;
        canvas.add(line);
        canvas.sendObjectToBack(line);
      }
      
      canvas.renderAll();
    } catch (error) {
      console.error('Error adding grid to canvas:', error);
    }
  };

  // Update style controls from selected object
  const updateStyleFromSelection = (obj: fabric.Object | null) => {
    try {
      if (!obj) return;

      // Update fill color
      if (obj.fill && typeof obj.fill === 'string') {
        setFillColor(obj.fill);
      }
      
      // Update stroke color - handle groups (arrows) specially
      if (obj.type === 'group') {
        const group = obj as Group;
        const firstObject = group.getObjects()[0];
        if (firstObject && firstObject.stroke && typeof firstObject.stroke === 'string') {
          setStrokeColor(firstObject.stroke);
        }
        if (firstObject && firstObject.strokeWidth) {
          setStrokeWidth(firstObject.strokeWidth);
        }
      } else if (obj.stroke && typeof obj.stroke === 'string') {
        setStrokeColor(obj.stroke);
      }
      
      // Update stroke width
      if (obj.strokeWidth) {
        setStrokeWidth(obj.strokeWidth);
      }
      
      // Update opacity
      if (obj.opacity !== undefined) {
        setOpacity(Math.round(obj.opacity * 100));
      }
      
      // Update text properties
      if (obj.type === 'textbox' || obj.type === 'text') {
        const textObj = obj as Textbox;
        if (textObj.fontSize) setFontSize(textObj.fontSize);
        if (textObj.fontFamily) setFontFamily(textObj.fontFamily);
        if (textObj.fontWeight) setFontWeight(String(textObj.fontWeight));
      }
    } catch (error) {
      console.error('Error updating style from selection:', error);
    }
  };

  // Save canvas state for undo/redo
  const saveCanvasState = (canvas: FabricCanvas) => {
    try {
      const state = JSON.stringify(canvas.toJSON());
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push({ state, timestamp: Date.now() });
      
      // Limit history to 50 states
      if (newHistory.length > 50) {
        newHistory.shift();
      } else {
        setHistoryIndex(prev => prev + 1);
      }
      
      setHistory(newHistory);
    } catch (error) {
      console.error('Error saving canvas state:', error);
    }
  };

  // Load canvas state
  const loadCanvasState = (canvas: FabricCanvas, stateData: any) => {
    try {
      if (typeof stateData === 'string') {
        canvas.loadFromJSON(stateData, () => {
          canvas.renderAll();
        });
      } else {
        canvas.loadFromJSON(JSON.stringify(stateData), () => {
          canvas.renderAll();
        });
      }
    } catch (error) {
      console.error('Error loading canvas state:', error);
    }
  };

  // Undo functionality
  const undo = () => {
    if (!fabricCanvas || historyIndex <= 0) return;
    
    const prevIndex = historyIndex - 1;
    const prevState = history[prevIndex];
    
    loadCanvasState(fabricCanvas, prevState.state);
    setHistoryIndex(prevIndex);
    
    toast({
      title: "Undo",
      description: "Last action undone.",
      duration: 1000,
    });
  };

  // Redo functionality
  const redo = () => {
    if (!fabricCanvas || historyIndex >= history.length - 1) return;
    
    const nextIndex = historyIndex + 1;
    const nextState = history[nextIndex];
    
    loadCanvasState(fabricCanvas, nextState.state);
    setHistoryIndex(nextIndex);
    
    toast({
      title: "Redo",
      description: "Action redone.",
      duration: 1000,
    });
  };

  // Delete selected objects
  const deleteSelected = () => {
    if (!fabricCanvas) return;
    
    const activeObjects = fabricCanvas.getActiveObjects();
    if (activeObjects.length === 0) return;
    
    const count = activeObjects.length;
    activeObjects.forEach(obj => {
      fabricCanvas.remove(obj);
    });
    fabricCanvas.discardActiveObject();
    fabricCanvas.renderAll();
    saveCanvasState(fabricCanvas);
    
    toast({
      title: "Objects Deleted",
      description: `${count} object(s) deleted successfully.`,
      duration: 1500,
    });
  };

  // Copy selected objects
  const copySelected = () => {
    if (!fabricCanvas) return;
    
    const activeObjects = fabricCanvas.getActiveObjects();
    if (activeObjects.length === 0) return;

    const promises = activeObjects.map(obj => {
      return new Promise<fabric.Object>((resolve) => {
        obj.clone().then((cloned: fabric.Object) => {
          cloned.set({
            left: (obj.left || 0) + 20,
            top: (obj.top || 0) + 20
          });
          resolve(cloned);
        });
      });
    });

    Promise.all(promises).then((clonedObjects) => {
      clonedObjects.forEach(cloned => {
        fabricCanvas.add(cloned);
      });
      
      // Select the new objects
      if (clonedObjects.length === 1) {
        fabricCanvas.setActiveObject(clonedObjects[0]);
      } else {
        const selection = new fabric.ActiveSelection(clonedObjects, {
          canvas: fabricCanvas,
        });
        fabricCanvas.setActiveObject(selection);
      }
      
      fabricCanvas.renderAll();
      saveCanvasState(fabricCanvas);
      
      toast({
        title: "Objects Copied",
        description: `${clonedObjects.length} object(s) copied successfully.`,
        duration: 1500,
      });
    });
  };

  // Professional canvas features
  const bringToFront = () => {
    if (!fabricCanvas || !selectedObject) return;
    fabricCanvas.bringObjectToFront(selectedObject);
    fabricCanvas.renderAll();
    saveCanvasState(fabricCanvas);
    toast({
      title: "Layer Changed",
      description: "Object brought to front.",
      duration: 1500,
    });
  };

  const sendToBack = () => {
    if (!fabricCanvas || !selectedObject) return;
    fabricCanvas.sendObjectToBack(selectedObject);
    fabricCanvas.renderAll();
    saveCanvasState(fabricCanvas);
    toast({
      title: "Layer Changed",
      description: "Object sent to back.",
      duration: 1500,
    });
  };

  const bringForward = () => {
    if (!fabricCanvas || !selectedObject) return;
    fabricCanvas.bringObjectForward(selectedObject);
    fabricCanvas.renderAll();
    saveCanvasState(fabricCanvas);
    toast({
      title: "Layer Changed",
      description: "Object brought forward.",
      duration: 1500,
    });
  };

  const sendBackward = () => {
    if (!fabricCanvas || !selectedObject) return;
    fabricCanvas.sendObjectBackwards(selectedObject);
    fabricCanvas.renderAll();
    saveCanvasState(fabricCanvas);
    toast({
      title: "Layer Changed",
      description: "Object sent backward.",
      duration: 1500,
    });
  };

  const duplicateSelected = () => {
    if (!fabricCanvas) return;
    
    const activeObjects = fabricCanvas.getActiveObjects();
    if (activeObjects.length === 0) return;

    const promises = activeObjects.map(obj => {
      return new Promise<fabric.Object>((resolve) => {
        obj.clone().then((cloned: fabric.Object) => {
          cloned.set({
            left: (obj.left || 0) + 20,
            top: (obj.top || 0) + 20,
          });
          resolve(cloned);
        });
      });
    });

    Promise.all(promises).then((clonedObjects) => {
      clonedObjects.forEach(cloned => {
        fabricCanvas.add(cloned);
      });
      
      // Select the duplicated objects
      if (clonedObjects.length === 1) {
        fabricCanvas.setActiveObject(clonedObjects[0]);
      } else {
        const selection = new fabric.ActiveSelection(clonedObjects, {
          canvas: fabricCanvas,
        });
        fabricCanvas.setActiveObject(selection);
      }
      
      fabricCanvas.renderAll();
      saveCanvasState(fabricCanvas);
    });
  };

  const lockSelected = () => {
    if (!fabricCanvas || !selectedObject) return;
    
    selectedObject.set({
      selectable: false,
      evented: false,
      lockMovementX: true,
      lockMovementY: true,
      lockRotation: true,
      lockScalingX: true,
      lockScalingY: true,
    });
    fabricCanvas.discardActiveObject();
    fabricCanvas.renderAll();
    saveCanvasState(fabricCanvas);
  };

  const unlockAll = () => {
    if (!fabricCanvas) return;
    
    fabricCanvas.getObjects().forEach(obj => {
      if (!(obj as any).isGrid) {
        obj.set({
          selectable: true,
          evented: true,
          lockMovementX: false,
          lockMovementY: false,
          lockRotation: false,
          lockScalingX: false,
          lockScalingY: false,
        });
      }
    });
    fabricCanvas.renderAll();
    saveCanvasState(fabricCanvas);
  };

  // Flip objects
  const flipHorizontal = () => {
    if (!fabricCanvas || !selectedObject) return;
    selectedObject.set('flipX', !selectedObject.flipX);
    fabricCanvas.renderAll();
    saveCanvasState(fabricCanvas);
  };

  const flipVertical = () => {
    if (!fabricCanvas || !selectedObject) return;
    selectedObject.set('flipY', !selectedObject.flipY);
    fabricCanvas.renderAll();
    saveCanvasState(fabricCanvas);
  };

  // Group/ungroup objects
  const groupObjects = () => {
    if (!fabricCanvas || selectedObjects.length < 2) return;
    
    const group = new fabric.Group(selectedObjects);
    selectedObjects.forEach(obj => fabricCanvas.remove(obj));
    fabricCanvas.add(group);
    fabricCanvas.setActiveObject(group);
    fabricCanvas.renderAll();
    saveCanvasState(fabricCanvas);
  };

  const ungroupObjects = () => {
    if (!fabricCanvas || !selectedObject || selectedObject.type !== 'group') return;
    
    const group = selectedObject as fabric.Group;
    const objects = group.getObjects();
    fabricCanvas.remove(group);
    
    objects.forEach(obj => {
      const newObj = obj;
      fabricCanvas.add(newObj);
    });
    
    fabricCanvas.renderAll();
    saveCanvasState(fabricCanvas);
  };

  // Alignment functions
  const alignLeft = () => {
    if (!fabricCanvas || selectedObjects.length < 2) return;
    
    const leftmost = Math.min(...selectedObjects.map(obj => obj.left || 0));
    selectedObjects.forEach(obj => {
      obj.set('left', leftmost);
    });
    fabricCanvas.renderAll();
    saveCanvasState(fabricCanvas);
  };

  const alignCenter = () => {
    if (!fabricCanvas || selectedObjects.length < 2) return;
    
    const canvasCenter = (fabricCanvas.width || 0) / 2;
    selectedObjects.forEach(obj => {
      obj.set('left', canvasCenter - (obj.width || 0) / 2);
    });
    fabricCanvas.renderAll();
    saveCanvasState(fabricCanvas);
  };

  const alignRight = () => {
    if (!fabricCanvas || selectedObjects.length < 2) return;
    
    const rightmost = Math.max(...selectedObjects.map(obj => (obj.left || 0) + (obj.width || 0)));
    selectedObjects.forEach(obj => {
      obj.set('left', rightmost - (obj.width || 0));
    });
    fabricCanvas.renderAll();
    saveCanvasState(fabricCanvas);
  };

  // Zoom functions
  const zoomIn = () => {
    if (!fabricCanvas) return;
    const newZoom = Math.min(zoom * 1.2, 300);
    setZoom(newZoom);
    fabricCanvas.setZoom(newZoom / 100);
    fabricCanvas.renderAll();
  };

  const zoomOut = () => {
    if (!fabricCanvas) return;
    const newZoom = Math.max(zoom / 1.2, 25);
    setZoom(newZoom);
    fabricCanvas.setZoom(newZoom / 100);
    fabricCanvas.renderAll();
  };

  const resetZoom = () => {
    if (!fabricCanvas) return;
    setZoom(100);
    fabricCanvas.setZoom(1);
    fabricCanvas.renderAll();
  };

  // Image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fabricCanvas) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File Type",
        description: "Please select a valid image file (PNG, JPG, GIF, etc.).",
        variant: "destructive"
      });
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive"
      });
      return;
    }

    // Show loading toast
    toast({
      title: "Uploading Image",
      description: "Processing your image...",
      duration: 2000,
    });

    const reader = new FileReader();
    reader.onload = (event) => {
      const imgUrl = event.target?.result as string;
      
      // Create image element for compression
      const img = new Image();
      img.onload = () => {
        try {
          // Compress image if needed
          let finalImgUrl = imgUrl;
          if (img.width > 1024 || img.height > 1024) {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Calculate new dimensions
            const maxSize = 1024;
            const ratio = Math.min(maxSize / img.width, maxSize / img.height);
            canvas.width = img.width * ratio;
            canvas.height = img.height * ratio;
            
            // Draw and compress
            ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
            finalImgUrl = canvas.toDataURL('image/jpeg', 0.8);
          }

          // Add to fabric canvas
          fabric.Image.fromURL(finalImgUrl, {
            crossOrigin: 'anonymous'
          }).then((fabricImg) => {
            // Scale image to fit canvas reasonably
            const canvasWidth = fabricCanvas.width || 800;
            const canvasHeight = fabricCanvas.height || 600;
            const maxWidth = Math.min(300, canvasWidth * 0.4);
            const maxHeight = Math.min(300, canvasHeight * 0.4);
            
            const scaleX = maxWidth / (fabricImg.width || 1);
            const scaleY = maxHeight / (fabricImg.height || 1);
            const scale = Math.min(scaleX, scaleY);
            
            fabricImg.set({
              scaleX: scale,
              scaleY: scale,
              left: 50,
              top: 50
            });
            
            fabricCanvas.add(fabricImg);
            fabricCanvas.setActiveObject(fabricImg);
            fabricCanvas.renderAll();
            saveCanvasState(fabricCanvas);
            
            toast({
              title: "Image Added",
              description: "Image has been successfully added to the canvas.",
              duration: 2000,
            });
          });
        } catch (error) {
          console.error('Error processing image:', error);
          toast({
            title: "Image Error",
            description: "Failed to process image. Please try again.",
            variant: "destructive"
          });
        }
      };
      
      img.onerror = () => {
        toast({
          title: "Image Error",
          description: "Failed to load image. Please try a different file.",
          variant: "destructive"
        });
      };
      
      img.src = imgUrl;
    };
    
    reader.onerror = () => {
      toast({
        title: "File Error",
        description: "Failed to read the selected file.",
        variant: "destructive"
      });
    };
    
    reader.readAsDataURL(file);
    
    // Reset input
    e.target.value = '';
  };

  // Apply style changes to selected object
  const applyStyleToSelected = (property: string, value: any) => {
    if (!fabricCanvas) return;

    const activeObjects = fabricCanvas.getActiveObjects();
    if (activeObjects.length === 0) return;

    activeObjects.forEach(obj => {
      // Handle special cases for different object types
      if (property === 'fill' && (obj.type === 'line' || obj.type === 'group')) {
        // Lines don't have fill, skip
        if (obj.type === 'line') return;
        // For groups (arrows), apply to stroke instead
        if (obj.type === 'group') {
          obj.set('stroke', value);
          return;
        }
      }
      
      if (property === 'stroke' && obj.type === 'group') {
        // For arrow groups, apply to all objects within
        const group = obj as Group;
        group.forEachObject((groupObj) => {
          groupObj.set('stroke', value);
        });
        return;
      }
      
      if (property === 'strokeWidth' && obj.type === 'group') {
        // For arrow groups, apply to all objects within
        const group = obj as Group;
        group.forEachObject((groupObj) => {
          groupObj.set('strokeWidth', value);
        });
        return;
      }
      
      obj.set(property, value);
    });
    
    fabricCanvas.renderAll();
    saveCanvasState(fabricCanvas);
  };

  // Export functions
  const exportAsPNG = () => {
    if (!fabricCanvas) return;

    try {
      // Hide grid for export
      const gridObjects = fabricCanvas.getObjects().filter(obj => (obj as any).isGrid);
      gridObjects.forEach(obj => obj.set('visible', false));
      fabricCanvas.renderAll();
      
      const dataURL = fabricCanvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 2 // High resolution
      });

      // Restore grid
      gridObjects.forEach(obj => obj.set('visible', true));
      fabricCanvas.renderAll();

      // Create download link
      const link = document.createElement('a');
      link.download = `design_${Date.now()}.png`;
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export Successful",
        description: "Design exported as PNG successfully.",
      });
    } catch (error) {
      console.error('Error exporting PNG:', error);
      toast({
        title: "Export Error",
        description: "Failed to export design as PNG. Please try again.",
        variant: "destructive"
      });
    }
  };

  const exportAsPDF = () => {
    if (!fabricCanvas) return;

    try {
      // Hide grid for export
      const gridObjects = fabricCanvas.getObjects().filter(obj => (obj as any).isGrid);
      gridObjects.forEach(obj => obj.set('visible', false));
      fabricCanvas.renderAll();

      const dataURL = fabricCanvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 3 // High resolution for print
      });

      // Restore grid
      gridObjects.forEach(obj => obj.set('visible', true));
      fabricCanvas.renderAll();

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = 297; // A4 landscape width
      const imgHeight = 210; // A4 landscape height

      pdf.addImage(dataURL, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`design_${Date.now()}.pdf`);

      toast({
        title: "Export Successful",
        description: "Design exported as PDF successfully.",
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast({
        title: "Export Error",
        description: "Failed to export design as PDF. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Save design to cloud
  const saveDesign = async () => {
    if (!fabricCanvas) return;

    setSaving(true);
    try {
      // Save canvas state
      const canvasData = fabricCanvas.toJSON();
      
      // Export high-resolution image
      const gridObjects = fabricCanvas.getObjects().filter(obj => (obj as any).isGrid);
      gridObjects.forEach(obj => obj.set('visible', false));
      fabricCanvas.renderAll();

      const dataURL = fabricCanvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 2
      });

      gridObjects.forEach(obj => obj.set('visible', true));
      fabricCanvas.renderAll();

      let imageUrl = '';
      
      try {
        // Convert dataURL to File for Cloudinary upload
        const response = await fetch(dataURL);
        const blob = await response.blob();
        const file = new File([blob], 'design.png', { type: 'image/png' });

        // Upload to Cloudinary
        imageUrl = await uploadToCloudinary(file);
      } catch (cloudinaryError) {
        console.warn('Cloudinary upload failed, saving locally:', cloudinaryError);
        // Use dataURL as fallback
        imageUrl = dataURL;
      }

      // Save design data to Firestore
      await saveDesignToFirestore(JSON.stringify(canvasData), imageUrl);

      onSave(imageUrl);
      
      toast({
        title: "Design Saved",
        description: "Your design has been saved successfully.",
      });
    } catch (error) {
      console.error('Error saving design:', error);
      toast({
        title: "Save Error",
        description: "Failed to save design. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Firestore integration for saving designs
  const saveDesignToFirestore = async (designData: any, imageUrl: string) => {
    if (!orderId) return;
    
    try {
      // Dynamic import to avoid bundling Firebase if not needed
      const { db } = await import('@/lib/firebase');
      const { doc, setDoc } = await import('firebase/firestore');
      
      const designRef = doc(db, `orders/${orderId}/designs`, `item_${itemIndex}`);
      await setDoc(designRef, {
        canvasData: designData,
        imageUrl,
        timestamp: new Date(),
        version: 1
      });
      
      console.log('Design saved to Firestore successfully');
    } catch (error) {
      console.error('Error saving design to Firestore:', error);
      // Fallback to localStorage if Firestore fails
      const designKey = `design_${orderId}_${itemIndex}`;
      localStorage.setItem(designKey, JSON.stringify({
        canvasData: designData,
        imageUrl,
        timestamp: Date.now()
      }));
    }
  };

  const loadDesignFromFirestore = async () => {
    if (!orderId) return null;
    
    try {
      const { db } = await import('@/lib/firebase');
      const { doc, getDoc } = await import('firebase/firestore');
      
      const designRef = doc(db, `orders/${orderId}/designs`, `item_${itemIndex}`);
      const designSnap = await getDoc(designRef);
      
      if (designSnap.exists()) {
        return designSnap.data();
      }
      
      // Fallback to localStorage
      const designKey = `design_${orderId}_${itemIndex}`;
      const localDesign = localStorage.getItem(designKey);
      return localDesign ? JSON.parse(localDesign) : null;
    } catch (error) {
      console.error('Error loading design from Firestore:', error);
      
      // Fallback to localStorage
      const designKey = `design_${orderId}_${itemIndex}`;
      const localDesign = localStorage.getItem(designKey);
      return localDesign ? JSON.parse(localDesign) : null;
    }
  };

  // Clear canvas
  const clearCanvas = () => {
    if (!fabricCanvas) return;
    
    const objectCount = fabricCanvas.getObjects().filter(obj => !(obj as any).isGrid).length;
    if (objectCount === 0) {
      toast({
        title: "Canvas Empty",
        description: "Canvas is already empty.",
        duration: 1500,
      });
      return;
    }
    
    // Show confirmation
    const confirmed = window.confirm(`Are you sure you want to clear the canvas? This will remove all ${objectCount} objects and cannot be undone.`);
    if (!confirmed) return;
    
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = '#ffffff';
    if (showGrid) {
      addGridToCanvas(fabricCanvas);
    }
    fabricCanvas.renderAll();
    saveCanvasState(fabricCanvas);
    
    toast({
      title: "Canvas Cleared",
      description: `${objectCount} objects removed from canvas.`,
      duration: 2000,
    });
  };

  // Initialize canvas when modal opens
  useEffect(() => {
    if (!isOpen) {
      // Clean up canvas when modal closes
      if (fabricCanvas) {
        fabricCanvas.dispose();
        setFabricCanvas(null);
      }
      return;
    }

    // Wait for DOM to be ready
    const timer = setTimeout(() => {
      const canvas = initializeCanvas();
      if (canvas) {
        setFabricCanvas(canvas);
      }
    }, 100);

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!fabricCanvas) return;

      // Prevent default browser actions for our shortcuts
      const key = e.key.toLowerCase();
      
      // Tool shortcuts (only if not in text editing mode)
      const activeObject = fabricCanvas.getActiveObject();
      const isTextEditing = activeObject && activeObject.type === 'textbox' && (activeObject as any).isEditing;
      
      if (!isTextEditing) {
        switch (key) {
          case 'v':
            setActiveTool('select');
            e.preventDefault();
            break;
          case 'p':
            setActiveTool('pencil');
            e.preventDefault();
            break;
          case 'r':
            setActiveTool('rectangle');
            e.preventDefault();
            break;
          case 'c':
            if (!e.ctrlKey && !e.metaKey) {
              setActiveTool('circle');
              e.preventDefault();
            }
            break;
          case 'l':
            setActiveTool('line');
            e.preventDefault();
            break;
          case 'a':
            if (!e.ctrlKey && !e.metaKey) {
              setActiveTool('arrow');
              e.preventDefault();
            }
            break;
          case 't':
            setActiveTool('text');
            e.preventDefault();
            break;
          case 'i':
            fileInputRef.current?.click();
            e.preventDefault();
            break;
        }
      }

      // Ctrl/Cmd shortcuts
      if ((e.ctrlKey || e.metaKey) && ['z', 'y', 'c', 'v', 'a', 's', 'd'].includes(key)) {
        e.preventDefault();
        
        switch (key) {
          case 'z':
            if (e.shiftKey) {
              redo();
            } else {
              undo();
            }
            break;
          case 'y':
            redo();
            break;
          case 'c':
            copySelected();
            break;
          case 'a':
            fabricCanvas.discardActiveObject();
            const sel = new fabric.ActiveSelection(fabricCanvas.getObjects().filter(obj => !(obj as any).isGrid), {
              canvas: fabricCanvas,
            });
            fabricCanvas.setActiveObject(sel);
            fabricCanvas.renderAll();
            break;
          case 's':
            saveDesign();
            break;
          case 'd':
            duplicateSelected();
            break;
        }
      }

      // Other shortcuts
      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          if (!isTextEditing) {
            deleteSelected();
            e.preventDefault();
          }
          break;
        case 'Escape':
          fabricCanvas.discardActiveObject();
          fabricCanvas.renderAll();
          setActiveTool('select');
          e.preventDefault();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      if (fabricCanvas) {
        fabricCanvas.dispose();
        setFabricCanvas(null);
      }
    };
  }, [isOpen]); // Only depend on isOpen to prevent infinite loops

  // Reinitialize canvas when critical properties change
  useEffect(() => {
    if (isOpen && canvasRef.current && !fabricCanvas) {
      const canvas = initializeCanvas();
      if (canvas) {
        setFabricCanvas(canvas);
      }
    }
  }, [isOpen, fabricCanvas, initializeCanvas]);

  // Update canvas when tool changes
  useEffect(() => {
    if (!fabricCanvas) return;

    // Set drawing mode for pencil
    fabricCanvas.isDrawingMode = activeTool === 'pencil';
    fabricCanvas.selection = activeTool === 'select';
    
    // Update brush properties
    if (fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush.color = strokeColor;
      fabricCanvas.freeDrawingBrush.width = strokeWidth;
    }
    
    // Update cursor based on tool
    const canvasElement = fabricCanvas.getElement();
    if (canvasElement) {
      switch (activeTool) {
        case 'select':
          canvasElement.style.cursor = 'default';
          break;
        case 'pencil':
          canvasElement.style.cursor = 'crosshair';
          break;
        case 'rectangle':
        case 'circle':
        case 'line':
        case 'arrow':
          canvasElement.style.cursor = 'crosshair';
          break;
        case 'text':
          canvasElement.style.cursor = 'text';
          break;
        case 'image':
          canvasElement.style.cursor = 'copy';
          break;
        default:
          canvasElement.style.cursor = 'default';
      }
    }

    // Clear any active selection when switching to non-select tools
    if (activeTool !== 'select') {
      fabricCanvas.discardActiveObject();
      fabricCanvas.renderAll();
    }

    // Show tool feedback with toast notification
    const toolMessages = {
      select: 'Selection Tool Active - Click objects to select, drag to move, use handles to resize',
      pencil: 'Pencil Tool Active - Click and drag to draw freehand lines',
      rectangle: 'Rectangle Tool Active - Click and drag to draw rectangles', 
      circle: 'Circle Tool Active - Click and drag to draw circles',
      line: 'Line Tool Active - Click and drag to draw straight lines',
      arrow: 'Arrow Tool Active - Click and drag to draw arrows',
      text: 'Text Tool Active - Click anywhere to add text',
      image: 'Image Tool Active - Upload and place images on canvas'
    };

    // Show toast notification for tool change
    toast({
      title: `${activeTool.charAt(0).toUpperCase() + activeTool.slice(1)} Tool Selected`,
      description: toolMessages[activeTool],
      duration: 2000,
    });

    console.log(`Switched to ${toolMessages[activeTool] || activeTool}`);
  }, [activeTool, strokeColor, strokeWidth, fabricCanvas]);

  // Update canvas when grid settings change
  useEffect(() => {
    if (!fabricCanvas) return;

    try {
      // Remove existing grid lines
      const gridObjects = fabricCanvas.getObjects().filter(obj => (obj as any).isGrid);
      gridObjects.forEach(obj => fabricCanvas.remove(obj));

      // Add new grid if enabled
      if (showGrid) {
        addGridToCanvas(fabricCanvas);
      }

      fabricCanvas.renderAll();
    } catch (error) {
      console.error('Error updating grid:', error);
    }
  }, [showGrid, gridSize, fabricCanvas]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Professional Design Canvas
          </DialogTitle>
        </DialogHeader>

        <div className="flex h-[85vh]">
          {/* Left Toolbar */}
          <div className="w-16 bg-gray-50 border-r flex flex-col items-center py-4 gap-2">
            <Button
              variant={activeTool === 'select' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTool('select')}
              className={`w-10 h-10 p-0 ${activeTool === 'select' ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 dark:bg-gray-700'}`}
              title="Select Tool (V)"
            >
              <MousePointer2 className="h-4 w-4" />
            </Button>
            
            <Button
              variant={activeTool === 'pencil' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTool('pencil')}
              className={`w-10 h-10 p-0 ${activeTool === 'pencil' ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 dark:bg-gray-700'}`}
              title="Pencil Tool (P)"
            >
              <Pen className="h-4 w-4" />
            </Button>
            
            <Button
              variant={activeTool === 'rectangle' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTool('rectangle')}
              className={`w-10 h-10 p-0 ${activeTool === 'rectangle' ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 dark:bg-gray-700'}`}
              title="Rectangle Tool (R)"
            >
              <Square className="h-4 w-4" />
            </Button>
            
            <Button
              variant={activeTool === 'circle' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTool('circle')}
              className={`w-10 h-10 p-0 ${activeTool === 'circle' ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 dark:bg-gray-700'}`}
              title="Circle Tool (C)"
            >
              <CircleIcon className="h-4 w-4" />
            </Button>
            
            <Button
              variant={activeTool === 'line' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTool('line')}
              className={`w-10 h-10 p-0 ${activeTool === 'line' ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 dark:bg-gray-700'}`}
              title="Line Tool (L)"
            >
              <Minus className="h-4 w-4" />
            </Button>
            
            <Button
              variant={activeTool === 'arrow' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTool('arrow')}
              className={`w-10 h-10 p-0 ${activeTool === 'arrow' ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 dark:bg-gray-700'}`}
              title="Arrow Tool (A)"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
            
            <Button
              variant={activeTool === 'text' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTool('text')}
              className={`w-10 h-10 p-0 ${activeTool === 'text' ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 dark:bg-gray-700'}`}
              title="Text Tool (T)"
            >
              <Type className="h-4 w-4" />
            </Button>
            
            <Button
              variant={activeTool === 'image' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setActiveTool('image');
                fileInputRef.current?.click();
              }}
              className={`w-10 h-10 p-0 ${activeTool === 'image' ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 dark:bg-gray-700'}`}
              title="Upload Image (I)"
            >
              <ImageIcon className="h-4 w-4" />
            </Button>

            <Separator className="my-2" />

            <Button
              variant="ghost"
              size="sm"
              onClick={undo}
              disabled={historyIndex <= 0}
              className="w-10 h-10 p-0 hover:bg-gray-200 disabled:opacity-50"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className="w-10 h-10 p-0 hover:bg-gray-200 disabled:opacity-50"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Main Canvas Area */}
          <div className="flex-1 flex flex-col">
            {/* Quick Toolbar - Removed for now */}
            <div className="h-12 bg-white border-b flex items-center gap-4 px-4">
              <div className="flex items-center gap-1 border rounded-lg p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={undo}
                  disabled={historyIndex <= 0}
                  className="h-8 w-8 p-0"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={redo}
                  disabled={historyIndex >= history.length - 1}
                  className="h-8 w-8 p-0"
                  title="Redo (Ctrl+Y)"
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Top Toolbar */}
            <div className="h-16 bg-white border-b flex items-center gap-4 px-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copySelected}
                  disabled={!selectedObject}
                  title="Copy"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={deleteSelected}
                  disabled={!selectedObject}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <Separator orientation="vertical" className="h-8" />

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={bringToFront}
                  disabled={!selectedObject}
                  title="Bring to Front"
                >
                  <MoveUp className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={sendToBack}
                  disabled={!selectedObject}
                  title="Send to Back"
                >
                  <MoveDown className="h-4 w-4" />
                </Button>
              </div>

              <Separator orientation="vertical" className="h-8" />

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={flipHorizontal}
                  disabled={!selectedObject}
                  title="Flip Horizontal"
                >
                  <FlipHorizontal className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={flipVertical}
                  disabled={!selectedObject}
                  title="Flip Vertical"
                >
                  <FlipVertical className="h-4 w-4" />
                </Button>
              </div>

              <Separator orientation="vertical" className="h-8" />

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={groupObjects}
                  disabled={selectedObjects.length < 2}
                  title="Group"
                >
                  <GroupIcon className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={ungroupObjects}
                  disabled={!selectedObject || selectedObject.type !== 'group'}
                  title="Ungroup"
                >
                  <Ungroup className="h-4 w-4" />
                </Button>
              </div>

              <Separator orientation="vertical" className="h-8" />

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={alignLeft}
                  disabled={selectedObjects.length < 2}
                  title="Align Left"
                >
                  <AlignLeft className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={alignCenter}
                  disabled={selectedObjects.length < 2}
                  title="Align Center"
                >
                  <AlignCenter className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={alignRight}
                  disabled={selectedObjects.length < 2}
                  title="Align Right"
                >
                  <AlignRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={zoomOut}
                  title="Zoom Out"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                
                <span className="text-sm font-mono w-12 text-center">
                  {Math.round(zoom)}%
                </span>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={zoomIn}
                  title="Zoom In"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetZoom}
                  title="Reset Zoom"
                >
                  100%
                </Button>

                <Separator orientation="vertical" className="h-8" />

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowGrid(!showGrid)}
                  title="Toggle Grid"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Canvas Container */}
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

            {/* Status Bar */}
            <div className="h-8 bg-gray-100 border-t flex items-center px-4 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-4">
                <span>Tool: <strong className="capitalize">{activeTool}</strong></span>
                {selectedObject && (
                  <span>
                    Selected: <strong>{selectedObject.type}</strong>
                    {selectedObject.width && selectedObject.height && (
                      <span className="ml-2">
                        {Math.round(selectedObject.width)}×{Math.round(selectedObject.height)}
                      </span>
                    )}
                  </span>
                )}
                <span className="ml-auto">
                  Objects: {fabricCanvas ? fabricCanvas.getObjects().filter(obj => !(obj as any).isGrid).length : 0}
                </span>
                <span>Zoom: {Math.round(zoom)}%</span>
              </div>
            </div>
          </div>

          {/* Right Properties Panel */}
          <div className="w-72 bg-gray-50 border-l overflow-y-auto">
            <div className="p-4 space-y-6">
              {/* Active Tool Info */}
              <div className="bg-white rounded-lg p-3 border">
                <div className="flex items-center gap-2 mb-2">
                  {activeTool === 'select' && <MousePointer2 className="h-4 w-4 text-blue-600" />}
                  {activeTool === 'pencil' && <Pen className="h-4 w-4 text-blue-600" />}
                  {activeTool === 'rectangle' && <Square className="h-4 w-4 text-blue-600" />}
                  {activeTool === 'circle' && <CircleIcon className="h-4 w-4 text-blue-600" />}
                  {activeTool === 'line' && <Minus className="h-4 w-4 text-blue-600" />}
                  {activeTool === 'arrow' && <ArrowRight className="h-4 w-4 text-blue-600" />}
                  {activeTool === 'text' && <Type className="h-4 w-4 text-blue-600" />}
                  {activeTool === 'image' && <ImageIcon className="h-4 w-4 text-blue-600" />}
                  <span className="text-sm font-medium capitalize">{activeTool} Tool</span>
                  <span className="text-xs text-gray-500 ml-auto">
                    {activeTool === 'select' && '(V)'}
                    {activeTool === 'pencil' && '(P)'}
                    {activeTool === 'rectangle' && '(R)'}
                    {activeTool === 'circle' && '(C)'}
                    {activeTool === 'line' && '(L)'}
                    {activeTool === 'arrow' && '(A)'}
                    {activeTool === 'text' && '(T)'}
                    {activeTool === 'image' && '(I)'}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {activeTool === 'select' && 'Click and drag to select objects. Use handles to resize.'}
                  {activeTool === 'pencil' && 'Click and drag to draw freehand lines.'}
                  {activeTool === 'rectangle' && 'Click and drag to draw rectangles.'}
                  {activeTool === 'circle' && 'Click and drag to draw circles.'}
                  {activeTool === 'line' && 'Click and drag to draw straight lines.'}
                  {activeTool === 'arrow' && 'Click and drag to draw arrows.'}
                  {activeTool === 'text' && 'Click anywhere to add text.'}
                  {activeTool === 'image' && 'Click to upload and place images.'}
                </p>
              </div>
              
              {/* Quick Shortcuts */}
              <div className="bg-gray-100 rounded-lg p-3 border">
                <h4 className="text-sm font-medium mb-2">Quick Shortcuts</h4>
                <div className="text-xs text-gray-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Undo</span>
                    <span className="font-mono">Ctrl+Z</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Redo</span>
                    <span className="font-mono">Ctrl+Y</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Copy</span>
                    <span className="font-mono">Ctrl+C</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Duplicate</span>
                    <span className="font-mono">Ctrl+D</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delete</span>
                    <span className="font-mono">Del</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Select All</span>
                    <span className="font-mono">Ctrl+A</span>
                  </div>
                </div>
              </div>

              {/* Selection Info */}
              {selectedObject && (
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Selected Object</h4>
                  <div className="text-xs text-blue-800 space-y-1">
                    <div>Type: <strong className="capitalize">{selectedObject.type}</strong></div>
                    {selectedObject.width && selectedObject.height && (
                      <div>Size: <strong>{Math.round(selectedObject.width)}×{Math.round(selectedObject.height)}</strong></div>
                    )}
                    {selectedObject.left !== undefined && selectedObject.top !== undefined && (
                      <div>Position: <strong>{Math.round(selectedObject.left)}, {Math.round(selectedObject.top)}</strong></div>
                    )}
                  </div>
                </div>
              )}

              {/* Fill Color */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Fill Color</Label>
                <div className="flex items-center gap-2 mb-2">
                  <Input
                    type="color"
                    value={fillColor}
                    onChange={(e) => {
                      setFillColor(e.target.value);
                      applyStyleToSelected('fill', e.target.value);
                    }}
                    className="w-12 h-8 p-0 border-none"
                  />
                  <Input
                    type="text"
                    value={fillColor}
                    onChange={(e) => {
                      setFillColor(e.target.value);
                      applyStyleToSelected('fill', e.target.value);
                    }}
                    className="flex-1 text-xs"
                  />
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {colors.map((color) => (
                    <button
                      key={color}
                      className="w-6 h-6 rounded border-2 border-gray-200 hover:border-gray-400 transition-colors"
                      style={{ backgroundColor: color }}
                      onClick={() => {
                        setFillColor(color);
                        applyStyleToSelected('fill', color);
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Stroke Color */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Stroke Color</Label>
                <div className="flex items-center gap-2 mb-2">
                  <Input
                    type="color"
                    value={strokeColor}
                    onChange={(e) => {
                      setStrokeColor(e.target.value);
                      applyStyleToSelected('stroke', e.target.value);
                    }}
                    className="w-12 h-8 p-0 border-none"
                  />
                  <Input
                    type="text"
                    value={strokeColor}
                    onChange={(e) => {
                      setStrokeColor(e.target.value);
                      applyStyleToSelected('stroke', e.target.value);
                    }}
                    className="flex-1 text-xs"
                  />
                </div>
              </div>

              {/* Stroke Width */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Stroke Width</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[strokeWidth]}
                    onValueChange={(value) => {
                      setStrokeWidth(value[0]);
                      applyStyleToSelected('strokeWidth', value[0]);
                    }}
                    max={20}
                    min={0}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-xs w-8 text-center">{strokeWidth}px</span>
                </div>
              </div>

              {/* Opacity */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Opacity</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[opacity]}
                    onValueChange={(value) => {
                      setOpacity(value[0]);
                      applyStyleToSelected('opacity', value[0] / 100);
                    }}
                    max={100}
                    min={0}
                    step={5}
                    className="flex-1"
                  />
                  <span className="text-xs w-8 text-center">{opacity}%</span>
                </div>
              </div>

              {/* Text Properties (shown when text is selected) */}
              {selectedObject?.type === 'textbox' && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Font Family</Label>
                    <Select
                      value={fontFamily}
                      onValueChange={(value) => {
                        setFontFamily(value);
                        applyStyleToSelected('fontFamily', value);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fonts.map((font) => (
                          <SelectItem key={font} value={font}>
                            {font}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-2 block">Font Size</Label>
                    <div className="flex items-center gap-2">
                      <Slider
                        value={[fontSize]}
                        onValueChange={(value) => {
                          setFontSize(value[0]);
                          applyStyleToSelected('fontSize', value[0]);
                        }}
                        max={72}
                        min={8}
                        step={1}
                        className="flex-1"
                      />
                      <span className="text-xs w-8 text-center">{fontSize}px</span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-2 block">Font Weight</Label>
                    <Select
                      value={fontWeight}
                      onValueChange={(value) => {
                        setFontWeight(value);
                        applyStyleToSelected('fontWeight', value);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="bold">Bold</SelectItem>
                        <SelectItem value="lighter">Light</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <Separator />

              {/* Canvas Settings */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Canvas Settings</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Show Grid</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowGrid(!showGrid);
                        if (fabricCanvas) {
                          fabricCanvas.clear();
                          fabricCanvas.backgroundColor = '#ffffff';
                          if (!showGrid) {
                            addGridToCanvas(fabricCanvas);
                          }
                          fabricCanvas.renderAll();
                        }
                      }}
                    >
                      {showGrid ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Snap to Grid</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSnapToGrid(!snapToGrid)}
                    >
                      {snapToGrid ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Actions */}
              <div className="space-y-2">
                <Button
                  onClick={exportAsPNG}
                  className="w-full"
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export PNG
                </Button>
                
                <Button
                  onClick={exportAsPDF}
                  className="w-full"
                  variant="outline"
                >
                  <FileType className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
                
                <Button
                  onClick={saveDesign}
                  disabled={saving}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Design'}
                </Button>
                
                <Button
                  onClick={clearCanvas}
                  variant="destructive"
                  className="w-full"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Canvas
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Hidden file input for image upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
      </DialogContent>
    </Dialog>
  );
};

export default ToolDesignCanvas;
