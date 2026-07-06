/* eslint-disable react-hooks/exhaustive-deps, react-hooks/incompatible-library */
import { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  CheckCircle2, AlertTriangle, Gauge, Database, MapPin, Activity, Search
} from 'lucide-react';
import { 
  MapRecenter,
  CustomDropdown,
  createFocusedComplaintMarker
} from './DashboardUtils';

export default function IngestedReportsTab({
  structuredRecords = [],
  quarantineRecords = [],
  flaggedRecords = [],
  selectedBatch
}) {
  const [mapCenter, setMapCenter] = useState([23.0225, 72.5714]);
  const [mapZoom, setMapZoom] = useState(12);
  const [sortBy, setSortBy] = useState('confidence_desc');
  const [focusedRecordId, setFocusedRecordId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');

  const filteredStructured = selectedBatch === 'all'
    ? structuredRecords
    : structuredRecords.filter((record) => record.batch_id === selectedBatch);

  const filteredQuarantine = selectedBatch === 'all'
    ? quarantineRecords
    : quarantineRecords.filter((record) => record.batch_id === selectedBatch);

  const filteredFlagged = selectedBatch === 'all'
    ? flaggedRecords
    : flaggedRecords.filter((record) => record.batch_id === selectedBatch);

  const uniqueCategories = useMemo(() => {
    const cats = new Set(structuredRecords.map(r => r.complaint_category).filter(Boolean));
    return Array.from(cats).sort();
  }, [structuredRecords]);

  const filteredAndSortedRecords = useMemo(() => {
    let records = [...filteredStructured];

    // Apply Search Term
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      records = records.filter(r => 
        (r.complaint_id || '').toLowerCase().includes(term) ||
        (r.ward_name || '').toLowerCase().includes(term) ||
        (r.description || '').toLowerCase().includes(term)
      );
    }

    // Apply Category Filter
    if (filterCategory !== 'all') {
      records = records.filter(r => r.complaint_category === filterCategory);
    }

    // Apply Severity Filter
    if (filterSeverity !== 'all') {
      records = records.filter(r => r.severity === filterSeverity);
    }

    // Apply Sorting
    if (sortBy === 'confidence_desc') {
      return records.sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0));
    }
    if (sortBy === 'confidence_asc') {
      return records.sort((a, b) => (a.confidence_score || 0) - (b.confidence_score || 0));
    }
    if (sortBy === 'severity_high') {
      const severityWeights = { High: 3, Medium: 2, Low: 1 };
      return records.sort((a, b) => (severityWeights[b.severity || 'Low'] || 0) - (severityWeights[a.severity || 'Low'] || 0));
    }
    if (sortBy === 'severity_low') {
      const severityWeights = { High: 3, Medium: 2, Low: 1 };
      return records.sort((a, b) => (severityWeights[a.severity || 'Low'] || 0) - (severityWeights[b.severity || 'Low'] || 0));
    }
    if (sortBy === 'ward_name') {
      return records.sort((a, b) => (a.ward_name || '').localeCompare(b.ward_name || ''));
    }
    if (sortBy === 'category') {
      return records.sort((a, b) => (a.complaint_category || '').localeCompare(b.complaint_category || ''));
    }
    return records;
  }, [filteredStructured, searchTerm, filterCategory, filterSeverity, sortBy]);

  const handleViewOnMap = (recordId, lat, lng) => {
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
      setFocusedRecordId(recordId);
      setMapCenter([parsedLat, parsedLng]);
      setMapZoom(16);
      const mapElement = document.getElementById("ingestion-map-container");
      if (mapElement) {
        mapElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      // Keep rapid blinking active for 2.5s (5 blinks at 0.5s each) then restore to standard glow
      setTimeout(() => {
        setFocusedRecordId((prev) => (prev === recordId ? null : prev));
      }, 2500);
    }
  };

  const parentRef = useRef();

  const rowVirtualizer = useVirtualizer({
    count: filteredAndSortedRecords.length,
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
          {/* Map Container */}
          <div id="ingestion-map-container" className="glass-card p-5 rounded-2xl h-[460px] flex flex-col relative z-0">
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
                  const severityColors = {
                    High: '#dc2626',
                    Medium: '#d97706',
                    Low: '#059669'
                  };
                  const color = severityColors[record.severity] || '#2563eb';
                  const isFocused = record.id === focusedRecordId;
                  if (isFocused) {
                    return (
                      <Marker 
                        key={`complaint-marker-${record.id}`} 
                        position={[record.lat, record.lng]} 
                        icon={createFocusedComplaintMarker(record.severity)}
                      >
                        <Popup>
                          <div className="text-xs p-1 text-slate-900 font-sans">
                            <span className="font-bold text-brand-700 text-[13px]">{record.ward_name || 'Unknown'}</span>
                            <p className="text-[11px] text-slate-600 font-medium mt-1">{record.description}</p>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  }
                  return (
                    <CircleMarker 
                      key={`complaint-marker-${record.id}`} 
                      center={[record.lat, record.lng]} 
                      radius={5.5}
                      pathOptions={{
                        className: 'ingested-hotspot-marker',
                        fillColor: color,
                        color: '#ffffff',
                        weight: 1.5,
                        fillOpacity: 0.95
                      }}
                    >
                      <Popup>
                        <div className="text-xs p-1 text-slate-900 font-sans">
                          <span className="font-bold text-brand-700 text-[13px]">{record.ward_name || 'Unknown'}</span>
                          <p className="text-[11px] text-slate-600 font-medium mt-1">{record.description}</p>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            </div>
          </div>

          {/* Info Card */}
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
          </div>
        </div>
      </div>

      {/* Dataset Table Section */}
      <div className="glass-card p-5 rounded-2xl overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
            <Database size={18} className="text-brand-600" />
            Clean Structured Dataset
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Sort:</span>
            <CustomDropdown
              value={sortBy}
              onChange={setSortBy}
              options={[
                { value: 'confidence_desc', label: 'Confidence: High to Low' },
                { value: 'confidence_asc', label: 'Confidence: Low to High' },
                { value: 'severity_high', label: 'Severity: High first' },
                { value: 'severity_low', label: 'Severity: Low first' },
                { value: 'ward_name', label: 'Ward Name (A-Z)' },
                { value: 'category', label: 'Category (A-Z)' }
              ]}
              className="w-56"
            />
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 mb-5 items-center justify-between border-t border-slate-100 pt-4">
          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search size={14} />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by ID, Ward, Description..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 focus:border-brand-300 focus:ring-1 focus:ring-brand-200/50 bg-white text-slate-700 placeholder-slate-400 text-xs rounded-xl font-semibold outline-none transition-all"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
            {/* Category Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Category:</span>
              <CustomDropdown
                value={filterCategory}
                onChange={setFilterCategory}
                options={[
                  { value: 'all', label: 'All Categories' },
                  ...uniqueCategories.map(cat => ({ value: cat, label: cat }))
                ]}
                className="w-44"
              />
            </div>

            {/* Severity Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Severity:</span>
              <CustomDropdown
                value={filterSeverity}
                onChange={setFilterSeverity}
                options={[
                  { value: 'all', label: 'All Severities' },
                  { value: 'High', label: 'High' },
                  { value: 'Medium', label: 'Medium' },
                  { value: 'Low', label: 'Low' }
                ]}
                className="w-36"
              />
            </div>
          </div>
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
            <tbody key={`${selectedBatch}-${sortBy}-${searchTerm}-${filterCategory}-${filterSeverity}`} className="divide-y divide-slate-100 text-slate-700 font-semibold animate-in fade-in duration-200">
              {paddingTop > 0 && (
                <tr>
                  <td colSpan={7} style={{ height: `${paddingTop}px` }} />
                </tr>
              )}
              {virtualRows.map((virtualRow) => {
                const record = filteredAndSortedRecords[virtualRow.index];
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
                        <button
                          onClick={() => handleViewOnMap(record.id, record.lat, record.lng)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold border border-brand-200 rounded-lg text-[10px] transition-all cursor-pointer inline-flex items-center gap-1 active:scale-[0.97]"
                        >
                          <MapPin size={10} className="text-brand-500" />
                          View on map
                        </button>
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
