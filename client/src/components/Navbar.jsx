import { Shield, LayoutDashboard, UploadCloud } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload', label: 'Data Ingestion', icon: UploadCloud },
    { id: 'review', label: 'Review Center', icon: Shield },
  ];

  const activeIdx = navItems.findIndex(item => item.id === activeTab);

  return (
    <nav className="bg-white sticky top-0 z-50 px-6 py-4 flex flex-col md:flex-row items-center justify-between border-b border-slate-200 shadow-sm gap-4 md:gap-0">
      <div className="flex items-center gap-3 w-full md:w-auto justify-center md:justify-start">
        <div className="bg-brand-600 text-white p-2 rounded-xl border border-brand-500 shadow-sm">
          <Shield size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 text-center md:text-left">
            UrbanFix <span className="text-brand-600">311</span>
          </h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider text-center md:text-left">Phase 1: Sorting & Organization</p>
        </div>
      </div>
      
      <div className="relative flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200/40 w-full max-w-md md:w-[420px] shadow-inner">
        {/* Sliding active pill indicator */}
        <div 
          className="absolute top-1 bottom-1 left-1 rounded-lg bg-brand-600 shadow-sm border border-brand-500 transition-all duration-300 ease-out"
          style={{
            width: 'calc((100% - 8px) / 3)',
            transform: `translateX(calc(${activeIdx * 100}%))`
          }}
        />

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-lg font-bold text-[10px] sm:text-xs uppercase tracking-wider transition-colors duration-300 cursor-pointer ${
                isActive
                  ? 'text-white'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon size={13} className="sm:w-3.5 sm:h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
