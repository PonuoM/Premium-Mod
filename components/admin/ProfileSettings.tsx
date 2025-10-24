import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProfileSettings, WatermarkPosition, WatermarkType } from '../../types';
import { supabase } from '../../lib/supabase';
import UploadIcon from '../icons/UploadIcon';

const DEFAULT_SETTINGS: ProfileSettings = {
  storeName: 'Watch Configurator',
  watermarkType: 'image',
  watermarkImageUrl: 'https://i.imgur.com/7n45iB4.png', // Default sample logo
  watermarkOpacity: 10,
  watermarkSize: 150,
  watermarkPosition: 'bottom-right',
  showFilterButtons: true,
};

interface ProfileSettingsComponentProps {
    onNavigate: (view: 'configurator') => void;
}

const ProfileSettingsComponent: React.FC<ProfileSettingsComponentProps> = ({ onNavigate }) => {
  const [settings, setSettings] = useState<ProfileSettings>(DEFAULT_SETTINGS);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const fetchProfileSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!supabase) {
        throw new Error('Supabase is not configured.');
      }

      const { data, error } = await supabase
        .from('profile_settings')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (data) {
        // Convert database format to application format
        const dbSettings: ProfileSettings = {
          storeName: data.store_name,
          watermarkType: data.watermark_type as WatermarkType,
          watermarkImageUrl: data.watermark_url || '',
          watermarkOpacity: Math.round((data.watermark_opacity || 0.5) * 100), // Convert from 0-1 to 0-100
          watermarkSize: data.watermark_size || 100,
          watermarkPosition: data.watermark_position as WatermarkPosition,
          showFilterButtons: data.show_filter_buttons !== false, // Default to true if not set
        };
        setSettings(dbSettings);
      } else {
        // No settings found, use defaults
        setSettings(DEFAULT_SETTINGS);
      }
    } catch (err: any) {
      console.error('Error fetching profile settings:', err);
      setError(err.message || 'Failed to fetch profile settings.');
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfileSettings();
  }, [fetchProfileSettings]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleRadioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings(prev => ({ ...prev, watermarkType: e.target.value as WatermarkType }));
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: parseInt(value, 10) }));
  };

  const handleSave = async () => {
    if (!supabase) {
      setError('Supabase is not configured.');
      return;
    }

    setSaveStatus('saving');
    setError(null);

    try {
      // Convert application format to database format
      const dbData = {
        store_name: settings.storeName,
        watermark_type: settings.watermarkType,
        watermark_url: settings.watermarkImageUrl,
        watermark_opacity: settings.watermarkOpacity / 100, // Convert from 0-100 to 0-1
        watermark_size: settings.watermarkSize,
        watermark_position: settings.watermarkPosition,
        show_filter_buttons: settings.showFilterButtons,
        updated_at: new Date().toISOString(),
      };

      // Try to update existing record first
      const { error: updateError } = await supabase
        .from('profile_settings')
        .update(dbData)
        .limit(1);

      if (updateError && updateError.code !== 'PGRST116') {
        // If no record exists, insert a new one
        const { error: insertError } = await supabase
          .from('profile_settings')
          .insert([dbData]);

        if (insertError) {
          throw insertError;
        }
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err: any) {
      console.error('Error saving profile settings:', err);
      setError(err.message || 'Failed to save profile settings.');
      setSaveStatus('idle');
    }
  };

  const handleReset = async () => {
    if (window.confirm('Are you sure you want to reset all settings to default?')) {
      if (!supabase) {
        setError('Supabase is not configured.');
        return;
      }

      try {
        // Delete existing settings
        const { error: deleteError } = await supabase
          .from('profile_settings')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

        if (deleteError) {
          console.warn('Error deleting existing settings:', deleteError);
        }

        setSettings(DEFAULT_SETTINGS);
        setError(null);
      } catch (err: any) {
        console.error('Error resetting settings:', err);
        setError(err.message || 'Failed to reset settings.');
      }
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!supabase) { alert('Supabase not configured'); return; }

    setIsUploading(true);
    try {
        const fileName = `watermark.${file.name.split('.').pop()}`;
        const filePath = `public/${fileName}`; // Simple public path for watermark

        // Upload with upsert to overwrite existing watermark
        const { error: uploadError } = await supabase.storage
            .from('watch-assets')
            .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('watch-assets').getPublicUrl(filePath);
        if (!data.publicUrl) throw new Error("Could not get public URL");
        
        // Add a timestamp to bust cache
        const imageUrlWithCacheBuster = `${data.publicUrl}?t=${new Date().getTime()}`;
        setSettings(prev => ({ ...prev, watermarkImageUrl: imageUrlWithCacheBuster }));

    } catch (err: any) {
        alert(`Upload failed: ${err.message}`);
    } finally {
        setIsUploading(false);
        if(fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const positionOptions: { value: WatermarkPosition; label: string }[] = [
    { value: 'top-left', label: 'Top Left' },
    { value: 'top-center', label: 'Top Center' },
    { value: 'top-right', label: 'Top Right' },
    { value: 'center-left', label: 'Center Left' },
    { value: 'center', label: 'Center' },
    { value: 'center-right', label: 'Center Right' },
    { value: 'bottom-left', label: 'Bottom Left' },
    { value: 'bottom-center', label: 'Bottom Center' },
    { value: 'bottom-right', label: 'Bottom Right' },
  ];

  if (loading) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-gray-800">ตั้งค่าโปรไฟล์</h1>
        <div className="mt-6 bg-white rounded-xl shadow-sm p-8 ">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C4A383] mx-auto"></div>
            <p className="text-gray-500 mt-4">Loading profile settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">ตั้งค่าโปรไฟล์</h1>
        <button 
          onClick={() => onNavigate('configurator')}
          className="bg-white border border-gray-300 text-gray-700 font-semibold px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm"
        >
          Back to Configurator
        </button>
      </div>
      
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 font-medium">Error</p>
          <p className="text-red-500 text-sm mt-1">{error}</p>
        </div>
      )}
      
      <div className="mt-6 bg-white rounded-xl shadow-sm p-8 ">
        <div className="space-y-10">
          
          {/* Store Information */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">Store Information</h2>
            <div className="mt-4">
              <label htmlFor="storeName" className="block text-sm font-medium text-gray-700">Store Name</label>
              <input
                type="text"
                id="storeName"
                name="storeName"
                value={settings.storeName}
                onChange={handleInputChange}
                className="mt-1 block w-full max-w-sm px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 bg-white text-gray-900"
              />
              <p className="mt-2 text-xs text-gray-500">This name will be displayed on the main page.</p>
            </div>
          </section>

          {/* Display Settings */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">Display Settings</h2>
            <div className="mt-4">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="showFilterButtons"
                  checked={settings.showFilterButtons}
                  onChange={(e) => setSettings(prev => ({ ...prev, showFilterButtons: e.target.checked }))}
                  className="h-4 w-4 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Show Filter Buttons</span>
                  <p className="text-xs text-gray-500">Display category filter buttons (All, สายยาง, สายหนัง, etc.) in the part selector</p>
                </div>
              </label>
            </div>
          </section>

          {/* Watermark Settings */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">Watermark Settings</h2>
            <div className="mt-4 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Watermark Type</label>
                <div className="mt-2 flex items-center space-x-6">
                  {(['image', 'text', 'none'] as WatermarkType[]).map(type => (
                    <label key={type} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="watermarkType"
                        value={type}
                        checked={settings.watermarkType === type}
                        onChange={handleRadioChange}
                        className="h-4 w-4 text-yellow-600 focus:ring-yellow-500 border-gray-300"
                      />
                      <span className="capitalize text-sm text-gray-800">{type === 'text' ? 'Text (Store Name)' : type}</span>
                    </label>
                  ))}
                </div>
              </div>

              {settings.watermarkType === 'image' && (
                  <div>
                    <label htmlFor="watermarkImageUrl" className="block text-sm font-medium text-gray-700">Watermark Image</label>
                    <div className="mt-1 flex rounded-md shadow-sm max-w-sm">
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg, image/webp" />
                        <input
                            type="text"
                            name="watermarkImageUrl"
                            id="watermarkImageUrl"
                            value={settings.watermarkImageUrl}
                            onChange={handleInputChange}
                            placeholder="URL or upload new image"
                            className="flex-1 block w-full min-w-0 rounded-none rounded-l-md px-3 py-2 border-gray-300 focus:ring-yellow-500 focus:border-yellow-500 bg-white text-gray-900"
                        />
                        <button
                            type="button"
                            onClick={handleUploadClick}
                            disabled={isUploading}
                            className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 text-sm hover:bg-gray-100"
                        >
                            {isUploading ? '...' : 'Upload'}
                        </button>
                    </div>
                  </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div>
                  <label htmlFor="watermarkOpacity" className="block text-sm font-medium text-gray-700">Opacity ({settings.watermarkOpacity}%)</label>
                  <input
                    id="watermarkOpacity"
                    name="watermarkOpacity"
                    type="range"
                    min="0"
                    max="100"
                    value={settings.watermarkOpacity}
                    onChange={handleSliderChange}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <div>
                  <label htmlFor="watermarkSize" className="block text-sm font-medium text-gray-700">Size ({settings.watermarkSize}px)</label>
                  <input
                    id="watermarkSize"
                    name="watermarkSize"
                    type="range"
                    min="10"
                    max="500"
                    value={settings.watermarkSize}
                    onChange={handleSliderChange}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <div>
                    <label htmlFor="watermarkPosition" className="block text-sm font-medium text-gray-700">Position</label>
                    <select
                        id="watermarkPosition"
                        name="watermarkPosition"
                        value={settings.watermarkPosition}
                        onChange={handleInputChange}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm rounded-md"
                    >
                        {positionOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
              </div>

            </div>
          </section>
        </div>
        
        {/* Action Buttons */}
        <div className="mt-8 pt-5 border-t">
          <div className="flex justify-end items-center space-x-3">
            <button
                type="button"
                onClick={handleReset}
                className="bg-white border border-gray-300 text-gray-700 font-semibold px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
                Reset to Default
            </button>
            <button
                type="button"
                onClick={handleSave}
                className="bg-[#C4A383] text-white font-semibold px-4 py-2 rounded-lg hover:bg-opacity-90 transition-opacity flex items-center space-x-2 text-sm w-32 justify-center"
            >
                {saveStatus === 'idle' && 'Save Settings'}
                {saveStatus === 'saving' && 'Saving...'}
                {saveStatus === 'saved' && 'Saved!'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettingsComponent;