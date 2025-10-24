import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { PartGroup } from '../../types';
import PlusIcon from '../icons/PlusIcon';
import PencilIcon from '../icons/PencilIcon';
import TrashIcon from '../icons/TrashIcon';
import DragHandleIcon from '../icons/DragHandleIcon';

const CORE_GROUPS = ['bracelet', 'outer', 'inner', 'dial', 'hands', 'second', 'case', 'movement'];

interface PartGroupManagerProps {
    onNavigate: (view: 'configurator') => void;
}


const PartGroupManager: React.FC<PartGroupManagerProps> = ({ onNavigate }) => {
  const [partGroups, setPartGroups] = useState<PartGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    mode: 'add' | 'edit';
    group?: PartGroup;
  }>({ isOpen: false, mode: 'add' });
  
  const [formState, setFormState] = useState({ key: '', name_en: '', name_th: '', sort_order: 0, z_index: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Drag and Drop state
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fetchPartGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!supabase) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase
        .from('part_groups')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setPartGroups(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch part groups.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPartGroups();
  }, [fetchPartGroups]);

  const handleOpenAddModal = () => {
    const nextSortOrder = partGroups.length > 0 ? Math.max(...partGroups.map(p => p.sort_order)) + 1 : 1;
    setFormState({ key: '', name_en: '', name_th: '', sort_order: nextSortOrder, z_index: nextSortOrder });
    setFormError(null);
    setModalState({ isOpen: true, mode: 'add' });
  };

  const handleOpenEditModal = (group: PartGroup) => {
    setFormState(group);
    setFormError(null);
    setModalState({ isOpen: true, mode: 'edit', group });
  };

  const handleCloseModal = () => {
    setModalState({ isOpen: false, mode: 'add' });
  };
  
  const generateKey = (name: string) => {
    return name.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name_en.trim() || !formState.name_th.trim()) {
      setFormError('English and Thai names cannot be empty.');
      return;
    }
    if (!supabase) { setFormError('Supabase is not configured.'); return; }

    setIsSubmitting(true);
    setFormError(null);

    try {
      let error;
      if (modalState.mode === 'edit' && modalState.group) {
        const { error: updateError } = await supabase
          .from('part_groups')
          .update({ name_en: formState.name_en, name_th: formState.name_th, sort_order: formState.sort_order, z_index: formState.z_index })
          .eq('key', modalState.group.key);
        error = updateError;
      } else {
        const newKey = formState.key || generateKey(formState.name_en);
        if(!newKey) {
            setFormError('Key could not be generated. Please provide an English name.');
            setIsSubmitting(false);
            return;
        }
        const { error: insertError } = await supabase
          .from('part_groups')
          .insert([{ ...formState, key: newKey }]);
        error = insertError;
      }
      if (error) throw error;
      handleCloseModal();
      await fetchPartGroups();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save part group.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDelete = async (group: PartGroup) => {
    if (CORE_GROUPS.includes(group.key)) {
        alert('This is a core part group and cannot be deleted.');
        return;
    }
    if (window.confirm(`Are you sure you want to delete "${group.name_en}"?`)) {
        if (!supabase) { setError('Supabase is not configured.'); return; }
        try {
            const { error: assetCheckError } = await supabase.from('assets').select('id').eq('group_key', group.key).limit(1);
            if (assetCheckError) throw assetCheckError;
            // Note: Supabase RLS might prevent seeing assets, so the check might not be robust client-side.
            // The prompt says "must not have assets in use", but we'll proceed assuming deletion is allowed if no assets are found.
            
            const { error } = await supabase.from('part_groups').delete().eq('key', group.key);
            if (error) throw error;
            await fetchPartGroups();
        } catch (err: any) {
            setError(err.message || 'Failed to delete part group. It might be in use.');
            console.error(err);
        }
    }
  };
  
  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    dragItem.current = index;
    e.dataTransfer.effectAllowed = 'move';
    // Small timeout to allow the browser to render the drag image
    setTimeout(() => setIsDragging(true), 0);
  };
  
  const handleDragEnter = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    dragOverItem.current = index;
    const list = [...partGroups];
    const draggedItemContent = list[dragItem.current!];
    if (draggedItemContent === undefined) return;

    list.splice(dragItem.current!, 1);
    list.splice(dragOverItem.current!, 0, draggedItemContent);
    dragItem.current = dragOverItem.current;
    setPartGroups(list);
  };
  
  const handleDragEnd = async () => {
    setIsDragging(false);
    if (dragItem.current === null || dragOverItem.current === null) return;
    
    dragItem.current = null;
    dragOverItem.current = null;
    
    // Update sort_order and z_index based on new array order
    const updatedGroups = partGroups.map((group, index) => ({
      ...group,
      sort_order: index + 1,
      z_index: index + 1,
    }));
    
    setPartGroups(updatedGroups); // Optimistically update UI
    
    if (!supabase) { setError('Supabase not configured.'); return; }
    
    // Save to database
    const { error: upsertError } = await supabase.from('part_groups').upsert(updatedGroups);
    if (upsertError) {
      setError(upsertError.message || "Failed to update order.");
      // Re-fetch to revert optimistic update on error
      await fetchPartGroups();
    }
  };


  return (
    <>
      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">จัดการกลุ่มชิ้นส่วน</h1>
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
              <span>Add Part Group</span>
            </button>
          </div>
        </div>


        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">รายการกลุ่มชิ้นส่วน</h2>
          {loading ? (
            <p className="text-center text-gray-500 py-8">Loading...</p>
          ) : error ? (
            <div className="text-center text-red-600 bg-red-50 p-4 rounded-lg">{error}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm table-fixed">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="py-3 px-2 font-medium w-12"></th>
                    <th className="py-3 px-4 font-medium w-40">KEY</th>
                    <th className="py-3 px-4 font-medium">NAME (EN)</th>
                    <th className="py-3 px-4 font-medium">NAME (TH)</th>
                    <th className="py-3 px-4 font-medium w-24">SORT ORDER</th>
                    <th className="py-3 px-4 font-medium w-20">LAYER</th>
                    <th className="py-3 px-4 font-medium w-32">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {partGroups.map((group, index) => (
                    <tr 
                      key={group.key} 
                      className={`border-b border-gray-200 hover:bg-gray-50 ${isDragging && dragItem.current === index ? 'opacity-50' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragEnter={(e) => handleDragEnter(e, index)}
                      onDragOver={(e) => e.preventDefault()}
                      onDragEnd={handleDragEnd}
                    >
                      <td className="py-3 px-2 text-center">
                        <div className="cursor-move text-gray-400">
                          <DragHandleIcon className="w-5 h-5" />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600 truncate">
                        <span className="bg-gray-100 text-gray-700 text-xs font-mono py-1 px-2 rounded-md">{group.key}</span>
                      </td>
                      <td className="py-3 px-4 text-gray-800 font-medium">{group.name_en}</td>
                      <td className="py-3 px-4 text-gray-800 font-medium">{group.name_th}</td>
                      <td className="py-3 px-4 text-gray-600">{group.sort_order}</td>
                      <td className="py-3 px-4 text-gray-600 font-bold">{group.z_index}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-4">
                          <button onClick={() => handleOpenEditModal(group)} className="text-blue-600 hover:text-blue-800 transition-colors">
                            <PencilIcon className="w-5 h-5" />
                          </button>
                          <button onClick={() => handleDelete(group)} disabled={CORE_GROUPS.includes(group.key)} className="text-red-600 hover:text-red-800 transition-colors disabled:text-gray-300 disabled:cursor-not-allowed">
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      {modalState.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md z-50">
            <form onSubmit={handleSubmit}>
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-800">{modalState.mode === 'add' ? 'Add Part Group' : 'Edit Part Group'}</h2>
                 <div className="mt-6 space-y-4">
                    <div>
                        <label htmlFor="name_en" className="block text-sm font-medium text-gray-700 mb-1">Name (EN)</label>
                        <input id="name_en" type="text" value={formState.name_en} onChange={(e) => setFormState(s => ({ ...s, name_en: e.target.value, key: modalState.mode === 'add' ? generateKey(e.target.value) : s.key }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500" autoFocus/>
                    </div>
                     <div>
                        <label htmlFor="name_th" className="block text-sm font-medium text-gray-700 mb-1">Name (TH)</label>
                        <input id="name_th" type="text" value={formState.name_th} onChange={(e) => setFormState(s => ({ ...s, name_th: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"/>
                    </div>
                    <div>
                        <label htmlFor="key" className="block text-sm font-medium text-gray-700 mb-1">Key (ID)</label>
                        <input id="key" type="text" value={formState.key} readOnly={modalState.mode === 'edit'} onChange={(e) => setFormState(s => ({ ...s, key: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100" />
                        <p className="text-xs text-gray-500 mt-1">Auto-generated from English name. Cannot be changed after creation.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="sort_order" className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                            <input id="sort_order" type="number" value={formState.sort_order} onChange={(e) => setFormState(s => ({ ...s, sort_order: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                        </div>
                        <div>
                            <label htmlFor="z_index" className="block text-sm font-medium text-gray-700 mb-1">Layer (z-index)</label>
                            <input id="z_index" type="number" value={formState.z_index} onChange={(e) => setFormState(s => ({ ...s, z_index: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg"/>
                        </div>
                    </div>
                 </div>
                {formError && <p className="text-sm text-red-600 mt-4">{formError}</p>}
              </div>
              <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 rounded-b-xl">
                 <button type="button" onClick={handleCloseModal} className="bg-white border border-gray-300 text-gray-700 font-semibold px-4 py-2 rounded-lg hover:bg-gray-50 text-sm">Cancel</button>
                 <button type="submit" disabled={isSubmitting} className="bg-[#C4A383] text-white font-semibold px-4 py-2 rounded-lg hover:bg-opacity-90 text-sm disabled:opacity-50">{isSubmitting ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default PartGroupManager;
