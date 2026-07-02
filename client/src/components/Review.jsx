import { useState, useMemo, useEffect, useRef } from 'react';
import axios from 'axios';
import { useVirtualizer } from '@tanstack/react-virtual';
import { 
  ShieldCheck, CheckCircle, 
  MapPin, Phone, Info, Edit3, Trash2, Loader2,
  ChevronDown, X
} from 'lucide-react';
import { CustomDropdown } from './DashboardUtils';

const AHMEDABAD_WARDS = [
  "Navrangpura", "Vastrapur", "Satellite", "Naranpura", "Girdhar Nagar", 
  "Paldi", "Bodakdev", "Jodhpur", "Bopal", "Thaltej", "Ranip", 
  "Chandkheda", "Sabarmati", "Nikol", "Maninagar", "Kalupur", 
  "Jamalpur", "Shahpur", "Dariapur", "Astodia"
];

const COMPLAINT_CATEGORIES = [
  "Sewer & Drainage", "Garbage & Waste", "Streetlights", 
  "Roads & Potholes", "Water Supply", "Other"
];

const sortOptions = [
  { value: 'confidence-asc', label: 'Confidence: Low → High' },
  { value: 'confidence-desc', label: 'Confidence: High → Low' },
  { value: 'priority', label: 'Priority: High → Low' },
  { value: 'flagType', label: 'Flag Type' },
  { value: 'ward', label: 'Ward Name' },
  { value: 'newest', label: 'Original Order' }
];

const wardDropdownOptions = [
  { value: '', label: 'Select Ward...' },
  ...AHMEDABAD_WARDS.map(w => ({ value: w, label: w }))
];

const categoryDropdownOptions = COMPLAINT_CATEGORIES.map(c => ({ value: c, label: c }));

const severityDropdownOptions = [
  { value: 'Low', label: 'Low' },
  { value: 'Medium', label: 'Medium' },
  { value: 'High', label: 'High' }
];

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://urbanfix-311.onrender.com';

export default function Review({ 
  quarantineRecords, 
  flaggedRecords, 
  fetchData 
}) {
  const [activeSubTab, setActiveSubTab] = useState('flagged'); // 'flagged' or 'quarantine'
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [submittingRecordId, setSubmittingRecordId] = useState(null);
  const [sortKey, setSortKey] = useState('confidence-asc');
  const parentRef = useRef(null);

  // Local records state for optimistic updates
  const [localFlagged, setLocalFlagged] = useState([]);
  const [localQuarantine, setLocalQuarantine] = useState([]);
  
  // Selection state
  const [selectedRecordIds, setSelectedRecordIds] = useState(new Set());
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  
  // Toasts state
  const [toasts, setToasts] = useState([]);

  // Sync props to local state
  useEffect(() => {
    setLocalFlagged(flaggedRecords);
  }, [flaggedRecords]);

  useEffect(() => {
    setLocalQuarantine(quarantineRecords);
  }, [quarantineRecords]);

  const addToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const toggleSelectRecord = (id) => {
    setSelectedRecordIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };



  // Edited values state
  const [editWard, setEditWard] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editSeverity, setEditSeverity] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPincode, setEditPincode] = useState('');

  // Active records listing based on sub-tab
  const records = activeSubTab === 'flagged' 
    ? localFlagged.filter(r => r.status === 'pending')
    : localQuarantine.filter(r => r.status === 'pending');

  const sortedRecords = useMemo(() => {
    const sorted = [...records];
    const priorityRank = { 'High': 3, 'Medium': 2, 'Low': 1 };
    
    switch (sortKey) {
      case 'confidence-asc':
        sorted.sort((a, b) => (a.confidence_score || 0) - (b.confidence_score || 0));
        break;
      case 'confidence-desc':
        sorted.sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0));
        break;
      case 'priority':
        sorted.sort((a, b) => {
          const rankA = priorityRank[a.partial_clean?.severity] || 2;
          const rankB = priorityRank[b.partial_clean?.severity] || 2;
          return rankB - rankA;
        });
        break;
      case 'flagType':
        sorted.sort((a, b) => {
          const flagsA = a.flags || a.partial_clean?.flags || [];
          const flagsB = b.flags || b.partial_clean?.flags || [];
          const flagA = flagsA[0] || '';
          const flagB = flagsB[0] || '';
          return flagA.localeCompare(flagB);
        });
        break;
      case 'ward':
        sorted.sort((a, b) => {
          const wardA = a.partial_clean?.ward_name || '';
          const wardB = b.partial_clean?.ward_name || '';
          return wardA.localeCompare(wardB);
        });
        break;
      case 'newest':
      default:
        break;
    }
    return sorted;
  }, [records, sortKey]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: sortedRecords.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 380,
    overscan: 4
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  // Scroll reset effect when sub tab or sort selection changes
  useEffect(() => {
    if (parentRef.current) {
      parentRef.current.scrollTop = 0;
    }
    rowVirtualizer.scrollToOffset(0);
    setSelectedRecordIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubTab, sortKey]);

  const isAllSelected = sortedRecords.length > 0 && selectedRecordIds.size === sortedRecords.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedRecordIds(new Set());
    } else {
      setSelectedRecordIds(new Set(sortedRecords.map(r => r.id)));
    }
  };

  const startEditing = (rec) => {
    setEditingRecordId(rec.id);
    const clean = rec.partial_clean || {};
    setEditWard(clean.ward_name || '');
    setEditCategory(clean.complaint_category || 'Other');
    setEditSeverity(clean.severity || 'Medium');
    setEditDesc(clean.description || rec.raw_data?.["Complaint Details"] || '');
    setEditPhone(clean.phone || rec.raw_data?.["Reporter Phone"] || '');
    setEditPincode(clean.postal_code || rec.raw_data?.["Pincode"] || '');
  };

  const handleReviewAction = async (recordId, action) => {
    if (submittingRecordId === recordId) return;

    const sourceList = activeSubTab === 'flagged' ? localFlagged : localQuarantine;
    const targetRecord = sourceList.find(r => r.id === recordId);
    if (!targetRecord) return;

    // Save previous state for rollback
    const prevFlagged = [...localFlagged];
    const prevQuarantine = [...localQuarantine];

    // Optimistically remove from state
    if (activeSubTab === 'flagged') {
      setLocalFlagged(prev => prev.filter(r => r.id !== recordId));
    } else {
      setLocalQuarantine(prev => prev.filter(r => r.id !== recordId));
    }

    setSubmittingRecordId(recordId);
    try {
      const payload = {
        record_id: recordId,
        source_table: activeSubTab === 'flagged' ? 'flagged_records' : 'quarantine_records',
        action: action,
        reviewer: 'Human Reviewer'
      };

      if (action === 'approve' && editingRecordId === recordId) {
        payload.edited_data = {
          ward_name: editWard || null,
          complaint_category: editCategory,
          severity: editSeverity,
          description: editDesc,
          phone: editPhone || null,
          postal_code: editPincode || null
        };
      }

      await axios.post(`${API_BASE_URL}/review/submit`, payload);
      setEditingRecordId(null);
      if (fetchData) await fetchData();
    } catch (err) {
      // Rollback on failure
      setLocalFlagged(prevFlagged);
      setLocalQuarantine(prevQuarantine);
      addToast(`Failed to ${action === 'approve' ? 'approve' : 'discard'} record: ${err.message} — restored to list`, 'error');
    } finally {
      setSubmittingRecordId(null);
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedRecordIds.size === 0 || bulkSubmitting) return;
    setBulkSubmitting(true);

    const idsToProcess = Array.from(selectedRecordIds);
    const prevFlagged = [...localFlagged];
    const prevQuarantine = [...localQuarantine];

    // Optimistically remove all selected records from local state
    if (activeSubTab === 'flagged') {
      setLocalFlagged(prev => prev.filter(r => !selectedRecordIds.has(r.id)));
    } else {
      setLocalQuarantine(prev => prev.filter(r => !selectedRecordIds.has(r.id)));
    }

    // Clear selection state
    setSelectedRecordIds(new Set());

    try {
      // Fire requests in parallel using Promise.allSettled
      const promises = idsToProcess.map(recordId => {
        const payload = {
          record_id: recordId,
          source_table: activeSubTab === 'flagged' ? 'flagged_records' : 'quarantine_records',
          action: action,
          reviewer: 'Human Reviewer'
        };
        return axios.post(`${API_BASE_URL}/review/submit`, payload);
      });

      const results = await Promise.allSettled(promises);

      const failedIds = [];
      results.forEach((res, index) => {
        if (res.status === 'rejected') {
          failedIds.push(idsToProcess[index]);
        }
      });

      if (failedIds.length > 0) {
        // Rollback only the failed records
        const failedRecords = (activeSubTab === 'flagged' ? prevFlagged : prevQuarantine).filter(r => failedIds.includes(r.id));
        if (activeSubTab === 'flagged') {
          setLocalFlagged(prev => [...prev, ...failedRecords]);
        } else {
          setLocalQuarantine(prev => [...prev, ...failedRecords]);
        }

        const successCount = idsToProcess.length - failedIds.length;
        if (successCount > 0) {
          addToast(`${successCount} record(s) ${action === 'approve' ? 'approved' : 'discarded'} successfully. ${failedIds.length} failed and restored.`, 'error');
        } else {
          addToast(`Failed to ${action === 'approve' ? 'approve' : 'discard'} ${failedIds.length} record(s) — restored to list.`, 'error');
        }
      } else {
        // All succeeded
        addToast(`${idsToProcess.length} record(s) ${action === 'approve' ? 'approved' : 'discarded'} successfully.`, 'success');
      }

      if (fetchData) await fetchData();
    } catch (err) {
      setLocalFlagged(prevFlagged);
      setLocalQuarantine(prevQuarantine);
      addToast(`Error dispatching bulk action: ${err.message}`, 'error');
    } finally {
      setBulkSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ShieldCheck className="text-brand-600" />
            Human Verification Center
          </h2>
          <p className="text-slate-500 text-sm">Review, correct, and promote records marked as suspicious or incomplete by the AI layer.</p>
        </div>
      </div>

      {/* Sticky Tab Selector + Sort Selector */}
      <div className="sticky top-[73px] z-40 bg-slate-50/95 backdrop-blur-md py-3 px-4 -mx-4 sm:-mx-6 sm:px-6 border-b border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xs">
        {/* Sub-tabs toggler */}
        <div className="flex bg-white p-1 rounded-xl border border-slate-200 w-full sm:w-auto shadow-sm">
          <button
            onClick={() => { setActiveSubTab('flagged'); setEditingRecordId(null); }}
            className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer ${
              activeSubTab === 'flagged'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-100'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Flagged Records ({localFlagged.filter(r => r.status === 'pending').length})
          </button>
          <button
            onClick={() => { setActiveSubTab('quarantine'); setEditingRecordId(null); }}
            className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer ${
              activeSubTab === 'quarantine'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-100'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Quarantine Pool ({localQuarantine.filter(r => r.status === 'pending').length})
          </button>
        </div>

        {/* Bulk select check & Sort Controls */}
        <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
          {sortedRecords.length > 0 && (
            <label className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm text-xs font-bold text-slate-500 cursor-pointer hover:border-slate-300 transition-colors select-none">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-slate-350 text-brand-600 focus:ring-brand-500 cursor-pointer"
              />
              Select All ({sortedRecords.length})
            </label>
          )}

          <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-sm w-full sm:w-auto">
            <span className="text-[10px] font-extrabold text-slate-400 pl-1.5 uppercase tracking-wider whitespace-nowrap">Sort by:</span>
            <CustomDropdown
              value={sortKey}
              onChange={setSortKey}
              options={sortOptions}
              className="w-full sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* Main Review queue listing */}
      <div ref={parentRef} className="max-h-[72vh] overflow-auto px-1">
        {sortedRecords.length > 0 ? (
          <div
            style={{
              height: `${totalSize}px`,
              width: '100%',
              position: 'relative'
            }}
          >
            {virtualRows.map((virtualRow) => {
              const rec = sortedRecords[virtualRow.index];
            const isEditing = editingRecordId === rec.id;
            const flags = rec.flags || (rec.partial_clean?.flags) || [];
            const confidence = rec.confidence_score || 0.0;
            const raw = rec.raw_data || {};

            const radius = 10;
            const strokeWidth = 2.5;
            const circumference = 2 * Math.PI * radius;
            const strokeDashoffset = circumference - (confidence * circumference);
            const strokeColor = confidence >= 0.70 ? '#d97706' : '#dc2626';

            return (
              <div
                key={rec.id}
                ref={rowVirtualizer.measureElement}
                data-index={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                  paddingBottom: '16px'
                }}
              >
                <div 
                  className={`glass-card p-6 rounded-2xl border transition-all duration-300 ${
                    isEditing ? 'border-brand-500 ring-4 ring-brand-50 shadow-lg' : 'hover:border-slate-300'
                  }`}
                >
                {/* Header: Flags & Confidence */}
                <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-100 pb-4 mb-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedRecordIds.has(rec.id)}
                      onChange={() => toggleSelectRecord(rec.id)}
                      className="h-4 w-4 rounded border-slate-350 text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                    <span className={`h-2.5 w-2.5 rounded-full ${activeSubTab === 'flagged' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500 animate-pulse'}`}></span>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Record ID: {rec.id.slice(0, 8)}</span>
                    {flags.map((flag, idx) => (
                      <span key={idx} className="bg-slate-50 text-slate-500 border border-slate-200 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                        {flag.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-150">
                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 uppercase tracking-wide block font-extrabold">AI Confidence</span>
                        <span className={`text-xs font-mono font-extrabold block ${
                          confidence >= 0.70 ? 'text-amber-600' : 'text-rose-600'
                        }`}>{(confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div className="relative flex items-center justify-center w-7 h-7">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle
                            cx="14"
                            cy="14"
                            r={radius}
                            stroke="#e2e8f0"
                            strokeWidth={strokeWidth}
                            fill="transparent"
                          />
                          <circle
                            cx="14"
                            cy="14"
                            r={radius}
                            stroke={strokeColor}
                            strokeWidth={strokeWidth}
                            fill="transparent"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            className="transition-all duration-500 ease-out"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Grid comparing original vs editable/clean */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column: Original Unstructured CSV Raw Input */}
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                      <Info size={14} className="text-slate-300" />
                      Original Input (Raw Data)
                    </h4>
                    
                    <div className="space-y-3.5 text-xs">
                      <div>
                        <span className="text-slate-400 block font-bold uppercase text-[9px] tracking-tight">Ward/Area Specified</span>
                        <span className="text-slate-700 font-bold bg-white px-2.5 py-1.5 rounded-lg inline-block mt-1 border border-slate-100 shadow-sm min-w-[120px]">
                          {raw["Ward/Area"] || <em className="text-slate-300 font-normal">empty</em>}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block font-bold uppercase text-[9px] tracking-tight">Complaint Details</span>
                        <span className="text-slate-700 block bg-white p-3 rounded-lg mt-1 leading-relaxed border border-slate-100 shadow-sm font-medium italic">
                          "{raw["Complaint Details"] || <em className="text-slate-300 font-normal">empty</em>}"
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-slate-400 block font-bold uppercase text-[9px] tracking-tight">Reporter Phone</span>
                          <span className="text-slate-600 font-mono bg-white px-2 py-1 rounded inline-block mt-1 border border-slate-100">
                            {raw["Reporter Phone"] || <em className="text-slate-300 font-normal">empty</em>}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-bold uppercase text-[9px] tracking-tight">Pincode</span>
                          <span className="text-slate-600 font-mono bg-white px-2 py-1 rounded inline-block mt-1 border border-slate-100">
                            {raw["Pincode"] || <em className="text-slate-300 font-normal">empty</em>}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: AI Proposed Cleaned Input (Editable) */}
                  <div className="bg-brand-50/20 p-4 rounded-xl border border-brand-100/50">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-[10px] font-bold text-brand-700 uppercase tracking-widest flex items-center gap-1.5">
                        <Edit3 size={14} />
                        AI Proposed Cleaned Format
                      </h4>
                      {!isEditing && (
                        <button
                          onClick={() => startEditing(rec)}
                          className="text-[10px] text-brand-600 hover:text-brand-700 flex items-center gap-1 font-bold uppercase tracking-wider transition bg-white px-2.5 py-1 rounded-lg border border-brand-100 shadow-sm"
                        >
                          <Edit3 size={10} />
                          Unlock Fields
                        </button>
                      )}
                    </div>

                    {isEditing ? (
                      /* Editing Form Inputs */
                      <div className="space-y-4 text-xs">
                        <div>
                          <label className="text-slate-500 block font-bold uppercase text-[9px] mb-1">Standardized Ward</label>
                          <CustomDropdown
                            value={editWard}
                            onChange={setEditWard}
                            options={wardDropdownOptions}
                            className="w-full"
                          />
                        </div>

                        <div>
                          <label className="text-slate-500 block font-bold uppercase text-[9px] mb-1">Description (Verified)</label>
                          <textarea
                            rows={3}
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            className="w-full bg-white text-slate-900 rounded-lg border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none resize-none leading-relaxed font-medium"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-slate-500 block font-bold uppercase text-[9px] mb-1">Category</label>
                            <CustomDropdown
                              value={editCategory}
                              onChange={setEditCategory}
                              options={categoryDropdownOptions}
                              className="w-full"
                            />
                          </div>
                          <div>
                            <label className="text-slate-500 block font-bold uppercase text-[9px] mb-1">Severity</label>
                            <CustomDropdown
                              value={editSeverity}
                              onChange={setEditSeverity}
                              options={severityDropdownOptions}
                              className="w-full"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-slate-500 block font-bold uppercase text-[9px] mb-1">Phone</label>
                            <input
                              type="text"
                              value={editPhone}
                              onChange={(e) => setEditPhone(e.target.value)}
                              placeholder="9876543210"
                              className="w-full bg-white text-slate-900 rounded-lg border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none font-mono font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-slate-500 block font-bold uppercase text-[9px] mb-1">Pincode</label>
                            <input
                              type="text"
                              value={editPincode}
                              onChange={(e) => setEditPincode(e.target.value)}
                              placeholder="380015"
                              className="w-full bg-white text-slate-900 rounded-lg border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none font-mono font-bold"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Standby Proposed values display */
                      <div className="space-y-4 text-xs leading-relaxed">
                        <div className="flex items-center gap-2">
                          <MapPin size={16} className={rec.partial_clean?.ward_name && rec.partial_clean.ward_name !== 'Unresolved' ? "text-brand-600" : "text-amber-500"} />
                          <span className="text-slate-400 font-bold uppercase text-[9px] tracking-tight">Resolved Ward:</span>
                          {rec.partial_clean?.ward_name && rec.partial_clean.ward_name !== 'Unresolved' ? (
                            <span className="font-bold text-brand-800 bg-brand-100 border border-brand-200 px-3 py-1 rounded-full">
                              {rec.partial_clean.ward_name}
                            </span>
                          ) : (
                            <span className="font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                              Unresolved
                            </span>
                          )}
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-brand-50/60 shadow-sm">
                          <span className="text-slate-400 block font-bold uppercase text-[9px] mb-1.5 tracking-tight">Standardized Text Proposal:</span>
                          <p className="text-slate-700 font-medium italic">"{rec.partial_clean?.description || "No proposal available"}"</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-slate-400 font-bold uppercase text-[9px] tracking-tight">Classification:</span>
                            <span className="text-slate-900 font-bold">{rec.partial_clean?.complaint_category || 'Other'}</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-slate-400 font-bold uppercase text-[9px] tracking-tight">Priority Assessment:</span>
                            <span className={`font-bold ${
                              rec.partial_clean?.severity === 'High' ? 'text-rose-600' :
                              rec.partial_clean?.severity === 'Medium' ? 'text-amber-600' : 'text-emerald-600'
                            }`}>{rec.partial_clean?.severity || 'Medium'}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 font-mono">
                          <div className="flex items-center gap-2">
                            <Phone size={12} className="text-slate-400" />
                            <span className="text-slate-600 font-bold">{rec.partial_clean?.phone || 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 font-bold uppercase text-[9px]">PIN:</span>
                            <span className="text-slate-600 font-bold">{rec.partial_clean?.postal_code || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Submitactions footer */}
                <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-slate-100">
                  <button
                    onClick={() => handleReviewAction(rec.id, 'reject')}
                    disabled={submittingRecordId !== null}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-100 hover:border-rose-100 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submittingRecordId === rec.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                    Discard
                  </button>

                  {isEditing ? (
                    <button
                      onClick={() => handleReviewAction(rec.id, 'approve')}
                      disabled={submittingRecordId !== null}
                      className="flex items-center gap-1.5 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-widest transition-all duration-300 shadow-md shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submittingRecordId === rec.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <CheckCircle size={14} />
                      )}
                      Verify & Commit
                    </button>
                  ) : (
                    <button
                      onClick={() => handleReviewAction(rec.id, 'approve')}
                      disabled={submittingRecordId !== null}
                      className="flex items-center gap-1.5 px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold uppercase tracking-widest transition-all duration-300 shadow-md shadow-brand-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submittingRecordId === rec.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <ShieldCheck size={14} />
                      )}
                      Approve AI Output
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
        ) : (
          <div className="bg-white py-20 text-center rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center items-center space-y-4">
            <div className="bg-emerald-50 p-4 rounded-full">
              <CheckCircle size={48} className="text-emerald-500" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-slate-900 tracking-tight">No Pending Verification Items</h4>
              <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto font-medium">
                The review pool for this category is currently empty. All records have been processed.
              </p>
            </div>
          </div>
        )}
      </div>
      {/* Toast Notifications */}
      <div className="fixed top-6 right-6 z-100 flex flex-col gap-3 pointer-events-none max-w-sm w-full">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-lg border flex items-center justify-between gap-3 animate-in slide-in-from-right-10 fade-in duration-300 ${
              toast.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <span className="text-xs font-bold">{toast.message}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Bulk Action Floating Bar */}
      {selectedRecordIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 bg-white border border-slate-200 shadow-2xl rounded-2xl p-4 flex items-center justify-between gap-6 min-w-[320px] md:min-w-[480px] animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-brand-600 animate-ping"></span>
            <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
              {selectedRecordIds.size} Record{selectedRecordIds.size > 1 ? 's' : ''} Selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkAction('approve')}
              disabled={bulkSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-brand-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {bulkSubmitting ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <ShieldCheck size={12} />
              )}
              Approve All
            </button>
            <button
              onClick={() => handleBulkAction('reject')}
              disabled={bulkSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {bulkSubmitting ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Trash2 size={12} />
              )}
              Discard All
            </button>
            <button
              onClick={() => setSelectedRecordIds(new Set())}
              disabled={bulkSubmitting}
              className="text-xs font-bold text-slate-400 hover:text-slate-650 px-2 py-1 rounded-lg transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
