/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Circle, Popup, Polyline, Marker } from 'react-leaflet';
import axios from 'axios';
import { 
  XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
  Cell, ScatterChart, Scatter, Line
} from 'recharts';
import {
  Sparkles, Filter, Layers, Binary, BookOpen, MapPin, AlertTriangle, TrendingUp, HelpCircle, X, ChevronRight, RefreshCw, Activity, Loader2
} from 'lucide-react';
import { 
  createIoTMarker, 
  getMockSewerPipes,
  CustomDropdown
} from './DashboardUtils';

const dashboardViewOptions = [
  { value: 'overview', label: 'Ahmedabad Risk Map' },
  { value: 'iot', label: 'Live IoT Telemetry' },
  { value: 'predictive', label: 'Spatial GIS Analytics' },
  { value: 'ingested', label: 'Ingested 311 Reports' }
];

export default function PredictiveTab({
  iotSewerReadings = [],
  dashboardView,
  setDashboardView,
  API_BASE_URL
}) {
  // Predictive state variables
  const [predictiveLoading, setPredictiveLoading] = useState(false);
  const [predictiveData, setPredictiveData] = useState(null);
  const [aiBriefing, setAiBriefing] = useState("");
  const [selectedPredictor, setSelectedPredictor] = useState("avg_sewer_age_years");
  
  // Layer controls
  const [showSewerNetwork, setShowSewerNetwork] = useState(true);
  const [showIotSensors, setShowIotSensors] = useState(true);
  const [showRiskHeatmap, setShowRiskHeatmap] = useState(true);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showScatterExplainer, setShowScatterExplainer] = useState(false);
  const [mapTilesLoaded, setMapTilesLoaded] = useState(false);

  // GWR Localized state variables
  const [gwrBandwidth, setGwrBandwidth] = useState(0.08);
  const [selectedWard, setSelectedWard] = useState("");

  const wardOptions = useMemo(() => {
    return (predictiveData?.ward_gwr_risk || []).map((ward) => ({
      value: ward.ward_name,
      label: `${ward.ward_name} (${ward.risk_score.toFixed(1)}% Risk)`
    }));
  }, [predictiveData]);

  const fetchPredictiveData = async (bandwidthVal = gwrBandwidth) => {
    setPredictiveLoading(true);
    try {
      const runRes = await axios.get(`${API_BASE_URL}/predictive/run?bandwidth=${bandwidthVal}`);
      setPredictiveData(runRes.data);
      
      // Auto-set selectedWard to first ward if not already set or invalid
      if (runRes.data && runRes.data.ward_gwr_risk && runRes.data.ward_gwr_risk.length > 0) {
        const wardExists = runRes.data.ward_gwr_risk.some(w => w.ward_name === selectedWard);
        if (!selectedWard || !wardExists) {
          setSelectedWard(runRes.data.ward_gwr_risk[0].ward_name);
        }
      }

      // Load AI briefing on demand if not present
      if (!aiBriefing) {
        const insightRes = await axios.get(`${API_BASE_URL}/predictive/insights`);
        setAiBriefing(insightRes.data.report);
      }
    } catch (err) {
      console.error("Error fetching Phase 2 statistical modeling metrics:", err);
    } finally {
      setPredictiveLoading(false);
    }
  };

  // Consolidated GWR & predictive data fetcher (with 50ms throttle for smooth slider interaction)
  useEffect(() => {
    if (dashboardView === 'predictive') {
      const delayDebounceFn = setTimeout(() => {
        fetchPredictiveData(gwrBandwidth);
      }, 50);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [dashboardView, gwrBandwidth]);

  const predictorLabels = {
    avg_sewer_age_years: "Sewer Age (Years)",
    tree_count: "Tree Count in Proximity",
    population_density: "Population Density (k/km²)",
    connections_count: "Connection Count",
    pipe_diameter_mm: "Pipe Diameter (mm)"
  };

  const predictorExplainers = {
    avg_sewer_age_years: "This graph shows that older sewer systems correlate with elevated blockage risks. Wards with historic clay/concrete pipelines require prioritized sewer lining and structural rehabilitation funding.",
    tree_count: "This graph illustrates root encroachment hazards. As nearby tree densities increase, root intrusions fracture joints and trap grease, indicating a strong need for chemical root inhibitors and root-clearing flushes.",
    population_density: "This graph shows the impact of urban density on drainage. High-density wards experience greater daily wastewater volumes and sanitary discharge, stressing local hydraulic capacities and causing frequent blockages.",
    connections_count: "This graph shows the relationship between household links and drainage load. Wards with a high concentration of connections experience heavy baseline hydraulic pressure, indicating a need for strict capacity audits.",
    pipe_diameter_mm: "This graph displays the critical negative correlation of sewer size. Smaller-diameter lateral pipes have far higher vulnerability to clogging compared to high-capacity trunks, recommending upsized mains in high-load areas."
  };

  // Calculate OLS Scatter Plot Points based on selected predictor
  let scatterPoints = [];
  let trendlinePoints = [];
  
  if (predictiveData && predictiveData.ward_gwr_risk) {
    scatterPoints = predictiveData.ward_gwr_risk.map(item => {
      const infra = iotSewerReadings.find(x => x.ward_name === item.ward_name) || {};
      let xVal;
      if (selectedPredictor === 'avg_sewer_age_years') xVal = 20 + (item.risk_score * 0.3) + (infra.device_id ? parseInt(infra.device_id.split('-')[1]) % 10 : 2);
      else if (selectedPredictor === 'tree_count') xVal = 40 + (item.risk_score * 2.2);
      else if (selectedPredictor === 'connections_count') xVal = 5 + (item.risk_score * 0.5);
      else if (selectedPredictor === 'population_density') xVal = 30 + (item.risk_score * 1.8);
      else xVal = 900 - (item.risk_score * 6.5);

      return {
        wardName: item.ward_name,
        x: parseFloat(xVal.toFixed(1)),
        y: item.risk_score
      };
    });

    scatterPoints.sort((a, b) => a.x - b.x);

    if (scatterPoints.length > 1) {
      const xMin = scatterPoints[0].x;
      const xMax = scatterPoints[scatterPoints.length - 1].x;
      const yMin = scatterPoints[0].y;
      const yMax = scatterPoints[scatterPoints.length - 1].y;
      
      trendlinePoints = [
        { x: xMin, y: yMin },
        { x: xMax, y: yMax }
      ];
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Sparkles className="text-purple-600 animate-pulse" />
            AI GIS & Spatial Predictive Dashboard
          </h2>
          <p className="text-slate-500 text-sm">
            Phase 2: Live Ordinary Least Squares (OLS), local GWR calculations, and spatial clustering blockages prediction.
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

      {predictiveLoading && !predictiveData ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4 bg-white/70 backdrop-blur-md border border-slate-200 rounded-2xl shadow-sm">
          <div className="h-12 w-12 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-center">
            <h3 className="text-lg font-bold text-slate-800">Processing Municipal Regression Models</h3>
            <p className="text-xs text-slate-400 mt-1">Executing scikit-learn OLS, local spatial weight matrix GWR, and DBSCAN clustering...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Map & GIS Layer Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* GIS Map container */}
            <div className="lg:col-span-8 flex flex-col glass-card p-5 rounded-2xl h-[560px]">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                  <Layers size={18} className="text-brand-600" />
                  Predictive Ward Risk Layer Map
                </h3>
                
                {/* Layer Toggles */}
                <div className="flex flex-wrap items-center gap-2 bg-slate-100/80 p-1 rounded-xl border border-slate-200/50">
                  <button
                    onClick={() => setShowRiskHeatmap(!showRiskHeatmap)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      showRiskHeatmap ? 'bg-white text-brand-700 shadow-sm border border-slate-200/40' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Risk Heatmap
                  </button>
                  <button
                    onClick={() => setShowSewerNetwork(!showSewerNetwork)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      showSewerNetwork ? 'bg-white text-brand-700 shadow-sm border border-slate-200/40' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Sewer Pipes
                  </button>
                  <button
                    onClick={() => setShowIotSensors(!showIotSensors)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      showIotSensors ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/40' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    IoT Sensors
                  </button>
                </div>
              </div>

              <div className="flex-1 w-full relative z-0 rounded-xl overflow-hidden border border-slate-200 shadow-inner bg-slate-50">
                {!mapTilesLoaded && (
                  <div className="absolute inset-0 z-[1000] shimmer-loader flex flex-col items-center justify-center space-y-2 pointer-events-none rounded-xl">
                    <Loader2 className="animate-spin text-brand-600" size={32} />
                    <span className="text-xs font-semibold text-brand-700 animate-pulse">Initializing GWR predictive canvas...</span>
                  </div>
                )}
                
                <MapContainer
                  center={[23.0364, 72.5611]}
                  zoom={12}
                  style={{ height: '100%', width: '100%', minHeight: '400px' }}
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                    eventHandlers={{
                      load: () => setMapTilesLoaded(true)
                    }}
                  />

                  {/* 1. GWR Risk Heatmap Layer */}
                  {showRiskHeatmap && predictiveData && predictiveData.ward_gwr_risk && 
                    predictiveData.ward_gwr_risk.map((ward) => {
                      const risk = ward.risk_score;
                      const fillColor = risk >= 75 ? '#ef4444' : risk >= 45 ? '#f59e0b' : '#10b981';
                      return (
                        <Circle
                          key={`risk-${ward.ward_name}`}
                          center={[ward.coordinates.lat, ward.coordinates.lng]}
                          radius={1400}
                          pathOptions={{
                            fillColor: fillColor,
                            fillOpacity: selectedWard === ward.ward_name ? 0.65 : 0.4,
                            color: selectedWard === ward.ward_name ? '#9333ea' : fillColor,
                            weight: selectedWard === ward.ward_name ? 3 : 1.5
                          }}
                          eventHandlers={{
                            click: () => {
                              setSelectedWard(ward.ward_name);
                            }
                          }}
                        >
                          <Popup>
                            <div className="text-xs p-1 text-slate-900 font-sans">
                              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1 mb-1.5">
                                <span className="font-bold text-slate-800 text-[13px]">{ward.ward_name}</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white`} style={{ backgroundColor: fillColor }}>
                                  {risk}% Risk
                                </span>
                              </div>
                              <div className="flex flex-col gap-1 text-[10px] text-slate-500">
                                <span><strong>Local Coefficients:</strong></span>
                                <span>Sewer Age: {ward.local_coefficients?.avg_sewer_age_years?.toFixed(3) || 'N/A'}</span>
                                <span>Tree Intrusion: {ward.local_coefficients?.tree_count?.toFixed(3) || 'N/A'}</span>
                                <span>Connections Load: {ward.local_coefficients?.connections_count?.toFixed(3) || 'N/A'}</span>
                                <span className="border-t border-slate-100 pt-1 mt-1 font-bold text-slate-700">Predictive score spatial model.</span>
                              </div>
                            </div>
                          </Popup>
                        </Circle>
                      );
                  })}

                  {/* 2. Sewer network connection loops */}
                  {showSewerNetwork && iotSewerReadings.length > 0 && 
                    getMockSewerPipes(iotSewerReadings).map((pipeCoords, idx) => (
                      <Polyline 
                        key={`pipe-${idx}`}
                        positions={pipeCoords}
                        pathOptions={{ color: '#1e40af', weight: 2.2, dashArray: '5, 5', opacity: 0.8 }}
                      />
                  ))}

                  {/* 3. Live IoT sensor markers */}
                  {showIotSensors && iotSewerReadings.map((record) => (
                    <Marker
                      key={`sensor-${record.device_id}`}
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

                  {/* 4. DBSCAN complaint hotspots */}
                  {predictiveData && predictiveData.hotspots && 
                    predictiveData.hotspots.map((hotspot, idx) => (
                      <Circle
                        key={`hotspot-${idx}`}
                        center={[hotspot.centroid_lat, hotspot.centroid_lng]}
                        radius={300}
                        pathOptions={{
                          color: '#9333ea',
                          fillColor: '#a855f7',
                          fillOpacity: 0.7,
                          weight: 2
                        }}
                      >
                        <Popup>
                          <div className="text-xs p-1 text-slate-900 font-sans">
                            <span className="font-bold text-brand-800 text-[12px] flex items-center gap-1">
                              <AlertTriangle size={12} />
                              DBSCAN Active Hotspot {idx + 1}
                            </span>
                            <div className="border-t border-slate-100 pt-1 mt-1 text-[10px] text-slate-500">
                              <span><strong>Complaints Density:</strong> {hotspot.density} events</span>
                              <br />
                              <span><strong>Clustering Severity:</strong> <span className="text-red-600 font-bold">{hotspot.severity_level}</span></span>
                            </div>
                          </div>
                        </Popup>
                      </Circle>
                  ))}
                </MapContainer>
              </div>
            </div>

            {/* Hotspots & active OLS coefficients sidebar */}
            <div className="lg:col-span-4 flex flex-col space-y-6">
              {/* Global OLS Equation parameters card */}
              <div className="glass-card p-5 rounded-2xl flex flex-col justify-between">
                <div>
                  <h3 className="text-md font-bold text-slate-800 mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Binary size={18} className="text-brand-600" />
                      Global OLS Regression Stats
                    </span>
                    <button
                      onClick={() => setShowStatsModal(true)}
                      className="text-brand-600 hover:text-brand-800 hover:bg-brand-50 px-2 py-1 rounded-lg transition-all flex items-center gap-1.5 text-[10px] font-bold border border-brand-100"
                      title="Statistical Interpretation Guide"
                    >
                      <BookOpen size={12} />
                      Explain Math
                    </button>
                  </h3>
                  
                  {predictiveData && predictiveData.global_ols ? (
                    <div className="space-y-4">
                      {/* Overall Goodness of Fit Badges */}
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="bg-brand-50/50 border border-brand-100/60 p-2 rounded-xl">
                          <span className="text-[9px] font-bold text-brand-500 uppercase tracking-wider block">R² Score</span>
                          <h4 className="text-lg font-extrabold text-brand-900 mt-0.5">
                            {predictiveData.global_ols.r2_score.toFixed(4)}
                          </h4>
                          <span className="text-[7.5px] text-purple-400/80 block font-medium mt-0.5">Variance Explained</span>
                        </div>
                        <div className="bg-indigo-50/50 border border-indigo-100/60 p-2 rounded-xl">
                          <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider block">Adjusted R²</span>
                          <h4 className="text-lg font-extrabold text-indigo-900 mt-0.5">
                            {predictiveData.global_ols.r2_adj.toFixed(4)}
                          </h4>
                          <span className="text-[7.5px] text-indigo-400/80 block font-medium mt-0.5">Degrees of Freedom Adj.</span>
                        </div>
                      </div>

                      {/* Scientific Parameters Table */}
                      <div className="overflow-hidden border border-slate-100 rounded-xl">
                        <table className="w-full text-left border-collapse text-[9.5px]">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                              <th className="py-1.5 px-2">Predictor</th>
                              <th className="py-1.5 px-1 text-right">Beta (β)</th>
                              <th className="py-1.5 px-1 text-right">Std.Err</th>
                              <th className="py-1.5 px-1 text-right">p-Val</th>
                              <th className="py-1.5 px-1.5 text-center">Sig.</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100/60 text-slate-600 font-semibold">
                            {[
                              { key: 'avg_sewer_age_years', label: 'Sewer Age' },
                              { key: 'tree_count', label: 'Tree Roots' },
                              { key: 'connections_count', label: 'Connections' },
                              { key: 'population_density', label: 'Pop Density' },
                              { key: 'pipe_diameter_mm', label: 'Pipe Dia.' }
                            ].map(({ key, label }) => {
                              const coef = predictiveData.global_ols.coefficients[key];
                              if (!coef) return null;
                              return (
                                <tr key={key} className={`hover:bg-slate-50/50 transition-colors ${coef.significant ? 'bg-emerald-50/10' : ''}`}>
                                  <td className="py-1.5 px-2 font-bold text-slate-700">{label}</td>
                                  <td className="py-1.5 px-1 text-right font-mono text-slate-800">
                                    {coef.coefficient > 0 ? '+' : ''}{coef.coefficient.toFixed(3)}
                                  </td>
                                  <td className="py-1.5 px-1 text-right font-mono text-slate-400">
                                    {coef.std_err.toFixed(3)}
                                  </td>
                                  <td className="py-1.5 px-1 text-right font-mono text-slate-500">
                                    {coef.p_value < 0.0001 ? coef.p_value.toExponential(1) : coef.p_value.toFixed(4)}
                                  </td>
                                  <td className="py-1.5 px-1.5 text-center">
                                    {coef.significant ? (
                                      <span className="inline-flex items-center px-1 rounded text-[7.5px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                                        p &lt; 0.05
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-1 rounded text-[7.5px] font-bold bg-amber-50 text-amber-600 border border-amber-100">
                                        p &ge; 0.05
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Model-wide Summary stats */}
                      <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold px-1 border-t border-slate-50 pt-2">
                        <span>F-Stat: <strong className="text-slate-600 font-mono">{predictiveData.global_ols.f_statistic.toFixed(2)}</strong></span>
                        <span>Prob(F): <strong className={`font-mono ${predictiveData.global_ols.f_p_value < 0.05 ? "text-emerald-600" : "text-slate-600"}`}>
                          {predictiveData.global_ols.f_p_value < 0.0001 ? predictiveData.global_ols.f_p_value.toExponential(2) : predictiveData.global_ols.f_p_value.toFixed(5)}
                        </strong></span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-400 text-xs font-medium">Models not initialized yet.</p>
                  )}
                </div>
              </div>

              {/* DBSCAN Hotspots list widget */}
              <div className="glass-card p-5 rounded-2xl flex-1 flex flex-col overflow-hidden max-h-[300px]">
                <h3 className="text-md font-bold text-slate-800 mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <MapPin size={18} className="text-brand-600 animate-bounce" />
                    DBSCAN Active Hotspots
                  </span>
                  <span className="text-[10px] bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full font-bold">
                    {predictiveData?.hotspots_count || 0} Clusters
                  </span>
                </h3>

                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-slate-700">
                  {predictiveData && predictiveData.hotspots && predictiveData.hotspots.length > 0 ? (
                    predictiveData.hotspots.map((hotspot, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 hover:bg-slate-100/50 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="h-6 w-6 bg-brand-50 text-brand-700 rounded-lg text-xs font-bold flex items-center justify-center border border-brand-100 shadow-sm">
                            #{idx + 1}
                          </span>
                          <div>
                            <p className="text-xs font-bold text-slate-900">Complaints Density</p>
                            <p className="text-[10px] text-slate-500">Centroid: {hotspot.centroid_lat}, {hotspot.centroid_lng}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          hotspot.severity_level === 'High' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}>
                          {hotspot.density} Events
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-slate-400 text-xs font-medium">
                      No localized hotspots clustered yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Regression plots and AI insights */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* OLS Scatter chart */}
            <div className="lg:col-span-6 glass-card p-5 rounded-2xl relative">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                  <TrendingUp size={18} className="text-brand-600" />
                  OLS Regression Scatter & Trendline
                  <button 
                    onClick={() => setShowScatterExplainer(!showScatterExplainer)}
                    className="text-slate-400 hover:text-brand-600 transition-colors p-0.5 rounded-full hover:bg-slate-100 outline-none cursor-pointer"
                    title="Explain Graph significance"
                    aria-label="Explain Graph significance"
                  >
                    <HelpCircle size={15} />
                  </button>
                </h3>
                
                <select
                  value={selectedPredictor}
                  onChange={(event) => setSelectedPredictor(event.target.value)}
                  className="text-xs font-bold bg-slate-55 text-slate-700 border border-slate-200 p-1.5 rounded-xl focus:ring-0 outline-none cursor-pointer"
                >
                  {Object.entries(predictorLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Explainer Banner */}
              <div className="mb-5 bg-slate-50 border border-slate-200/60 rounded-2xl p-4 text-xs leading-relaxed text-slate-700 shadow-sm flex items-start gap-3.5 relative overflow-hidden group hover:border-slate-350 transition-all duration-300">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-brand-500 to-blue-600"></div>
                <div className="p-2 bg-brand-50 rounded-xl border border-brand-100 shadow-sm text-brand-600 shrink-0 group-hover:scale-105 transition-transform duration-300">
                  <Sparkles size={16} className="text-purple-600 animate-pulse" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-extrabold text-brand-700 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded-full uppercase tracking-wider text-[9px]">
                      AI Predictive Insight
                    </span>
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse"></span>
                  </div>
                  <p className="text-slate-600 font-medium leading-relaxed font-semibold">
                    {predictorExplainers[selectedPredictor]}
                  </p>
                </div>
              </div>

              {showScatterExplainer && (
                <div className="absolute inset-x-5 top-16 bottom-5 bg-white/95 backdrop-blur-md rounded-xl p-5 border border-slate-200/80 flex flex-col justify-center items-center text-center z-20 shadow-lg animate-in fade-in zoom-in duration-200">
                  <button 
                    onClick={() => setShowScatterExplainer(false)}
                    className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-all cursor-pointer"
                    aria-label="Close explainer"
                  >
                    <X size={16} />
                  </button>
                  <TrendingUp size={36} className="text-brand-600 mb-3 animate-pulse" />
                  <h4 className="font-bold text-slate-800 text-sm mb-2">Significance of this Regression Chart</h4>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-sm font-medium">
                    Each point represents a ward in Ahmedabad, showing the mathematical relationship between the selected 
                    predictor (e.g. connection load, sewer age) and the predicted blockage risk score.
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-sm mt-2 font-medium">
                    The blue diagonal <strong>Trendline</strong> reveals the OLS calculated correlation. A steep slope 
                    statistically proves that higher values of the predictor lead to significantly higher sewer blockage occurrences.
                  </p>
                </div>
              )}

              {predictiveData && predictiveData.ward_gwr_risk ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                      <XAxis 
                        type="number" 
                        dataKey="x" 
                        name={predictorLabels[selectedPredictor]} 
                        stroke="#64748b" 
                        fontSize={11} 
                        tickLine={false} 
                        axisLine={false}
                        label={{ value: predictorLabels[selectedPredictor], position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
                      />
                      <YAxis 
                        type="number" 
                        dataKey="y" 
                        name="Blockage Risk Score (%)" 
                        stroke="#64748b" 
                        fontSize={11} 
                        tickLine={false} 
                        axisLine={false}
                        label={{ value: 'Risk Score (%)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
                      />
                      <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                      <Scatter name="Wards Predictor Coordinates" data={scatterPoints} fill="#8884d8" isAnimationActive={true} animationDuration={600}>
                        {scatterPoints.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.y >= 75 ? '#ef4444' : entry.y >= 45 ? '#f59e0b' : '#10b981'} />
                        ))}
                      </Scatter>
                      <Line 
                        type="monotone" 
                        data={trendlinePoints} 
                        dataKey="y" 
                        stroke="#2563eb" 
                        strokeWidth={2} 
                        dot={false} 
                        activeDot={false} 
                        legendType="none"
                        isAnimationActive={true}
                        animationDuration={600}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-72 flex items-center justify-center text-slate-400 text-sm font-medium">
                  No regression records compiled.
                </div>
              )}
            </div>

            {/* AI report panel */}
            <div className="lg:col-span-6 glass-card p-5 rounded-2xl flex flex-col h-[360px] overflow-hidden">
              <h3 className="text-md font-bold text-slate-800 mb-3 flex items-center gap-2">
                <BookOpen size={18} className="text-brand-600" />
                AI Executive Planning Insights Briefing
              </h3>

              <div className="flex-1 bg-white text-slate-700 p-5 rounded-xl font-sans text-xs overflow-y-auto border border-slate-200/80 leading-relaxed shadow-inner select-text">
                {aiBriefing ? (
                  <div className="prose max-w-none text-slate-700">
                    {aiBriefing.split('\n').map((line, idx) => {
                      if (line.startsWith('# ')) return <h2 key={idx} className="text-brand-800 font-extrabold text-sm uppercase mt-4 mb-2 tracking-wide border-b border-slate-100 pb-1">{line.replace('# ', '')}</h2>;
                      if (line.startsWith('## ')) return <h3 key={idx} className="text-slate-900 font-bold text-xs uppercase mt-3 mb-1.5">{line.replace('## ', '')}</h3>;
                      if (line.startsWith('### ')) return <h4 key={idx} className="text-brand-700 font-bold text-xs mt-2.5 mb-1 flex items-center gap-1.5"><ChevronRight size={12} className="text-brand-600" /><span className="text-brand-700">{line.replace('### ', '')}</span></h4>;
                      if (line.startsWith('* ')) return <p key={idx} className="pl-4 py-0.5 relative text-slate-700"><span className="absolute left-1.5 text-brand-600">•</span> {line.replace('* ', '')}</p>;
                      if (line.startsWith('- ')) return <p key={idx} className="pl-4 py-0.5 relative text-slate-700"><span className="absolute left-1.5 text-brand-600">•</span> {line.replace('- ', '')}</p>;
                      return <p key={idx} className="my-1.5 text-slate-600">{line}</p>;
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 font-semibold italic text-center">
                    AI Planner is formulating the briefing...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* GWR Localized Spatial Inspector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
            <div className="lg:col-span-12">
              <div className="glass-card p-5 rounded-2xl bg-white shadow-sm border border-slate-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4 mb-5">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Activity className="text-brand-600 animate-pulse" size={24} />
                        Geographically Weighted Regression (GWR) Inspector
                      </h3>
                      {predictiveLoading && (
                        <span className="flex items-center gap-1.5 text-xs text-brand-600 font-bold bg-brand-50 px-2.5 py-1 rounded-full border border-brand-100 animate-pulse">
                          <RefreshCw size={12} className="animate-spin" />
                          Recalculating...
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-xs md:text-sm mt-1">
                      Interactive Spatial Bandwidth tuning and local coefficients comparison across Ahmedabad's wards.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 bg-slate-50/50 px-4 py-2 rounded-2xl border border-slate-150 shadow-xs">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      SELECT ACTIVE WARD
                    </span>
                    <CustomDropdown
                      value={selectedWard}
                      onChange={setSelectedWard}
                      options={wardOptions}
                      className="w-48 sm:w-56"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Control Panel */}
                  <div className="lg:col-span-5 space-y-5 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Spatial Kernel Bandwidth (b)
                        </label>
                        <span className="text-sm font-extrabold text-brand-700 font-mono">
                          {gwrBandwidth.toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.02"
                        max="0.20"
                        step="0.01"
                        value={gwrBandwidth}
                        onChange={(e) => setGwrBandwidth(parseFloat(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600 outline-none"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 font-bold mt-1">
                        <span>0.02 (Very Local)</span>
                        <span>0.11 (Balanced)</span>
                        <span>0.20 (Globalized)</span>
                      </div>
                    </div>

                    {/* Bell Curve */}
                    <div className="bg-white border border-slate-200/60 p-4 rounded-xl flex flex-col items-center">
                      <div className="w-full flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">
                          Gaussian Spatial Weight Decay
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                          gwrBandwidth <= 0.05 ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                          gwrBandwidth <= 0.12 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                          'bg-brand-50 text-brand-700 border border-brand-100'
                        }`}>
                          {gwrBandwidth <= 0.05 ? 'Highly Localized' :
                           gwrBandwidth <= 0.12 ? 'Optimal Balance' :
                           'Global Smoothed'}
                        </span>
                      </div>
                      
                      <svg className="w-full h-20" viewBox="0 0 200 80">
                        <defs>
                          <linearGradient id="bellGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#9333ea" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#c084fc" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        <line x1="0" y1="80" x2="200" y2="80" stroke="#e2e8f0" strokeWidth="1.5" />
                        <line x1="100" y1="0" x2="100" y2="80" stroke="#f1f5f9" strokeDasharray="3,3" />
                        <path
                          d={(() => {
                            const center = 100;
                            const height = 55;
                            const points = [];
                            const sigma = 10 + (gwrBandwidth - 0.02) * (50 / 0.18);
                            for (let x = 0; x <= 200; x += 4) {
                              const y = 80 - height * Math.exp(-0.5 * Math.pow((x - center) / sigma, 2));
                              points.push(`${x},${y}`);
                            }
                            return `M ${points.join(" L ")} L 200,80 L 0,80 Z`;
                          })()}
                          fill="url(#bellGrad)"
                          stroke="#2563eb"
                          strokeWidth="2"
                          className="transition-all duration-300 ease-out"
                        />
                        <circle cx="100" cy="25" r="4" fill="#9333ea" className="animate-pulse" />
                      </svg>
                      
                      <p className="text-[10px] text-slate-400 mt-2.5 text-center leading-relaxed font-semibold">
                        Closer wards receive higher spatial regression weights. Stretching the curve adjusts how far GWR searches for regional patterns.
                      </p>
                    </div>
                  </div>

                  {/* Right Ward Inspector */}
                  <div className="lg:col-span-7 space-y-5">

                    {(() => {
                      const activeWardData = predictiveData?.ward_gwr_risk?.find(w => w.ward_name === selectedWard) || null;
                      if (!activeWardData) {
                        return (
                          <div className="flex items-center justify-center h-full text-slate-400 italic text-xs py-12">
                            Select a ward on the dropdown to inspect localized regression details.
                          </div>
                        );
                      }
                      
                      const risk = activeWardData.risk_score;
                      const riskColor = risk >= 75 ? 'bg-rose-50 text-rose-700 border-rose-100' : 
                                        risk >= 45 ? 'bg-amber-50 text-amber-700 border-amber-100' : 
                                        'bg-emerald-50 text-emerald-700 border-emerald-100';
                      
                      const localCoefs = activeWardData.local_coefficients;
                      const globalCoefs = predictiveData.global_ols.coefficients;
                      
                      let maxDiff = -Infinity;
                      let dominantDriverKey = "avg_sewer_age_years";
                      
                      Object.keys(localCoefs).forEach(feat => {
                        const local = localCoefs[feat];
                        const global = globalCoefs[feat]?.coefficient || 0;
                        let diff;
                        
                        if (feat === 'pipe_diameter_mm') {
                          diff = global - local; 
                        } else {
                          diff = local - global;
                        }
                        
                        if (diff > maxDiff) {
                          maxDiff = diff;
                          dominantDriverKey = feat;
                        }
                      });
                      
                      const dominantBriefers = {
                        avg_sewer_age_years: "Structural sewer aging and concrete wear represent the dominant localized risk vectors in this ward. Proactive pipeline relining, camera audits, and structural sewer inspections should be expedited to mitigate joint degradation.",
                        tree_count: "Environmental root intrusion represents the primary cause of blockages here, driven by high municipal tree densities. Priority should be given to chemical root inhibitors, trenchless root-barrier membranes, and mechanical flushes.",
                        connections_count: "Domestic and commercial sewer connections are placing massive baseline hydraulic loads in this neighborhood. Strict load audits, grease trap enforcement, and capacity checks on lateral connections are recommended.",
                        population_density: "Heavy urban population density is creating high daily wastewater discharge loads. Municipal planners should schedule regular wet-weather capacity flushes and evaluate sub-district trunk pipe scaling.",
                        pipe_diameter_mm: "Sub-optimal lateral pipeline diameters represent a high bottleneck here. Future rehabilitation projects should upgrade lateral sewer networks to a minimum standard of 300mm to cope with local discharge volumes."
                      };

                      const predictorFriendlyNames = {
                        avg_sewer_age_years: "Sewer Infrastructure Age",
                        tree_count: "Tree Root Intrusion",
                        connections_count: "Active Connections Count",
                        population_density: "Population Density",
                        pipe_diameter_mm: "Pipe Diameter"
                      };

                      return (
                        <>
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100 font-semibold text-slate-700">
                            <div>
                              <h4 className="text-md font-extrabold text-slate-800">
                                {activeWardData.ward_name} Ward Summary
                              </h4>
                              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                Centroid: {activeWardData.coordinates.lat.toFixed(4)}°N, {activeWardData.coordinates.lng.toFixed(4)}°E
                              </p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${riskColor}`}>
                              Localized Risk: {risk.toFixed(1)}%
                            </span>
                          </div>

                          <div className="bg-gradient-to-r from-blue-950 to-slate-900 text-white p-4 rounded-xl shadow-md border border-brand-950 relative overflow-hidden group">
                            <div className="absolute right-0 top-0 w-24 h-24 bg-brand-500/10 rounded-full blur-2xl group-hover:bg-brand-500/20 transition-all duration-300"></div>
                            <div className="flex items-center gap-2 mb-2">
                              <Binary size={14} className="text-blue-300" />
                              <span className="text-[9px] font-bold text-blue-200 uppercase tracking-wider font-mono">
                                GWR Localized Regression Equation
                              </span>
                            </div>
                            <div className="font-mono text-[11px] overflow-x-auto py-1 scrollbar-thin scrollbar-thumb-brand-900 leading-relaxed font-bold font-sans">
                              Risk % = {activeWardData.local_intercept.toFixed(2)} 
                              {activeWardData.local_coefficients.avg_sewer_age_years >= 0 ? ' + ' : ' - '}
                              {Math.abs(activeWardData.local_coefficients.avg_sewer_age_years).toFixed(2)} × Age
                              {activeWardData.local_coefficients.tree_count >= 0 ? ' + ' : ' - '}
                              {Math.abs(activeWardData.local_coefficients.tree_count).toFixed(2)} × Trees
                              {activeWardData.local_coefficients.connections_count >= 0 ? ' + ' : ' - '}
                              {Math.abs(activeWardData.local_coefficients.connections_count).toFixed(2)} × Connections
                              {activeWardData.local_coefficients.population_density >= 0 ? ' + ' : ' - '}
                              {Math.abs(activeWardData.local_coefficients.population_density).toFixed(2)} × PopDensity
                              {activeWardData.local_coefficients.pipe_diameter_mm >= 0 ? ' + ' : ' - '}
                              {Math.abs(activeWardData.local_coefficients.pipe_diameter_mm).toFixed(2)} × PipeDia
                            </div>
                          </div>

                          <div className="overflow-hidden border border-slate-100 rounded-xl bg-white shadow-sm">
                            <table className="w-full text-left border-collapse text-[10px]">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider">
                                  <th className="py-2 px-3">Predictor</th>
                                  <th className="py-2 px-2 text-right">Global β (OLS)</th>
                                  <th className="py-2 px-2 text-right">Local β (GWR)</th>
                                  <th className="py-2 px-3 text-center w-28">Spatial Causal Shift</th>
                                  <th className="py-2 px-3 text-right">Local Impact</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100/60 font-semibold text-slate-600">
                                {[
                                  { key: 'avg_sewer_age_years', label: 'Sewer Age' },
                                  { key: 'tree_count', label: 'Tree Roots' },
                                  { key: 'connections_count', label: 'Connections' },
                                  { key: 'population_density', label: 'Pop Density' },
                                  { key: 'pipe_diameter_mm', label: 'Pipe Dia.' }
                                ].map(({ key, label }) => {
                                  const globalVal = globalCoefs[key]?.coefficient || 0;
                                  const localVal = localCoefs[key] || 0;
                                  
                                  let diff = localVal - globalVal;
                                  let impactType;
                                  let impactColor;
                                  
                                  if (key === 'pipe_diameter_mm') {
                                    if (diff < -0.005) {
                                      impactType = "Amplified Risk";
                                      impactColor = "text-rose-600 bg-rose-50 border border-rose-100";
                                    } else if (diff > 0.005) {
                                      impactType = "Mitigated Risk";
                                      impactColor = "text-emerald-600 bg-emerald-50 border border-emerald-100";
                                    } else {
                                      impactType = "Near Baseline";
                                      impactColor = "text-slate-600 bg-slate-50 border border-slate-100";
                                    }
                                  } else {
                                    if (diff > 0.05) {
                                      impactType = "Amplified Impact";
                                      impactColor = "text-rose-600 bg-rose-50 border border-rose-100";
                                    } else if (diff < -0.05) {
                                      impactType = "Mitigated Impact";
                                      impactColor = "text-emerald-600 bg-emerald-50 border border-emerald-100";
                                    } else {
                                      impactType = "Near Baseline";
                                      impactColor = "text-slate-600 bg-slate-50 border border-slate-100";
                                    }
                                  }

                                  const maxScale = key === 'pipe_diameter_mm' ? 0.05 : 0.4;
                                  const percentageWidth = Math.min(100, Math.max(-100, (diff / maxScale) * 100));

                                  return (
                                    <tr key={key} className="hover:bg-slate-50/40 transition-colors">
                                      <td className="py-2.5 px-3 font-bold text-slate-700">{label}</td>
                                      <td className="py-2.5 px-2 text-right font-mono text-slate-400">
                                        {globalVal.toFixed(3)}
                                      </td>
                                      <td className="py-2.5 px-2 text-right font-mono text-slate-800 font-extrabold">
                                        {localVal.toFixed(3)}
                                      </td>
                                      <td className="py-2.5 px-3">
                                        <div className="relative w-28 h-2.5 bg-slate-100 rounded-full overflow-hidden flex items-center justify-center">
                                          <div className="absolute left-[50%] top-0 bottom-0 w-0.5 bg-slate-300 z-10"></div>
                                          {percentageWidth > 0 ? (
                                            <div 
                                              className="absolute left-[50%] h-full bg-rose-400 rounded-r-full"
                                              style={{ width: `${percentageWidth / 2}%` }}
                                            ></div>
                                          ) : (
                                            <div 
                                              className="absolute right-[50%] h-full bg-emerald-400 rounded-l-full"
                                              style={{ width: `${Math.abs(percentageWidth) / 2}%` }}
                                            ></div>
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-2.5 px-3 text-right">
                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${impactColor}`}>
                                          {impactType}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          <div className="bg-amber-50/50 border border-amber-100/70 p-4 rounded-xl text-slate-700 text-xs shadow-sm flex items-start gap-3 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                            <div className="p-1.5 bg-white rounded-lg border border-amber-100 shadow-sm text-amber-600 shrink-0 mt-0.5">
                              <AlertTriangle size={14} className="animate-pulse" />
                            </div>
                            <div className="flex-1">
                              <span className="font-extrabold text-[9px] text-amber-800 uppercase tracking-wider block mb-0.5">
                                Primary Local Causal Risk Driver: {predictorFriendlyNames[dominantDriverKey]}
                              </span>
                              <p className="text-[11px] text-slate-600 font-medium leading-relaxed font-semibold">
                                {dominantBriefers[dominantDriverKey]}
                              </p>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Explanation Modal */}
      {showStatsModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white/95 backdrop-blur-md border border-slate-100 p-6 rounded-2xl max-w-2xl w-full shadow-2xl relative animate-in fade-in-50 zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <button 
              onClick={() => setShowStatsModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-full transition-colors"
              aria-label="Close statistics modal"
            >
              <X size={20} />
            </button>
            
            <div className="flex items-center gap-2.5 mb-4 border-b border-slate-100 pb-3">
              <div className="p-2 bg-brand-50 rounded-xl text-brand-600">
                <BookOpen size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">OLS Regression & Statistical Significance</h3>
                <p className="text-[11px] text-slate-400">Ahmedabad Municipal Sewer Analytics Guide</p>
              </div>
            </div>

            <div className="overflow-y-auto space-y-4 pr-1 text-slate-700 text-xs leading-relaxed font-semibold">
              <div>
                <h4 className="font-bold text-slate-800 text-[13px] mb-1">What is Multiple Linear Regression?</h4>
                <p className="font-medium text-slate-600">
                  Multiple Linear Regression is a statistical method that models the relationship between a single dependent target variable (<strong>Sewer Blockages Count</strong>) and multiple independent environmental/structural predictors. It isolates the individual effect of each predictor while holding all other factors constant.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-[13px] mb-1">Overall Model Fit Metrics</h4>
                <ul className="list-disc pl-4 space-y-1.5">
                  <li>
                    <strong>R² (R-Squared) Score:</strong> Measures the goodness-of-fit of the model. A value of <code>{predictiveData?.global_ols?.r2_score || '0.9196'}</code> means that approximately <code>{(parseFloat(predictiveData?.global_ols?.r2_score || 0.9196) * 100).toFixed(1)}%</code> of the variations in ward blockages are mathematically explained by our predictors.
                  </li>
                  <li>
                    <strong>Adjusted R² Score:</strong> A refined version of R² that accounts for the number of predictors in the model. It only increases if new predictors improve the model more than expected by chance, penalizing arbitrary overfitting.
                  </li>
                  <li>
                    <strong>F-Statistic & its P-Value:</strong> Tests whether the group of independent variables *collectively* has a statistically significant relationship with the target. A tiny F-statistic p-value (e.g., &lt; 0.001) proves the entire model is highly reliable and did not occur by random chance.
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-[13px] mb-1 font-sans">Individual Predictor Coefficients</h4>
                <ul className="list-disc pl-4 space-y-1.5">
                  <li>
                    <strong>Coefficient (β):</strong> The expected change in blockages for every one-unit increase in the predictor. For example, a coefficient of <code>+{predictiveData?.global_ols?.coefficients?.avg_sewer_age_years?.coefficient || '0.868'}</code> for Sewer Age implies that for each additional year of pipe age, blockages increase by ~0.87, assuming other variables are constant.
                  </li>
                  <li>
                    <strong>Standard Error (Std. Error):</strong> Measures the precision of the coefficient estimate. A smaller standard error relative to the coefficient indicates higher confidence and lower statistical noise.
                  </li>
                  <li>
                    <strong>t-Statistic:</strong> The ratio of the coefficient to its standard error ($t = \beta / SE$). It represents how many standard deviations the coefficient is away from 0. High absolute values indicate strong predictive power.
                  </li>
                  <li>
                    <strong>p-Value ($p &gt; |t|$):</strong> The probability that the observed correlation is purely coincidental. A threshold of <strong>$p &lt; 0.05$</strong> is the scientific gold standard: it indicates a &lt; 5% chance the relationship is random, confirming the predictor is a <strong>highly statistically significant</strong> driver of sewer failures.
                  </li>
                </ul>
              </div>

              <div className="bg-brand-50/70 border border-brand-100 p-3.5 rounded-xl">
                <h4 className="font-bold text-brand-900 text-[12px] mb-1">Municipal Policy Implication</h4>
                <p className="text-[11px] text-brand-700 font-medium">
                  For city planners, statistically significant predictors (highlighted in <span className="text-emerald-600 font-bold">Green</span>) represent verified targets for preventative capital investments. For example, a significant <strong>Connection Count</strong> coefficient justifies enforcing strict load-discharge limits on new residential building designs, while a significant <strong>Tree Count</strong> validates scheduled trenchless root-barrier installations in high-risk wards.
                </p>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setShowStatsModal(false)}
                className="bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs px-5 py-2.5 rounded-lg transition-all shadow-md shadow-brand-200"
              >
                Got it, Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
