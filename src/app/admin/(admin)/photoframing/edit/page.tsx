"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Loader2,
  Grid,
  ZoomIn,
  ZoomOut,
  Layers,
  Type,
  Layout,
  Eye,
  Plus,
  Trash2,
  AlertTriangle,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import { useFrameStore } from "@/store/frameStore";

// Define local types
interface PlacementCoords {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TextSettings {
  x: number;
  y: number;
  width: number;
  height: number;
  font: string;
  size: number;
  color: string;
  align?: "left" | "center" | "right";
  label?: string;
}

interface EditorData {
  dimensions: {
    width: number;
    height: number;
  };
  hasImageArea: boolean;
  placementCoords: PlacementCoords | null;
  textSettings: TextSettings[];
}

interface FormErrors {
  name?: string;
  frameImage?: string;
  submit?: string;
  fetch?: string;
}

interface ResizeHandle {
  target: "image" | "text";
  handle: "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
  index?: number;
}

// Canvas Container Component
interface CanvasContainerProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  dimensions: { width: number; height: number };
  zoom: number;
  isPreviewMode: boolean;
  isLoading: boolean;
  onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseUp: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseLeave: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  cursorStyle: string;
}

const CanvasContainer: React.FC<CanvasContainerProps> = ({
  canvasRef,
  dimensions,
  zoom,
  isPreviewMode,
  isLoading,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  cursorStyle,
}) => {
  const calculateScale = () => {
    const maxWidth = 600;
    const maxHeight = 500;
    if (dimensions.width === 0) return 1;
    const widthScale = maxWidth / dimensions.width;
    const heightScale = maxHeight / dimensions.height;
    return Math.min(widthScale, heightScale, 1) * zoom;
  };

  const scale = calculateScale();

  return (
    <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 relative h-[500px] flex items-center justify-center shadow-inner group">
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "center",
          width: `${dimensions.width}px`,
          height: `${dimensions.height}px`,
          position: "relative",
        }}
        className="canvas-wrapper z-10 transition-transform duration-200 ease-out"
      >
        {isPreviewMode ? (
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={dimensions.width}
              height={dimensions.height}
              className="cursor-default shadow-2xl rounded-sm"
            />
            {isLoading && (
              <div className="absolute inset-0 bg-white/20 dark:bg-black/40 flex items-center justify-center backdrop-blur-md rounded-sm">
                <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
              </div>
            )}
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            width={dimensions.width}
            height={dimensions.height}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
            className={`${cursorStyle} rounded-sm shadow-xl transition-shadow duration-300`}
          />
        )}
      </div>
      <div className="absolute bottom-4 left-4 flex gap-2 z-20">
        <div className="bg-white/90 dark:bg-gray-900/90 text-gray-800 dark:text-gray-100 text-[10px] font-bold px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 backdrop-blur-md shadow-sm uppercase tracking-wider">
          {dimensions.width} × {dimensions.height} PX
        </div>
      </div>
    </div>
  );
};

export default function EditFramePage() {
  return (
    <React.Suspense fallback={<div className="p-10 flex justify-center"><Loader2 className="animate-spin h-10 w-10 text-blue-500" /></div>}>
      <EditFrameWrapper />
    </React.Suspense>
  );
}

function EditFrameWrapper() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const frameId = searchParams.get("id");
  const { frames, updateFrame, fetchFrames } = useFrameStore() as any;

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Core State
  const [name, setName] = useState<string>("");
  const [sampleText, setSampleText] = useState<string>("Sample Text");
  const [frameImage, setFrameImage] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errors, setErrors] = useState<FormErrors>({});
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(1);
  const [previewMode, setPreviewMode] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"image" | "text">("image");
  const [activeTextIndex, setActiveTextIndex] = useState<number>(0);

  // Canvas State
  const [isDraggingImage, setIsDraggingImage] = useState<boolean>(false);
  const [isDraggingText, setIsDraggingText] = useState<boolean>(false);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);

  const [editorData, setEditorData] = useState<EditorData>({
    dimensions: { width: 600, height: 600 },
    hasImageArea: true,
    placementCoords: { x: 150, y: 150, width: 300, height: 300 },
    textSettings: [
      {
        x: 150,
        y: 480,
        width: 300,
        height: 60,
        font: "Arial",
        size: 32,
        color: "#ffffff",
        label: "Text Field",
      },
    ],
  });



  // Fetch frame data
  useEffect(() => {
    const fetchFrameData = async () => {
      if (!frameId) {
        router.push("/admin/photoframing/all");
        return;
      }

      try {
        setIsLoading(true);
        if (frames.length === 0) await fetchFrames();
        const frame = frames.find((f: any) => f._id === frameId);

        if (frame) {
          initializeFormWithFrame(frame);
        } else {
          // Fallback fetch if not in store
          const response = await fetch(`/api/frames/${frameId}`, {
            headers: { 'x-api-key': "9a4f2c8d7e1b5f3a9c2d8e7f1b4a5c3d" },
          });
          const data = await response.json();
          if (data.success) {
            initializeFormWithFrame(data.data);
          } else {
            throw new Error(data.message || "Failed to fetch frame");
          }
        }
      } catch (error: any) {
        setErrors({ fetch: error.message });
      } finally {
        setIsLoading(false);
      }
    };

    fetchFrameData();
  }, [frameId, frames, fetchFrames, router]);

  const initializeFormWithFrame = (frame: any) => {
    setName(frame.name);
    setCurrentImageUrl(frame.imageUrl);
    setPreviewImage(frame.imageUrl);

    // Support legacy and new textSettings
    const textArr = Array.isArray(frame.textSettings)
      ? frame.textSettings
      : (frame.textSettings ? [frame.textSettings] : []);

    setEditorData({
      dimensions: {
        width: frame.dimensions?.width || 600,
        height: frame.dimensions?.height || 600,
      },
      hasImageArea: frame.hasImageArea !== false,
      placementCoords: frame.placementCoords || null,
      textSettings: textArr,
    });
    setActiveTextIndex(0);
  };

  // Canvas Drawing Effect
  useEffect(() => {
    if (!canvasRef.current || !previewImage) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = editorData.dimensions.width;
    canvas.height = editorData.dimensions.height;

    const handleSize = 12;
    const drawHandle = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string, isActive: boolean = false) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, isActive ? handleSize / 1.5 : handleSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    const img = new Image();
    img.src = previewImage;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Draw Grid
      if (showGrid) {
        ctx.strokeStyle = "rgba(156, 163, 175, 0.2)";
        ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width; x += 50) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += 50) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }
      }

      // Draw Image Area
      if (editorData.hasImageArea && editorData.placementCoords) {
        const pc = editorData.placementCoords;
        const isActive = activeTab === "image";

        ctx.fillStyle = isActive ? "rgba(59, 130, 246, 0.4)" : "rgba(59, 130, 246, 0.15)";
        ctx.fillRect(pc.x, pc.y, pc.width, pc.height);

        ctx.strokeStyle = "rgba(37, 99, 235, 1)";
        ctx.lineWidth = isActive ? 3 : 1;
        ctx.strokeRect(pc.x, pc.y, pc.width, pc.height);

        if (isActive) {
          const color = "rgba(37, 99, 235, 1)";
          drawHandle(ctx, pc.x, pc.y, color);
          drawHandle(ctx, pc.x + pc.width, pc.y, color);
          drawHandle(ctx, pc.x, pc.y + pc.height, color);
          drawHandle(ctx, pc.x + pc.width, pc.y + pc.height, color);
        }
      }

      // Draw Text Areas
      editorData.textSettings.forEach((ts, index) => {
        const isActive = activeTextIndex === index && activeTab === "text";

        ctx.fillStyle = isActive ? "rgba(16, 185, 129, 0.4)" : "rgba(16, 185, 129, 0.15)";
        ctx.fillRect(ts.x, ts.y, ts.width, ts.height);

        ctx.strokeStyle = "rgba(5, 150, 105, 1)";
        ctx.lineWidth = isActive ? 3 : 1;
        ctx.strokeRect(ts.x, ts.y, ts.width, ts.height);

        if (isActive) {
          const color = "rgba(5, 150, 105, 1)";
          drawHandle(ctx, ts.x, ts.y, color);
          drawHandle(ctx, ts.x + ts.width, ts.y, color);
          drawHandle(ctx, ts.x, ts.y + ts.height, color);
          drawHandle(ctx, ts.x + ts.width, ts.y + ts.height, color);
        }

        // Render Text
        ctx.font = `${ts.size}px ${ts.font}`;
        ctx.fillStyle = ts.color;
        ctx.textAlign = ts.align || "center";
        ctx.textBaseline = "middle";

        let textX = ts.x + ts.width / 2;
        if (ts.align === "left") textX = ts.x;
        if (ts.align === "right") textX = ts.x + ts.width;

        ctx.fillText(sampleText || "Text Area", textX, ts.y + ts.height / 2);
      });
    };
  }, [previewImage, editorData, showGrid, sampleText, activeTextIndex, activeTab]);

  // Preview logic same as Create
  useEffect(() => {
    if (!previewCanvasRef.current || !previewImage) return;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = editorData.dimensions.width;
    canvas.height = editorData.dimensions.height;

    const frameImg = new Image();
    frameImg.src = previewImage;
    const userImg = new Image();
    userImg.src = "/api/placeholder/400/400";

    frameImg.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);

      const renderObjects = () => {
        editorData.textSettings.forEach(ts => {
          ctx.font = `${ts.size}px ${ts.font}`;
          ctx.fillStyle = ts.color;
          ctx.textAlign = ts.align || "center";
          ctx.textBaseline = "middle";

          let textX = ts.x + ts.width / 2;
          if (ts.align === "left") textX = ts.x;
          if (ts.align === "right") textX = ts.x + ts.width;

          ctx.fillText(sampleText, textX, ts.y + ts.height / 2);
        });
      };

      if (editorData.hasImageArea && editorData.placementCoords) {
        userImg.onload = () => {
          ctx.drawImage(userImg, editorData.placementCoords!.x, editorData.placementCoords!.y, editorData.placementCoords!.width, editorData.placementCoords!.height);
          renderObjects();
        };
        userImg.onerror = () => {
          ctx.fillStyle = "rgba(156, 163, 175, 0.5)";
          ctx.fillRect(editorData.placementCoords!.x, editorData.placementCoords!.y, editorData.placementCoords!.width, editorData.placementCoords!.height);
          renderObjects();
        };
      } else {
        renderObjects();
      }
    };
  }, [previewImage, editorData, sampleText, previewMode]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = editorData.dimensions.width / rect.width;
    const scaleY = editorData.dimensions.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const handleDist = 15;

    for (let i = editorData.textSettings.length - 1; i >= 0; i--) {
      const ts = editorData.textSettings[i];
      if (Math.abs(x - ts.x) < handleDist && Math.abs(y - ts.y) < handleDist) { setResizeHandle({ target: "text", handle: "topLeft", index: i }); }
      else if (Math.abs(x - (ts.x + ts.width)) < handleDist && Math.abs(y - ts.y) < handleDist) { setResizeHandle({ target: "text", handle: "topRight", index: i }); }
      else if (Math.abs(x - ts.x) < handleDist && Math.abs(y - (ts.y + ts.height)) < handleDist) { setResizeHandle({ target: "text", handle: "bottomLeft", index: i }); }
      else if (Math.abs(x - (ts.x + ts.width)) < handleDist && Math.abs(y - (ts.y + ts.height)) < handleDist) { setResizeHandle({ target: "text", handle: "bottomRight", index: i }); }
      else if (x > ts.x && x < ts.x + ts.width && y > ts.y && y < ts.y + ts.height) {
        setIsDraggingText(true);
        setActiveTextIndex(i);
        setActiveTab("text");
        setDragStartPos({ x: x - ts.x, y: y - ts.y });
        return;
      }
      if (resizeHandle) { setActiveTextIndex(i); setActiveTab("text"); return; }
    }

    if (editorData.hasImageArea && editorData.placementCoords) {
      const pc = editorData.placementCoords;
      if (Math.abs(x - pc.x) < handleDist && Math.abs(y - pc.y) < handleDist) { setResizeHandle({ target: "image", handle: "topLeft" }); }
      else if (Math.abs(x - (pc.x + pc.width)) < handleDist && Math.abs(y - pc.y) < handleDist) { setResizeHandle({ target: "image", handle: "topRight" }); }
      else if (Math.abs(x - pc.x) < handleDist && Math.abs(y - (pc.y + pc.height)) < handleDist) { setResizeHandle({ target: "image", handle: "bottomLeft" }); }
      else if (Math.abs(x - (pc.x + pc.width)) < handleDist && Math.abs(y - (pc.y + pc.height)) < handleDist) { setResizeHandle({ target: "image", handle: "bottomRight" }); }
      else if (x > pc.x && x < pc.x + pc.width && y > pc.y && y < pc.y + pc.height) {
        setIsDraggingImage(true);
        setActiveTab("image");
        setDragStartPos({ x: x - pc.x, y: y - pc.y });
        return;
      }
      if (resizeHandle) { setActiveTab("image"); return; }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = editorData.dimensions.width / rect.width;
    const scaleY = editorData.dimensions.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (resizeHandle) {
      const { target, handle, index } = resizeHandle;
      if (target === "image" && editorData.placementCoords) {
        const pc = { ...editorData.placementCoords };
        if (handle === "topLeft") { pc.width += pc.x - x; pc.height += pc.y - y; pc.x = x; pc.y = y; }
        if (handle === "topRight") { pc.width = x - pc.x; pc.height += pc.y - y; pc.y = y; }
        if (handle === "bottomLeft") { pc.width += pc.x - x; pc.height = y - pc.y; pc.x = x; }
        if (handle === "bottomRight") { pc.width = x - pc.x; pc.height = y - pc.y; }
        if (pc.width > 20 && pc.height > 20) setEditorData(prev => ({ ...prev, placementCoords: pc }));
      } else if (target === "text" && index !== undefined) {
        const newTS = [...editorData.textSettings];
        const ts = { ...newTS[index] };
        if (handle === "topLeft") { ts.width += ts.x - x; ts.height += ts.y - y; ts.x = x; ts.y = y; }
        if (handle === "topRight") { ts.width = x - ts.x; ts.height += ts.y - y; ts.y = y; }
        if (handle === "bottomLeft") { ts.width += ts.x - x; ts.height = y - ts.y; ts.x = x; }
        if (handle === "bottomRight") { ts.width = x - ts.x; ts.height = y - ts.y; }
        if (ts.width > 10 && ts.height > 10) {
          newTS[index] = ts;
          setEditorData(prev => ({ ...prev, textSettings: newTS }));
        }
      }
      return;
    }

    if (isDraggingImage && editorData.placementCoords) {
      setEditorData(prev => ({ ...prev, placementCoords: { ...prev.placementCoords!, x: x - dragStartPos.x, y: y - dragStartPos.y } }));
    }

    if (isDraggingText && activeTextIndex !== undefined) {
      setEditorData(prev => {
        const newTS = [...prev.textSettings];
        newTS[activeTextIndex] = { ...newTS[activeTextIndex], x: x - dragStartPos.x, y: y - dragStartPos.y };
        return { ...prev, textSettings: newTS };
      });
    }
  };

  const addTextSettings = () => {
    setEditorData(prev => ({
      ...prev,
      textSettings: [...prev.textSettings, { x: 100, y: 100, width: 200, height: 50, font: "Arial", size: 24, color: "#ffffff", align: "center", label: `Text Field ${prev.textSettings.length + 1}` }]
    }));
    setActiveTextIndex(editorData.textSettings.length);
    setActiveTab("text");
  };

  const removeTextSettings = (index: number) => {
    // No longer requiring at least 1 text setting
    setEditorData(prev => ({ ...prev, textSettings: prev.textSettings.filter((_, i) => i !== index) }));
    if (activeTextIndex >= index) setActiveTextIndex(Math.max(0, activeTextIndex - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !frameId) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("name", name);
      if (frameImage) formData.append("frameImage", frameImage);
      formData.append("currentImageUrl", currentImageUrl || "");
      formData.append("dimensions", JSON.stringify(editorData.dimensions));
      formData.append("hasImageArea", String(editorData.hasImageArea));
      if (editorData.hasImageArea) formData.append("placementCoords", JSON.stringify(editorData.placementCoords));
      formData.append("textSettings", JSON.stringify(editorData.textSettings));

      const response = await fetch(`/api/frames/${frameId}`, {
        method: "PUT",
        body: formData,
        headers: { 'x-api-key': '9a4f2c8d7e1b5f3a9c2d8e7f1b4a5c3d' }
      });

      const data = await response.json();
      if (data.success) {
        updateFrame(data.data);
        router.push("/admin/photoframing/all");
      } else {
        throw new Error(data.message);
      }
    } catch (err: any) {
      setErrors({ submit: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading && !errors.fetch) {
    return <div className="p-10 flex justify-center"><Loader2 className="animate-spin h-10 w-10 text-blue-500" /></div>;
  }

  if (errors.fetch) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">Failed to load frame</h2>
        <p className="text-gray-500 mb-6">{errors.fetch}</p>
        <Link href="/admin/photoframing/all" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Back to Frames</Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 pb-6 border-b border-gray-100 dark:border-gray-800">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2 tracking-tight">Edit Frame</h1>
          <p className="text-gray-500 dark:text-gray-400">Modify your frame constraints and styling.</p>
        </div>
        <Link href="/admin/photoframing/all" className="inline-flex items-center text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-blue-600 transition-colors group">
          <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
        </Link>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        <aside className="xl:col-span-4 space-y-8 order-2 xl:order-1">
          {/* Metadata Section */}
          <section className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400"><Layout size={20} /></div>
              <h2 className="text-xl font-bold dark:text-white">Basic Info</h2>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 ml-1">Frame Title</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl ring-1 ring-gray-200 dark:ring-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 ml-1">Frame Image</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative cursor-pointer group rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-500 transition-all p-4 flex flex-col items-center justify-center"
              >
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setFrameImage(file);
                    setPreviewImage(URL.createObjectURL(file));
                  }
                }} />
                {previewImage && (
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden">
                    <NextImage src={previewImage} fill className="object-contain" alt="Preview" />
                  </div>
                )}
                <div className="mt-2 text-xs font-bold text-blue-600 uppercase">Change Image</div>
              </div>
            </div>
          </section>

          {/* Controls Section */}
          <section className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl overflow-hidden">
            <div className="flex border-b border-gray-100 dark:border-gray-800 p-1">
              {(["image", "text"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm transition-all
                    ${activeTab === tab ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" : "text-gray-500"}`}
                >
                  {tab === "image" ? <Layers size={18} /> : <Type size={18} />} {tab.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="p-6">
              {activeTab === "image" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl mb-4">
                    <span className="text-sm font-bold">Image Slot</span>
                    <button
                      onClick={() => setEditorData(prev => ({ ...prev, hasImageArea: !prev.hasImageArea }))}
                      className={`w-12 h-6 rounded-full transition-colors relative ${editorData.hasImageArea ? "bg-blue-500" : "bg-gray-300"}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${editorData.hasImageArea ? "left-7" : "left-1"}`} />
                    </button>
                  </div>
                  {editorData.hasImageArea && (
                    <div className="grid grid-cols-2 gap-3">
                      {["x", "y", "width", "height"].map(prop => (
                        <div key={prop}>
                          <label className="text-[10px] font-black uppercase text-gray-400 ml-1">{prop}</label>
                          <input
                            type="number"
                            value={Math.round((editorData.placementCoords as any)?.[prop] || 0)}
                            onChange={(e) => setEditorData(prev => ({ ...prev, placementCoords: { ...(prev.placementCoords as any), [prop]: Number(e.target.value) } }))}
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm font-bold ring-1 ring-gray-100 dark:ring-gray-700 outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "text" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold">Layers ({editorData.textSettings.length})</h3>
                    <button onClick={addTextSettings} className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-xl"><Plus size={18} /></button>
                  </div>

                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {editorData.textSettings.map((_, i) => (
                      <div
                        key={i}
                        onClick={() => setActiveTextIndex(i)}
                        className={`p-3 rounded-xl flex items-center justify-between cursor-pointer border-2 transition-all 
                           ${activeTextIndex === i ? "border-blue-500 bg-blue-50/50" : "border-transparent bg-gray-50 opacity-60"}`}
                      >
                        <span className="text-sm font-bold">Text Layer {i + 1}</span>
                        <button onClick={(e) => { e.stopPropagation(); removeTextSettings(i); }} className="text-red-400 hover:text-red-500"><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {["x", "y", "width", "height"].map(prop => (
                        <div key={prop}>
                          <label className="text-[10px] font-black uppercase text-gray-400 ml-1">{prop}</label>
                          <input
                            type="number"
                            value={Math.round((editorData.textSettings[activeTextIndex] as any)?.[prop] || 0)}
                            onChange={(e) => setEditorData(prev => {
                              const next = [...prev.textSettings];
                              next[activeTextIndex] = { ...next[activeTextIndex], [prop]: Number(e.target.value) };
                              return { ...prev, textSettings: next };
                            })}
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm font-bold ring-1 ring-gray-100 dark:ring-gray-700"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Font Color</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={editorData.textSettings[activeTextIndex]?.color || "#ffffff"}
                          onChange={(e) => setEditorData(prev => {
                            const next = [...prev.textSettings];
                            next[activeTextIndex] = { ...next[activeTextIndex], color: e.target.value };
                            return { ...prev, textSettings: next };
                          })}
                          className="w-12 h-10 p-1 bg-gray-50 dark:bg-gray-800 border-none rounded-xl"
                        />
                        <input
                          type="text"
                          value={editorData.textSettings[activeTextIndex]?.color}
                          onChange={(e) => setEditorData(prev => {
                            const next = [...prev.textSettings];
                            next[activeTextIndex] = { ...next[activeTextIndex], color: e.target.value };
                            return { ...prev, textSettings: next };
                          })}
                          className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm font-mono font-bold ring-1 ring-gray-100 dark:ring-gray-700"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pb-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Size</label>
                        <input
                          type="number"
                          value={editorData.textSettings[activeTextIndex]?.size}
                          onChange={(e) => setEditorData(prev => {
                            const next = [...prev.textSettings];
                            next[activeTextIndex] = { ...next[activeTextIndex], size: Number(e.target.value) };
                            return { ...prev, textSettings: next };
                          })}
                          className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm font-bold ring-1 ring-gray-100 dark:ring-gray-700"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Font</label>
                        <select
                          value={editorData.textSettings[activeTextIndex]?.font}
                          onChange={(e) => setEditorData(prev => {
                            const next = [...prev.textSettings];
                            next[activeTextIndex] = { ...next[activeTextIndex], font: e.target.value };
                            return { ...prev, textSettings: next };
                          })}
                          className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm font-bold ring-1 ring-gray-100 dark:ring-gray-700"
                        >
                          {["Arial", "Times New Roman", "Impact", "Georgia", "Verdana", "Majalla", "MajallaB"].map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Alignment</label>
                      <div className="flex bg-gray-50 dark:bg-gray-800 p-1 rounded-2xl gap-1">
                        {(["left", "center", "right"] as const).map((align) => (
                          <button
                            key={align}
                            onClick={() => setEditorData(prev => {
                              const next = [...prev.textSettings];
                              next[activeTextIndex] = { ...next[activeTextIndex], align };
                              return { ...prev, textSettings: next };
                            })}
                            className={`flex-1 flex items-center justify-center p-2 rounded-xl transition-all ${editorData.textSettings[activeTextIndex]?.align === align ? "bg-white dark:bg-gray-700 text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
                          >
                            {align === "left" && <AlignLeft size={18} />}
                            {align === "center" && <AlignCenter size={18} />}
                            {align === "right" && <AlignRight size={18} />}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1 mt-2">
                      <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Input Label</label>
                      <input
                        type="text"
                        placeholder="e.g. Your Name"
                        value={editorData.textSettings[activeTextIndex]?.label || ""}
                        onChange={(e) => setEditorData(prev => {
                          const next = [...prev.textSettings];
                          next[activeTextIndex] = { ...next[activeTextIndex], label: e.target.value };
                          return { ...prev, textSettings: next };
                        })}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm font-bold ring-1 ring-gray-100 dark:ring-gray-700 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`w-full py-4 rounded-3xl font-black text-lg flex items-center justify-center gap-3 transition-all
            ${isSubmitting ? "bg-gray-200 text-gray-400" : "bg-blue-600 text-white shadow-2xl hover:-translate-y-1 active:scale-95"}`}
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={20} />}
            {isSubmitting ? "Saving..." : "Save Frame"}
          </button>
        </aside>

        <main className="xl:col-span-8 space-y-6 order-1 xl:order-2">
          <div className="sticky top-6 z-30 flex items-center justify-between p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-white dark:border-gray-800 rounded-3xl shadow-xl">
            <div className="flex gap-2">
              <button onClick={() => setShowGrid(!showGrid)} className={`p-2.5 rounded-2xl ${showGrid ? "bg-blue-100 text-blue-600" : "bg-gray-50 text-gray-400"}`} title="Toggle Grid"><Grid size={18} /></button>
              <button onClick={() => setZoom(prev => Math.min(prev + 0.1, 2))} className="p-2.5 rounded-2xl bg-gray-50 dark:bg-gray-800"><ZoomIn size={18} /></button>
              <button onClick={() => setZoom(prev => Math.max(prev - 0.1, 0.5))} className="p-2.5 rounded-2xl bg-gray-50 dark:bg-gray-800"><ZoomOut size={18} /></button>
            </div>

            <div className="flex items-center gap-4 text-xs font-bold">
              <input type="text" value={sampleText} onChange={(e) => setSampleText(e.target.value)} className="px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-2xl outline-none ring-1 ring-gray-100" />
              <button onClick={() => setPreviewMode(!previewMode)} className={`px-5 py-2.5 rounded-2xl flex items-center gap-2 ${previewMode ? "bg-amber-100 text-amber-600" : "bg-gray-50"}`}><Eye size={16} /> Preview</button>
            </div>
          </div>

          <CanvasContainer
            canvasRef={previewMode ? previewCanvasRef : canvasRef}
            dimensions={editorData.dimensions}
            zoom={zoom}
            isPreviewMode={previewMode}
            isLoading={isLoading}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={() => { setResizeHandle(null); setIsDraggingImage(false); setIsDraggingText(false); }}
            onMouseLeave={() => { setResizeHandle(null); setIsDraggingImage(false); setIsDraggingText(false); }}
            cursorStyle={resizeHandle ? "cursor-grabbing" : isDraggingImage || isDraggingText ? "cursor-grabbing" : "cursor-crosshair"}
          />
        </main>
      </div>
    </div>
  );
}