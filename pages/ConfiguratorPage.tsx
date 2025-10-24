
import React, { useState, useMemo, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import Header from '../components/Header';
import PartSelector from '../components/PartSelector';
import WatchPreview from '../components/WatchPreview';
import { ViewAsset, Sku, PartGroup, ProfileSettings } from '../types';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'watch_config_profile_settings';
const DEFAULT_SETTINGS: ProfileSettings = {
  storeName: 'Watch Configurator',
  watermarkType: 'image',
  watermarkImageUrl: '',
  watermarkOpacity: 10,
  watermarkSize: 150,
  watermarkPosition: 'bottom-right',
  showFilterButtons: true,
};

interface ConfiguratorPageProps {
  onNavigate: (view: 'admin') => void;
}

export interface ConfiguratorPageRef {
  refreshProfileSettings: () => void;
}

const ConfiguratorPage = forwardRef<ConfiguratorPageRef, ConfiguratorPageProps>(({ onNavigate }, ref) => {
  const [skus, setSkus] = useState<Sku[]>([]);
  const [partGroups, setPartGroups] = useState<PartGroup[]>([]);
  const [assets, setAssets] = useState<ViewAsset[]>([]);
  
  const [selectedSkuId, setSelectedSkuId] = useState<string>('');
  const [selectedAssets, setSelectedAssets] = useState<Record<string, string>>({});
  const [profileSettings, setProfileSettings] = useState<ProfileSettings>(DEFAULT_SETTINGS);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfileSettings = useCallback(async () => {
    try {
      if (!supabase) {
        console.warn('Supabase is not configured, using default settings.');
        setProfileSettings(DEFAULT_SETTINGS);
        return;
      }

      const { data, error } = await supabase
        .from('profile_settings')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching profile settings:', error);
        setProfileSettings(DEFAULT_SETTINGS);
        return;
      }

      if (data) {
        // Convert database format to application format
        const dbSettings: ProfileSettings = {
          storeName: data.store_name,
          watermarkType: data.watermark_type as any,
          watermarkImageUrl: data.watermark_url || '',
          watermarkOpacity: Math.round((data.watermark_opacity || 0.5) * 100), // Convert from 0-1 to 0-100
          watermarkSize: data.watermark_size || 100,
          watermarkPosition: data.watermark_position as any,
          showFilterButtons: data.show_filter_buttons !== false, // Default to true if not set
        };
        setProfileSettings(dbSettings);
      } else {
        // No settings found, use defaults
        setProfileSettings(DEFAULT_SETTINGS);
      }
    } catch (err: any) {
      console.error('Error fetching profile settings:', err);
      setProfileSettings(DEFAULT_SETTINGS);
    }
  }, []);

  useEffect(() => {
    fetchProfileSettings();
  }, [fetchProfileSettings]);

  useImperativeHandle(ref, () => ({
    refreshProfileSettings: fetchProfileSettings,
  }));

  const fetchInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (!supabase) {
        throw new Error('Supabase is not configured.');
      }

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
      console.error(err);
      setError(err.message || 'Failed to fetch initial data.');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Combined effect to fetch assets and set defaults when SKU or part groups change
  useEffect(() => {
    if (!selectedSkuId || partGroups.length === 0) {
      setAssets([]);
      // Don't reset selectedAssets here to avoid clearing user selections
      if(selectedSkuId) setLoading(false)
      return;
    }

    const fetchAssetsAndSetDefaults = async () => {
      setLoading(true);
      setError(null);
      
      try {
        if (!supabase) throw new Error('Supabase is not configured.');

        const { data: fetchedAssets, error } = await supabase
          .from('assets_with_subcategory')
          .select('*')
          .eq('sku_id', selectedSkuId);
        
        if (error) throw error;

        const assetsData = fetchedAssets || [];
        setAssets(assetsData);

        const defaults: Record<string, string> = {};
        partGroups.forEach(group => {
            const assetsForGroup = assetsData.filter(a => a.group_key === group.key);
            if (assetsForGroup.length > 0) {
                assetsForGroup.sort((a, b) => a.sort - b.sort);
                defaults[group.key] = assetsForGroup[0].id;
            }
        });
        setSelectedAssets(defaults);

      } catch (err: any) {
        console.error(err);
        setError(err.message || `Failed to fetch assets for SKU: ${selectedSkuId}`);
        setAssets([]);
        setSelectedAssets({});
      } finally {
        setLoading(false);
      }
    };

    fetchAssetsAndSetDefaults();
  }, [selectedSkuId, partGroups]);


  const handleAssetSelect = (groupKey: string, assetId: string) => {
    setSelectedAssets(prev => ({
      ...prev,
      [groupKey]: assetId,
    }));
  };
  
  const assetsForPreview = useMemo(() => {
    const selectedIds = Object.values(selectedAssets).filter(id => id !== undefined);
    
    if (selectedIds.length === 0) return [];
    
    const filteredAssets = assets
      .filter(asset => selectedIds.includes(asset.id))
      .sort((a, b) => a.z_index - b.z_index);
    
    return filteredAssets;
  }, [selectedAssets, assets]);

  // Prevent right-click and copy protection
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent F12, Ctrl+Shift+I, Ctrl+U, Ctrl+S, Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        (e.ctrlKey && e.key === 'u') ||
        (e.ctrlKey && e.key === 's') ||
        (e.ctrlKey && e.key === 'a') ||
        (e.ctrlKey && e.key === 'c') ||
        (e.ctrlKey && e.key === 'v') ||
        (e.ctrlKey && e.key === 'x')
      ) {
        e.preventDefault();
      }
    };

    const handleSelectStart = (e: Event) => {
      e.preventDefault();
    };

    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
    };

    // Add event listeners
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('dragstart', handleDragStart);

    // Cleanup
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('dragstart', handleDragStart);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>
      <Header 
        onNavigate={onNavigate}
        storeName={profileSettings.storeName}
      />
      <main className="flex flex-1 overflow-hidden">
        {loading && <div className="text-center p-10 w-full">Loading Configurator...</div>}
        {error && <div className="text-center p-10 text-red-600 bg-red-50 rounded-lg m-8 w-full">{error}</div>}
        
        {!loading && !error && skus.length > 0 && (
          <>
            {/* Desktop Layout */}
            <div className="hidden lg:flex w-full">
              <div className="w-full max-w-sm lg:max-w-md xl:max-w-lg p-4 md:p-8 overflow-y-auto border-r border-gray-200">
                <PartSelector 
                  partGroups={partGroups} 
                  assets={assets}
                  selectedAssets={selectedAssets}
                  onAssetSelect={handleAssetSelect}
                  showFilterButtons={profileSettings.showFilterButtons}
                  skus={skus}
                  selectedSku={selectedSkuId}
                  onSkuChange={setSelectedSkuId}
                />
              </div>
              <div className="flex-1">
                <WatchPreview 
                  assets={assetsForPreview}
                  settings={profileSettings}
                />
              </div>
            </div>

            {/* Mobile Layout */}
            <div className="lg:hidden flex flex-col w-full h-full">
              {/* Fixed Watch Preview - 60% of screen height */}
              <div className="h-3/5 flex-shrink-0">
                <WatchPreview 
                  assets={assetsForPreview}
                  settings={profileSettings}
                />
              </div>
              
              {/* Scrollable Parts Section - 40% of screen height */}
              <div className="h-2/5 overflow-y-auto bg-white border-t border-gray-200">
                <div className="p-3">
                  <PartSelector 
                    partGroups={partGroups} 
                    assets={assets}
                    selectedAssets={selectedAssets}
                    onAssetSelect={handleAssetSelect}
                    showFilterButtons={profileSettings.showFilterButtons}
                    skus={skus}
                    selectedSku={selectedSkuId}
                    onSkuChange={setSelectedSkuId}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {!loading && !error && skus.length === 0 && (
           <div className="w-full text-center p-10 m-8 bg-white rounded-xl shadow-sm">
              <h2 className="text-2xl font-semibold text-gray-800">No SKUs Found</h2>
              <p className="text-gray-500 mt-2">Please go to the Admin Panel to add your first SKU.</p>
              <button 
                  onClick={() => onNavigate('admin')}
                  className="mt-4 bg-[#C4A383] text-white font-semibold px-4 py-2 rounded-lg hover:bg-opacity-90 transition-opacity"
              >
                  Go to Admin
              </button>
           </div>
        )}
      </main>
    </div>
  );
});

export default ConfiguratorPage;
