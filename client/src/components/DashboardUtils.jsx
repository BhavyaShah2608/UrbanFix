/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { ChevronDown } from 'lucide-react';

export const stateStyles = {
  normal: {
    color: '#059669',
    label: 'Normal',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-100'
  },
  warning: {
    color: '#d97706',
    label: 'Warning',
    badge: 'bg-amber-50 text-amber-700 border-amber-100'
  },
  critical: {
    color: '#dc2626',
    label: 'Critical',
    badge: 'bg-rose-50 text-rose-700 border-rose-100'
  }
};

export const createIoTMarker = (state) => {
  const color = stateStyles[state]?.color || '#2563eb';

  return L.divIcon({
    className: 'custom-gps-marker',
    html: `
      <div class="relative flex items-center justify-center">
        <span class="absolute inline-flex h-7 w-7 rounded-full opacity-60 animate-ping" style="background-color: ${color};"></span>
        <span class="relative inline-flex rounded-full h-4 w-4 border-2 border-white shadow-md" style="background-color: ${color};"></span>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
};

export const createComplaintMarker = (severity) => {
  const colorMap = {
    High: '#dc2626',
    Medium: '#d97706',
    Low: '#059669'
  };
  const color = colorMap[severity] || '#2563eb';

  return L.divIcon({
    className: 'custom-gps-marker',
    html: `
      <div class="relative flex items-center justify-center">
        <span class="absolute inline-flex h-6 w-6 rounded-full opacity-60 animate-slow-ping" style="background-color: ${color};"></span>
        <span class="relative inline-flex rounded-full h-3.5 w-3.5 border-2 border-white shadow-md" style="background-color: ${color};"></span>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

export const createFocusedComplaintMarker = (severity) => {
  const colorMap = {
    High: '#dc2626',
    Medium: '#d97706',
    Low: '#059669'
  };
  const color = colorMap[severity] || '#2563eb';

  return L.divIcon({
    className: 'custom-gps-marker',
    html: `
      <div class="relative flex items-center justify-center">
        <span class="absolute inline-flex h-7 w-7 rounded-full opacity-60 animate-ping" style="background-color: ${color};"></span>
        <span class="relative inline-flex rounded-full h-4 w-4 border-2 border-white shadow-md" style="background-color: ${color};"></span>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
};

export function MapRecenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, zoom, { animate: true, duration: 1.0 });
    }
  }, [center, zoom, map]);
  return null;
}

export const formatReadingTime = (value) => {
  if (!value) return 'Live';
  return new Date(value).toLocaleString();
};

// Generate simulated sewer pipe network connecting Ahmedabad wards logically
export const getMockSewerPipes = (wards) => {
  const pipes = [];
  for (let i = 0; i < wards.length; i++) {
    const next1 = wards[(i + 1) % wards.length];
    const next2 = wards[(i + 4) % wards.length];
    
    if (wards[i].geo_latitude && next1.geo_latitude) {
      pipes.push([[wards[i].geo_latitude, wards[i].geo_longitude], [next1.geo_latitude, next1.geo_longitude]]);
    }
    if (wards[i].geo_latitude && next2.geo_latitude && i % 3 === 0) {
      pipes.push([[wards[i].geo_latitude, wards[i].geo_longitude], [next2.geo_latitude, next2.geo_longitude]]);
    }
  }
  return pipes;
};

export const renderChatInline = (text) => {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

export const renderChatMarkdown = (content, keyPrefix = 'chat-line') => {
  if (!content) return null;

  return String(content).split('\n').map((rawLine, index) => {
    const line = rawLine.trim();
    const key = `${keyPrefix}-${index}`;

    if (!line) return <div key={key} className="h-2" />;
    if (line.startsWith('### ')) {
      return <h4 key={key} className="mt-3 mb-1 text-[12px] font-extrabold text-slate-900">{renderChatInline(line.replace('### ', ''))}</h4>;
    }
    if (line.startsWith('#### ')) {
      return <h5 key={key} className="mt-2.5 mb-1 text-[11px] font-extrabold uppercase tracking-wide text-brand-700">{renderChatInline(line.replace('#### ', ''))}</h5>;
    }
    if (line.startsWith('- [ ] ')) {
      return <p key={key} className="pl-4 py-0.5 text-[11px] font-medium text-slate-700">[ ] {renderChatInline(line.replace('- [ ] ', ''))}</p>;
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return <p key={key} className="pl-4 py-0.5 relative text-[11px] text-slate-700"><span className="absolute left-1.5 text-brand-600">-</span>{renderChatInline(line.slice(2))}</p>;
    }
    if (/^\d+\.\s/.test(line)) {
      return <p key={key} className="py-0.5 text-[11px] font-semibold text-slate-800">{renderChatInline(line)}</p>;
    }
    return <p key={key} className="py-0.5 text-[11px] leading-relaxed text-slate-600">{renderChatInline(line)}</p>;
  });
};

export function MapZoomListener({ onChange }) {
  const map = useMap();
  useEffect(() => {
    const handleZoom = () => {
      onChange(map.getZoom());
    };
    map.on('zoomend', handleZoom);
    return () => {
      map.off('zoomend', handleZoom);
    };
  }, [map, onChange]);
  return null;
}

export function CustomDropdown({ value, onChange, options, className = "", leftIcon }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      <div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer shadow-sm outline-none"
        >
          <div className="flex items-center gap-2">
            {leftIcon && <span className="text-slate-400 flex items-center shrink-0">{leftIcon}</span>}
            <span>{selectedOption?.label || selectedOption?.value}</span>
          </div>
          <ChevronDown size={14} className={`text-slate-450 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-full min-w-[200px] rounded-xl bg-white border border-slate-200/80 shadow-lg ring-1 ring-black/5 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right">
          <div className="py-1 max-h-60 overflow-y-auto scrollbar-thin">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer block ${
                  option.value === value
                    ? 'bg-brand-50 text-brand-700 font-bold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {option.label || option.value}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
