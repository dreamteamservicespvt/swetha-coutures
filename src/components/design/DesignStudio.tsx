import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Canvas as FabricCanvas,
  Circle,
  Ellipse,
  Group,
  IText,
  Image as FabricImage,
  Line,
  PencilBrush,
  Polygon,
  Rect,
  Triangle,
} from 'fabric';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  MousePointer2,
  Pencil,
  Eraser,
  Minus,
  MoveRight,
  Square,
  Circle as CircleIcon,
  Type as TypeIcon,
  ImagePlus,
  Undo2,
  Redo2,
  Trash2,
  Copy,
  BringToFront,
  SendToBack,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Save,
  Download,
  X,
  Palette,
  Layers,
  SlidersHorizontal,
  Loader2,
  Shapes,
  Ruler,
  Ungroup,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { uploadToCloudinary } from '@/utils/cloudinaryConfig';
import { cn } from '@/lib/utils';

export interface DesignSaveResult {
  /** Cloudinary URL of the flattened PNG — what gets shown to the master tailor. */
  imageUrl: string;
  /** Fabric JSON so the design can be re-opened and edited later. */
  designJson: string;
}

interface DesignStudioProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (result: DesignSaveResult) => void;
  /** Fabric JSON from a previous session, to continue editing. */
  initialJson?: string;
  /** Existing image to drop in as a starting reference. */
  initialImageUrl?: string;
  title?: string;
  subtitle?: string;
}

type Tool =
  | 'select'
  | 'draw'
  | 'erase'
  | 'line'
  | 'arrow'
  | 'rect'
  | 'circle'
  | 'text'
  | 'measure';

const PALETTE = [
  '#111827', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#a16207',
  '#78716c', '#ffffff',
];

/**
 * Ready-made garment outlines — the fastest way to start a tailoring sketch.
 * Chosen from what this shop actually bills: sarees, blouses, dresses & frocks,
 * inskirts, tops, lehengas, kurtis and gowns.
 */
const GARMENT_TEMPLATES = [
  { id: 'blouse', label: 'Blouse' },
  { id: 'saree', label: 'Saree drape' },
  { id: 'kurti', label: 'Kurti' },
  { id: 'lehenga', label: 'Lehenga' },
  { id: 'gown', label: 'Gown' },
  { id: 'dress', label: 'Dress' },
  { id: 'frock', label: 'Baby frock' },
  { id: 'top', label: 'Top' },
  { id: 'inskirt', label: 'Inskirt' },
  { id: 'palazzo', label: 'Palazzo' },
  { id: 'salwar', label: 'Salwar' },
  { id: 'dupatta', label: 'Dupatta' },
  { id: 'sleeve', label: 'Sleeve' },
  { id: 'neckRound', label: 'Round neck' },
  { id: 'neckV', label: 'V neck' },
  { id: 'neckBoat', label: 'Boat neck' },
] as const;

type TemplateId = (typeof GARMENT_TEMPLATES)[number]['id'];

const TOOLS: { id: Tool; icon: React.ElementType; label: string; key: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select & move', key: 'V' },
  { id: 'draw', icon: Pencil, label: 'Freehand draw', key: 'P' },
  { id: 'erase', icon: Eraser, label: 'Eraser — rub out by dragging', key: 'E' },
  { id: 'line', icon: Minus, label: 'Straight line', key: 'L' },
  { id: 'arrow', icon: MoveRight, label: 'Arrow / pointer', key: 'A' },
  { id: 'rect', icon: Square, label: 'Rectangle', key: 'R' },
  { id: 'circle', icon: CircleIcon, label: 'Circle', key: 'C' },
  { id: 'text', icon: TypeIcon, label: 'Text note', key: 'T' },
  { id: 'measure', icon: Ruler, label: 'Measurement line', key: 'M' },
];

/**
 * Design Studio — where a design is drawn for the customer and handed to the master tailor.
 *
 * Replaces the old ToolDesignCanvas, which pinned an 800×600 canvas inside a fixed
 * three-column desktop layout and was unusable on a phone. Here the canvas sizes itself to
 * whatever space it gets, tools live in a rail that becomes a bottom bar on small screens,
 * and the properties panel becomes a sheet. Designs save as both a flat PNG (for sharing)
 * and fabric JSON (so they can be reopened and edited).
 */
const DesignStudio: React.FC<DesignStudioProps> = ({
  isOpen,
  onClose,
  onSave,
  initialJson,
  initialImageUrl,
  title = 'Design Studio',
  subtitle,
}) => {
  /**
   * Held as state, not a ref, and set through a callback ref.
   *
   * Radix mounts portal content in a later commit than the one that flips `isOpen`, so an
   * effect keyed only on `isOpen` runs while the <canvas> is still absent — fabric would
   * bail out and never retry, leaving a dead 300×150 element. Keying the setup on the
   * element itself means initialisation happens exactly when there is something to attach to.
   */
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<FabricCanvas | null>(null);

  // History is a ref, not state: it is written from fabric event handlers that must not
  // re-render the component on every stroke.
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const suspendHistory = useRef(false);
  const drawStart = useRef<{ x: number; y: number } | null>(null);
  const drawingShape = useRef<any>(null);

  const [ready, setReady] = useState(false);
  const [tool, setTool] = useState<Tool>('draw');
  // Mirrors `tool` for fabric callbacks, which capture the value from the render that
  // registered them and would otherwise act on a stale tool.
  const toolRef = useRef<Tool>('draw');
  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);
  const [strokeColor, setStrokeColor] = useState('#111827');
  const [fillColor, setFillColor] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [eraserWidth, setEraserWidth] = useState(24);
  const [fontSize, setFontSize] = useState(22);
  const [zoom, setZoom] = useState(1);
  const [hasSelection, setHasSelection] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [objectCount, setObjectCount] = useState(0);

  /* ------------------------------------------------------------------ history */

  /** The artboard colour. The eraser paints in this, which is what makes it rub out. */
  const BOARD_COLOUR = '#ffffff';

  /**
   * `isEraser` is a custom flag, so fabric only keeps it if it is listed explicitly —
   * without it, reopening a saved design would forget which strokes were erasures.
   */
  const serialize = (canvas: FabricCanvas) =>
    JSON.stringify(canvas.toObject(['isEraser']));

  const pushHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || suspendHistory.current) return;

    const snapshot = serialize(canvas);
    // Drop any redo branch — a new edit after undoing replaces the discarded future.
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(snapshot);
    // 60 steps is plenty for a sketch and keeps memory bounded on phones.
    if (historyRef.current.length > 60) historyRef.current.shift();
    historyIndexRef.current = historyRef.current.length - 1;

    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
    setObjectCount(canvas.getObjects().length);
  }, []);

  const restore = useCallback(async (index: number) => {
    const canvas = canvasRef.current;
    if (!canvas || index < 0 || index >= historyRef.current.length) return;

    suspendHistory.current = true;
    try {
      await canvas.loadFromJSON(historyRef.current[index]);
      // loadFromJSON rebuilds every object from scratch, so their cached corner
      // coordinates have to be recomputed or nothing is clickable after an undo.
      canvas.forEachObject((object) => {
        object.setCoords();
        // Erase strokes stay inert so they can never be selected or dragged around.
        if ((object as any).isEraser) object.set({ selectable: false, evented: false });
      });
      canvas.renderAll();
      historyIndexRef.current = index;
      setCanUndo(index > 0);
      setCanRedo(index < historyRef.current.length - 1);
      setObjectCount(canvas.getObjects().length);
    } finally {
      suspendHistory.current = false;
    }
  }, []);

  const undo = useCallback(() => restore(historyIndexRef.current - 1), [restore]);
  const redo = useCallback(() => restore(historyIndexRef.current + 1), [restore]);

  /* ------------------------------------------------------------- canvas setup */

  // Keep the drawing surface filling whatever space the layout gives it, at any breakpoint.
  const fitCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;

    const width = Math.max(280, stage.clientWidth - 16);
    const height = Math.max(280, stage.clientHeight - 16);
    canvas.setDimensions({ width, height });
    canvas.renderAll();
  }, []);

  useEffect(() => {
    if (!isOpen || !canvasEl) return;

    const canvas = new FabricCanvas(canvasEl, {
      backgroundColor: BOARD_COLOUR,
      preserveObjectStacking: true,
      selection: true,
      // Touch devices need this off, otherwise a two-finger scroll drags the artboard.
      allowTouchScrolling: false,
    });
    canvasRef.current = canvas;

    const brush = new PencilBrush(canvas);
    brush.color = strokeColor;
    brush.width = strokeWidth;
    canvas.freeDrawingBrush = brush;

    const onSelection = () => setHasSelection(canvas.getActiveObjects().length > 0);
    canvas.on('selection:created', onSelection);
    canvas.on('selection:updated', onSelection);
    canvas.on('selection:cleared', () => setHasSelection(false));
    canvas.on('object:modified', pushHistory);
    /*
     * Freehand strokes. An eraser stroke is an ordinary path drawn in `destination-out`
     * mode, which rubs out whatever is beneath it instead of adding ink — the behaviour
     * people expect from an eraser. Deleting the whole object (the previous behaviour) is
     * still available: select it and press Delete.
     */
    canvas.on('path:created', (event: any) => {
      const path = event.path;
      if (path && toolRef.current === 'erase') {
        // Erase strokes are ordinary paths painted in the artboard colour, sitting on top.
        // Fabric's per-object `globalCompositeOperation` (true pixel subtraction) is not
        // honoured by this build's render path, and a white stroke is indistinguishable in
        // the exported PNG — which is the only thing the master tailor ever sees.
        path.set({ selectable: false, evented: false });
        (path as any).isEraser = true;
        canvas.requestRenderAll();
      }
      pushHistory();
    });

    /*
     * Fabric attaches its hidden <textarea> — the element that actually receives keystrokes
     * while text is being edited — to the document body, which is outside this dialog. A
     * modal Radix dialog traps focus to its own subtree, so it immediately pulled focus back
     * and every character typed was swallowed. Re-homing the textarea inside the dialog puts
     * it within the trap, and focus sticks.
     */
    canvas.on('text:editing:entered', (event: any) => {
      const textarea = event.target?.hiddenTextarea as HTMLTextAreaElement | undefined;
      if (!textarea) return;
      if (shellRef.current && !shellRef.current.contains(textarea)) {
        shellRef.current.appendChild(textarea);
      }
      textarea.focus();
    });

    // Text is only worth recording once the user has finished typing. An empty box left
    // behind by a stray tap is removed rather than saved onto the tailor's sheet.
    canvas.on('text:editing:exited', (event: any) => {
      const text = event.target;
      if (text && !String(text.text || '').trim()) {
        canvas.remove(text);
        canvas.requestRenderAll();
        return;
      }
      text?.setCoords();
      pushHistory();
    });

    fitCanvas();

    const restoreInitial = async () => {
      if (initialJson) {
        try {
          suspendHistory.current = true;
          await canvas.loadFromJSON(initialJson);
          canvas.renderAll();
        } catch (error) {
          console.error('Could not load saved design:', error);
        } finally {
          suspendHistory.current = false;
        }
      } else if (initialImageUrl) {
        try {
          const img = await FabricImage.fromURL(initialImageUrl, { crossOrigin: 'anonymous' });
          fitImageToCanvas(canvas, img);
          canvas.add(img);
          canvas.renderAll();
        } catch (error) {
          console.error('Could not load reference image:', error);
        }
      }
      historyRef.current = [serialize(canvas)];
      historyIndexRef.current = 0;
      setCanUndo(false);
      setCanRedo(false);
      setObjectCount(canvas.getObjects().length);
      setReady(true);
    };
    restoreInitial();

    const observer = new ResizeObserver(() => fitCanvas());
    if (stageRef.current) observer.observe(stageRef.current);
    window.addEventListener('resize', fitCanvas);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fitCanvas);
      canvas.dispose();
      canvasRef.current = null;
      setReady(false);
      historyRef.current = [];
      historyIndexRef.current = -1;
    };
    // Re-creating the canvas on prop changes would throw away the user's work, so this
    // deliberately runs only when the studio opens (and the artboard element exists).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, canvasEl]);

  /* ------------------------------------------------------------- tool bindings */

  // Brush settings follow the style controls live. In erase mode the brush paints an
  // opaque stroke whose composite mode subtracts it, so only its width matters.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas?.freeDrawingBrush) return;
    if (tool === 'erase') {
      canvas.freeDrawingBrush.color = BOARD_COLOUR;
      canvas.freeDrawingBrush.width = eraserWidth;
    } else {
      canvas.freeDrawingBrush.color = strokeColor;
      canvas.freeDrawingBrush.width = strokeWidth;
    }
  }, [strokeColor, strokeWidth, eraserWidth, tool, ready]);

  // Apply style changes to whatever is selected, so the controls feel like a real editor.
  const applyStyleToSelection = useCallback(
    (patch: Record<string, any>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const objects = canvas.getActiveObjects();
      if (objects.length === 0) return;
      objects.forEach((object) => object.set(patch));
      canvas.requestRenderAll();
      pushHistory();
    },
    [pushHistory]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;

    canvas.isDrawingMode = tool === 'draw' || tool === 'erase';
    canvas.selection = tool === 'select';
    canvas.defaultCursor = tool === 'select' ? 'default' : 'crosshair';
    canvas.forEachObject((object) => {
      object.selectable = tool === 'select';
      object.evented = tool === 'select' || tool === 'erase';
    });
    canvas.requestRenderAll();
  }, [tool, ready]);

  // Shape drawing: press, drag, release. One handler set covers every draggable tool.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;

    const point = (event: any) => canvas.getScenePoint(event.e);

    const handleDown = (event: any) => {
      if (tool === 'select' || tool === 'draw' || tool === 'erase') return;

      const pointer = point(event);

      if (tool === 'text') {
        // Starts empty and in edit mode — a placeholder that has to be selected and
        // overwritten is friction, and forgotten placeholders end up on the tailor's sheet.
        const text = new IText('', {
          left: pointer.x,
          top: pointer.y,
          fill: strokeColor,
          fontSize,
          fontFamily: 'Inter, system-ui, sans-serif',
        });
        canvas.add(text);
        text.setCoords();
        canvas.setActiveObject(text);
        // Deferred to the next frame: fabric is still processing this same press, and its
        // mouse:up handling would immediately drop the caret we just placed.
        requestAnimationFrame(() => {
          text.enterEditing();
          canvas.requestRenderAll();
        });
        setTool('select');
        return;
      }

      drawStart.current = { x: pointer.x, y: pointer.y };

      const common = {
        stroke: strokeColor,
        strokeWidth,
        fill: fillColor === 'transparent' ? '' : fillColor,
        selectable: false,
        evented: false,
      };

      let shape: any = null;
      if (tool === 'rect') {
        shape = new Rect({ left: pointer.x, top: pointer.y, width: 1, height: 1, ...common });
      } else if (tool === 'circle') {
        shape = new Ellipse({ left: pointer.x, top: pointer.y, rx: 1, ry: 1, ...common });
      } else if (tool === 'line' || tool === 'arrow' || tool === 'measure') {
        shape = new Line([pointer.x, pointer.y, pointer.x, pointer.y], {
          stroke: strokeColor,
          strokeWidth,
          selectable: false,
          evented: false,
          ...(tool === 'measure' ? { strokeDashArray: [8, 6] } : {}),
        });
      }

      if (shape) {
        drawingShape.current = shape;
        canvas.add(shape);
      }
    };

    const handleMove = (event: any) => {
      if (!drawStart.current || !drawingShape.current) return;
      const pointer = point(event);
      const start = drawStart.current;
      const shape = drawingShape.current;

      if (shape instanceof Rect) {
        shape.set({
          left: Math.min(start.x, pointer.x),
          top: Math.min(start.y, pointer.y),
          width: Math.abs(pointer.x - start.x),
          height: Math.abs(pointer.y - start.y),
        });
      } else if (shape instanceof Ellipse) {
        shape.set({
          left: Math.min(start.x, pointer.x),
          top: Math.min(start.y, pointer.y),
          rx: Math.abs(pointer.x - start.x) / 2,
          ry: Math.abs(pointer.y - start.y) / 2,
        });
      } else if (shape instanceof Line) {
        shape.set({ x2: pointer.x, y2: pointer.y });
      }

      // Fabric caches an object's corner coordinates; without this the shape keeps the
      // hit-box it had when it was 1×1 at the press point, so it can never be clicked,
      // selected, moved or erased afterwards.
      shape.setCoords();
      canvas.requestRenderAll();
    };

    const handleUp = () => {
      const start = drawStart.current;
      const shape = drawingShape.current;
      drawStart.current = null;
      drawingShape.current = null;
      if (!shape || !start) return;

      // Discard accidental taps that produced a zero-size shape.
      const tiny =
        (shape instanceof Rect && (shape.width! < 3 || shape.height! < 3)) ||
        (shape instanceof Ellipse && shape.rx! < 2 && shape.ry! < 2) ||
        (shape instanceof Line &&
          Math.hypot(shape.x2! - shape.x1!, shape.y2! - shape.y1!) < 5);

      if (tiny) {
        canvas.remove(shape);
        canvas.requestRenderAll();
        return;
      }

      if (tool === 'arrow' && shape instanceof Line) {
        // Replace the plain line with a line + head, grouped so it moves as one object.
        canvas.remove(shape);
        const arrow = buildArrow(
          shape.x1!, shape.y1!, shape.x2!, shape.y2!, strokeColor, strokeWidth
        );
        canvas.add(arrow);
      } else if (tool === 'measure' && shape instanceof Line) {
        // Canvas pixels mean nothing to a tailor — the label starts as a blank inches
        // placeholder in edit mode so the real measurement is typed straight in.
        const label = new IText('0 in', {
          left: (shape.x1! + shape.x2!) / 2,
          top: (shape.y1! + shape.y2!) / 2 - 20,
          fill: strokeColor,
          fontSize: Math.max(12, fontSize - 4),
          fontFamily: 'Inter, system-ui, sans-serif',
          backgroundColor: 'rgba(255,255,255,0.88)',
          originX: 'center',
        });
        canvas.add(label);
        canvas.setActiveObject(label);
        label.enterEditing();
        label.selectAll();
      }

      canvas.forEachObject((object) => {
        object.selectable = true;
        object.evented = true;
        object.setCoords();
      });
      canvas.requestRenderAll();
      pushHistory();
    };

    canvas.on('mouse:down', handleDown);
    canvas.on('mouse:move', handleMove);
    canvas.on('mouse:up', handleUp);

    return () => {
      canvas.off('mouse:down', handleDown);
      canvas.off('mouse:move', handleMove);
      canvas.off('mouse:up', handleUp);
    };
  }, [tool, ready, strokeColor, fillColor, strokeWidth, fontSize, pushHistory]);

  /* ------------------------------------------------------------------ actions */

  const deleteSelection = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const objects = canvas.getActiveObjects();
    if (objects.length === 0) return;
    objects.forEach((object) => canvas.remove(object));
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    pushHistory();
  }, [pushHistory]);

  const duplicateSelection = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active) return;
    const clone = await active.clone();
    clone.set({ left: (active.left || 0) + 24, top: (active.top || 0) + 24 });
    canvas.add(clone);
    clone.setCoords();
    canvas.setActiveObject(clone);
    canvas.requestRenderAll();
    pushHistory();
  }, [pushHistory]);

  /**
   * Breaks a garment outline into its individual lines so parts of it can be moved,
   * recoloured or deleted on their own — a template is a Group, which otherwise behaves as
   * one indivisible object.
   */
  const ungroupSelection = useCallback(() => {
    const canvas = canvasRef.current;
    const active = canvas?.getActiveObject() as any;
    if (!canvas || !active) return;

    if (!(active instanceof Group)) {
      toast({
        title: 'Nothing to split',
        description: 'Select a garment outline to split it into separate lines.',
      });
      return;
    }

    const pieces = active.removeAll();
    canvas.remove(active);
    pieces.forEach((piece: any) => {
      piece.set({ selectable: true, evented: true });
      canvas.add(piece);
      piece.setCoords();
    });
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    pushHistory();
    toast({ title: 'Outline split', description: `${pieces.length} separate parts.` });
  }, [pushHistory]);

  const reorder = useCallback(
    (direction: 'front' | 'back') => {
      const canvas = canvasRef.current;
      const active = canvas?.getActiveObject();
      if (!canvas || !active) return;
      if (direction === 'front') canvas.bringObjectToFront(active);
      else canvas.sendObjectToBack(active);
      canvas.requestRenderAll();
      pushHistory();
    },
    [pushHistory]
  );

  const applyZoom = useCallback((next: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const clamped = Math.min(3, Math.max(0.25, next));
    canvas.setZoom(clamped);
    canvas.requestRenderAll();
    setZoom(clamped);
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.getObjects().length === 0) return;
    if (!window.confirm('Clear the whole design? This cannot be undone except with Undo.')) return;
    canvas.remove(...canvas.getObjects());
    canvas.backgroundColor = '#ffffff';
    canvas.requestRenderAll();
    pushHistory();
  }, [pushHistory]);

  const addTemplate = useCallback(
    (id: TemplateId) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const shape = buildTemplate(id, canvas.getWidth(), canvas.getHeight());
      if (!shape) return;
      canvas.add(shape);
      shape.setCoords();
      canvas.setActiveObject(shape);
      canvas.requestRenderAll();
      pushHistory();
      setTool('select');
      setPanelOpen(false);
    },
    [pushHistory]
  );

  const handleImagePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    setUploadingImage(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const img = await FabricImage.fromURL(dataUrl, { crossOrigin: 'anonymous' });
      fitImageToCanvas(canvas, img);
      canvas.add(img);
      img.setCoords();
      canvas.setActiveObject(img);
      canvas.requestRenderAll();
      pushHistory();
      setTool('select');
    } catch (error) {
      console.error('Image import failed:', error);
      toast({
        title: 'Could not add image',
        description: 'The file could not be read. Try a JPG or PNG.',
        variant: 'destructive',
      });
    } finally {
      setUploadingImage(false);
    }
  };

  /**
   * Flattens the artboard to a PNG data URL.
   *
   * Rendered at 2× so the master tailor gets a print-legible sheet, but stepped down if
   * that lands over ~6 MB — Cloudinary's unsigned upload rejects oversized payloads, and a
   * silent rejection at save time is the worst possible moment to find out.
   */
  const exportPng = useCallback((): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    for (const multiplier of [2, 1.5, 1]) {
      const dataUrl = canvas.toDataURL({ format: 'png', quality: 1, multiplier });
      // base64 is ~4/3 the byte size of the binary it encodes.
      if (dataUrl.length * 0.75 < 6_000_000 || multiplier === 1) return dataUrl;
    }
    return null;
  }, []);

  const handleDownload = useCallback(() => {
    const dataUrl = exportPng();
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `design-${Date.now()}.png`;
    link.click();
  }, [exportPng]);

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (canvas.getObjects().length === 0) {
      toast({
        title: 'Nothing to save',
        description: 'Draw something or add a reference photo first.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      // Commit any text still being edited, so a half-typed note is not lost on save.
      const active = canvas.getActiveObject() as any;
      if (active?.isEditing) active.exitEditing();
      canvas.discardActiveObject();
      canvas.requestRenderAll();

      const designJson = serialize(canvas);

      let dataUrl: string | null = null;
      try {
        dataUrl = exportPng();
      } catch (renderError) {
        // A cross-origin image dropped on the canvas taints it and toDataURL throws.
        console.error('Canvas export blocked:', renderError);
        throw new Error(
          'An imported image is blocking the export. Remove the last added photo and save again.'
        );
      }
      if (!dataUrl) throw new Error('Could not render the design');

      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `design-${Date.now()}.png`, { type: 'image/png' });
      const imageUrl = await uploadToCloudinary(file);

      onSave({ imageUrl, designJson });
      toast({ title: 'Design saved', description: 'It is attached to this order item.' });
      onClose();
    } catch (error) {
      console.error('Design save failed:', error);
      toast({
        title: 'Save failed',
        description:
          error instanceof Error ? error.message : 'Could not upload the design. Try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  /* -------------------------------------------------------------- keyboard */

  useEffect(() => {
    if (!isOpen) return;

    const onKey = (event: KeyboardEvent) => {
      // Escape must never reach the page behind. The studio opens from inside an order
      // dialog, and Radix listens for Escape on `document` — without this, one Escape
      // closed the whole order form and threw the design away.
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const active = canvasRef.current?.getActiveObject() as any;
        if (active?.isEditing) {
          active.exitEditing();
        } else {
          canvasRef.current?.discardActiveObject();
        }
        canvasRef.current?.requestRenderAll();
        setTool('select');
        return;
      }

      const target = event.target as HTMLElement;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        (canvasRef.current?.getActiveObject() as any)?.isEditing;
      if (typing) return;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteSelection();
        return;
      }

      const match = TOOLS.find((entry) => entry.key.toLowerCase() === event.key.toLowerCase());
      if (match) setTool(match.id);
    };

    // Capture phase on `window`, which is the very first hop of the capture path
    // (window → document → … ). Radix registers its Escape handler as a *document* capture
    // listener when the order dialog opens, i.e. before this component exists — so a
    // document-level listener here would run second and be too late to stop it.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen, undo, redo, deleteSelection]);

  if (!isOpen) return null;

  const styleControls = (
    <div className="space-y-5">
      <div>
        <Label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <Palette className="h-3.5 w-3.5" /> Colour
        </Label>
        <div className="grid grid-cols-6 gap-1.5">
          {PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Colour ${color}`}
              onClick={() => {
                setStrokeColor(color);
                applyStyleToSelection({ stroke: color, fill: undefined });
              }}
              className={cn(
                'h-8 w-full rounded-md border-2 transition',
                strokeColor === color
                  ? 'border-blue-500 ring-2 ring-blue-200'
                  : 'border-gray-200 dark:border-gray-700'
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <Input
          type="color"
          value={strokeColor}
          onChange={(event) => {
            setStrokeColor(event.target.value);
            applyStyleToSelection({ stroke: event.target.value });
          }}
          className="mt-2 h-9 w-full cursor-pointer p-1"
        />
      </div>

      <div>
        <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Fill
        </Label>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              setFillColor('transparent');
              applyStyleToSelection({ fill: '' });
            }}
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs',
              fillColor === 'transparent'
                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950'
                : 'border-gray-200 dark:border-gray-700'
            )}
          >
            None
          </button>
          {PALETTE.slice(0, 8).map((color) => (
            <button
              key={`fill-${color}`}
              type="button"
              aria-label={`Fill ${color}`}
              onClick={() => {
                setFillColor(color);
                applyStyleToSelection({ fill: color });
              }}
              className={cn(
                'h-7 w-7 rounded-md border-2',
                fillColor === color ? 'border-blue-500' : 'border-gray-200 dark:border-gray-700'
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      <div>
        <Label className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-500">
          <span>Stroke width</span>
          <span className="text-gray-900 dark:text-gray-100">{strokeWidth}px</span>
        </Label>
        <Slider
          value={[strokeWidth]}
          min={1}
          max={24}
          step={1}
          onValueChange={([value]) => {
            setStrokeWidth(value);
            applyStyleToSelection({ strokeWidth: value });
          }}
        />
      </div>

      {tool === 'erase' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
          <Label className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
            <span>Eraser size</span>
            <span>{eraserWidth}px</span>
          </Label>
          <Slider
            value={[eraserWidth]}
            min={6}
            max={80}
            step={2}
            onValueChange={([value]) => setEraserWidth(value)}
          />
          <p className="mt-2 text-[11px] text-amber-800/80 dark:text-amber-300/80">
            Drag to rub out. To remove a whole shape or outline instead, switch to Select,
            click it and press Delete.
          </p>
        </div>
      )}

      <div>
        <Label className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-500">
          <span>Text size</span>
          <span className="text-gray-900 dark:text-gray-100">{fontSize}px</span>
        </Label>
        <Slider
          value={[fontSize]}
          min={10}
          max={72}
          step={1}
          onValueChange={([value]) => {
            setFontSize(value);
            applyStyleToSelection({ fontSize: value });
          }}
        />
      </div>

      <div>
        <Label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <Shapes className="h-3.5 w-3.5" /> Garment outlines
        </Label>
        <div className="grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto pr-1">
          {GARMENT_TEMPLATES.map((template) => (
            <Button
              key={template.id}
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => addTemplate(template.id)}
            >
              {template.label}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <Label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <Layers className="h-3.5 w-3.5" /> Arrange
        </Label>
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={!hasSelection}
            onClick={() => reorder('front')}
          >
            <BringToFront className="mr-1 h-3.5 w-3.5" /> Front
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={!hasSelection}
            onClick={() => reorder('back')}
          >
            <SendToBack className="mr-1 h-3.5 w-3.5" /> Back
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={!hasSelection}
            onClick={duplicateSelection}
          >
            <Copy className="mr-1 h-3.5 w-3.5" /> Duplicate
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs text-red-600 hover:bg-red-50"
            disabled={!hasSelection}
            onClick={deleteSelection}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-2 h-8 w-full text-xs"
          disabled={!hasSelection}
          onClick={ungroupSelection}
        >
          <Ungroup className="mr-1 h-3.5 w-3.5" /> Split outline into parts
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="mt-2 h-8 w-full text-xs text-red-600 hover:bg-red-50"
          onClick={clearCanvas}
        >
          Clear canvas
        </Button>
      </div>
    </div>
  );

  /*
   * The studio is a Radix dialog layer in its own right, not a hand-rolled overlay.
   *
   * It opens from *inside* the order dialog, and a modal Radix dialog traps focus to its own
   * subtree — a plain portal put the studio outside that subtree, so fabric's hidden textarea
   * lost focus the instant it was given it and every keystroke went to the dialog behind.
   * Registering as a nested layer puts the studio on top of Radix's stack, which means focus,
   * Escape and pointer events all belong to it while it is open.
   */
  return (
    <DialogPrimitive.Root
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/60" />
        <DialogPrimitive.Content
          ref={shellRef}
          className="fixed inset-0 z-[100] flex flex-col bg-gray-100 outline-none dark:bg-gray-950"
          // Escape is handled by the studio's own key handler (exit text editing / clear the
          // selection). Closing on Escape would throw away an unsaved design.
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between gap-2 border-b bg-white px-3 py-2 dark:border-gray-800 dark:bg-gray-900 sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 p-1.5">
            <Palette className="h-4 w-4 text-white sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100 sm:text-base">
              {title}
            </h2>
            {subtitle && (
              <p className="truncate text-[11px] text-gray-500 dark:text-gray-400 sm:text-xs">
                {subtitle}
              </p>
            )}
          </div>
          <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">
            {objectCount} element{objectCount === 1 ? '' : 's'}
          </Badge>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 lg:hidden"
            onClick={() => setPanelOpen(true)}
            title="Style options"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="hidden h-9 sm:inline-flex"
            onClick={handleDownload}
          >
            <Download className="mr-1.5 h-4 w-4" />
            PNG
          </Button>
          <Button
            size="sm"
            className="h-9 bg-gradient-to-r from-purple-600 to-blue-600"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            Save
          </Button>
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={onClose} title="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {/* Tool rail — vertical on desktop, bottom bar on mobile (rendered below) */}
        <nav className="hidden w-14 shrink-0 flex-col items-center gap-1 border-r bg-white py-3 dark:border-gray-800 dark:bg-gray-900 sm:flex">
          {TOOLS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              title={`${entry.label} (${entry.key})`}
              onClick={() => setTool(entry.id)}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg transition',
                tool === entry.id
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
              )}
            >
              <entry.icon className="h-4.5 w-4.5" />
            </button>
          ))}
          <div className="my-1 h-px w-8 bg-gray-200 dark:bg-gray-700" />
          <button
            type="button"
            title="Add photo"
            onClick={() => fileRef.current?.click()}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {uploadingImage ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
          </button>
        </nav>

        {/* Canvas stage */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            ref={stageRef}
            className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-gray-200 p-2 dark:bg-gray-800"
          >
            <div className="shadow-lg">
              <canvas ref={setCanvasEl} className="touch-none rounded-sm" />
            </div>

            {/* Zoom controls float over the artboard so they never eat layout space */}
            <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg border bg-white/95 p-1 shadow dark:border-gray-700 dark:bg-gray-900/95">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => applyZoom(zoom - 0.25)}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="w-11 text-center text-xs font-medium tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => applyZoom(zoom + 0.25)}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => applyZoom(1)}
                title="Reset zoom"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Mobile tool bar */}
          <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-t bg-white px-2 py-2 dark:border-gray-800 dark:bg-gray-900 sm:hidden">
            {TOOLS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-label={entry.label}
                onClick={() => setTool(entry.id)}
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition',
                  tool === entry.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                )}
              >
                <entry.icon className="h-5 w-5" />
              </button>
            ))}
            <button
              type="button"
              aria-label="Add photo"
              onClick={() => fileRef.current?.click()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {uploadingImage ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ImagePlus className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Properties panel — always visible from lg up */}
        <aside className="hidden w-64 shrink-0 overflow-y-auto border-l bg-white p-4 dark:border-gray-800 dark:bg-gray-900 lg:block">
          {styleControls}
        </aside>
      </div>

      {/* Properties sheet for small screens */}
      {panelOpen && (
        <div className="fixed inset-0 z-[110] lg:hidden">
          <button
            type="button"
            aria-label="Close options"
            className="absolute inset-0 bg-black/50"
            onClick={() => setPanelOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-4 dark:bg-gray-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Style</h3>
              <Button variant="ghost" size="sm" onClick={() => setPanelOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {styleControls}
          </div>
        </div>
      )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImagePick}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

/* -------------------------------------------------------------------- helpers */

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });
}

/** Scales an imported image so it lands inside the artboard rather than off-screen. */
function fitImageToCanvas(canvas: FabricCanvas, img: FabricImage) {
  const maxWidth = canvas.getWidth() * 0.7;
  const maxHeight = canvas.getHeight() * 0.7;
  const scale = Math.min(maxWidth / (img.width || 1), maxHeight / (img.height || 1), 1);
  img.set({
    scaleX: scale,
    scaleY: scale,
    left: (canvas.getWidth() - (img.width || 0) * scale) / 2,
    top: (canvas.getHeight() - (img.height || 0) * scale) / 2,
  });
}

/** A line with a solid triangular head, grouped so it behaves as one object. */
function buildArrow(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number
) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headSize = Math.max(10, width * 4);

  const line = new Line([x1, y1, x2, y2], { stroke: color, strokeWidth: width });
  const head = new Triangle({
    left: x2,
    top: y2,
    width: headSize,
    height: headSize,
    fill: color,
    originX: 'center',
    originY: 'center',
    angle: (angle * 180) / Math.PI + 90,
  });

  return new Group([line, head]);
}

/**
 * Garment outlines drawn from primitives — no external assets, so they work offline, stay
 * crisp at any zoom and can be recoloured or resized like any other object.
 *
 * Everything is expressed in fractions of `unit` around the artboard centre, so a template
 * looks the same on a phone and on a desktop.
 */
function buildTemplate(id: TemplateId, canvasWidth: number, canvasHeight: number) {
  const unit = Math.min(canvasWidth, canvasHeight) * 0.55;
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;

  const outline = {
    fill: '',
    stroke: '#334155',
    strokeWidth: 2,
  };
  const guide = {
    stroke: '#94a3b8',
    strokeWidth: 1,
    strokeDashArray: [6, 6] as number[],
  };

  const p = (x: number, y: number) => ({ x: cx + x * unit, y: cy + y * unit });
  const line = (x1: number, y1: number, x2: number, y2: number, style = guide) =>
    new Line([p(x1, y1).x, p(x1, y1).y, p(x2, y2).x, p(x2, y2).y], style);
  const poly = (points: [number, number][], style = outline) =>
    new Polygon(points.map(([x, y]) => p(x, y)), style);
  const group = (objects: any[]) =>
    new Group(objects, { left: cx, top: cy, originX: 'center', originY: 'center' });

  switch (id) {
    case 'blouse':
      return group([
        poly([
          [-0.45, -0.34], [-0.18, -0.42], [0, -0.28], [0.18, -0.42], [0.45, -0.34],
          [0.3, -0.04], [0.34, 0.3], [-0.34, 0.3], [-0.3, -0.04],
        ]),
        line(0, -0.28, 0, 0.3),
        line(-0.3, -0.04, 0.3, -0.04),
      ]);

    case 'saree':
      // Pallu over the shoulder plus the pleated drape — the shape used to mark
      // border, pallu work and pleat placement.
      return group([
        poly([[-0.3, -0.5], [0.3, -0.5], [0.42, 0.55], [-0.42, 0.55]]),
        poly([[0.06, -0.5], [0.32, -0.44], [0.2, 0.1], [-0.02, 0.02]], {
          fill: '',
          stroke: '#64748b',
          strokeWidth: 1.5,
        }),
        line(-0.16, -0.1, -0.16, 0.55),
        line(-0.05, -0.1, -0.05, 0.55),
        line(0.06, -0.1, 0.06, 0.55),
        line(-0.42, 0.46, 0.42, 0.46, { stroke: '#64748b', strokeWidth: 3, strokeDashArray: [] }),
      ]);

    case 'kurti':
      return group([
        poly([
          [-0.32, -0.48], [-0.12, -0.54], [0, -0.44], [0.12, -0.54], [0.32, -0.48],
          [0.26, -0.18], [0.36, 0.55], [-0.36, 0.55], [-0.26, -0.18],
        ]),
        line(0, -0.44, 0, 0.55),
        line(-0.28, 0.12, 0.28, 0.12),
      ]);

    case 'lehenga':
      return group([
        poly([[-0.3, -0.5], [0.3, -0.5], [0.24, -0.14], [-0.24, -0.14]]),
        poly([[-0.22, -0.04], [0.22, -0.04], [0.52, 0.55], [-0.52, 0.55]]),
        line(-0.52, 0.44, 0.52, 0.44, { stroke: '#64748b', strokeWidth: 3, strokeDashArray: [] }),
      ]);

    case 'gown':
      return group([
        poly([
          [-0.24, -0.55], [0.24, -0.55], [0.18, -0.12], [0.46, 0.55], [-0.46, 0.55], [-0.18, -0.12],
        ]),
        line(-0.19, -0.12, 0.19, -0.12),
        line(0, -0.55, 0, 0.55),
      ]);

    case 'dress':
      return group([
        poly([
          [-0.3, -0.5], [-0.1, -0.55], [0, -0.45], [0.1, -0.55], [0.3, -0.5],
          [0.2, -0.1], [0.4, 0.5], [-0.4, 0.5], [-0.2, -0.1],
        ]),
        line(-0.21, -0.1, 0.21, -0.1),
      ]);

    case 'frock':
      // Short yoke, wide flare — the shape used for children's frocks.
      return group([
        poly([[-0.22, -0.45], [0.22, -0.45], [0.18, -0.18], [-0.18, -0.18]]),
        poly([[-0.18, -0.16], [0.18, -0.16], [0.44, 0.34], [-0.44, 0.34]]),
        line(-0.44, 0.26, 0.44, 0.26, { stroke: '#64748b', strokeWidth: 2.5, strokeDashArray: [] }),
        line(0, -0.45, 0, 0.34),
      ]);

    case 'top':
      return group([
        poly([
          [-0.4, -0.32], [-0.16, -0.4], [0, -0.26], [0.16, -0.4], [0.4, -0.32],
          [0.28, -0.06], [0.3, 0.28], [-0.3, 0.28], [-0.28, -0.06],
        ]),
        line(0, -0.26, 0, 0.28),
      ]);

    case 'inskirt':
      // Petticoat / inskirt: straight waist, slight A-line, hem band.
      return group([
        poly([[-0.2, -0.42], [0.2, -0.42], [0.34, 0.5], [-0.34, 0.5]]),
        line(-0.2, -0.34, 0.2, -0.34, { stroke: '#64748b', strokeWidth: 2.5, strokeDashArray: [] }),
        line(-0.34, 0.42, 0.34, 0.42),
        line(0, -0.42, 0, 0.5),
      ]);

    case 'palazzo':
      return group([
        poly([[-0.2, -0.45], [0.2, -0.45], [0.42, 0.5], [0.03, 0.5], [0, 0.0], [-0.03, 0.5], [-0.42, 0.5]]),
        line(-0.2, -0.37, 0.2, -0.37, { stroke: '#64748b', strokeWidth: 2.5, strokeDashArray: [] }),
      ]);

    case 'salwar':
      return group([
        poly([[-0.24, -0.45], [0.24, -0.45], [0.3, 0.2], [0.12, 0.5], [0.02, 0.5], [0, 0.05], [-0.02, 0.5], [-0.12, 0.5], [-0.3, 0.2]]),
        line(-0.24, -0.37, 0.24, -0.37, { stroke: '#64748b', strokeWidth: 2.5, strokeDashArray: [] }),
        line(-0.12, 0.42, 0.12, 0.42),
      ]);

    case 'dupatta':
      return group([
        poly([[-0.45, -0.28], [0.45, -0.28], [0.45, 0.28], [-0.45, 0.28]]),
        line(-0.45, -0.2, 0.45, -0.2, { stroke: '#64748b', strokeWidth: 3, strokeDashArray: [] }),
        line(-0.45, 0.2, 0.45, 0.2, { stroke: '#64748b', strokeWidth: 3, strokeDashArray: [] }),
      ]);

    case 'sleeve':
      return group([
        poly([[-0.16, -0.4], [0.16, -0.4], [0.22, 0.4], [-0.22, 0.4]]),
        new Circle({
          left: p(0, -0.4).x,
          top: p(0, -0.4).y,
          radius: unit * 0.16,
          fill: '',
          stroke: '#94a3b8',
          strokeWidth: 1,
          strokeDashArray: [5, 5],
          originX: 'center',
          originY: 'center',
        }),
        line(-0.22, 0.32, 0.22, 0.32),
      ]);

    case 'neckRound':
      return group([
        poly([[-0.32, -0.2], [0.32, -0.2], [0.32, 0.28], [-0.32, 0.28]]),
        new Ellipse({
          left: p(0, -0.2).x,
          top: p(0, -0.2).y,
          rx: unit * 0.15,
          ry: unit * 0.13,
          ...outline,
          originX: 'center',
          originY: 'center',
        }),
      ]);

    case 'neckV':
      return group([
        poly([[-0.32, -0.2], [0.32, -0.2], [0.32, 0.28], [-0.32, 0.28]]),
        poly([[-0.14, -0.2], [0.14, -0.2], [0, 0.08]]),
      ]);

    case 'neckBoat':
      return group([
        poly([[-0.32, -0.2], [0.32, -0.2], [0.32, 0.28], [-0.32, 0.28]]),
        poly([[-0.22, -0.2], [0.22, -0.2], [0.16, -0.08], [-0.16, -0.08]]),
      ]);

    default:
      return null;
  }
}

export default DesignStudio;
