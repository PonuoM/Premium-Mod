import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Sku, PartGroup, Asset } from '../../types';
import PlusIcon from '../icons/PlusIcon';
import SearchIcon from '../icons/SearchIcon';
import PencilIcon from '../icons/PencilIcon';
import TrashIcon from '../icons/TrashIcon';

interface SkuManagerProps {
    onNavigate: (view: 'configurator') => void;
}

interface ManagePartsContentProps {
    sku: Sku;
    onClose: () => void;
}

const ManagePartsContent: React.FC<ManagePartsContentProps> = ({ sku, onClose }) => {
    const [partGroups, setPartGroups] = useState<PartGroup[]>([]);
    const [selectedPartGroup, setSelectedPartGroup] = useState<string>('');
    const [assets, setAssets] = useState<Asset[]>([]);
    const [subcategories, setSubcategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPartGroups = useCallback(async () => {
        try {
            if (!supabase) throw new Error('Supabase not configured');
            const { data, error } = await supabase
                .from('part_groups')
                .select('*')
                .order('sort_order');
            
            if (error) throw error;
            setPartGroups(data || []);
        } catch (err: any) {
            setError(err.message);
        }
    }, []);

    const fetchSubcategories = useCallback(async () => {
        if (!selectedPartGroup || !supabase) return;
        
        try {
            const { data, error } = await supabase
                .from('subcategories')
                .select('*')
                .eq('sku_id', sku.id)
                .eq('group_key', selectedPartGroup)
                .order('sort_order');
            
            if (error) throw error;
            setSubcategories(data || []);
        } catch (err: any) {
            console.error('Error fetching subcategories:', err);
            setSubcategories([]);
        }
    }, [selectedPartGroup, sku.id]);

    const fetchAssets = useCallback(async () => {
        if (!selectedPartGroup || !supabase) return;
        
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('assets')
                .select('*')
                .eq('sku_id', sku.id)
                .eq('group_key', selectedPartGroup)
                .order('sort');
            
            if (error) throw error;
            setAssets(data || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [selectedPartGroup, sku.id]);

    useEffect(() => {
        fetchPartGroups();
    }, [fetchPartGroups]);

    // Auto select first part group when part groups are loaded
    useEffect(() => {
        if (partGroups.length > 0 && !selectedPartGroup) {
            setSelectedPartGroup(partGroups[0].key);
        }
    }, [partGroups, selectedPartGroup]);

    useEffect(() => {
        if (selectedPartGroup) {
            fetchSubcategories();
            fetchAssets();
        } else {
            setAssets([]);
            setSubcategories([]);
        }
    }, [selectedPartGroup, fetchSubcategories, fetchAssets]);

    const handleSubcategoryChange = async (assetId: string, subcategoryId: string) => {
        try {
            if (!supabase) throw new Error('Supabase not configured');
            
            const { error } = await supabase
                .from('assets')
                .update({ subcategory_id: subcategoryId || null })
                .eq('id', assetId);
            
            if (error) throw error;
            
            // Update local state without refetching
            setAssets(prevAssets => 
                prevAssets.map(asset => 
                    asset.id === assetId 
                        ? { ...asset, subcategory_id: subcategoryId || null }
                        : asset
                )
            );
        } catch (err: any) {
            console.error('Error updating subcategory:', err);
            alert('เกิดข้อผิดพลาดในการอัพเดท subcategory');
        }
    };

    return (
        <div className="space-y-6">
            {/* Part Group Selection */}
            <div className="flex items-center space-x-4">
                <label className="text-sm font-medium text-gray-700">Part Group:</label>
                <select
                    value={selectedPartGroup}
                    onChange={(e) => setSelectedPartGroup(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                >
                    <option value="">Select Part Group</option>
                    {partGroups.map(group => (
                        <option key={group.key} value={group.key}>
                            {group.name_th} ({group.name_en})
                        </option>
                    ))}
                </select>
                <button className="bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600 transition-colors">
                    Add Group to SKU
                </button>
            </div>

            {/* Assets Grid */}
            {selectedPartGroup && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-800">Parts</h3>
                        {subcategories.length > 0 && (
                            <div className="text-sm text-gray-600">
                                หมวดย่อย: {subcategories.map(sub => {
                                    const count = assets.filter(asset => asset.subcategory_id === sub.id).length;
                                    return `${sub.name} (${count})`;
                                }).join(', ')}
                                {(() => {
                                    const unassignedCount = assets.filter(asset => !asset.subcategory_id).length;
                                    return unassignedCount > 0 ? `, ไม่ได้เลือก (${unassignedCount})` : '';
                                })()}
                            </div>
                        )}
                    </div>
                    {loading ? (
                        <p className="text-center text-gray-500 py-8">Loading...</p>
                    ) : error ? (
                        <div className="text-center text-red-600 bg-red-50 p-4 rounded-lg">{error}</div>
                    ) : assets.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                            <p>No parts found for this group.</p>
                            <button className="mt-4 bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600 transition-colors">
                                Upload Images
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-6 gap-4">
                            {assets.map((asset) => (
                                <div key={asset.id} className="relative group">
                                    {/* Action Buttons */}
                                    <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="flex space-x-1">
                                            <button className="bg-blue-500 text-white p-1 rounded hover:bg-blue-600 transition-colors">
                                                <PencilIcon className="w-3 h-3" />
                                            </button>
                                            <button className="bg-red-500 text-white p-1 rounded hover:bg-red-600 transition-colors">
                                                <TrashIcon className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {/* Asset Image */}
                                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-2">
                                        <img 
                                            src={asset.url} 
                                            alt={asset.label}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    
                                    {/* Asset Info */}
                                    <div className="space-y-2">
                                        <select 
                                            className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                                            value={asset.subcategory_id || ''}
                                            onChange={(e) => handleSubcategoryChange(asset.id, e.target.value)}
                                        >
                                            <option value="">(no subcategory)</option>
                                            {subcategories.map(sub => (
                                                <option key={sub.id} value={sub.id}>
                                                    {sub.name}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-gray-600 text-center">{asset.label}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const SkuManager: React.FC<SkuManagerProps> = ({ onNavigate }) => {
  const [skus, setSkus] = useState<Sku[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    mode: 'add' | 'edit';
    sku?: Sku;
  }>({ isOpen: false, mode: 'add' });

  const [manageModalState, setManageModalState] = useState<{
    isOpen: boolean;
    sku?: Sku;
  }>({ isOpen: false });

  const [skuId, setSkuId] = useState('');
  const [skuName, setSkuName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchSkus = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (!supabase) {
        throw new Error('Supabase is not configured. Please update lib/supabase.ts with your project URL and anon key.');
      }

      const { data, error } = await supabase
        .from('skus')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }
      
      setSkus(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch SKUs.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkus();
  }, [fetchSkus]);

  const formatDateTime = (isoString: string) => {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear() + 543; // Buddhist year
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  };

  const handleOpenAddModal = () => {
    setSkuId('');
    setSkuName('');
    setFormError(null);
    setModalState({ isOpen: true, mode: 'add' });
  };

  const handleOpenEditModal = (sku: Sku) => {
    setSkuId(sku.id);
    setSkuName(sku.name);
    setFormError(null);
    setModalState({ isOpen: true, mode: 'edit', sku });
  };

  const handleCloseModal = () => {
    setModalState({ isOpen: false, mode: 'add' });
  };

  const handleOpenManageModal = (sku: Sku) => {
    setManageModalState({ isOpen: true, sku });
  };

  const handleCloseManageModal = () => {
    setManageModalState({ isOpen: false });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modalState.mode === 'add' && !skuId.trim()) {
      setFormError('SKU ID cannot be empty.');
      return;
    }
    if (!skuName.trim()) {
      setFormError('SKU name cannot be empty.');
      return;
    }

    if (!supabase) {
      setFormError('Supabase is not configured.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      let error;
      if (modalState.mode === 'edit' && modalState.sku) {
        // Update existing SKU
        const { error: updateError } = await supabase
          .from('skus')
          .update({ name: skuName.trim() })
          .eq('id', modalState.sku.id);
        error = updateError;
      } else {
        // Add new SKU
        const formattedSkuId = skuId.trim().toLowerCase().replace(/\s+/g, '-');
        const { error: insertError } = await supabase
          .from('skus')
          .insert([{ id: formattedSkuId, name: skuName.trim() }]);
        error = insertError;
      }
      
      if (error) {
        throw error;
      }
      
      handleCloseModal();
      await fetchSkus(); // Refresh the list
    } catch (err: any) {
      setFormError(err.message || 'Failed to save SKU.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (sku: Sku) => {
    if (window.confirm(`Are you sure you want to delete SKU "${sku.name}"? This action cannot be undone.`)) {
      if (!supabase) {
        setError('Supabase is not configured.');
        return;
      }
      try {
        const { error } = await supabase.from('skus').delete().eq('id', sku.id);
        if (error) throw error;
        await fetchSkus();
      } catch (err: any) {
        setError(err.message || 'Failed to delete SKU.');
        console.error(err);
      }
    }
  };


  return (
    <>
      <div>
          <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold text-gray-800">จัดการ SKU</h1>
              <div className="flex space-x-3">
                  <button 
                      onClick={() => onNavigate('configurator')}
                      className="bg-white border border-gray-300 text-gray-700 font-semibold px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                  >
                      Back to Configurator
                  </button>
                  <button 
                    onClick={handleOpenAddModal}
                    className="bg-[#C4A383] text-white font-semibold px-4 py-2 rounded-lg hover:bg-opacity-90 transition-opacity flex items-center space-x-2 text-sm"
                  >
                      <PlusIcon className="w-4 h-4" />
                      <span>Add New SKU</span>
                  </button>
              </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">รายการ SKU</h2>
              <div className="relative mb-4">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input 
                      type="text"
                      placeholder="ค้นหา SKU"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none"
                  />
              </div>

              {loading ? (
                  <p className="text-center text-gray-500 py-8">Loading SKUs...</p>
              ) : error ? (
                  <div className="text-center text-red-600 bg-red-50 p-4 rounded-lg">
                      <p className="font-semibold">Error</p>
                      <p className="mt-1">{error}</p>
                      {error.includes('Supabase is not configured') ? (
                           <p className="text-sm text-gray-600 mt-2">Please update the placeholder values in the <code>lib/supabase.ts</code> file.</p>
                      ) : (
                           <p className="text-sm text-gray-600 mt-2">Please check your Supabase connection and make sure the 'skus' table exists.</p>
                      )}
                  </div>
              ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-gray-200 text-gray-500">
                                <th className="py-3 px-4 font-medium">ID</th>
                                <th className="py-3 px-4 font-medium">NAME</th>
                                <th className="py-3 px-4 font-medium">CREATED AT</th>
                                <th className="py-3 px-4 font-medium">ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {skus.length === 0 && !error ? (
                                <tr>
                                    <td colSpan={4} className="text-center text-gray-500 py-8">
                                        No SKUs found. You can add one using the button above.
                                    </td>
                                </tr>
                            ) : (
                                skus.map((sku) => (
                                    <tr key={sku.id} className="border-b border-gray-200 hover:bg-gray-50">
                                        <td className="py-3 px-4 text-gray-600 truncate max-w-[15ch]">{sku.id}</td>
                                        <td className="py-3 px-4 text-gray-800 font-medium">{sku.name}</td>
                                        <td className="py-3 px-4 text-gray-600">{formatDateTime(sku.created_at)}</td>
                                        <td className="py-3 px-4 text-gray-600 font-medium">
                                            <div className="flex items-center space-x-4">
                                                <button onClick={() => handleOpenManageModal(sku)} className="flex items-center text-green-600 hover:text-green-800 text-xs font-medium transition-colors">
                                                    จัดการ
                                                </button>
                                                <button onClick={() => handleOpenEditModal(sku)} className="flex items-center text-blue-600 hover:text-blue-800 text-xs font-medium transition-colors">
                                                    <PencilIcon className="w-4 h-4 mr-1"/> Edit
                                                </button>
                                                <button onClick={() => handleDelete(sku)} className="flex items-center text-red-600 hover:text-red-800 text-xs font-medium transition-colors">
                                                    <TrashIcon className="w-4 h-4 mr-1"/> Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                  </div>
              )}
          </div>
      </div>

      {modalState.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4" aria-modal="true" role="dialog">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md z-50">
            <form onSubmit={handleSubmit}>
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-800">{modalState.mode === 'add' ? 'Add New SKU' : 'Edit SKU'}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {modalState.mode === 'add' ? 'Enter the ID and name for the new SKU.' : `Editing SKU: ${modalState.sku?.name}`}
                </p>
                
                {modalState.mode === 'add' && (
                   <div className="mt-6">
                    <label htmlFor="sku-id" className="block text-sm font-medium text-gray-700 mb-1">
                      SKU ID
                    </label>
                    <input
                      type="text"
                      id="sku-id"
                      value={skuId}
                      onChange={(e) => setSkuId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none"
                      placeholder="e.g., daytona-rainbow"
                      autoFocus
                    />
                     <p className="text-xs text-gray-500 mt-1">Should be unique, lowercase, and use dashes instead of spaces.</p>
                  </div>
                )}

                <div className="mt-4">
                  <label htmlFor="sku-name" className="block text-sm font-medium text-gray-700 mb-1">
                    SKU Name
                  </label>
                  <input
                    type="text"
                    id="sku-name"
                    value={skuName}
                    onChange={(e) => setSkuName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none"
                    placeholder="e.g., Daytona Rainbow"
                    autoFocus={modalState.mode === 'edit'}
                  />
                </div>
                {formError && (
                  <p className="text-sm text-red-600 mt-2">{formError}</p>
                )}
              </div>
              <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 rounded-b-xl">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="bg-white border border-gray-300 text-gray-700 font-semibold px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !skuName.trim() || (modalState.mode === 'add' && !skuId.trim())}
                  className="bg-[#C4A383] text-white font-semibold px-4 py-2 rounded-lg hover:bg-opacity-90 transition-opacity flex items-center space-x-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Saving...' : (modalState.mode === 'add' ? 'Create SKU' : 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Parts Modal */}
      {manageModalState.isOpen && manageModalState.sku && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Manage Parts for SKU: {manageModalState.sku.name}</h2>
              <button
                onClick={handleCloseManageModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6">
              <ManagePartsContent sku={manageModalState.sku} onClose={handleCloseManageModal} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SkuManager;
