import React, { useState, useMemo } from 'react';
import { ViewAsset, PartGroup, Sku } from '../types';
import ChevronDownIcon from './icons/ChevronDownIcon';

interface PartSelectorProps {
  partGroups: PartGroup[];
  assets: ViewAsset[];
  selectedAssets: Record<string, string>;
  onAssetSelect: (groupKey: string, assetId: string) => void;
  showFilterButtons?: boolean;
  skus: Sku[];
  selectedSku: string;
  onSkuChange: (skuId: string) => void;
}

const PartSelector: React.FC<PartSelectorProps> = ({ partGroups, assets, selectedAssets, onAssetSelect, showFilterButtons = true, skus, selectedSku, onSkuChange }) => {
  const [activeSubcategories, setActiveSubcategories] = useState<Record<string, string>>({});
  

  const handleSubcategorySelect = (groupKey: string, subcategoryName: string) => {
    setActiveSubcategories(prev => ({ ...prev, [groupKey]: subcategoryName }));
  };

  const sortedPartGroups = useMemo(() => {
    return [...partGroups].sort((a, b) => a.sort_order - b.sort_order);
  }, [partGroups]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">Click to select SKU & Part</p>
        <div className="relative">
          <select
            value={selectedSku}
            onChange={(e) => onSkuChange(e.target.value)}
            className="appearance-none border border-gray-300 rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 bg-white pr-8 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            aria-label="Select SKU"
          >
            {skus.map(sku => (
              <option key={sku.id} value={sku.id}>{sku.name}</option>
            ))}
            {skus.length === 0 && <option disabled>No SKUs available</option>}
          </select>
          <ChevronDownIcon className="h-4 w-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
      </div>
      {sortedPartGroups
        .filter(group => assets.some(a => a.group_key === group.key))
        .map((group) => {
        const groupAssets = assets.filter(a => a.group_key === group.key);

        // Show all assets, regardless of subcategory
        const assetsWithSubcategory = groupAssets;
        
        // If no assets, don't show this group
        if (assetsWithSubcategory.length === 0) {
          return null;
        }
        
        const subcategories = Array.from(new Set(assetsWithSubcategory.map(a => a.subcategory_name).filter(name => name && name.trim() !== '')));
        
        // Hide groups that have no subcategories
        if (subcategories.length === 0) {
          return null;
        }
        
        const activeSub = activeSubcategories[group.key] || subcategories[0];
        
        const displayedAssets = activeSub 
          ? assetsWithSubcategory.filter(a => a.subcategory_name === activeSub)
          : assetsWithSubcategory;

        return (
          <div key={group.key} className="mb-6">
            <div className="mb-3">
              <h2 className="text-base font-semibold text-gray-800">{group.name_th} / {group.name_en}</h2>
            </div>
            {subcategories.length > 0 && showFilterButtons && (
              <>
                {/* Desktop Layout */}
                <div className="hidden lg:flex flex-wrap gap-3 mb-4">
                  {subcategories.map((sub, index) => {
                    // Find the first asset in this subcategory to get the image
                    const firstAsset = assetsWithSubcategory.find(a => a.subcategory_name === sub);
                    const subcategoryImage = firstAsset?.subcategory_image_url;
                    
                    return (
                      <button
                        key={`${group.key}-${sub}-${index}`}
                        onClick={() => handleSubcategorySelect(group.key, sub as string)}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all duration-200 ${
                          activeSub === sub
                            ? 'bg-gray-700 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:shadow-sm'
                        }`}
                      >
                        {subcategoryImage && (
                          <img 
                            src={subcategoryImage} 
                            alt={sub}
                            className="w-5 h-5 rounded-full object-cover border border-gray-200"
                          />
                        )}
                        <span className="text-xs font-medium">{sub}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Mobile Horizontal Scroll Layout */}
                <div className="lg:hidden mb-3">
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide touch-scroll" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    {subcategories.map((sub, index) => {
                      // Find the first asset in this subcategory to get the image
                      const firstAsset = assetsWithSubcategory.find(a => a.subcategory_name === sub);
                      const subcategoryImage = firstAsset?.subcategory_image_url;
                      
                      return (
                        <button
                          key={`${group.key}-${sub}-${index}`}
                          onClick={() => handleSubcategorySelect(group.key, sub as string)}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all duration-200 flex-shrink-0 ${
                          activeSub === sub
                            ? 'bg-gray-700 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:shadow-sm'
                        }`}
                        >
                          {subcategoryImage && (
                            <img 
                              src={subcategoryImage} 
                              alt={sub}
                              className="w-5 h-5 rounded-full object-cover border border-gray-200"
                            />
                          )}
                          <span className="text-xs font-medium whitespace-nowrap">{sub}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
           {/* Desktop Grid Layout */}
           <div className="hidden lg:grid grid-cols-2 xl:grid-cols-3 gap-4">
             {displayedAssets.map((asset, index) => {
               const assetId = asset.asset_id || (asset as any).id;
               const isSelected = selectedAssets[group.key] === assetId;
               return (
                 <div
                   key={`${group.key}-${asset.asset_id}-${index}`}
                   onClick={() => {
                     const assetId = asset.asset_id || (asset as any).id;
                     onAssetSelect(group.key, assetId);
                   }}
                   className={`cursor-pointer rounded-lg p-2 border-2 transition-all duration-200 ${
                     isSelected ? 'border-yellow-500 shadow-md' : 'border-gray-200 hover:border-gray-300'
                   }`}
                   style={{ pointerEvents: 'auto' }}
                 >
                   <div className="aspect-square flex items-center justify-center bg-gray-50 rounded-md overflow-hidden pointer-events-none">
                      <img src={asset.url} alt={asset.label} className="object-contain h-full w-full pointer-events-none" />
                   </div>
                   <p className="text-xs text-center mt-2 text-gray-600 truncate">{asset.label}</p>
                 </div>
               );
             })}
           </div>

           {/* Mobile Horizontal Scroll Layout */}
           <div className="lg:hidden">
             <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide touch-scroll" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
               {displayedAssets.map((asset, index) => {
                 const assetId = asset.asset_id || (asset as any).id;
                 const isSelected = selectedAssets[group.key] === assetId;
                 return (
                   <div
                     key={`${group.key}-${asset.asset_id}-${index}`}
                     onClick={() => {
                       const assetId = asset.asset_id || (asset as any).id;
                       onAssetSelect(group.key, assetId);
                     }}
                     className={`cursor-pointer rounded-lg p-1.5 border-2 transition-all duration-200 flex-shrink-0 w-20 ${
                       isSelected ? 'border-yellow-500 shadow-md' : 'border-gray-200 hover:border-gray-300'
                     }`}
                     style={{ pointerEvents: 'auto' }}
                   >
                     <div className="aspect-square flex items-center justify-center bg-gray-50 rounded-md overflow-hidden pointer-events-none">
                        <img src={asset.url} alt={asset.label} className="object-contain h-full w-full pointer-events-none" />
                     </div>
                     <p className="text-xs text-center mt-1 text-gray-600 truncate">{asset.label}</p>
                   </div>
                 );
               })}
             </div>
           </div>
          </div>
        )
      })}
      
      {/* Mobile scroll hint */}
      <div className="lg:hidden text-center py-2">
        <p className="text-xs text-gray-400">เลื่อนลงดูพาทอื่น</p>
      </div>
    </div>
  );
};

export default PartSelector;
