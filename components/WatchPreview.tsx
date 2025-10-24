
import React, { useState } from 'react';
import PlusIcon from './icons/PlusIcon';
import MinusIcon from './icons/MinusIcon';
import DownloadIcon from './icons/DownloadIcon';
import { ViewAsset, ProfileSettings } from '../types';

interface WatchPreviewProps {
  assets: ViewAsset[];
  settings: ProfileSettings;
}

const WatchPreview: React.FC<WatchPreviewProps> = ({ assets, settings }) => {
  const [zoom, setZoom] = useState(100);
  

  const handleZoomIn = () => setZoom(z => Math.min(z + 10, 200));
  const handleZoomOut = () => setZoom(z => Math.max(z - 10, 50));
  
  const handleDownload = async () => {
    try {
      // Create a canvas to render the watch preview
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size
      canvas.width = 800;
      canvas.height = 800;

      // Create a white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Load and draw each asset
      const imagePromises = assets.map(asset => {
        return new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = asset.url;
        });
      });

      try {
        const images = await Promise.all(imagePromises);
        
        // Draw each image on the canvas
        images.forEach((img, index) => {
          const asset = assets[index];
          if (img && asset) {
            // Calculate position and size to center the image
            const scale = Math.min(canvas.width / img.width, canvas.height / img.height) * 0.8;
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;
            const x = (canvas.width - scaledWidth) / 2;
            const y = (canvas.height - scaledHeight) / 2;
            
            ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
          }
        });

        // Add watermark if enabled
        if (settings.watermarkType !== 'none') {
          ctx.globalAlpha = settings.watermarkOpacity / 100;
          
          if (settings.watermarkType === 'text') {
            ctx.fillStyle = '#000000';
            ctx.font = `${settings.watermarkSize}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(settings.storeName, canvas.width / 2, canvas.height - 50);
          } else if (settings.watermarkType === 'image' && settings.watermarkImageUrl) {
            const watermarkImg = new Image();
            watermarkImg.crossOrigin = 'anonymous';
            watermarkImg.onload = () => {
              const watermarkScale = settings.watermarkSize / 100;
              const watermarkWidth = watermarkImg.width * watermarkScale;
              const watermarkHeight = watermarkImg.height * watermarkScale;
              
              let x = 0, y = 0;
              switch (settings.watermarkPosition) {
                case 'top-left': x = 20; y = 20; break;
                case 'top-center': x = (canvas.width - watermarkWidth) / 2; y = 20; break;
                case 'top-right': x = canvas.width - watermarkWidth - 20; y = 20; break;
                case 'center-left': x = 20; y = (canvas.height - watermarkHeight) / 2; break;
                case 'center': x = (canvas.width - watermarkWidth) / 2; y = (canvas.height - watermarkHeight) / 2; break;
                case 'center-right': x = canvas.width - watermarkWidth - 20; y = (canvas.height - watermarkHeight) / 2; break;
                case 'bottom-left': x = 20; y = canvas.height - watermarkHeight - 20; break;
                case 'bottom-center': x = (canvas.width - watermarkWidth) / 2; y = canvas.height - watermarkHeight - 20; break;
                case 'bottom-right': x = canvas.width - watermarkWidth - 20; y = canvas.height - watermarkHeight - 20; break;
                default: x = canvas.width - watermarkWidth - 20; y = canvas.height - watermarkHeight - 20;
              }
              
              ctx.drawImage(watermarkImg, x, y, watermarkWidth, watermarkHeight);
            };
          }
        }

        // Convert canvas to blob and download
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `watch-config-${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
        }, 'image/png');
        
      } catch (error) {
        console.error('Error loading images:', error);
        alert('Error loading images for download');
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Error generating download');
    }
  };
  
  const getPositionClasses = () => {
      switch (settings.watermarkPosition) {
          case 'top-left': return 'top-4 left-4 items-start justify-start';
          case 'top-center': return 'top-4 left-1/2 -translate-x-1/2 items-start justify-center';
          case 'top-right': return 'top-4 right-4 items-start justify-end';
          case 'center-left': return 'top-1/2 left-4 -translate-y-1/2 items-center justify-start';
          case 'center': return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 items-center justify-center';
          case 'center-right': return 'top-1/2 right-4 -translate-y-1/2 items-center justify-end';
          case 'bottom-left': return 'bottom-4 left-4 items-end justify-start';
          case 'bottom-center': return 'bottom-4 left-1/2 -translate-x-1/2 items-end justify-center';
          case 'bottom-right': return 'bottom-4 right-4 items-end justify-end';
          default: return 'bottom-4 right-4 items-end justify-end';
      }
  };
  
  const watermarkContent = () => {
    if (settings.watermarkType === 'text') {
      return (
        <span
          className="font-bold text-black"
          style={{ fontSize: `${settings.watermarkSize}px`, textShadow: '0px 0px 5px rgba(255,255,255,0.7)' }}
        >
          {settings.storeName}
        </span>
      );
    }
    if (settings.watermarkType === 'image' && settings.watermarkImageUrl) {
      return (
        <img
          src={settings.watermarkImageUrl}
          alt="Watermark"
          style={{ width: `${settings.watermarkSize}px`, height: 'auto' }}
        />
      );
    }
    return null;
  };

  return (
    <div 
      className="bg-gradient-to-br from-slate-100 to-slate-200 h-full flex flex-col items-center justify-center relative select-none" 
      style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
        {/* Desktop Controls */}
        <div className="hidden lg:flex absolute top-4 right-4 items-center space-x-2 z-50">
            <div className="flex items-center bg-white rounded-md border border-gray-300">
                <button onClick={handleZoomOut} className="p-2 text-gray-600 hover:bg-gray-100 rounded-l-md">
                    <MinusIcon className="w-4 h-4"/>
                </button>
                <span className="px-3 text-sm font-medium text-gray-700 border-l border-r">{zoom}%</span>
                <button onClick={handleZoomIn} className="p-2 text-gray-600 hover:bg-gray-100 rounded-r-md">
                    <PlusIcon className="w-4 h-4"/>
                </button>
            </div>
            <button 
              onClick={handleDownload}
              className="bg-gray-700 text-white font-semibold px-4 py-2 rounded-md hover:bg-gray-800 transition-colors"
              title="Download PNG"
            >
                Download PNG
            </button>
        </div>

        {/* Mobile Controls - Top Right */}
        <div className="lg:hidden absolute top-4 right-4 z-50">
            <button 
              onClick={handleDownload}
              className="bg-gray-700 text-white p-2 rounded-md hover:bg-gray-800 transition-colors shadow-lg"
              title="Download PNG"
            >
                <DownloadIcon className="w-5 h-5" />
            </button>
        </div>

        {/* Watch Display Area */}
        <div className="relative w-full h-full flex items-center justify-center p-4">
            <div className="relative w-full h-full max-w-md" style={{ transform: `scale(${zoom / 100})`, transition: 'transform 0.2s ease-out' }}>
                {assets.length > 0 ? (
                    assets.map((asset, index) => (
                        <img 
                            key={`${asset.id}-${index}`}
                            src={asset.url} 
                            alt={asset.label} 
                            className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
                            style={{ zIndex: asset.z_index, userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                            }}
                            onContextMenu={(e) => e.preventDefault()}
                            onDragStart={(e) => e.preventDefault()}
                        />
                    ))
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">
                        <div className="text-center text-gray-500">
                            <div className="text-6xl mb-4">⌚</div>
                            <p className="text-lg font-medium">No parts selected</p>
                            <p className="text-sm">Select parts from below</p>
                        </div>
                    </div>
                )}
                
                {/* Dynamic Watermark */}
                {settings.watermarkType !== 'none' && (
                    <div 
                        className={`absolute inset-0 z-[9999] p-4 pointer-events-none flex ${getPositionClasses()}`}
                        style={{ opacity: settings.watermarkOpacity / 100 }}
                    >
                        {watermarkContent()}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default WatchPreview;
