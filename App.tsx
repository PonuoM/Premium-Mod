
import React, { useState, useRef } from 'react';
import ConfiguratorPage from './pages/ConfiguratorPage';
import AdminPage from './pages/AdminPage';

type View = 'configurator' | 'admin';

const App: React.FC = () => {
  const [view, setView] = useState<View>('configurator');
  const configuratorRef = useRef<{ refreshProfileSettings: () => void } | null>(null);

  const navigateTo = (newView: View) => {
    setView(newView);
    // If navigating back to configurator from admin, refresh profile settings
    if (newView === 'configurator' && view === 'admin') {
      configuratorRef.current?.refreshProfileSettings();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {view === 'configurator' && <ConfiguratorPage ref={configuratorRef} onNavigate={navigateTo} />}
      {view === 'admin' && <AdminPage onNavigate={navigateTo} />}
    </div>
  );
};

export default App;
