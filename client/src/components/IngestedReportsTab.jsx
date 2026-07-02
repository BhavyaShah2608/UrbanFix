/* eslint-disable react-hooks/exhaustive-deps, react-hooks/incompatible-library */
import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  CheckCircle2, AlertTriangle, Gauge, Database, Download, MapPin, Activity
} from 'lucide-react';
import { 
  createComplaintMarker, 
  MapRecenter 
} from './DashboardUtils';

export default function IngestedReportsTab({
  structuredRecords = [],
  quarantineRecords = [],
  flaggedRecords = [],
  selectedBatch,
  downloadCSV
}) {
  const [mapCenter, setMapCenter] = useState([23.0225, 72.5714]);
  const [mapZoom, setMapZoom] = useState(12);

  const filteredStructured = selectedBatch === 'all'
    ? structuredRecords
    : structuredRecords.filter((record) => record.batch_id === selectedBatch);

  const filteredQuarantine = selectedBatch === 'all'
    ? quarantineRecords
    : quarantineRecords.filter((record) => record.batch_id === selectedBatch);

  const filteredFlagged = selectedBatch === 'all'
    ? flaggedRecords
    : flaggedRecords.filter((record) => record.batch_id === selectedBatch);

  const parentRef = useRef();

  const rowVirtualizer = useVirtualizer({
    count: filteredStructured.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 10
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length > 0 
    ? totalSize - virtualRows[virtualRows.length - 1].end 
    : 0;

  // Auto-center map on first valid complaint
  useEffect(() => {
    if (filteredStructured.length > 0) {
      const firstValid = filteredStructured.find((record) => record.lat && record.lng);
      if (firstValid) {
        setMapCenter([firstValid.lat, firstValid.lng]);
        setMapZoom(13);
      }
    }
  }, [selectedBatch]);

  const categoryCounts = filteredStructured.reduce((acc, curr) => {
    const cat = curr.complaint_category || 'Other';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const barChartData = Object.keys(categoryCounts).map((name) => ({
    name,
    count: categoryCounts[name]
  }));

  const totalProcessed = filteredStructured.length + filteredQuarantine.length + filteredFlagged.length;
  const avgConfidence = totalProcessed > 0
    ? (filteredStructured.reduce((sum, record) => sum + (record.confidence_score || 1.0), 0)
      + filteredFlagged.reduce((sum, record) => sum + (record.confidence_score || 0.6), 0)
      + filteredQuarantine.reduce((sum, record) => sum + (record.confidence_score || 0.3), 0)) / totalProcessed
    : 0;

  const routingPieData = [
    { name: 'Structured', value: filteredStructured.length, color: '#059669' },
    { name: 'Flagged', value: filteredFlagged.filter((record) => record.status === 'pending').length, color: '#d97706' },
    { name: 'Quarantine', value: filteredQuarantine.filter((record) => record.status === 'pending').length, color: '#dc2626' }
  ].filter((item) => item.value > 0);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="glass-card glass-card-hover p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shadow-sm">
            <CheckCircle2 size={26} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Structured Records</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1 font-sans">{filteredStructured.length}</h3>
          </div>
        </div>

        <div className="glass-card glass-card-hover p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 shadow-sm">
            <AlertTriangle size={26} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Flagged Reviews</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1 font-sans">
              {filteredFlagged.filter((record) => record.status === 'pending').length}
            </h3>
          </div>
        </div>

        <div className="glass-card glass-card-hover p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 shadow-sm">
            <AlertTriangle size={26} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Quarantined</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1 font-sans">
              {filteredQuarantine.filter((record) => record.status === 'pending').length}
            </h3>
          </div>
        </div>

        <div className="glass-card glass-card-hover p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-brand-50 text-brand-600 rounded-xl border border-brand-100 shadow-sm">
            <Gauge size={26} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Accuracy Index</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1 font-sans">{(avgConfidence * 100).toFixed(0)}%</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-6">
          {/* Routing Status Pie */}
          <div className="glass-card p-5 rounded-2xl">
            <h3 className="text-md font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Database size={16} className="text-emerald-600" />
              311 Routing Status
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
                No processed records in this batch view.
              </div>
            )}
          </div>

          {/* Category Distribution Bar Chart */}
          <div className="glass-card p-5 rounded-2xl">
            <h3 className="text-md font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Database size={16} className="text-brand-600" />
              Ingested Categories Distribution
            </h3>
            {barChartData.length > 0 ? (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ left: -20, right: 10, bottom: 0 }}>
                    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={10} fontWeight="bold" stroke="#64748b" />
                    <YAxis tickLine={false} axisLine={false} fontSize={10} fontWeight="bold" stroke="#64748b" />
                    <RechartsTooltip contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                    <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={28} isAnimationActive={true} animationDuration={600} animationEasing="ease-out" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-xs font-semibold">
                No category records available.
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-7 space-y-6">
          {/* Info Card & Export */}
          <div className="glass-card p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-start gap-3 text-slate-600 font-sans">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shadow-sm shrink-0">
                <Database size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 leading-tight">
                  Clean Structured 311 Dataset
                </h4>
                <p className="text-[11px] text-slate-400 font-semibold mt-1">
                  Municipally processed civic complaints ingested and geospatially indexed.
                </p>
                <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-500 font-semibold">
                  <span>{filteredStructured.length} rows</span>
                  <span className="h-3 w-px bg-slate-200"></span>
                  <span>8 properties</span>
                </div>
              </div>
            </div>
            <button
              onClick={downloadCSV}
              className="flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 hover:border-brand-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-brand-600 font-semibold text-xs rounded-lg shadow-xs transition-all active:scale-[0.98] duration-150 cursor-pointer"
            >
              <Download size={14} />
              Export Structured 311 CSV
            </button>
          </div>

          {/* Map Container */}
          <div className="glass-card p-5 rounded-2xl h-[460px] flex flex-col relative z-0">
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Activity size={16} className="text-brand-600 animate-pulse" />
              Live Hotspots Map
            </h3>
            <div className="flex-1 w-full rounded-xl overflow-hidden border border-slate-200/80 bg-slate-50 shadow-inner">
              <MapContainer 
                center={mapCenter} 
                zoom={mapZoom} 
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                />
                <MapRecenter center={mapCenter} zoom={mapZoom} />
                {filteredStructured.map((record) => {
                  if (!record.lat || !record.lng) return null;
                  return (
                    <Marker 
                      key={`complaint-marker-${record.id}`} 
                      position={[record.lat, record.lng]} 
                      icon={createComplaintMarker(record.severity)}
                    >
                      <Popup>
                        <div className="text-xs p-1 text-slate-900 font-sans">
                          <span className="font-bold text-brand-700 text-[13px]">{record.ward_name || 'Unknown'}</span>
                          <p className="text-[11px] text-slate-600 font-medium mt-1">{record.description}</p>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Dataset Table Section */}
      <div className="glass-card p-5 rounded-2xl overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
            <Database size={18} className="text-brand-600" />
            Clean Structured Dataset
          </h3>
        </div>
        <div ref={parentRef} className="overflow-auto max-h-[520px] border border-slate-150 rounded-2xl shadow-xs scrollbar-thin">
          <table className="w-full text-left border-collapse text-xs font-sans table-fixed min-w-[800px]">
            <thead>
              <tr className="bg-slate-50/90 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 border-b border-slate-200/80 py-3.5 px-6 w-32">Complaint ID</th>
                <th className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 border-b border-slate-200/80 py-3.5 px-4 w-36">Ward</th>
                <th className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 border-b border-slate-200/80 py-3.5 px-4 w-44">Category</th>
                <th className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 border-b border-slate-200/80 py-3.5 px-4">Description</th>
                <th className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 border-b border-slate-200/80 py-3.5 px-4 w-48">Location</th>
                <th className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 border-b border-slate-200/80 py-3.5 px-4 w-32">Severity</th>
                <th className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 border-b border-slate-200/80 py-3.5 px-6 text-right w-28">Confidence</th>
              </tr>
            </thead>
            <tbody key={selectedBatch} className="divide-y divide-slate-100 text-slate-700 font-semibold animate-in fade-in duration-200">
              {paddingTop > 0 && (
                <tr>
                  <td colSpan={7} style={{ height: `${paddingTop}px` }} />
                </tr>
              )}
              {virtualRows.map((virtualRow) => {
                const record = filteredStructured[virtualRow.index];
                return (
                  <tr 
                    key={record.id} 
                    ref={rowVirtualizer.measureElement}
                    data-index={virtualRow.index}
                    className="hover:bg-slate-100/70 even:bg-slate-50/30 odd:bg-white transition-colors group"
                  >
                    <td className="py-3.5 px-6 font-mono text-brand-600 font-bold group-hover:text-brand-800 transition-colors">
                      {record.complaint_id}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">{record.ward_name || 'N/A'}</td>
                    <td className="py-3.5 px-4">
                      <span className="bg-brand-50/60 text-brand-700 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border border-brand-100/50">
                        {record.complaint_category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 font-medium leading-relaxed truncate" title={record.description}>
                      {record.description}
                    </td>
                    <td className="py-3.5 px-4">
                      {record.lat ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 font-mono bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">
                          <MapPin size={10} className="text-slate-400" />
                          {Number(record.lat).toFixed(4)}, {Number(record.lng).toFixed(4)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">No Coordinates</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                        record.severity === 'High' ? 'bg-rose-50 text-rose-700 border-rose-100/60' :
                        record.severity === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-100/60' :
                        'bg-emerald-50 text-emerald-700 border-emerald-100/60'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          record.severity === 'High' ? 'bg-rose-500 animate-pulse' :
                          record.severity === 'Medium' ? 'bg-amber-500' :
                          'bg-emerald-500'
                        }`}></span>
                        {record.severity || 'Low'}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 font-mono bg-emerald-50/70 border border-emerald-100 px-2 py-0.5 rounded-full">
                        {((record.confidence_score || 1.0) * 100).toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
              {paddingBottom > 0 && (
                <tr>
                  <td colSpan={7} style={{ height: `${paddingBottom}px` }} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
