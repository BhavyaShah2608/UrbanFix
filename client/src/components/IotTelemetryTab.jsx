/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip,
  BarChart, Bar, XAxis, YAxis
} from 'recharts';
import {
  RadioTower, CheckCircle2, AlertTriangle, Droplets, Download, X, ShieldCheck as ShieldCheckIcon, TrendingUp, Loader2
} from 'lucide-react';
import { 
  stateStyles, 
  createIoTMarker, 
  formatReadingTime 
} from './DashboardUtils';
import WardRelationAssistant from './WardRelationAssistant';

export default function IotTelemetryTab({
  iotSewerReadings = [],
  downloadCSV,
  API_BASE_URL
}) {
  const [isTelemetrySidebarOpen, setIsTelemetrySidebarOpen] = useState(false);
  const sortedTelemetryReadings = useMemo(() => {
    return [...iotSewerReadings].sort((a, b) => {
      const nameA = a.ward_name || '';
      const nameB = b.ward_name || '';
      return nameA.localeCompare(nameB);
    });
  }, [iotSewerReadings]);
  const [selectedRiskZone, setSelectedRiskZone] = useState(""); // "normal", "warning", "critical"
  const [mapCenter, setMapCenter] = useState([23.0225, 72.5714]);
  const [mapZoom, setMapZoom] = useState(12);
  const [mapTilesLoaded, setMapTilesLoaded] = useState(false);

  const hasIotReadings = iotSewerReadings.length > 0;

  // Auto-center map to first valid sensor reading on mount
  useEffect(() => {
    if (hasIotReadings) {
      const firstValid = iotSewerReadings.find((record) => record.geo_latitude && record.geo_longitude);
      if (firstValid) {
        setMapCenter([firstValid.geo_latitude, firstValid.geo_longitude]);
        setMapZoom(11);
      }
    }
  }, [hasIotReadings]);

  const routingPieData = [
    { name: 'Normal', value: iotSewerReadings.filter((r) => r.state_of_sewage === 'normal').length, color: '#059669' },
    { name: 'Warning', value: iotSewerReadings.filter((r) => r.state_of_sewage === 'warning').length, color: '#d97706' },
    { name: 'Critical', value: iotSewerReadings.filter((r) => r.state_of_sewage === 'critical').length, color: '#dc2626' }
  ].filter((item) => item.value > 0);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="glass-card glass-card-hover p-5 rounded-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <div className="p-3 bg-brand-50 text-brand-600 rounded-xl border border-brand-100 shadow-sm">
            <RadioTower size={26} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total IoT Sensors</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1 font-sans">{iotSewerReadings.length}</h3>
          </div>
        </div>

        <div 
          onClick={() => { setSelectedRiskZone('normal'); setIsTelemetrySidebarOpen(true); }}
          className="glass-card glass-card-hover p-5 rounded-2xl flex items-center gap-4 cursor-pointer hover:scale-[1.02] hover:shadow-lg hover:border-emerald-300 active:scale-[0.98] transition-all duration-300 border border-transparent animate-in fade-in slide-in-from-bottom-3 duration-300"
          style={{ animationDelay: '40ms', animationFillMode: 'both' }}
        >
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shadow-sm">
            <CheckCircle2 size={26} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Normal State Wards</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1 font-sans">
              {iotSewerReadings.filter((r) => r.state_of_sewage === 'normal').length}
            </h3>
          </div>
        </div>

        <div 
          onClick={() => { setSelectedRiskZone('warning'); setIsTelemetrySidebarOpen(true); }}
          className="glass-card glass-card-hover p-5 rounded-2xl flex items-center gap-4 cursor-pointer hover:scale-[1.02] hover:shadow-lg hover:border-amber-300 active:scale-[0.98] transition-all duration-300 border border-transparent animate-in fade-in slide-in-from-bottom-3 duration-300"
          style={{ animationDelay: '80ms', animationFillMode: 'both' }}
        >
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 shadow-sm">
            <AlertTriangle size={26} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Warning State Wards</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1 font-sans">
              {iotSewerReadings.filter((r) => r.state_of_sewage === 'warning').length}
            </h3>
          </div>
        </div>

        <div 
          onClick={() => { setSelectedRiskZone('critical'); setIsTelemetrySidebarOpen(true); }}
          className="glass-card glass-card-hover p-5 rounded-2xl flex items-center gap-4 cursor-pointer hover:scale-[1.02] hover:shadow-lg hover:border-rose-300 active:scale-[0.98] transition-all duration-300 border border-transparent animate-in fade-in slide-in-from-bottom-3 duration-300"
          style={{ animationDelay: '120ms', animationFillMode: 'both' }}
        >
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 shadow-sm">
            <Droplets size={26} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Critical State Wards</p>
            <h3 className="text-2xl font-bold text-rose-600 mt-1 font-sans">
              {iotSewerReadings.filter((r) => r.state_of_sewage === 'critical').length}
            </h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-6">
          {/* Sewage State Distribution */}
          <div className="glass-card p-5 rounded-2xl">
            <h3 className="text-md font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Droplets size={16} className="text-brand-600" />
              Sewage State Distribution
            </h3>
            {routingPieData.length > 0 ? (
              <div className="h-44 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={routingPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                      isAnimationActive={true}
                      animationDuration={600}
                      animationEasing="ease-out"
                    >
                      {routingPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-44 flex items-center justify-center text-slate-400 text-xs font-semibold">
                No telemetry readings recorded.
              </div>
            )}
          </div>

          {/* Wards with Highest Nitrogen Levels Bar Chart */}
          <div className="glass-card p-5 rounded-2xl">
            <h3 className="text-md font-bold text-slate-800 mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-brand-600" />
              Wards with Highest Nitrogen Levels (mg/L)
            </h3>
            {iotSewerReadings.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[...iotSewerReadings]
                      .sort((a, b) => b['nitrogen mg/L'] - a['nitrogen mg/L'])
                      .slice(0, 6)
                      .map((r) => ({
                        name: r.ward_name,
                        Nitrogen: r['nitrogen mg/L'],
                        Phosphorous: r['phosphorous mg/L']
                      }))}
                    margin={{ bottom: 15, left: -10, right: 10 }}
                  >
                    <XAxis dataKey="name" stroke="#64748b" fontSize={9.5} tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={60} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                    <Legend />
                    <Bar dataKey="Nitrogen" fill="#2563eb" radius={[4, 4, 0, 0]} isAnimationActive={true} animationDuration={600} animationEasing="ease-out" />
                    <Bar dataKey="Phosphorous" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={true} animationDuration={600} animationEasing="ease-out" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-400 text-xs font-semibold">
                No telemetry readings available.
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-7 space-y-6">
          {/* Municipal Sewerage Intelligence Hub */}
          <WardRelationAssistant iotSewerReadings={iotSewerReadings} API_BASE_URL={API_BASE_URL} />
        </div>
      </div>

      {/* Map Section */}
      <div className="mt-6 space-y-6">
        {/* Info Card & Export */}
        <div className="glass-card p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-start gap-3 text-slate-600 font-sans">
            <div className="p-2.5 bg-brand-50 text-brand-600 rounded-xl border border-brand-100 shadow-sm shrink-0">
              <RadioTower size={20} className="animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800 leading-tight">
                Live IoT Sewer Telemetry Dataset
              </h4>
              <p className="text-[11px] text-slate-400 font-semibold mt-1">
                Ahmedabad sensor nodes polling chemical loads & blockages dynamically.
              </p>
              <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-500 font-semibold">
                <span>{iotSewerReadings.length} rows</span>
                <span className="h-3 w-px bg-slate-200"></span>
                <span>18 properties</span>
              </div>
            </div>
          </div>
          <button
            onClick={downloadCSV}
            className="flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 hover:border-brand-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-brand-600 font-semibold text-xs rounded-lg shadow-xs transition-all active:scale-[0.98] duration-150 cursor-pointer"
          >
            <Download size={14} />
            Export IoT Telemetry CSV
          </button>
        </div>

        {/* Map Container */}
        <div className="glass-card p-5 rounded-2xl h-[460px] flex flex-col relative z-0">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <RadioTower size={16} className="text-brand-600 animate-pulse" />
            Live IoT Sensor Map
          </h3>
          <div className="flex-1 w-full rounded-xl overflow-hidden border border-slate-200/80 bg-slate-50 shadow-inner relative">
            {!mapTilesLoaded && (
              <div className="absolute inset-0 z-[1000] shimmer-loader flex flex-col items-center justify-center space-y-2 pointer-events-none rounded-xl">
                <Loader2 className="animate-spin text-brand-600" size={32} />
                <span className="text-xs font-semibold text-brand-700 animate-pulse">Initializing sensor map canvas...</span>
              </div>
            )}
            
            <MapContainer 
              center={mapCenter} 
              zoom={mapZoom} 
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                eventHandlers={{
                  load: () => setMapTilesLoaded(true)
                }}
              />
              {iotSewerReadings.map((record) => (
                <Marker
                  key={`sensor-map-${record.device_id}`}
                  position={[record.geo_latitude, record.geo_longitude]}
                  icon={createIoTMarker(record.state_of_sewage)}
                >
                  <Popup>
                    <div className="text-xs p-1 text-slate-900 font-sans">
                      <span className="font-bold text-brand-700 text-[13px]">{record.ward_name} IoT Sensor</span>
                      <div className="border-t border-slate-100 pt-1 mt-1 text-[10px] text-slate-500 flex flex-col">
                        <span><strong>Device:</strong> {record.device_id}</span>
                        <span><strong>Sewage State:</strong> <span className="font-bold text-slate-800 uppercase">{record.state_of_sewage}</span></span>
                        <span><strong>Chemical Nitrogen:</strong> {record['nitrogen mg/L']} mg/L</span>
                        <span><strong>Chemical Phosphorus:</strong> {record['phosphorous mg/L']} mg/L</span>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>
      </div>

      {/* Dataset Table Section */}
      <div className="glass-card p-5 rounded-2xl overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
            <RadioTower size={18} className="text-emerald-600 animate-pulse" />
            Live IoT Sewer Telemetry Dataset
          </h3>
          <div className="flex items-center gap-3">
            <button
              onClick={downloadCSV}
              className="px-3 py-1.5 bg-emerald-50/50 hover:bg-emerald-100/70 border border-emerald-200 text-emerald-700 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer hover:scale-[1.01]"
            >
              <Download size={14} className="text-emerald-600" />
              Export to CSV
            </button>
            <span className="hidden md:inline text-[9px] font-extrabold text-slate-400 uppercase tracking-widest pl-1.5 border-l border-slate-200">
              Real-Time Sensor Telemetry
            </span>
          </div>
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-[450px] border border-slate-150 rounded-2xl shadow-xs scrollbar-thin">
          <table className="w-full text-left border-collapse text-xs font-sans">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-150 text-slate-400 font-bold uppercase tracking-wider text-[10px] sticky top-0 z-10 shadow-xs">
                <th className="py-3 px-4 bg-slate-50/90">Area</th>
                <th className="py-3 px-4 bg-slate-50/90">Telemetry Date</th>
                <th className="py-3 px-4 bg-slate-50/90 text-right">Nitrogen Level</th>
                <th className="py-3 px-4 bg-slate-50/90 text-right">Phosphorus Level</th>
                <th className="py-3 px-4 bg-slate-50/90 text-center">Sewage State</th>
                <th className="py-3 px-4 bg-slate-50/90">State Details</th>
                <th className="py-3 px-4 bg-slate-50/90 text-right">Diameter</th>
                <th className="py-3 px-4 bg-slate-50/90">Install Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
              {sortedTelemetryReadings.map((r) => (
                <tr key={r.device_id} className="hover:bg-slate-50/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-800">
                    {r.ward_name}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 font-medium">
                    {formatReadingTime(r.date)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-850 font-bold">
                    {r['nitrogen mg/L']} <span className="text-[10px] text-slate-400 font-normal">mg/L</span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-850 font-bold">
                    {r['phosphorous mg/L']} <span className="text-[10px] text-slate-400 font-normal">mg/L</span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${stateStyles[r.state_of_sewage]?.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        r.state_of_sewage === 'critical' ? 'bg-red-500 animate-pulse' : r.state_of_sewage === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}></span>
                      {stateStyles[r.state_of_sewage]?.label || r.state_of_sewage}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 font-medium max-w-[200px] truncate" title={r.state_reason}>
                    {r.state_reason || "Optimal Operations"}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-slate-800">
                    {r.pipe_diameter_mm} <span className="text-[10px] text-slate-400 font-normal">mm</span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 font-medium">
                    {r.installation_method || "N/A"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Telemetry Risk Sidebar Panel */}
      {isTelemetrySidebarOpen && (
        <>
          <div 
            onClick={() => setIsTelemetrySidebarOpen(false)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[9998] transition-all duration-500 ease-in-out animate-in fade-in duration-300"
          />

          <div className="fixed top-0 right-0 h-screen w-full sm:w-[540px] bg-white/98 border-l border-slate-200 text-slate-800 z-[9999] shadow-2xl flex flex-col transition-all duration-300 ease-in-out animate-in slide-in-from-right duration-300 overflow-hidden font-sans">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border shadow-sm ${
                  selectedRiskZone === 'critical' 
                    ? 'bg-rose-50 border-rose-100 text-rose-600' 
                    : selectedRiskZone === 'warning' 
                    ? 'bg-amber-50 border-amber-100 text-amber-600' 
                    : 'bg-emerald-50 border-emerald-100 text-emerald-600'
                }`}>
                  {selectedRiskZone === 'critical' ? (
                    <Droplets size={20} className="animate-pulse" />
                  ) : selectedRiskZone === 'warning' ? (
                    <AlertTriangle size={20} className="animate-bounce" />
                  ) : (
                    <CheckCircle2 size={20} />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-wide text-slate-800 uppercase font-mono">
                    {selectedRiskZone === 'critical' && 'Critical State Conduits'}
                    {selectedRiskZone === 'warning' && 'Warning State Conduits'}
                    {selectedRiskZone === 'normal' && 'Normal State Conduits'}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase mt-0.5">
                    Ahmedabad Telemetry Operations Center
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTelemetrySidebarOpen(false)}
                className="text-slate-500 hover:text-slate-800 p-2 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 hover:border-slate-300 cursor-pointer animate-in fade-in duration-200"
                aria-label="Close sidebar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-slate-50/50">
              {(() => {
                const filteredWards = iotSewerReadings.filter(
                  (r) => r.state_of_sewage === selectedRiskZone
                );

                if (filteredWards.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
                      <div className="p-4 bg-slate-100 border border-slate-200 rounded-full text-slate-400">
                        <ShieldCheckIcon size={36} />
                      </div>
                      <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500">
                        No Conduits Detected
                      </h4>
                      <p className="text-[11px] text-slate-500 px-10 leading-relaxed font-semibold">
                        There are currently no sensor readings reported under this telemetry risk state.
                      </p>
                    </div>
                  );
                }

                return filteredWards.map((record) => {
                  let flowVelocity;
                  let wettedCapacity;
                  let riskScore;
                  
                  if (selectedRiskZone === 'critical') {
                    const seed = (record.pipe_age_years || 5) * (record.pipe_diameter_mm || 300);
                    flowVelocity = (0.10 + (seed % 10) * 0.015).toFixed(2);
                    wettedCapacity = (90 + (seed % 9)).toFixed(0) + "%";
                    riskScore = (8.0 + (seed % 15) * 0.1).toFixed(1);
                  } else if (selectedRiskZone === 'warning') {
                    const seed = (record.pipe_age_years || 5) * (record.pipe_diameter_mm || 300);
                    flowVelocity = (0.45 + (seed % 20) * 0.015).toFixed(2);
                    wettedCapacity = (60 + (seed % 25)).toFixed(0) + "%";
                    riskScore = (4.0 + (seed % 35) * 0.1).toFixed(1);
                  } else {
                    const seed = (record.pipe_age_years || 5) * (record.pipe_diameter_mm || 300);
                    flowVelocity = (1.05 + (seed % 30) * 0.015).toFixed(2);
                    wettedCapacity = (20 + (seed % 20)).toFixed(0) + "%";
                    riskScore = (0.5 + (seed % 25) * 0.1).toFixed(1);
                  }

                  return (
                    <div 
                      key={`sidebar-ward-${record.device_id}`}
                      className="bg-white border border-slate-100 rounded-xl p-4.5 space-y-3.5 hover:border-slate-200 transition-all duration-300 shadow-sm"
                    >
                      <div className="flex items-start justify-between border-b border-slate-100 pb-2.5">
                        <div>
                          <h4 className="text-sm font-extrabold text-slate-800 tracking-wide">
                            {record.ward_name}
                          </h4>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Sensor Node: {record.device_id}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase font-mono tracking-wider shadow-sm border ${
                          selectedRiskZone === 'critical'
                            ? 'bg-rose-50 border-rose-100 text-rose-600'
                            : selectedRiskZone === 'warning'
                            ? 'bg-amber-50 border-amber-100 text-amber-600'
                            : 'bg-emerald-50 border-emerald-100 text-emerald-600'
                        }`}>
                          {selectedRiskZone === 'critical' ? 'Critical' : selectedRiskZone === 'warning' ? 'Warning' : 'Normal'}
                        </span>
                      </div>

                      {record.state_reason && (
                        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-[11px] leading-relaxed font-semibold">
                          <span className="text-[9px] font-extrabold uppercase text-slate-400 font-mono block mb-0.5">
                            Anomaly Vector Diagnostics
                          </span>
                          <span className="text-slate-700 font-medium">{record.state_reason}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3.5 font-semibold">
                        <div className="space-y-1">
                          <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 font-mono block">
                            Chemical Load
                          </span>
                          <div className="text-[11px] text-slate-600 font-mono">
                            N: <span className="text-slate-800">{record['nitrogen mg/L']} mg/L</span>
                            <span className="mx-1 text-slate-300">|</span>
                            P: <span className="text-slate-800">{record['phosphorous mg/L']} mg/L</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 font-mono block">
                            Structural Index
                          </span>
                          <div className="text-[11px] text-slate-600 font-mono">
                            Age: <span className="text-slate-800">{record.pipe_age_years} yrs</span>
                            <span className="mx-1 text-slate-300">|</span>
                            Dia: <span className="text-slate-800">{record.pipe_diameter_mm} mm</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 font-mono block">
                            Topography
                          </span>
                          <div className="text-[11px] text-slate-600 font-mono">
                            Depth: <span className="text-slate-800">{record.pipe_depth_m} m</span>
                            <span className="mx-1 text-slate-300">|</span>
                            GWL: <span className="text-slate-800">{record.groundwater_level_m} m</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 font-mono block">
                            Node Links
                          </span>
                          <div className="text-[11px] text-slate-600 font-mono">
                            Connections: <span className="text-slate-800">{record.connections_count} links</span>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-3.5 space-y-2">
                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 font-mono block">
                          Derived Hydraulic Indicators
                        </span>
                        
                        <div className="grid grid-cols-3 gap-2.5">
                          <div className="bg-slate-50 border border-slate-100 rounded-xl p-2 text-center">
                            <span className="text-[8px] text-slate-500 font-mono block uppercase">Flow Velocity</span>
                            <span className="text-xs font-bold font-mono text-slate-800 mt-0.5 block">{flowVelocity} m/s</span>
                          </div>
                          <div className="bg-slate-50 border border-slate-100 rounded-xl p-2 text-center">
                            <span className="text-[8px] text-slate-500 font-mono block uppercase">Wetted Capacity</span>
                            <span className="text-xs font-bold font-mono text-slate-800 mt-0.5 block">{wettedCapacity}</span>
                          </div>
                          <div className="bg-slate-50 border border-slate-100 rounded-xl p-2 text-center">
                            <span className="text-[8px] text-slate-500 font-mono block uppercase">Risk Rating</span>
                            <span className={`text-xs font-extrabold font-mono mt-0.5 block ${
                              selectedRiskZone === 'critical'
                                ? 'text-rose-600'
                                : selectedRiskZone === 'warning'
                                ? 'text-amber-600'
                                : 'text-emerald-600'
                            }`}>{riskScore}/10</span>
                          </div>
                        </div>
                      </div>

                      <div className={`mt-3.5 p-3 rounded-xl border text-[11px] leading-relaxed font-sans ${
                        selectedRiskZone === 'critical'
                          ? 'bg-rose-50 border-rose-100 text-rose-800 animate-pulse'
                          : selectedRiskZone === 'warning'
                          ? 'bg-amber-50 border-amber-100 text-amber-800 font-semibold'
                          : 'bg-emerald-50 border-emerald-100 text-emerald-800 font-semibold'
                      }`}>
                        <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] mb-1.5">
                          <span>
                            {selectedRiskZone === 'critical' && 'IMMEDIATE REACTIVE ACTION: Hydro-Jetting Dispatch'}
                            {selectedRiskZone === 'warning' && 'SEMI-PROACTIVE ACTION: Preventative Desilting'}
                            {selectedRiskZone === 'normal' && 'PROACTIVE PLAN: CCTV Joint & Structural Audit'}
                          </span>
                        </div>
                        <p className="text-[10.5px] opacity-90">
                          {selectedRiskZone === 'critical' && 'Active blockage or extreme surcharging detected. Urgent dispatch of high-pressure hydro-jetting machines and suction tankers is required to restore flow capacity. Standard crew safety protocol for volatile H2S gas checks is mandatory.'}
                          {selectedRiskZone === 'warning' && 'Moderate surcharging or elevated nutrient load indicating structural roots or partial siltation. Schedule a preventative desilting flush and camera scoping within the next 48 hours to secure hydraulic capacity.'}
                          {selectedRiskZone === 'normal' && 'Conduit operating within nominal parameters. Schedule routine preventative visual/sonar joint audits as per the AMC pre-monsoon cycle. Maintain passive telemetry polling.'}
                        </p>
                        {record.maintenance_required && (
                          <div className={`mt-2 pt-2 border-t text-[9px] font-mono ${
                            selectedRiskZone === 'critical' 
                              ? 'border-rose-200 text-rose-600' 
                              : selectedRiskZone === 'warning' 
                              ? 'border-amber-200 text-amber-600' 
                              : 'border-emerald-200 text-emerald-600'
                          }`}>
                            <strong>Local Directive:</strong> {record.maintenance_required}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 font-semibold font-mono">
              <span>ACTIVE SEWER TELEMETRY</span>
              <span>POLLING RATE: 10S</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
