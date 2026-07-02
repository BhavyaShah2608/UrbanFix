/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Tooltip, Marker, Popup, Polyline, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import { 
  Activity, Filter, Gauge, MapPin, X, ChevronRight, Layers, Loader2, Database, RadioTower
} from 'lucide-react';
import { 
  MapZoomListener, CustomDropdown
} from './DashboardUtils';

const dashboardViewOptions = [
  { value: 'overview', label: 'Ahmedabad Risk Map' },
  { value: 'iot', label: 'Live IoT Telemetry' },
  { value: 'predictive', label: 'Spatial GIS Analytics' },
  { value: 'ingested', label: 'Ingested 311 Reports' }
];

export default function OverviewTab({
  dashboardView,
  setDashboardView,
  API_BASE_URL
}) {
  // Ahmedabad Risk Map (Overview) state variables
  const [overviewWards, setOverviewWards] = useState([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState("");
  const [selectedOverviewWard, setSelectedOverviewWard] = useState(null);
  const [isOverviewSidebarOpen, setIsOverviewSidebarOpen] = useState(false);
  const [layer1TilesLoaded, setLayer1TilesLoaded] = useState(false);
  const [layer2TilesLoaded, setLayer2TilesLoaded] = useState(false);

  // Layer 2 (Street Level View) states
  const [currentLayer, setCurrentLayer] = useState(1); // 1 = Ward Map, 2 = Street Level View
  const [selectedStreetWard, setSelectedStreetWard] = useState(null);
  const [streetData, setStreetData] = useState(null);
  const [streetLoading, setStreetLoading] = useState(false);
  const [streetError, setStreetError] = useState("");

  // Map Overlays
  const [showStreetComplaints, setShowStreetComplaints] = useState(true);
  const [showStreetSensors, setShowStreetSensors] = useState(true);
  const [showStreetInfra, setShowStreetInfra] = useState(false);
  const [showStreetRisk, setShowStreetRisk] = useState(true);

  // Scrubber Timeline (0 = Jan, 1 = Feb, 2 = Mar, 3 = Apr, 4 = May)
  const [selectedMonth, setSelectedMonth] = useState(4);
  const [mapZoomLevel, setMapZoomLevel] = useState(15);


  // Group complaints into spatial grid cells for custom clustering
  const getClusteredComplaints = (complaintsList, zoom) => {
    if (!complaintsList) return [];
    if (zoom > 14) {
      return complaintsList.map(c => ({ ...c, type: 'single' }));
    }
    
    const gridSize = zoom <= 11 ? 0.015 : zoom <= 12 ? 0.008 : zoom <= 13 ? 0.004 : 0.002;
    const clusters = {};
    
    complaintsList.forEach(comp => {
      const gridLat = Math.round(comp.lat / gridSize) * gridSize;
      const gridLng = Math.round(comp.lng / gridSize) * gridSize;
      const key = `${gridLat.toFixed(5)},${gridLng.toFixed(5)}`;
      
      if (!clusters[key]) {
        clusters[key] = {
          type: 'cluster',
          id: `cluster-${key}`,
          lat: gridLat,
          lng: gridLng,
          count: 0,
          complaints: []
        };
      }
      clusters[key].count += 1;
      clusters[key].complaints.push(comp);
    });
    
    return Object.values(clusters);
  };

  const createCustomComplaintIcon = (category, severity) => {
    const color = severity === 'high' ? '#ef4444' : severity === 'medium' ? '#f97316' : '#10b981';
    const bgColor = severity === 'high' ? '#fef2f2' : severity === 'medium' ? '#fffbeb' : '#f0fdf4';
    
    let iconHtml = "📍";
    if (category === "Sewer & Drainage") iconHtml = "💧";
    else if (category === "Roads & Potholes") iconHtml = "🚧";
    else if (category === "Water Supply") iconHtml = "🚰";
    else if (category === "Garbage & Waste") iconHtml = "🗑️";
    
    return L.divIcon({
      html: `
        <div style="
          width: 30px;
          height: 30px;
          background-color: ${bgColor};
          border: 2px solid ${color};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 5px rgba(0,0,0,0.4);
          font-size: 14px;
          line-height: 1;
        ">
          ${iconHtml}
        </div>
      `,
      className: "custom-complaint-icon-marker",
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
  };

  const createClusterIcon = (count) => {
    return L.divIcon({
      html: `
        <div style="
          width: 34px;
          height: 34px;
          background-color: #2563eb;
          border: 2.5px solid #ffffff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 6px rgba(0,0,0,0.5);
          font-size: 12px;
          color: #ffffff;
          font-weight: 800;
          line-height: 1;
          font-family: sans-serif;
        ">
          ${count}
        </div>
      `,
      className: "custom-cluster-icon-marker",
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });
  };

  const fetchStreetData = async (wardName) => {
    setStreetLoading(true);
    setStreetError("");
    try {
      const res = await axios.get(`${API_BASE_URL}/iot/ward-streets/${encodeURIComponent(wardName)}`);
      if (res.data && res.data.status === 'success') {
        setStreetData(res.data);
      } else {
        setStreetError("Failed to load street level analytics.");
      }
    } catch (err) {
      console.error("Error loading street data:", err);
      setStreetError("Unable to reach the street analytics engine.");
    } finally {
      setStreetLoading(false);
    }
  };

  // Fetch KML boundaries and integrated combined risk scores for the Overview Heatmap
  useEffect(() => {
    if (dashboardView === 'overview') {
      const fetchOverviewData = async () => {
        setOverviewLoading(true);
        setOverviewError("");
        try {
          const res = await axios.get(`${API_BASE_URL}/iot/wards-boundaries`);
          setOverviewWards(res.data.wards || []);
        } catch (err) {
          console.error("Error loading combined risk scores:", err);
          setOverviewError("Failed to fetch Integrated AMC Risk scores.");
        } finally {
          setOverviewLoading(false);
        }
      };
      fetchOverviewData();
    }
  }, [dashboardView]);

  return (
    <div className="space-y-6 font-sans">
      {/* Premium White/Blue Top Navigation Bar */}
      <nav className="h-[52px] bg-white border border-slate-200 text-slate-800 px-6 rounded-2xl flex items-center justify-between shadow-xs mb-6">
        <div className="flex items-center gap-2">
          <Activity size={20} className="text-brand-600 animate-pulse" />
          <span className="font-extrabold text-[15px] tracking-wide uppercase text-slate-900">Urbanfix</span>
          <span className="hidden sm:inline text-[9px] font-bold px-2 py-0.5 bg-brand-50 border border-brand-100 rounded text-brand-600 tracking-wider uppercase">AMC Operations</span>
        </div>
        
        <div className="text-xs sm:text-sm font-bold text-slate-700">
          {currentLayer === 2 && selectedStreetWard ? (
            <span className="flex items-center gap-1.5 bg-brand-50/50 border border-brand-100 px-3 py-1 rounded-full text-brand-700">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-600 animate-pulse"></span>
              {selectedStreetWard.ward_name} Ward Street-Level Intel
            </span>
          ) : (
            <span className="font-bold text-slate-700 tracking-tight">Ahmedabad Operations Control Center</span>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg text-slate-400 hover:text-brand-600 transition-all duration-150">
            <RadioTower size={18} />
            <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[8px] font-bold px-1 rounded-full leading-relaxed border border-white">7</span>
          </div>
          
          <div className="flex items-center gap-2 border-l border-slate-200 pl-4 h-6">
            <div className="w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
              AS
            </div>
            <span className="hidden md:inline text-xs font-bold text-slate-600">AMC Staff</span>
          </div>
        </div>
      </nav>

      {currentLayer === 1 ? (
        /* ================= LAYER 1: OVERVIEW HEATMAP MAP VIEW ================= */
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <Activity className="text-brand-600 animate-pulse" />
                Ahmedabad City Risk Heatmap
              </h2>
              <p className="text-slate-500 text-sm">
                Integrated operations overview. Equally weighted: 50% Historical Ingested 311 Complaint Density + 50% Live IoT Sewer Telemetry.
              </p>
            </div>

            <CustomDropdown
              value={dashboardView}
              onChange={setDashboardView}
              options={dashboardViewOptions}
              className="w-full sm:w-60"
              leftIcon={<Filter size={14} />}
            />
          </div>

          {overviewError && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
              {overviewError}
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-6 relative min-h-[600px]">
            {/* Big Map Container */}
            <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm h-[600px] relative z-0">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Gauge size={16} className="text-brand-600" />
                  Ahmedabad Ward-Wise Combined Heatmap
                </span>
                <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-500">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>Low Risk (≤4)</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>Warning Risk (4-7)</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>Critical Risk (&gt;7)</span>
                </div>
              </div>
              
              <div className="flex-1 w-full relative">
                {overviewLoading ? (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center space-y-3">
                    <Loader2 className="animate-spin text-brand-600" size={32} />
                    <span className="text-sm font-medium text-slate-600 animate-pulse">Loading spatial boundaries and risk scoring...</span>
                  </div>
                ) : null}

                {!layer1TilesLoaded && (
                  <div className="absolute inset-0 z-[1000] shimmer-loader flex flex-col items-center justify-center space-y-2 pointer-events-none rounded-xl">
                    <Loader2 className="animate-spin text-brand-600" size={32} />
                    <span className="text-xs font-semibold text-brand-700 animate-pulse">Initializing risk layers...</span>
                  </div>
                )}
                
                <MapContainer center={[23.03, 72.56]} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                    eventHandlers={{
                      load: () => setLayer1TilesLoaded(true)
                    }}
                  />
                  
                  {overviewWards.map((ward) => {
                    return ward.polygons.map((polyCoords, pIdx) => {
                      const isSelected = selectedOverviewWard?.ward_name === ward.ward_name;
                      const fillColor = ward.combined_risk_score <= 4.0 
                        ? '#10b981' 
                        : ward.combined_risk_score <= 7.0 
                          ? '#f97316' 
                          : '#ef4444';
                          
                      return (
                        <Polygon
                          key={`overview-ward-${ward.ward_name}-poly-${pIdx}`}
                          positions={polyCoords}
                          pathOptions={{
                            fillColor: fillColor,
                            fillOpacity: isSelected ? 0.8 : 0.45,
                            color: isSelected ? '#2563eb' : '#64748b',
                            weight: isSelected ? 4 : 1.5,
                          }}
                          eventHandlers={{
                            mouseover: (e) => {
                              const layer = e.target;
                              layer.setStyle({
                                fillOpacity: 0.7,
                                weight: isSelected ? 4 : 3,
                                color: isSelected ? '#2563eb' : '#1e293b'
                              });
                            },
                            mouseout: (e) => {
                              const layer = e.target;
                              if (selectedOverviewWard?.ward_name !== ward.ward_name) {
                                layer.setStyle({
                                  fillOpacity: 0.45,
                                  weight: 1.5,
                                  color: '#64748b'
                                });
                              } else {
                                layer.setStyle({
                                  fillOpacity: 0.8,
                                  weight: 4,
                                  color: '#2563eb'
                                });
                              }
                            },
                            click: () => {
                              setSelectedOverviewWard(ward);
                              setIsOverviewSidebarOpen(true);
                            }
                          }}
                        >
                          <Tooltip sticky>
                            <div className="font-sans text-xs p-1">
                              <span className="font-bold text-slate-800 text-[13px]">{ward.ward_name}</span>
                              <div className="mt-1 border-t border-slate-100 pt-1 text-[10px] text-slate-500 flex flex-col gap-0.5">
                                <span><strong>Combined Risk:</strong> <span className={`font-bold ${ward.risk_level === 'critical' ? 'text-red-600' : ward.risk_level === 'warning' ? 'text-orange-500' : 'text-emerald-600'}`}>{ward.combined_risk_score} / 10</span></span>
                                <span><strong>Risk Level:</strong> <span className="font-semibold uppercase">{ward.risk_level}</span></span>
                                <span><strong>Active Complaints:</strong> {ward.complaint_count}</span>
                                <span><strong>Sewer State:</strong> <span className="font-semibold uppercase">{ward.iot_status}</span></span>
                              </div>
                            </div>
                          </Tooltip>
                        </Polygon>
                      );
                    });
                  })}
                </MapContainer>
              </div>
            </div>

            {/* Premium White Detailed Sidebar Pop-up */}
            {isOverviewSidebarOpen && selectedOverviewWard && (
              <div className="absolute lg:relative top-0 right-0 h-full w-full lg:w-[420px] bg-white border border-slate-200 lg:border-l shadow-2xl lg:shadow-sm rounded-2xl overflow-hidden z-10 flex flex-col p-6 animate-in slide-in-from-right duration-200">
                {/* Header */}
                <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                  <div>
                    <h4 className="text-lg font-bold text-slate-800 flex items-center gap-1.5">
                      <MapPin size={18} className="text-brand-600" />
                      {selectedOverviewWard.ward_name}
                    </h4>
                    <span className="text-xs text-slate-400 font-semibold tracking-wide uppercase">Ward Operations Profile</span>
                  </div>
                  <button
                    onClick={() => {
                      setIsOverviewSidebarOpen(false);
                      setSelectedOverviewWard(null);
                    }}
                    className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Scrollable details */}
                <div className="flex-1 overflow-y-auto pt-4 space-y-6 pr-1 font-sans">
                  
                  {/* Risk Score Status Panel */}
                  <div className="bg-slate-50/50 p-4 border border-slate-100 rounded-2xl flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-full flex flex-col items-center justify-center border-4 ${
                      selectedOverviewWard.risk_level === 'critical' 
                        ? 'border-red-500 bg-red-50 text-red-700' 
                        : selectedOverviewWard.risk_level === 'warning'
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    }`}>
                      <span className="text-lg font-black leading-none">{selectedOverviewWard.combined_risk_score}</span>
                      <span className="text-[9px] font-bold">/ 10</span>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase block">Combined Risk Index</span>
                      <span className={`text-md font-bold uppercase ${
                        selectedOverviewWard.risk_level === 'critical' 
                          ? 'text-red-600' 
                          : selectedOverviewWard.risk_level === 'warning'
                            ? 'text-orange-500'
                            : 'text-emerald-600'
                      }`}>
                        {selectedOverviewWard.risk_level} Risk Level
                      </span>
                    </div>
                  </div>

                  {/* Combined Risk Factor Breakdown */}
                  <div className="space-y-3">
                    <h5 className="text-xs font-bold text-slate-400 tracking-wider uppercase">Risk Contribution Breakdown</h5>
                    <div className="space-y-3 bg-white p-4 border border-slate-100 rounded-2xl shadow-sm">
                      {/* Live Telemetry Contribution */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-600 flex items-center gap-1"><Gauge size={12} className="text-brand-500" /> Live Telemetry (50%)</span>
                          <span className="text-slate-800">{selectedOverviewWard.iot_risk_score} / 10</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-brand-500 rounded-full" 
                            style={{ width: `${selectedOverviewWard.iot_risk_score * 10}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Historical 311 complaints contribution */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-600 flex items-center gap-1"><Database size={12} className="text-emerald-500" /> 311 Ingestion Density (50%)</span>
                          <span className="text-slate-800">{selectedOverviewWard.complaint_risk_score} / 10</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 rounded-full" 
                            style={{ width: `${selectedOverviewWard.complaint_risk_score * 10}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* IoT Chemical & Infrastructure Readings */}
                  <div className="space-y-3">
                    <h5 className="text-xs font-bold text-slate-400 tracking-wider uppercase">Live Telemetry Readings</h5>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white p-3 border border-slate-100 rounded-xl shadow-xs">
                        <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Sewer State</span>
                        <span className="text-sm font-bold text-slate-700 capitalize flex items-center gap-1.5 mt-0.5">
                          <span className={`w-2 h-2 rounded-full ${
                            selectedOverviewWard.telemetry.is_blocked === 'Y' ? 'bg-red-500' : 'bg-emerald-500'
                          }`}></span>
                          {selectedOverviewWard.iot_status}
                        </span>
                      </div>

                      <div className="bg-white p-3 border border-slate-100 rounded-xl shadow-xs">
                        <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Device ID</span>
                        <span className="text-sm font-bold text-slate-700 mt-0.5 block">{selectedOverviewWard.telemetry.device_id}</span>
                      </div>

                      <div className="bg-white p-3 border border-slate-100 rounded-xl shadow-xs">
                        <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Nitrogen</span>
                        <span className="text-sm font-bold text-slate-700 mt-0.5 block">{selectedOverviewWard.telemetry.nitrogen_mg_l} mg/L</span>
                      </div>

                      <div className="bg-white p-3 border border-slate-100 rounded-xl shadow-xs">
                        <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Phosphorus</span>
                        <span className="text-sm font-bold text-slate-700 mt-0.5 block">{selectedOverviewWard.telemetry.phosphorous_mg_l} mg/L</span>
                      </div>
                    </div>
                    
                    {/* Additional hydraulic specifications */}
                    <div className="bg-white border border-slate-150 rounded-xl shadow-xs overflow-hidden divide-y divide-slate-100 text-xs">
                      <div className="p-3.5 flex justify-between items-center hover:bg-slate-50/35 transition-colors">
                        <span className="font-semibold text-slate-500">Pipeline Diameter</span>
                        <span className="font-bold text-slate-800 flex items-center gap-1">
                          {selectedOverviewWard.telemetry.pipe_diameter_mm} mm 
                          <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-1.5 py-0.5 rounded uppercase">{selectedOverviewWard.telemetry.installation_method}</span>
                        </span>
                      </div>
                      <div className="p-3.5 flex justify-between items-center hover:bg-slate-50/35 transition-colors">
                        <span className="font-semibold text-slate-500">Pipeline Age & Depth</span>
                        <span className="font-bold text-slate-800 font-mono">{selectedOverviewWard.telemetry.pipe_age_years} <span className="text-[10px] text-slate-400 font-sans font-medium">yrs</span> <span className="text-slate-300 mx-1">|</span> {selectedOverviewWard.telemetry.pipe_depth_m} <span className="text-[10px] text-slate-400 font-sans font-medium">m depth</span></span>
                      </div>
                      <div className="p-3.5 flex justify-between items-center hover:bg-slate-50/35 transition-colors">
                        <span className="font-semibold text-slate-500">Surcharging Blockage</span>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                          selectedOverviewWard.telemetry.is_blocked === 'Y' ? 'bg-rose-50 text-rose-700 border-rose-100/60' : 'bg-emerald-50 text-emerald-700 border-emerald-100/60'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${selectedOverviewWard.telemetry.is_blocked === 'Y' ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                          {selectedOverviewWard.telemetry.is_blocked === 'Y' ? 'Active Blockage' : 'Active Flow'}
                        </span>
                      </div>
                      <div className="p-3.5 flex flex-col gap-1.5 hover:bg-slate-50/35 transition-colors">
                        <span className="font-semibold text-slate-500">Chemical Warning Details</span>
                        <span className="font-medium text-slate-600 leading-relaxed text-[11px]">{selectedOverviewWard.telemetry.state_reason}</span>
                      </div>
                    </div>
                  </div>

                  {/* Ingested 311 Historical civic complaints */}
                  <div className="space-y-3">
                    <h5 className="text-xs font-bold text-slate-400 tracking-wider uppercase">
                      Ingested 311 Complaints ({selectedOverviewWard.complaint_count})
                    </h5>
                    {selectedOverviewWard.recent_complaints.length > 0 ? (
                      <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                        {selectedOverviewWard.recent_complaints.map((comp, idx) => (
                          <div key={idx} className="bg-white p-3 border border-slate-100 rounded-xl shadow-xs space-y-2 hover:border-brand-200 hover:shadow-sm transition-all duration-150 group">
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] font-extrabold uppercase tracking-wider text-brand-600 bg-brand-50/60 border border-brand-100/50 px-2 py-0.5 rounded-full">
                                {comp.category}
                              </span>
                              <span className="text-[10px] font-semibold text-slate-400 font-mono">
                                {comp.date_filed ? new Date(comp.date_filed).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'}) : 'N/A'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-700 font-medium leading-relaxed">
                              {comp.description}
                            </p>
                            <div className="flex justify-between items-center text-[10px] font-semibold text-slate-400 pt-0.5">
                              <span className="font-mono text-[9px] text-slate-400 group-hover:text-slate-500 transition-colors">ID: {comp.complaint_id}</span>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                                comp.severity === 'high' || comp.severity === 'critical' ? 'bg-rose-50 text-rose-700 border-rose-100/50' :
                                comp.severity === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-100/50' :
                                'bg-emerald-50 text-emerald-700 border-emerald-100/50'
                              }`}>
                                <span className={`w-1 h-1 rounded-full ${
                                  comp.severity === 'high' || comp.severity === 'critical' ? 'bg-rose-500 animate-pulse' :
                                  comp.severity === 'medium' ? 'bg-amber-500' :
                                  'bg-emerald-500'
                                }`}></span>
                                {comp.severity}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 text-slate-400 border border-slate-100 rounded-xl text-center text-xs font-semibold">
                        No historical civic issues found in the database.
                      </div>
                    )}
                  </div>

                  {/* Crew Blueprints */}
                  <div className="space-y-3">
                    <h5 className="text-xs font-bold text-slate-400 tracking-wider uppercase">Crew Blueprint & Dispatch Recommendation</h5>
                    <div className="bg-slate-50/50 p-4 border border-slate-100 rounded-2xl text-xs space-y-3">
                      <div className="font-semibold text-slate-700 flex items-center gap-1 text-slate-800">
                        Recommended Engineering Dispatch Checklist:
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-start gap-2.5 text-slate-600 font-medium cursor-pointer">
                          <input type="checkbox" defaultChecked={selectedOverviewWard.combined_risk_score > 4} className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                          <span>Deploy high-velocity sewer hydro-jetting to wash out grease/silt blocks.</span>
                        </label>
                        <label className="flex items-start gap-2.5 text-slate-600 font-medium cursor-pointer">
                          <input type="checkbox" defaultChecked={selectedOverviewWard.combined_risk_score > 7} className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                          <span>Inject chemical root-inhibiting foam flushes to stop root joint fractures.</span>
                        </label>
                        <label className="flex items-start gap-2.5 text-slate-600 font-medium cursor-pointer">
                          <input type="checkbox" defaultChecked={selectedOverviewWard.telemetry.pipe_age_years > 30} className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                          <span>Evaluate section for structural CIPP Cured-In-Place pipeline re-lining.</span>
                        </label>
                        <label className="flex items-start gap-2.5 text-slate-600 font-medium cursor-pointer">
                          <input type="checkbox" defaultChecked={selectedOverviewWard.telemetry.is_blocked === 'Y'} className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                          <span>Establish bypass pumping lines and inspect immediate downstream manifolds.</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Explore Street Level Button */}
                  <div className="pt-4 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setSelectedStreetWard(selectedOverviewWard);
                        fetchStreetData(selectedOverviewWard.ward_name);
                        setCurrentLayer(2);
                        setIsOverviewSidebarOpen(false);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm rounded-lg shadow-sm hover:shadow-md active:bg-brand-800 transition-all duration-150 group"
                    >
                      <span>Explore Street Level View</span>
                      <ChevronRight size={16} className="text-white/80 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>

                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ================= LAYER 2: STREET LEVEL INTELLIGENCE VIEW ================= */
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Breadcrumb Navigation */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <button 
                onClick={() => {
                  setCurrentLayer(1);
                  setSelectedStreetWard(null);
                  setStreetData(null);
                }} 
                className="text-brand-600 hover:text-brand-800 transition-colors flex items-center gap-1.5"
              >
                <Activity size={14} /> Ahmedabad Map
              </button>
              <ChevronRight size={12} className="text-slate-400" />
              <span className="text-slate-800 font-bold">{selectedStreetWard?.ward_name}</span>
              <ChevronRight size={12} className="text-slate-400" />
              <span className="text-slate-400">Street Level View</span>
            </div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Smart City GIS Module
            </div>
          </div>

          {streetLoading && (
            <div className="h-[600px] bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center space-y-4 shadow-sm">
              <Loader2 className="animate-spin text-brand-600" size={36} />
              <span className="text-sm font-medium text-slate-600 animate-pulse">Retrieving street-level geometries and sensor coordinates...</span>
            </div>
          )}

          {streetError && (
            <div className="p-6 bg-red-50 border border-red-200 text-red-700 rounded-2xl shadow-sm text-sm font-semibold flex flex-col items-center gap-3">
              <span>{streetError}</span>
              <button 
                onClick={() => fetchStreetData(selectedStreetWard.ward_name)} 
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all"
              >
                Retry Analytics Query
              </button>
            </div>
          )}

          {streetData && !streetLoading && (
            <div className="space-y-6">
              <div className="flex flex-col lg:flex-row gap-6 relative min-h-[600px]">
                
                {/* Left Overlay Toggle Panel (200px) */}
                <div className="w-full lg:w-[200px] flex flex-col gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Map Overlays</span>
                  <div className="flex flex-col gap-3">
                    <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={showStreetComplaints} 
                        onChange={() => setShowStreetComplaints(!showStreetComplaints)}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4" 
                      />
                      <span>311 Complaints</span>
                    </label>
                    
                    <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={showStreetSensors} 
                        onChange={() => setShowStreetSensors(!showStreetSensors)}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4" 
                      />
                      <span>IoT Telemetry</span>
                    </label>
                    
                    <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={showStreetRisk} 
                        onChange={() => setShowStreetRisk(!showStreetRisk)}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4" 
                      />
                      <span>Street Risk</span>
                    </label>
                    
                    <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={showStreetInfra} 
                        onChange={() => setShowStreetInfra(!showStreetInfra)}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4" 
                      />
                      <span>Infrastructure Age</span>
                    </label>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2.5 text-[10px] text-slate-400">
                    <span className="font-bold uppercase tracking-wider block">Risk Legend</span>
                    <span className="flex items-center gap-1.5 font-semibold text-slate-600">
                      <span className="w-2.5 h-2.5 rounded bg-emerald-500"></span>
                      Low Risk (≤40)
                    </span>
                    <span className="flex items-center gap-1.5 font-semibold text-slate-600">
                      <span className="w-2.5 h-2.5 rounded bg-orange-500"></span>
                      Warning (40-70)
                    </span>
                    <span className="flex items-center gap-1.5 font-semibold text-slate-600">
                      <span className="w-2.5 h-2.5 rounded bg-red-500"></span>
                      Critical (&gt;70)
                    </span>
                  </div>
                </div>

                {/* Center Street Map Container */}
                <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm h-[600px] relative z-0">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <span className="text-xs font-extrabold text-slate-700 flex items-center gap-2 uppercase tracking-wider">
                      <Layers size={14} className="text-brand-500" />
                      {selectedStreetWard?.ward_name} Street GIS Canvas
                    </span>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2.5 py-1 rounded">
                      Timeline Context: {['Jan', 'Feb', 'Mar', 'Apr', 'May (Live)'][selectedMonth]}
                    </div>
                  </div>
                  
                  <div className="flex-1 w-full relative">
                    {!layer2TilesLoaded && (
                      <div className="absolute inset-0 z-[1000] shimmer-loader flex flex-col items-center justify-center space-y-2 pointer-events-none rounded-xl">
                        <Loader2 className="animate-spin text-brand-600" size={32} />
                        <span className="text-xs font-semibold text-brand-700 animate-pulse">Initializing street canvas...</span>
                      </div>
                    )}
                    
                    <MapContainer 
                      key={`${selectedStreetWard?.ward_name}-street-map`} 
                      center={streetData.center} 
                      zoom={15} 
                      style={{ height: '100%', width: '100%' }} 
                      scrollWheelZoom={true}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                        eventHandlers={{
                          load: () => setLayer2TilesLoaded(true)
                        }}
                      />
                      <MapZoomListener onChange={setMapZoomLevel} />

                      {/* Street Risk Segments */}
                      {(showStreetRisk || showStreetInfra) && streetData.streets.map((street, idx) => {
                        const currentRisk = street.monthly_risk[selectedMonth];
                        let strokeColor = '#10b981';
                        
                        if (currentRisk > 70) {
                          strokeColor = '#ef4444';
                        } else if (currentRisk > 40) {
                          strokeColor = '#f97316';
                        }

                        if (showStreetInfra) {
                          strokeColor = street.infrastructure_age_years > 30 ? '#475569' : '#94a3b8';
                        }

                        return (
                          <Polyline
                            key={`street-${idx}`}
                            positions={street.polyline}
                            pathOptions={{
                              color: strokeColor,
                              weight: 5,
                              opacity: 0.85,
                              lineJoin: 'round'
                            }}
                            eventHandlers={{
                              mouseover: (e) => {
                                e.target.setStyle({ weight: 8, opacity: 1.0 });
                              },
                              mouseout: (e) => {
                                e.target.setStyle({ weight: 5, opacity: 0.85 });
                              }
                            }}
                          >
                            <Popup>
                              <div className="font-sans text-xs p-1.5 min-w-[160px] space-y-1">
                                <span className="font-extrabold text-[13px] text-slate-800 block">{street.name}</span>
                                <div className="mt-1 border-t border-slate-100 pt-1 text-[11px] flex flex-col gap-1 text-slate-500">
                                  <span className="flex justify-between">
                                    <span>Risk Score:</span>
                                    <span className={`font-bold ${currentRisk > 70 ? 'text-red-600' : currentRisk > 40 ? 'text-orange-500' : 'text-emerald-600'}`}>
                                      {currentRisk}%
                                    </span>
                                  </span>
                                  <span className="flex justify-between">
                                    <span>Main Vulnerability:</span>
                                    <span className="font-semibold text-slate-700">{street.category}</span>
                                  </span>
                                  <span className="flex justify-between">
                                    <span>Conduit Age:</span>
                                    <span className="font-semibold text-slate-700">{street.infrastructure_age_years} yrs</span>
                                  </span>
                                  <span className="flex justify-between">
                                    <span>Street Complaints:</span>
                                    <span className="font-bold text-slate-700">{street.complaint_count}</span>
                                  </span>
                                </div>
                              </div>
                            </Popup>
                          </Polyline>
                        );
                      })}

                      {/* Complaint Pointers */}
                      {showStreetComplaints && getClusteredComplaints(streetData.complaints, mapZoomLevel).map((item, idx) => {
                        if (item.type === 'cluster') {
                          return (
                            <Marker
                              key={`cluster-${idx}`}
                              position={[item.lat, item.lng]}
                              icon={createClusterIcon(item.count)}
                            >
                              <Popup>
                                <div className="font-sans text-xs p-1.5 min-w-[200px]">
                                  <span className="font-extrabold text-[12px] text-brand-600 block mb-1">Cluster: {item.count} Active Complaints</span>
                                  <div className="border-t border-slate-100 pt-1.5 space-y-2 max-h-[150px] overflow-y-auto pr-1">
                                    {item.complaints.map((c, cIdx) => (
                                      <div key={cIdx} className="text-[10px] pb-1.5 border-b border-slate-50 last:border-b-0 space-y-0.5">
                                        <div className="flex justify-between font-bold">
                                          <span className="text-slate-800">{c.category}</span>
                                          <span className="uppercase text-[8px]" style={{ color: c.severity === 'high' ? '#ef4444' : c.severity === 'medium' ? '#f97316' : '#10b981' }}>{c.severity}</span>
                                        </div>
                                        <p className="text-slate-500 leading-tight">{c.description}</p>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="text-[9px] text-slate-400 font-semibold mt-1.5 text-center">Zoom in to explode this cluster</div>
                                </div>
                              </Popup>
                            </Marker>
                          );
                        } else {
                          const fillColor = item.severity === 'high' 
                            ? '#ef4444' 
                            : item.severity === 'medium' 
                              ? '#f97316' 
                              : '#10b981';
                              
                          return (
                            <Marker
                              key={`comp-${idx}`}
                              position={[item.lat, item.lng]}
                              icon={createCustomComplaintIcon(item.category, item.severity)}
                            >
                              <Popup>
                                <div className="font-sans text-xs p-1.5 min-w-[200px] space-y-1.5">
                                  <div className="flex justify-between items-center">
                                    <span 
                                      className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border"
                                      style={{
                                        color: fillColor,
                                        backgroundColor: item.severity === 'high' ? '#fef2f2' : item.severity === 'medium' ? '#fffbeb' : '#f0fdf4',
                                        borderColor: item.severity === 'high' ? '#fecaca' : item.severity === 'medium' ? '#fde68a' : '#bbf7d0'
                                      }}
                                    >
                                      {item.severity} Severity
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-semibold">{item.date_filed}</span>
                                  </div>
                                  <span className="font-bold text-[12px] text-slate-800 block">{item.category}</span>
                                  <p className="text-[11px] leading-relaxed text-slate-600">{item.description}</p>
                                  <div className="text-[9px] text-slate-400 pt-0.5">ID: {item.id}</div>
                                </div>
                              </Popup>
                            </Marker>
                          );
                        }
                      })}

                      {/* IoT Sensors */}
                      {showStreetSensors && streetData.sensors.map((sensor, idx) => (
                        <CircleMarker
                          key={`sensor-${idx}`}
                          center={[sensor.lat, sensor.lng]}
                          radius={8}
                          pathOptions={{
                            fillColor: '#2563eb',
                            fillOpacity: 1,
                            color: '#ffffff',
                            weight: 2
                          }}
                        >
                          <Popup>
                            <div className="font-sans text-xs p-2 min-w-[190px] space-y-1.5">
                              <span className="font-extrabold text-[12px] text-slate-800 flex items-center gap-1.5">
                                <RadioTower size={14} className="text-brand-600 animate-pulse" />
                                Sensor: {sensor.device_id}
                              </span>
                              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100 text-[10px]">
                                <div>
                                  <span className="text-slate-400 block font-bold">Nitrogen</span>
                                  <span className="font-bold text-slate-700">{sensor.nitrogen_mg_l} mg/L</span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block font-bold">Phosphorus</span>
                                  <span className="font-bold text-slate-700">{sensor.phosphorous_mg_l} mg/L</span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block font-bold">Flow Capacity</span>
                                  <span className={`font-bold ${sensor.flow_capacity_pct > 80 ? 'text-red-600' : 'text-slate-700'}`}>
                                    {sensor.flow_capacity_pct}%
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block font-bold">Pressure</span>
                                  <span className="font-bold text-slate-700">{sensor.pressure_psi} PSI</span>
                                </div>
                              </div>
                              <div className="text-[9px] text-slate-400 pt-1 text-right">pH Value: {sensor.ph_level}</div>
                            </div>
                          </Popup>
                        </CircleMarker>
                      ))}
                    </MapContainer>
                  </div>
                </div>

                {/* Right Street Risk Rankings Panel */}
                <div className="w-full lg:w-[280px] bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Risk Severity Rankings</span>
                    <span className="text-[10px] text-slate-400">Current playback: {['Jan', 'Feb', 'Mar', 'Apr', 'May (Live)'][selectedMonth]}</span>
                  </div>
                  
                  <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto max-h-[480px]">
                    {streetData.streets
                      .map(s => ({ ...s, currentRisk: s.monthly_risk[selectedMonth] }))
                      .sort((a, b) => b.currentRisk - a.currentRisk)
                      .map((street, idx) => {
                        const barColor = street.currentRisk > 70 
                          ? 'bg-red-500' 
                          : street.currentRisk > 40 
                            ? 'bg-orange-500' 
                            : 'bg-emerald-500';
                            
                        const textColor = street.currentRisk > 70 
                          ? 'text-red-600' 
                          : street.currentRisk > 40 
                            ? 'text-orange-500' 
                            : 'text-emerald-600';
                            
                        return (
                          <div key={idx} className="bg-slate-50/50 border border-slate-100 p-3 rounded-xl flex flex-col gap-2 shadow-xs">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="text-xs font-bold text-slate-800">{street.name}</span>
                                <span className="text-[9px] text-slate-400 block uppercase font-bold mt-0.5">{street.category}</span>
                              </div>
                              <span className={`text-[11px] font-extrabold ${textColor}`}>{street.currentRisk}%</span>
                            </div>
                            <div className="space-y-1">
                              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                <div className={`h-full ${barColor} rounded-full`} style={{ width: `${street.currentRisk}%` }}></div>
                              </div>
                              <div className="flex justify-between text-[8px] font-bold text-slate-400">
                                <span>Complaints: {street.complaint_count}</span>
                                <span>Pipe Age: {street.infrastructure_age_years} yrs</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

              </div>

              {/* Bottom Timeline Scrubber Panel */}
              <div className="w-full bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-center gap-5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 shrink-0">
                  <Activity size={16} className="text-brand-500 animate-pulse" />
                  <span>Timeline Risk Scrubber</span>
                </div>
                <div className="flex-1 flex items-center gap-4 w-full">
                  <span className="text-[10px] font-bold text-slate-400">Jan</span>
                  <input 
                    type="range" 
                    min="0" 
                    max="4" 
                    value={selectedMonth} 
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-brand-600 focus:outline-none"
                  />
                  <span className="text-[10px] font-bold text-slate-800">May (Live)</span>
                </div>
                <div className="shrink-0 bg-brand-50 border border-brand-100 text-brand-700 font-extrabold text-xs px-3.5 py-2 rounded-full uppercase tracking-wider">
                  Risk playback: {['January', 'February', 'March', 'April', 'May'][selectedMonth]}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
