"use client";

import React, { useState, useEffect, useRef, MouseEvent, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import {
    Upload,
    ArrowRight,
    Search,
    ChevronLeft,
    Maximize2,
    Share,
    X,
    Save
} from "lucide-react";
import NextImage from "next/image";
import { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Frame } from "@/types";
import FrameCard from "./FrameCard";

// Dynamically import heavy components
const ReactCrop = dynamic(() => import('react-image-crop').then(mod => mod.ReactCrop), {
    ssr: false,
    loading: () => <div className="h-[400px] w-full bg-gray-100 animate-pulse rounded-2xl flex items-center justify-center">Loading editor...</div>
});

const BlinkBlur = dynamic(() => import('react-loading-indicators').then(mod => mod.BlinkBlur), {
    ssr: false
});

const UserPhotoFramingClient: React.FC = () => {
    const [frames, setFrames] = useState<Frame[]>([]);
    const [selectedFrame, setSelectedFrame] = useState<Frame | null>(null);
    const [userImage, setUserImage] = useState<string | null>(null);
    const [userTexts, setUserTexts] = useState<string[]>([]);
    const [debouncedTexts, setDebouncedTexts] = useState<string[]>([]);
    const [finalImage, setFinalImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [currentStep, setCurrentStep] = useState<"select" | "upload" | "crop" | "preview" | "complete">("select");
    const [favoriteFrames, setFavoriteFrames] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState<string>("");

    const [frameCopySuccess, setFrameCopySuccess] = useState<{ [key: string]: boolean }>({});
    const [isDragOver, setIsDragOver] = useState<boolean>(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const userImgRef = useRef<HTMLImageElement>(null);
    const cachedRenderDeps = useRef<{
        frameUrl: string | null;
        userUrl: string | null;
        frameImg: HTMLImageElement | null;
        userImg: HTMLImageElement | null;
    }>({ frameUrl: null, userUrl: null, frameImg: null, userImg: null });
    const urlProcessedRef = useRef<boolean>(false);

    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
    const [croppedImage, setCroppedImage] = useState<string | null>(null);
    const [aspect, setAspect] = useState<number | undefined>(undefined);

    const sectionRef = useRef<HTMLDivElement>(null);

    const scrollToSection = useCallback(() => {
        if (sectionRef.current) {
            sectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }, []);

    // Memoized search filtering for speed
    const filteredFrames = useMemo(() => {
        if (!searchQuery.trim()) return frames;
        const lowerQuery = searchQuery.toLowerCase();
        return frames.filter((frame) =>
            frame.name.toLowerCase().includes(lowerQuery)
        );
    }, [frames, searchQuery]);

    useEffect(() => {
        const fetchFrames = async () => {
            try {
                setIsLoading(true);
                const response = await fetch("/api/frames?activeOnly=true", {
                    headers: {
                        'x-api-key': '9a4f2c8d7e1b5f3a9c2d8e7f1b4a5c3d',
                    },
                });
                const data = await response.json();

                if (data.success) {
                    setFrames(data.data);
                    if (selectedFrame && !data.data.some((f: { _id: string; }) => f._id === selectedFrame._id)) {
                        setSelectedFrame(null);
                    }
                } else {
                    setError(data.message || "Failed to fetch frames");
                }
            } catch (err) {
                setError("An error occurred while fetching frames");
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchFrames();

        const savedFavorites = localStorage.getItem('favoriteFrames');
        if (savedFavorites) {
            setFavoriteFrames(JSON.parse(savedFavorites));
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedTexts(userTexts);
        }, 300); // Reduced delay to 300ms for better responsiveness
        return () => clearTimeout(timer);
    }, [userTexts]);

    useEffect(() => {
        if (frames.length > 0 && !urlProcessedRef.current) {
            const urlParams = new URLSearchParams(window.location.search);
            const frameId = urlParams.get('frame');

            if (frameId) {
                const frameFromUrl = frames.find((f) => f._id === frameId);
                if (frameFromUrl) {
                    setSelectedFrame(frameFromUrl);
                    if (frameFromUrl.hasImageArea === false) {
                        setCurrentStep("preview");
                    } else {
                        setCurrentStep("upload");
                        if (frameFromUrl.placementCoords) {
                            const aspectRatio = frameFromUrl.placementCoords.width / frameFromUrl.placementCoords.height;
                            setAspect(aspectRatio);
                        }
                    }
                    // Add a small delay to ensure the DOM has updated before scrolling
                    setTimeout(scrollToSection, 100);
                }
            }
            urlProcessedRef.current = true;
        }
    }, [frames, scrollToSection]);

    useEffect(() => {
        localStorage.setItem('favoriteFrames', JSON.stringify(favoriteFrames));
    }, [favoriteFrames]);

    const toggleFavorite = useCallback((frameId: string, event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        setFavoriteFrames(prev => {
            if (prev.includes(frameId)) {
                return prev.filter(id => id !== frameId);
            } else {
                return [...prev, frameId];
            }
        });
    }, []);

    const handleSelectFrame = useCallback((frame: Frame) => {
        setSelectedFrame(frame);
        if (frame.hasImageArea === false) {
            setCurrentStep("preview");
        } else {
            setCurrentStep("upload");
        }

        if (frame.placementCoords) {
            const aspectRatio = frame.placementCoords.width / frame.placementCoords.height;
            setAspect(aspectRatio);
        }

        const url = new URL(window.location.href);
        url.searchParams.set('frame', frame._id);
        window.history.pushState({}, '', url);

        scrollToSection();
    }, [scrollToSection]);

    const handleCopyFrameLink = useCallback((frameId: string, event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        const shareLink = `${window.location.origin}${window.location.pathname}?frame=${frameId}`;

        navigator.clipboard.writeText(shareLink).then(
            () => {
                setFrameCopySuccess(prev => ({ ...prev, [frameId]: true }));
                setTimeout(() => {
                    setFrameCopySuccess(prev => ({ ...prev, [frameId]: false }));
                }, 2000);
            },
            (err) => console.error('Could not copy link: ', err)
        );
    }, []);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];

        if (!file.type.startsWith("image/")) {
            setError("Please upload a valid image file (PNG, JPG, JPEG, GIF)");
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            setError("Image size must be less than 10MB");
            return;
        }

        setError(null);
        try {
            const objectUrl = URL.createObjectURL(file);
            setUserImage(objectUrl);
            setCroppedImage(null);
            setCurrentStep("crop");
        } catch (error) {
            console.error('Error creating object URL:', error);
            setError("Failed to process the image. Please try again.");
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (!file.type.startsWith("image/")) {
                setError("Please upload a valid image file");
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                setError("Image size must be less than 10MB");
                return;
            }
            setError(null);
            try {
                const objectUrl = URL.createObjectURL(file);
                setUserImage(objectUrl);
                setCroppedImage(null);
                setCurrentStep("crop");
            } catch (error) {
                setError("Failed to process the image.");
            }
        }
    };

    const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
        if (!aspect || !selectedFrame) return;
        const { width, height } = e.currentTarget;
        const crop = centerCrop(
            makeAspectCrop({ unit: '%', width: 90 }, aspect, width, height),
            width,
            height
        );
        setCrop(crop);
    };

    const handleAutoFit = () => {
        if (!userImgRef.current || !selectedFrame || !aspect) return;

        const image = userImgRef.current;
        const { width, height } = image;

        const optimalCrop = centerCrop(
            makeAspectCrop({ unit: '%', width: 100 }, aspect, width, height),
            width,
            height
        );

        setCrop(optimalCrop);
        setCompletedCrop(optimalCrop as unknown as PixelCrop);
    };

    const createCroppedImage = useCallback(() => {
        if (!userImgRef.current || !completedCrop || !selectedFrame) return;

        const image = userImgRef.current;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;

        const targetWidth = selectedFrame.placementCoords ? selectedFrame.placementCoords.width : 200;
        const targetHeight = selectedFrame.placementCoords ? selectedFrame.placementCoords.height : 200;

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const cropX = completedCrop.x * scaleX;
        const cropY = completedCrop.y * scaleY;
        const cropWidth = completedCrop.width * scaleX;
        const cropHeight = completedCrop.height * scaleY;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(
            image,
            cropX, cropY, cropWidth, cropHeight,
            0, 0, targetWidth, targetHeight
        );

        return canvas.toDataURL('image/png', 1.0);
    }, [completedCrop, selectedFrame]);

    const handleApplyCrop = () => {
        if (!completedCrop) {
            setError("Please complete the crop first");
            return;
        }
        const croppedImageUrl = createCroppedImage();
        if (croppedImageUrl) {
            setCroppedImage(croppedImageUrl);
            setCurrentStep("preview");
        }
    };

    useEffect(() => {
        if (currentStep !== "preview" || !canvasRef.current || !selectedFrame) return;
        if (selectedFrame.hasImageArea !== false && !croppedImage) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const pixelRatio = window.devicePixelRatio || 1;
        canvas.width = selectedFrame.dimensions.width * pixelRatio;
        canvas.height = selectedFrame.dimensions.height * pixelRatio;

        canvas.style.width = 'auto';
        canvas.style.height = 'auto';
        canvas.style.maxWidth = '100%';
        canvas.style.maxHeight = '70vh';
        canvas.style.objectFit = 'contain';

        ctx.scale(pixelRatio, pixelRatio);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        const drawCanvas = (frameImage: HTMLImageElement, userImage: HTMLImageElement | null) => {
            ctx.clearRect(0, 0, canvas.width / pixelRatio, canvas.height / pixelRatio);
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width / pixelRatio, canvas.height / pixelRatio);

            if (selectedFrame.hasImageArea !== false && selectedFrame.placementCoords && userImage) {
                const placement = selectedFrame.placementCoords;
                ctx.drawImage(
                    userImage,
                    0, 0, userImage.width, userImage.height,
                    placement.x, placement.y, placement.width, placement.height
                );
            }

            ctx.drawImage(frameImage, 0, 0, canvas.width / pixelRatio, canvas.height / pixelRatio);

            if (selectedFrame.textSettings) {
                selectedFrame.textSettings.forEach((ts, index) => {
                    const textToDraw = debouncedTexts[index] || "";
                    if (textToDraw) {
                        const fontSize = ts.size || 30;
                        ctx.font = `${fontSize}px ${ts.font || 'Arial, sans-serif'}`;
                        ctx.fillStyle = ts.color || '#000000';
                        ctx.textAlign = ts.align || 'center';
                        ctx.textBaseline = 'middle';

                        let textX = ts.x;
                        if (ts.align === 'center') textX = ts.x + (ts.width / 2);
                        else if (ts.align === 'right') textX = ts.x + ts.width;

                        const textY = ts.y + (ts.height / 2);
                        ctx.fillText(textToDraw, textX, textY);
                    }
                });
            }
        };

        const frameUrl = selectedFrame.imageUrl;
        const userUrl = selectedFrame.hasImageArea !== false ? croppedImage : null;

        if (cachedRenderDeps.current.frameUrl === frameUrl &&
            cachedRenderDeps.current.userUrl === userUrl &&
            cachedRenderDeps.current.frameImg) {
            drawCanvas(cachedRenderDeps.current.frameImg, cachedRenderDeps.current.userImg);
            return;
        }

        setIsLoading(true);
        const frameImg = new Image();
        const userImg = new Image();
        frameImg.crossOrigin = "anonymous";
        userImg.crossOrigin = "anonymous";
        frameImg.src = frameUrl;
        if (userUrl) userImg.src = userUrl;

        const loadImages = () => {
            const promises = [];
            promises.push(new Promise((res, rej) => {
                frameImg.onload = res;
                frameImg.onerror = rej;
            }));
            if (userUrl) {
                promises.push(new Promise((res, rej) => {
                    userImg.onload = res;
                    userImg.onerror = rej;
                }));
            }
            return Promise.all(promises);
        };

        loadImages().then(() => {
            cachedRenderDeps.current = { frameUrl, userUrl, frameImg, userImg: userUrl ? userImg : null };
            drawCanvas(frameImg, userUrl ? userImg : null);
            setIsLoading(false);
        }).catch(() => {
            setError("Failed to render preview.");
            setIsLoading(false);
        });
    }, [currentStep, croppedImage, selectedFrame, debouncedTexts]);

    const handleGenerateImage = async () => {
        if (!canvasRef.current || !selectedFrame) return;
        setIsProcessing(true);
        try {
            const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.9);
            setFinalImage(dataUrl);
            await fetch(`/api/frames/${selectedFrame._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ incrementUsage: true }),
            });
            setCurrentStep("complete");
        } catch (err) {
            setError("Failed to generate image");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReset = () => {
        setUserImage(null);
        setCroppedImage(null);
        setUserTexts([]);
        setFinalImage(null);
        setSelectedFrame(null);
        setCurrentStep("select");
        setCrop(undefined);
        setCompletedCrop(null);
        const url = new URL(window.location.href);
        url.searchParams.delete('frame');
        window.history.pushState({}, '', url);
    };

    const handleShare = async () => {
        if (!finalImage) return;
        try {
            const response = await fetch(finalImage);
            const blob = await response.blob();
            const fileName = `framed-photo-${selectedFrame?.name.replace(/\s+/g, '-').toLowerCase() || 'photo'}.png`;
            const file = new File([blob], fileName, { type: 'image/png' });

            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ title: 'My Photo', text: 'Look!', files: [file] });
            } else {
                const link = document.createElement('a');
                link.href = finalImage;
                link.download = fileName;
                link.click();
            }
        } catch (error) {
            alert('Search your browser for download button or long-press image.');
        }
    };

    if (isLoading && currentStep === "select") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#FDFCF9]">
                <BlinkBlur color="#32cd32" size="medium" />
            </div>
        );
    }

    return (
        <div ref={sectionRef} className="max-w-6xl mx-auto p-4 md:p-6 pb-16 pt-8">
            {currentStep === "select" && (
                <div className="space-y-16">
                    <div className="relative max-w-xl mx-auto mt-20">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search frames by name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full py-4 px-6 pl-14 border-0 rounded-full shadow-xl focus:outline-none focus:ring-2 focus:ring-brand-green transition-all duration-300 bg-white placeholder:text-gray-400 text-lg"
                            />
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-6 w-6 text-gray-400" />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery("")} className="absolute right-5 top-1/2 -translate-y-1/2 h-6 w-6 text-gray-400">
                                    <X className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div id="available-frames">
                        <div className="flex items-center justify-between mb-10">
                            <h2 className="text-2xl font-bold text-gray-900">Available Collections</h2>
                            <span className="text-sm font-bold text-brand-green bg-emerald-50 px-4 py-1.5 rounded-full">{filteredFrames.length} Items</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                            {filteredFrames.map((frame) => (
                                <FrameCard
                                    key={frame._id}
                                    frame={frame}
                                    onSelect={handleSelectFrame}
                                    onCopyLink={handleCopyFrameLink}
                                    onToggleFavorite={toggleFavorite}
                                    isFavorite={favoriteFrames.includes(frame._id)}
                                    copySuccess={!!frameCopySuccess[frame._id]}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {currentStep === "upload" && selectedFrame && (
                <div className="max-w-4xl mx-auto bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden mt-15">
                    <div className="bg-[#FDFCF9] p-8 border-b border-gray-50">
                        <h2 className="text-3xl font-bold text-gray-900">Upload Photo</h2>
                        <p className="text-gray-500">Choose a photo for <span className="text-brand-green">{selectedFrame.name}</span></p>
                    </div>
                    <div className="p-8">
                        <div className="flex flex-col lg:flex-row gap-12">
                            <div className="w-full lg:w-1/2 lg:order-2">
                                <div className="bg-[#FDFCF9] rounded-3xl p-6 border border-gray-50 mb-6">
                                    <h3 className="text-lg font-bold text-gray-900 mb-4">Selected Frame</h3>
                                    <div className="relative aspect-square bg-white rounded-2xl overflow-hidden">
                                        <NextImage src={selectedFrame.imageUrl} alt={selectedFrame.name} fill className="object-contain" />
                                    </div>
                                </div>
                            </div>

                            <div className="w-full lg:w-1/2 lg:order-1">
                                <div
                                    className={`border-4 border-dashed rounded-[2rem] p-10 flex flex-col items-center justify-center min-h-[350px] relative transition-all ${isDragOver ? 'border-brand-green bg-emerald-50/50' : 'border-gray-100'}`}
                                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                                    onDragLeave={() => setIsDragOver(false)}
                                    onDrop={handleDrop}
                                >
                                    <Upload className="h-10 w-10 text-brand-green mb-4" />
                                    <p className="text-lg font-bold text-gray-900">Drop photo here</p>
                                    <p className="text-sm text-gray-400">or <span className="text-brand-green cursor-pointer">click to browse</span></p>
                                    <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                                </div>

                                <div className="mt-8 space-y-6">
                                    <h4 className="text-lg font-bold text-gray-900">Personalize</h4>
                                    {selectedFrame.textSettings.map((ts, index) => (
                                        <div key={index} className="space-y-2">
                                            {ts.label && <label className="block text-sm font-bold text-gray-700 ml-1">{ts.label}</label>}
                                            <input
                                                type="text"
                                                value={userTexts[index] || ''}
                                                onChange={(e) => {
                                                    const newTexts = [...userTexts];
                                                    newTexts[index] = e.target.value;
                                                    setUserTexts(newTexts);
                                                }}
                                                placeholder={ts.label || "Enter text here..."}
                                                className="w-full px-6 py-4 bg-[#FDFCF9] border-0 rounded-2xl shadow-inner focus:ring-2 focus:ring-brand-green transition-all"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between mt-12">
                            <button onClick={() => setCurrentStep("select")} className="px-8 py-3 bg-white border border-gray-100 rounded-full font-bold flex items-center">
                                <ChevronLeft className="h-5 w-5 mr-2" /> Back
                            </button>
                            <button
                                onClick={() => setCurrentStep("crop")}
                                disabled={!userImage}
                                className={`px-8 py-3 rounded-full font-bold transition-all flex items-center ${userImage ? 'bg-brand-green text-white' : 'bg-gray-200 text-gray-400'}`}
                            >
                                Continue <ArrowRight className="h-5 w-5 ml-2" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {currentStep === "crop" && selectedFrame && userImage && (
                <div className="max-w-4xl mx-auto bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mt-15">
                    <div className="bg-gray-50 p-4 border-b">
                        <h2 className="text-lg font-medium text-gray-900">Crop Your Photo</h2>
                    </div>
                    <div className="p-6">
                        <div className="flex justify-center mb-6">
                            <button onClick={handleAutoFit} className="px-6 py-2 bg-brand-green text-white rounded-full font-bold text-sm flex items-center shadow-lg">
                                <Maximize2 className="h-4 w-4 mr-2" /> Auto-Fit
                            </button>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 flex justify-center">
                            <ReactCrop crop={crop} onChange={c => setCrop(c)} onComplete={c => setCompletedCrop(c)} aspect={aspect}>
                                <img ref={userImgRef} src={userImage} alt="Crop" onLoad={onImageLoad} className="max-h-[500px]" />
                            </ReactCrop>
                        </div>
                        <div className="flex justify-between mt-6">
                            <button onClick={() => setCurrentStep("upload")} className="px-8 py-3 bg-white border border-gray-100 rounded-full font-bold flex items-center">
                                <ChevronLeft className="h-5 w-5 mr-2" /> Back
                            </button>
                            <button onClick={handleApplyCrop} className="px-8 py-3 bg-brand-green text-white rounded-full font-bold shadow-lg flex items-center">
                                Apply Crop <ArrowRight className="h-5 w-5 ml-2" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {currentStep === "preview" && selectedFrame && (selectedFrame.hasImageArea === false || croppedImage) && (
                <div className="max-w-4xl mx-auto bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden mt-15">
                    <div className="bg-[#FDFCF9] p-8 border-b">
                        <h2 className="text-3xl font-bold text-gray-900">Preview</h2>
                    </div>
                    <div className="p-6">
                        <div className="bg-gray-50 rounded-lg p-4 mb-6 flex items-center justify-center relative">
                            {isLoading && <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10"><BlinkBlur color="#32cd32" size="medium" /></div>}
                            <canvas ref={canvasRef} className="rounded-md shadow-sm" />
                        </div>
                        <div className="my-4 space-y-3">
                            <h4 className="text-lg font-bold text-gray-900">Personalize</h4>
                            {selectedFrame.textSettings.map((ts, index) => (
                                <div key={index} className="space-y-2">
                                    {ts.label && <label className="block text-sm font-bold text-gray-700 ml-1">{ts.label}</label>}
                                    <input
                                        type="text"
                                        value={userTexts[index] || ''}
                                        onChange={(e) => {
                                            const newTexts = [...userTexts];
                                            newTexts[index] = e.target.value;
                                            setUserTexts(newTexts);
                                        }}
                                        placeholder={ts.label || "Enter text here..."}
                                        className="w-full px-6 py-4 bg-[#FDFCF9] border-0 rounded-2xl shadow-inner focus:ring-2 focus:ring-brand-green transition-all"
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between mt-8">
                            <button onClick={() => setCurrentStep(selectedFrame.hasImageArea === false ? "select" : "crop")} className="px-4 py-3 bg-white border border-gray-100 rounded-full font-bold flex items-center">
                                <ChevronLeft className="h-5 w-5 mr-2" /> Back
                            </button>
                            <button onClick={handleGenerateImage} className="px-4 py-3 bg-brand-green text-white rounded-full font-bold shadow-lg flex items-center" disabled={isProcessing}>
                                {isProcessing ? "Processing..." : "Generate"}<ArrowRight className="h-5 w-5 ml-2" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {currentStep === "complete" && finalImage && selectedFrame && (
                <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-gray-100 shadow-2xl overflow-hidden mt-15">
                    <div className="bg-emerald-50/50 p-8 text-center">
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">Perfect!</h2>
                        <p className="text-gray-500">Your photo has been successfully framed.</p>
                    </div>
                    <div className="p-8">
                        <div className="flex flex-col lg:flex-row gap-8 items-center">
                            <div className="w-full lg:w-2/3 bg-gray-50 rounded-lg p-4 flex justify-center">
                                <NextImage src={finalImage} alt="Final" width={600} height={600} className="rounded-md shadow-md" />
                            </div>
                            <div className="w-full lg:w-1/3 flex flex-col gap-4">
                                <button onClick={handleShare} className="w-full py-4 bg-brand-green text-white rounded-full font-bold flex items-center justify-center shadow-lg">
                                    <Share className="h-5 w-5 mr-2" /> Share Now
                                </button>
                                <a href={finalImage} download={`framed-${selectedFrame.name}.jpg`} className="w-full py-4 border border-gray-200 rounded-full font-bold text-center">
                                    <Save className="h-5 w-5 inline mr-2" /> Download
                                </a>
                                <button onClick={handleReset} className="w-full py-4 text-gray-500">Create Another</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {error && (
                <div className="fixed bottom-4 left-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50">
                    <p>{error}</p>
                    <button onClick={() => setError(null)} className="absolute top-0 right-0 p-2">&times;</button>
                </div>
            )}
        </div>
    );
};

export default UserPhotoFramingClient;
