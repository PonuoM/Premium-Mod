import React from 'react';
import { AdminView } from '../../pages/AdminPage';
import WatchIcon from '../icons/WatchIcon';
import DiamondIcon from '../icons/DiamondIcon';
import CategoryIcon from '../icons/CategoryIcon';
import SettingsIcon from '../icons/SettingsIcon';

interface AdminSidebarProps {
    activeView: AdminView;
    setActiveView: (view: AdminView) => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeView, setActiveView }) => {
  // Fix: Replaced JSX.Element with React.ReactElement to resolve "Cannot find namespace 'JSX'" error.
  const navItems: { view: AdminView; icon: React.ReactElement; label: string }[] = [
    { view: 'sku', icon: <WatchIcon className="h-5 w-5" />, label: 'จัดการ SKU' },
    { view: 'part-groups', icon: <DiamondIcon className="h-5 w-5" />, label: 'จัดการกลุ่มชิ้นส่วน' },
    { view: 'subcategory', icon: <CategoryIcon className="h-5 w-5" />, label: 'จัดการ Subcategory' },
    { view: 'profile', icon: <SettingsIcon className="h-5 w-5" />, label: 'ตั้งค่าโปรไฟล์' },
  ];

  return (
    <aside className="w-64 bg-white shadow-sm p-4 flex flex-col">
      <div className="px-4 py-2 mb-8">
        <h1 className="text-sm font-semibold text-gray-800">แอดมินพาเนล</h1>
        <p className="text-xs text-gray-500">Watch Configurator</p>
      </div>
      <nav className="flex flex-col space-y-2">
        {navItems.map((item) => {
          const isActive = activeView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => setActiveView(item.view)}
              className={`flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors relative text-left w-full ${
                isActive
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-500 rounded-r-full"></div>}
              {item.icon}
              <span className="text-sm">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

export default AdminSidebar;