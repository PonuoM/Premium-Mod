
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Sku, PartGroup, Subcategory, Asset } from '../../types';
import PlusIcon from '../icons/PlusIcon';
import PencilIcon from '../icons/PencilIcon';
import TrashIcon from '../icons/TrashIcon';
import UploadIcon from '../icons/UploadIcon';
import ImageIcon from '../icons/ImageIcon';

type SubcategoryWithAssets = Subcategory & { assets: Asset[] };

interface SubcategoryManagerProps {
    onNavigate: (view: 'configurator') => void;
}


const SubcategoryManager: React.FC<SubcategoryManagerProps> = ({ onNavigate }) => {
    const [skus, setSkus] = useState<Sku[]>([]);
    const [partGroups, setPartGroups] = useState<PartGroup[]>([]);
    const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);

    const [selectedSkuId, setSelectedSkuId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal State
    const [modalState, setModalState] = useState<{
      isOpen: boolean;
      group: PartGroup | null;
    }>({ isOpen: false, group: null });
    const [newSubcategoryName, setNewSubcategoryName] = useState('');
    const [newAssetFile, setNewAssetFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);


    // Initial data fetch (SKUs and Part Groups)
    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            setError(null);
            try {
                if (!supabase) throw new Error("Supabase not configured.");

                const [skusRes, partGroupsRes] = await Promise.all([
                    supabase.from('skus').select('*').order('name'),
                    supabase.from('part_groups').select('*').order('sort_order'),
                ]);

                if (skusRes.error) throw skusRes.error;
                if (partGroupsRes.error) throw partGroupsRes.error;
                
                const fetchedSkus = skusRes.data || [];
                setSkus(fetchedSkus);
                setPartGroups(partGroupsRes.data || []);
                
                if (fetchedSkus.length > 0) {
                    setSelectedSkuId(fetchedSkus[0].id);
                } else {
                    setLoading(false);
                }
            } catch (err: any) {
                setError(err.message || "Failed to fetch initial data.");
                setLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    const fetchSkuData = useCallback(async () => {
        if (!selectedSkuId) {
            setSubcategories([]);
            setAssets([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            if (!supabase) throw new Error("Supabase not configured.");
            
            const [subcategoriesRes, assetsRes] = await Promise.all([
                supabase.from('subcategories').select('*').eq('sku_id', selectedSkuId),
                supabase.from('assets').select('*').eq('sku_id', selectedSkuId),
            ]);

            if (subcategoriesRes.error) throw subcategoriesRes.error;
            if (assetsRes.error) throw assetsRes.error;

            setSubcategories(subcategoriesRes.data || []);
            setAssets(assetsRes.data || []);

        } catch (err: any) {
            setError(err.message || "Failed to fetch data for SKU.");
        } finally {
            setLoading(false);
        }
    }, [selectedSkuId]);

    // Fetch subcategories and assets when SKU changes
    useEffect(() => {
        fetchSkuData();
    }, [fetchSkuData]);


    const groupedData = useMemo(() => {
        const dataByGroup: Record<string, SubcategoryWithAssets[]> = {};
        
        // Only include part groups that have assets for the selected SKU
        const partGroupsWithAssets = partGroups.filter(group => 
            assets.some(asset => asset.group_key === group.key)
        );

        partGroupsWithAssets.forEach(pg => {
            dataByGroup[pg.key] = [];
        });

        // Group subcategories by part group
        partGroupsWithAssets.forEach(group => {
            const groupSubcats = subcategories
                .filter(sub => sub.group_key === group.key)
                .map(sub => ({ ...sub, assets: [] }))
                .sort((a, b) => a.sort_order - b.sort_order);
            
            dataByGroup[group.key] = groupSubcats;
        });

        return dataByGroup;
    }, [partGroups, subcategories, assets]);
    
    // --- Modal Handlers ---
    const handleOpenAddModal = (group: PartGroup) => {
        setModalState({ isOpen: true, group });
        setNewSubcategoryName('');
        setNewAssetFile(null);
        setFormError(null);
    };

    const handleCloseModal = () => {
        setModalState({ isOpen: false, group: null });
    };

    const handleModalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!modalState.group || !newSubcategoryName.trim() || !newAssetFile) {
            setFormError('Please provide a name and select an image file.');
            return;
        }
        if (!supabase) { setFormError('Supabase not configured.'); return; }

        setIsSubmitting(true);
        setFormError(null);
        
        try {
            // Step 1: Upload the Subcategory Image
            const fileExt = newAssetFile.name.split('.').pop();
            const fileName = `subcategory-${Date.now()}.${fileExt}`;
            const filePath = `subcategories/${fileName}`;
            const { error: uploadError } = await supabase.storage
                .from('watch-assets')
                .upload(filePath, newAssetFile);
            if (uploadError) throw uploadError;

            // Step 2: Get the public URL
            const { data: urlData } = supabase.storage.from('watch-assets').getPublicUrl(filePath);
            if (!urlData || !urlData.publicUrl) throw new Error("Could not get public URL.");

            // Step 3: Create the Subcategory with image
            const newSub = {
                sku_id: selectedSkuId,
                name: newSubcategoryName.trim(),
                group_key: modalState.group.key,
                sort_order: (groupedData[modalState.group.key]?.length || 0) + 1,
                image_url: urlData.publicUrl,
            };
            const { error: subError } = await supabase
                .from('subcategories')
                .insert(newSub);
            if (subError) throw subError;

            handleCloseModal();
            await fetchSkuData();

        } catch (err: any) {
            setFormError(err.message || "An unexpected error occurred.");
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Delete Handlers ---
    const handleDeleteSubcategory = async (sub: SubcategoryWithAssets) => {
        if (!window.confirm(`Delete "${sub.name}"?`)) return;
        if (!supabase) { alert('Supabase not configured.'); return; }

        try {
            // Delete subcategory image if exists
            if (sub.image_url) {
                const urlParts = sub.image_url.split('/storage/v1/object/public/');
                if (urlParts.length > 1) {
                    const filePath = urlParts[1];
                    const bucketName = filePath.split('/')[0];
                    const pathOnly = filePath.split('/').slice(1).join('/');
                    const { error: storageError } = await supabase.storage.from(bucketName).remove([pathOnly]);
                    if (storageError) console.warn("Storage deletion failed, might be already gone:", storageError.message);
                }
            }

            // Delete subcategory from database
            const { error: subcatDbError } = await supabase.from('subcategories').delete().eq('id', sub.id);
            if (subcatDbError) throw subcatDbError;

            await fetchSkuData(); // Refresh
        } catch (err: any) {
            alert(`Error deleting subcategory: ${err.message}`);
        }
    }

    return (
      <>
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">จัดการ Subcategory</h1>
                <div className="flex items-center space-x-3">
                    <button 
                        onClick={() => onNavigate('configurator')}
                        className="bg-white border border-gray-300 text-gray-700 font-semibold px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                    >
                        Back to Configurator
                    </button>
                    {skus.length > 0 && (
                         <div className="flex items-center space-x-2">
                            <label htmlFor="sku-select" className="text-sm font-medium text-gray-700">SKU:</label>
                            <select
                                id="sku-select"
                                value={selectedSkuId}
                                onChange={(e) => setSelectedSkuId(e.target.value)}
                                className="appearance-none border border-gray-300 rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 bg-white pr-8 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            >
                                {skus.map(sku => <option key={sku.id} value={sku.id}>{sku.name}</option>)}
                            </select>
                        </div>
                    )}
                </div>
            </div>
            
            {loading && <p className="text-center text-gray-500 py-8">Loading data...</p>}
            {error && <div className="text-center text-red-600 bg-red-50 p-4 rounded-lg">{error}</div>}

            {!loading && !error && skus.length === 0 && (
                <div className="bg-white rounded-xl shadow-sm p-6 text-center">
                    <p className="text-gray-500">Please add an SKU first in the 'จัดการ SKU' section.</p>
                </div>
            )}


            {!loading && !error && skus.length > 0 && (
                <div className="space-y-8">
                    {Object.keys(groupedData).length > 0 ? (
                        Object.keys(groupedData).map(groupKey => {
                            const group = partGroups.find(pg => pg.key === groupKey);
                            if (!group) return null;
                            
                            return (
                                <PartGroupSection 
                                    key={group.key} 
                                    group={group} 
                                    subcategories={groupedData[group.key] || []}
                                    onAddSubcategory={() => handleOpenAddModal(group)}
                                    onDeleteSubcategory={handleDeleteSubcategory}
                                    onRefresh={fetchSkuData}
                                />
                            );
                        })
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm p-6 text-center">
                            <p className="text-gray-500">No parts available for this SKU. Please add parts first in the 'จัดการ SKU' section.</p>
                        </div>
                    )}
                </div>
            )}
        </div>

        {modalState.isOpen && modalState.group && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-md z-50">
                    <form onSubmit={handleModalSubmit}>
                        <div className="p-6">
                            <h2 className="text-xl font-semibold text-gray-800">Add Subcategory</h2>
                            <p className="text-sm text-gray-500 mt-1">To <span className="font-medium">{modalState.group.name_en}</span></p>
                            
                            <div className="mt-6">
                                <label htmlFor="sub-name" className="block text-sm font-medium text-gray-700 mb-1">Subcategory Name</label>
                                <input id="sub-name" type="text" value={newSubcategoryName} onChange={e => setNewSubcategoryName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500" autoFocus />
                            </div>

                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">First Image</label>
                                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                                    <div className="space-y-1 text-center">
                                        <UploadIcon className="mx-auto h-12 w-12 text-gray-400" />
                                        <div className="flex text-sm text-gray-600">
                                            <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-yellow-600 hover:text-yellow-500 focus-within:outline-none">
                                                <span>Upload a file</span>
                                                <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={e => setNewAssetFile(e.target.files ? e.target.files[0] : null)} accept="image/png, image/jpeg, image/webp" />
                                            </label>
                                            <p className="pl-1">or drag and drop</p>
                                        </div>
                                        <p className="text-xs text-gray-500">PNG, JPG, WEBP</p>
                                        {newAssetFile && <p className="text-xs text-green-600 mt-2">{newAssetFile.name}</p>}
                                    </div>
                                </div>
                            </div>

                            {formError && <p className="text-sm text-red-600 mt-4">{formError}</p>}
                        </div>
                         <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 rounded-b-xl">
                            <button type="button" onClick={handleCloseModal} className="bg-white border border-gray-300 text-gray-700 font-semibold px-4 py-2 rounded-lg hover:bg-gray-50 text-sm">Cancel</button>
                            <button type="submit" disabled={isSubmitting || !newSubcategoryName || !newAssetFile} className="bg-[#C4A383] text-white font-semibold px-4 py-2 rounded-lg hover:bg-opacity-90 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                                {isSubmitting ? 'Creating...' : 'Create Subcategory'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
      </>
    );
};

// --- PartGroupSection Component ---
interface PartGroupSectionProps {
    group: PartGroup;
    subcategories: SubcategoryWithAssets[];
    onAddSubcategory: (group: PartGroup) => void;
    onDeleteSubcategory: (sub: SubcategoryWithAssets) => void;
    onRefresh: () => void;
}

const PartGroupSection: React.FC<PartGroupSectionProps> = ({ group, subcategories, onAddSubcategory, onDeleteSubcategory, onRefresh }) => {
    return (
        <div className="bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-800">{group.name_th} / <span className="font-medium text-gray-600">{group.name_en}</span></h2>
                    <button 
                        onClick={() => onAddSubcategory(group)}
                        className="bg-[#C4A383] text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-opacity-90 transition-opacity flex items-center space-x-2 text-xs"
                    >
                        <PlusIcon className="w-4 h-4" />
                        <span>Add Subcategory</span>
                    </button>
                </div>
            </div>
            <div className="p-6">
                {subcategories.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                        {subcategories.map(sub => (
                            <SubcategoryItem 
                                key={sub.id} 
                                subcategory={sub}
                                onDeleteSubcategory={onDeleteSubcategory}
                                onDataChange={() => { /* Prop drilled from top */ }}
                                onRefresh={onRefresh}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-gray-400 text-center py-4">No subcategories found for this part group.</p>
                )}
            </div>
        </div>
    );
}

// --- SubcategoryItem Component ---
interface SubcategoryItemProps {
    subcategory: SubcategoryWithAssets;
    onDeleteSubcategory: (sub: SubcategoryWithAssets) => void;
    onDataChange: () => void;
    onRefresh: () => void;
}

const SubcategoryItem: React.FC<SubcategoryItemProps> = ({ subcategory, onDeleteSubcategory, onDataChange, onRefresh }) => {
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !subcategory.sku_id || !subcategory.group_key || !subcategory.id) {
            console.error("Missing data for upload", subcategory);
            return;
        };
        if (!supabase) { alert('Supabase not configured'); return; }

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `subcategory-${subcategory.id}-${Date.now()}.${fileExt}`;
            const filePath = `subcategories/${fileName}`;
            
            const { error: uploadError } = await supabase.storage.from('watch-assets').upload(filePath, file);
            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from('watch-assets').getPublicUrl(filePath);
            if (!urlData || !urlData.publicUrl) throw new Error("Could not get public URL.");
            
            const { error: updateError } = await supabase
                .from('subcategories')
                .update({ image_url: urlData.publicUrl })
                .eq('id', subcategory.id);
            if (updateError) throw updateError;
            
            // Refresh data immediately
            onRefresh();
        } catch (err: any) {
            alert(`Upload failed: ${err.message}`);
        } finally {
            setIsUploading(false);
            if(fileInputRef.current) fileInputRef.current.value = "";
        }
    };
    
    return (
        <div className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
            <div className="flex items-center space-x-3">
                {/* Subcategory Image */}
                <div className="w-16 h-16 border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center flex-shrink-0">
                    {subcategory.image_url ? (
                        <img src={subcategory.image_url} alt={subcategory.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="text-gray-400 text-center">
                            <ImageIcon className="w-6 h-6 mx-auto" />
                        </div>
                    )}
                </div>

                {/* Subcategory Info */}
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-700 truncate">{subcategory.name}</h3>
                    <span className="text-xs text-gray-500">Subcategory</span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-2 flex-shrink-0">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg, image/webp" />
                    <button 
                        onClick={handleUploadClick}
                        disabled={isUploading}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title="Upload Image"
                    >
                        {isUploading ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                        ) : (
                            <UploadIcon className="w-4 h-4"/>
                        )}
                    </button>
                    <button 
                        onClick={() => onDeleteSubcategory(subcategory)} 
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Delete Subcategory"
                    >
                        <TrashIcon className="w-4 h-4"/>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SubcategoryManager;
