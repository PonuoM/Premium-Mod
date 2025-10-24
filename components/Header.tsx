
import React from 'react';
import UserIcon from './icons/UserIcon';

interface HeaderProps {
  onNavigate: (view: 'admin') => void;
  storeName: string;
}

const Header: React.FC<HeaderProps> = ({ onNavigate, storeName }) => {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-4 md:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-800">{storeName}</h1>
          </div>
          <div className="flex items-center">
            <button 
              onClick={() => onNavigate('admin')}
              className="flex items-center border border-gray-300 rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <UserIcon className="h-4 w-4 mr-2 text-gray-500" />
              Admin
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
