import React, { useState } from 'react';
import AdminSidebar from '../components/admin/AdminSidebar';
import SkuManager from '../components/admin/SkuManager';
import PartGroupManager from '../components/admin/PartGroupManager';
import SubcategoryManager from '../components/admin/SubcategoryManager';
import ProfileSettings from '../components/admin/ProfileSettings';

export type AdminView = 'sku' | 'part-groups' | 'subcategory' | 'profile';

interface AdminPageProps {
    onNavigate: (view: 'configurator') => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ onNavigate }) => {
  const [activeView, setActiveView] = useState<AdminView>('sku');

  const renderContent = () => {
    switch (activeView) {
      case 'sku':
        return <SkuManager onNavigate={onNavigate} />;
      case 'part-groups':
        return <PartGroupManager onNavigate={onNavigate} />;
      case 'subcategory':
        return <SubcategoryManager onNavigate={onNavigate} />;
      case 'profile':
        return <ProfileSettings onNavigate={onNavigate} />;
      default:
        return <SkuManager onNavigate={onNavigate} />;
    }
  }

  return (
    <div className="flex min-h-screen bg-[#F8F9FA]">
      <AdminSidebar activeView={activeView} setActiveView={setActiveView} />
      <main className="flex-1 p-8">
        {renderContent()}
      </main>
    </div>
  );
};

export default AdminPage;