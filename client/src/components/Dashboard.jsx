import { useState, useMemo } from 'react';
import { Filter, Activity, Database } from 'lucide-react';
import OverviewTab from './OverviewTab';
import PredictiveTab from './PredictiveTab';
import IotTelemetryTab from './IotTelemetryTab';
import IngestedReportsTab from './IngestedReportsTab';
import { formatReadingTime, CustomDropdown } from './DashboardUtils';

const dashboardViewOptions = [
  { value: 'overview', label: 'Ahmedabad Risk Map' },
  { value: 'iot', label: 'Live IoT Telemetry' },
  { value: 'predictive', label: 'Spatial GIS Analytics' },
  { value: 'ingested', label: 'Ingested 311 Reports' }
];

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://urbanfix-311.onrender.com';

export default function Dashboard({
  structuredRecords = [],
  quarantineRecords = [],
  flaggedRecords = [],
  reports = [],
  iotSewerReadings = []
}) {
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [dashboardView, setDashboardView] = useState('overview');
  const batchOptions = useMemo(() => {
    const opts = [{ value: 'all', label: 'All Batches' }];
    const seen = new Set();
    reports.forEach((report) => {
      if (report.batch_id && !seen.has(report.batch_id)) {
        seen.add(report.batch_id);
        opts.push({
          value: report.batch_id,
          label: `Batch ${report.batch_id.slice(0, 8)} (${new Date(report.created_at).toLocaleTimeString()})`
        });
      }
    });
    return opts;
  }, [reports]);

  const filteredStructured = selectedBatch === 'all'
    ? structuredRecords
    : structuredRecords.filter((record) => record.batch_id === selectedBatch);

  const downloadCSV = () => {
    let dataToExport;
    let filename;

    if (dashboardView === 'iot') {
      dataToExport = iotSewerReadings.map(r => ({
        "Area": r.ward_name,
        "Date/Time": formatReadingTime(r.date),
        "Nitrogen Level (mg/L)": r['nitrogen mg/L'],
        "Phosphorous Level (mg/L)": r['phosphorous mg/L'],
        "State of Sewage": r.state_of_sewage,
        "State Reason": r.state_reason,
        "Pipe Diameter (mm)": r.pipe_diameter_mm,
        "Installation Method": r.installation_method,
        "Pipe Age (Years)": r.pipe_age_years,
        "Pipe Length (m)": r.pipe_length_m,
        "Pipe Depth (m)": r.pipe_depth_m,
        "Connections Count": r.connections_count,
        "Environmental Conditions": r.environmental_conditions,
        "Groundwater Level (m)": r.groundwater_level_m,
        "Is Blocked": r.is_blocked,
        "Cause & Maintenance Required": r.maintenance_required,
        "Latitude": r.geo_latitude,
        "Longitude": r.geo_longitude
      }));
      filename = "urbanfix_live_iot_telemetry.csv";
    } else {
      dataToExport = filteredStructured.map(r => ({
        "Complaint ID": r.complaint_id,
        "Ward": r.ward_name || "N/A",
        "Category": r.complaint_category,
        "Description": r.description,
        "Latitude": r.lat || "",
        "Longitude": r.lng || "",
        "Severity": r.severity || "Low",
        "Confidence Score": `${((r.confidence_score || 1.0) * 100).toFixed(0)}%`
      }));
      filename = `urbanfix_structured_data_batch_${selectedBatch}.csv`;
    }

    if (dataToExport.length === 0) {
      alert("No data available to download.");
      return;
    }

    const headers = Object.keys(dataToExport[0]);
    const csvRows = [
      headers.join(','),
      ...dataToExport.map(row =>
        headers.map(fieldName => {
          const value = row[fieldName] !== undefined && row[fieldName] !== null ? row[fieldName] : "";
          const escaped = ('' + value).replace(/"/g, '""');
          return `"${escaped}"`;
        }).join(',')
      )
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (dashboardView === 'overview') {
    return (
      <OverviewTab
        dashboardView={dashboardView}
        setDashboardView={setDashboardView}
        API_BASE_URL={API_BASE_URL}
      />
    );
  }

  if (dashboardView === 'predictive') {
    return (
      <PredictiveTab
        iotSewerReadings={iotSewerReadings}
        dashboardView={dashboardView}
        setDashboardView={setDashboardView}
        API_BASE_URL={API_BASE_URL}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Activity className="text-brand-600" />
            Operations Control Panel
          </h2>
          <p className="text-slate-500 text-sm">Real-time civic data parsing & validation engine metrics.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <CustomDropdown
            value={dashboardView}
            onChange={setDashboardView}
            options={dashboardViewOptions}
            className="w-full sm:w-60"
            leftIcon={<Filter size={14} />}
          />

          {dashboardView !== 'iot' && (
            <CustomDropdown
              value={selectedBatch}
              onChange={setSelectedBatch}
              options={batchOptions}
              className="w-full sm:w-64"
              leftIcon={<Database size={14} />}
            />
          )}
        </div>
      </div>

      {dashboardView === 'iot' ? (
        <IotTelemetryTab
          iotSewerReadings={iotSewerReadings}
          dashboardView={dashboardView}
          setDashboardView={setDashboardView}
          downloadCSV={downloadCSV}
          API_BASE_URL={API_BASE_URL}
        />
      ) : (
        <IngestedReportsTab
          structuredRecords={structuredRecords}
          quarantineRecords={quarantineRecords}
          flaggedRecords={flaggedRecords}
          reports={reports}
          selectedBatch={selectedBatch}
          setSelectedBatch={setSelectedBatch}
          downloadCSV={downloadCSV}
        />
      )}
    </div>
  );
}
