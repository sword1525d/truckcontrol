'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, RefreshCcw, Camera as CameraIcon } from 'lucide-react';
import { Button } from './ui/button';

interface CameraCaptureProps {
  onCapture: (imageBlob: Blob) => void;
  onClose: () => void;
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isReady, setIsReady] = useState(false);

  const startCamera = useCallback(async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = newStream;
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.onloadedmetadata = () => {
            setIsReady(true);
        };
      }
    } catch (err) {
      console.error("Erro ao acessar a câmera:", err);
      alert("Não foi possível acessar a câmera. Verifique as permissões.");
      onClose();
    }
  }, [facingMode, onClose]);

  useEffect(() => {
    // Prevent background scrolling
    document.body.style.overflow = 'hidden';
    
    startCamera();
    
    return () => {
      document.body.style.overflow = '';
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [startCamera]);

  const handleCapture = () => {
    if (videoRef.current && isReady) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            onCapture(blob);
          }
        }, 'image/jpeg', 0.85); // Compress quality slightly for storage optimization
      }
    }
  };

  const toggleCamera = () => {
    setIsReady(false);
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed top-0 left-0 w-screen h-[100dvh] z-[99999] bg-black animate-in fade-in zoom-in duration-300 overflow-hidden touch-none">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`absolute top-0 left-0 w-full h-full object-cover transition-opacity duration-500 ${isReady ? 'opacity-100' : 'opacity-0'}`}
      />
      {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
              <CameraIcon className="w-12 h-12 animate-pulse opacity-50" />
          </div>
      )}
      
      <div className="absolute top-0 left-0 w-full p-4 sm:p-6 pt-safe pb-safe bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start z-10">
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20 rounded-full h-12 w-12 mt-2">
          <X className="h-8 w-8" />
        </Button>
        <Button variant="ghost" size="icon" onClick={toggleCamera} className="text-white hover:bg-white/20 rounded-full h-12 w-12 mt-2">
          <RefreshCcw className="h-6 w-6" />
        </Button>
      </div>

      <div className="absolute bottom-0 left-0 w-full p-8 pb-safe-12 bg-gradient-to-t from-black/80 to-transparent flex justify-center items-center z-10">
        <button
          onClick={handleCapture}
          disabled={!isReady}
          className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-transparent active:scale-95 transition-all disabled:opacity-50 mb-8"
        >
          <div className="w-16 h-16 bg-white rounded-full"></div>
        </button>
      </div>
    </div>,
    document.body
  );
}
