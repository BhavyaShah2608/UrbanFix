/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import Upload from './components/Upload';
import Review from './components/Review';

const rawApiUrl = import.meta.env.VITE_API_URL || 'https://urbanfix-311.onrender.com';
const API_BASE_URL = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [structuredRecords, setStructuredRecords] = useState([]);
  const [quarantineRecords, setQuarantineRecords] = useState([]);
  const [flaggedRecords, setFlaggedRecords] = useState([]);
  const [reports, setReports] = useState([]);
  const [iotSewerReadings, setIotSewerReadings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dynamic Initial Loader States
  const [isInitializing, setIsInitializing] = useState(true);
  const [progress, setProgress] = useState(0);
  const [estTime, setEstTime] = useState(50);
  const [initStage, setInitStage] = useState('Waking up backend server instances...');

  const fetchData = async (showLoader = true) => {
    try {
      if (showLoader && !isInitializing) setIsLoading(true);
      
      const [structuredRes, quarantineRes, flaggedRes, reportsRes, iotSewerRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/records/structured`),
        axios.get(`${API_BASE_URL}/records/quarantine`),
        axios.get(`${API_BASE_URL}/records/flagged`),
        axios.get(`${API_BASE_URL}/records/reports`),
        axios.get(`${API_BASE_URL}/iot/sewer-readings`)
      ]);

      setStructuredRecords(structuredRes.data);
      setQuarantineRecords(quarantineRes.data);
      setFlaggedRecords(flaggedRes.data);
      setReports(reportsRes.data);
      setIotSewerReadings(iotSewerRes.data.readings || []);

      if (isInitializing) {
        setProgress(100);
        setEstTime(0);
        setInitStage('Ready! Launching dashboard interface...');
        setTimeout(() => {
          setIsInitializing(false);
          setIsLoading(false);
        }, 600);
      }
    } catch (err) {
      console.error("Error loading data from API backend:", err);
      if (isInitializing) {
        setProgress(100);
        setEstTime(0);
        setInitStage('Failed to connect to core. Loading offline cache...');
        setTimeout(() => {
          setIsInitializing(false);
          setIsLoading(false);
        }, 800);
      }
    } finally {
      if (showLoader && !isInitializing) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(false), 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer logic to tick progress bar
  useEffect(() => {
    if (!isInitializing) return;

    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 98) {
          setInitStage('Finalizing system check... almost there.');
          return 98;
        }
        
        let next = prev;
        if (prev < 30) {
          next += 3.5;
        } else if (prev < 65) {
          next += 2;
        } else if (prev < 85) {
          next += 1;
        } else {
          next += 0.5;
        }
        
        next = Math.min(98, next);

        if (next < 25) {
          setInitStage('Waking up backend server instances...');
        } else if (next < 50) {
          setInitStage('Establishing database connection...');
        } else if (next < 75) {
          setInitStage('Ingesting structured 311 datasets...');
        } else {
          setInitStage('Syncing with live IoT telemetry data feeds...');
        }

        return parseFloat(next.toFixed(1));
      });

      setEstTime(prev => {
        if (prev <= 1) return 1;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isInitializing]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6 font-sans">
        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-150 p-8 shadow-2xl flex flex-col items-center space-y-6 transition-all duration-300 animate-in fade-in zoom-in-95">
          {/* Logo / Icon */}
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-blue-100 rounded-2xl scale-[1.3] animate-ping opacity-25"></div>
            <div className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg shadow-blue-200">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>

          {/* Heading */}
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">UrbanFix 311</h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-100">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              {progress < 100 ? 'System Booting' : 'Connection Ready'}
            </span>
          </div>

          {/* Progress Bar Container */}
          <div className="w-full space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
              <span className="transition-all duration-300">{initStage}</span>
              <span className="font-mono text-slate-800 text-sm font-bold">{Math.round(progress)}%</span>
            </div>
            
            {/* Progress Track */}
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 p-0.5">
              <div 
                style={{ width: `${progress}%` }} 
                className="h-full bg-gradient-to-r from-blue-500 to-blue-700 rounded-full relative transition-all duration-300 ease-out shadow-inner"
              >
                {/* Shine animation */}
                <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.3)_50%,transparent_100%)] bg-[length:200%_100%] animate-shimmer progress-shimmer"></div>
              </div>
            </div>
          </div>

          {/* Estimation Text */}
          <div className="text-center">
            {progress < 100 ? (
              <p className="text-xs font-semibold text-slate-400">
                {estTime > 1 ? (
                  <>Estimated initialization time: <span className="font-mono text-slate-700 font-extrabold">~{estTime}s</span></>
                ) : (
                  <span className="text-blue-600 animate-pulse font-bold">Establishing connection... almost ready</span>
                )}
              </p>
            ) : (
              <p className="text-xs font-bold text-emerald-600 animate-pulse">Initialization Complete!</p>
            )}
          </div>
        </div>
        
        {/* Footer info about free tier cold starts */}
        <p className="mt-8 text-[10px] text-slate-400 font-semibold tracking-wide uppercase text-center max-w-xs leading-relaxed">
          Note: This system runs on a cloud container. Cold-starts can take up to 50 seconds to allocate server resources.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top Navigation */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 md:px-6">
        {activeTab === 'dashboard' && (
          <Dashboard 
            structuredRecords={structuredRecords}
            quarantineRecords={quarantineRecords}
            flaggedRecords={flaggedRecords}
            reports={reports}
            iotSewerReadings={iotSewerReadings}
            fetchData={fetchData}
          />
        )}

        {activeTab === 'upload' && (
          <Upload onUploadSuccess={fetchData} />
        )}

        {activeTab === 'review' && (
          <Review 
            quarantineRecords={quarantineRecords}
            flaggedRecords={flaggedRecords}
            fetchData={fetchData}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500 font-semibold">
        &copy; {new Date().getFullYear()} Urbanfix IT Services LLP. All rights reserved.
      </footer>
    </div>
  );
}
