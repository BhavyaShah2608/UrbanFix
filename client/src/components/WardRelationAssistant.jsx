/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { 
  Bot, Loader2, MessageCircle, Send, ChevronDown 
} from 'lucide-react';
import { renderChatMarkdown } from './DashboardUtils';

function CustomDropdown({ value, onChange, options, className = "" }) {
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
          className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer shadow-sm outline-none"
        >
          <span>{selectedOption?.label || selectedOption?.value}</span>
          <ChevronDown size={12} className={`text-slate-455 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-full min-w-[150px] rounded-lg bg-white border border-slate-200/80 shadow-md ring-1 ring-black/5 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200 origin-top-right">
          <div className="py-0.5 max-h-48 overflow-y-auto scrollbar-thin">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer block ${
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

export default function WardRelationAssistant({
  iotSewerReadings = [],
  API_BASE_URL
}) {
  const [chatWardA, setChatWardA] = useState("");
  const [chatWardB, setChatWardB] = useState("");
  const [iotChatInput, setIotChatInput] = useState("");
  const [iotChatLoading, setIotChatLoading] = useState(false);
  const [iotChatError, setIotChatError] = useState("");
  const [iotChatMode, setIotChatMode] = useState("compare"); // "compare", "general", "predictive"
  const [iotChatMessages, setIotChatMessages] = useState([
    {
      role: "assistant",
      content: "Select two wards and ask how their drainage and sewage conditions affect each other. I will stay focused on flow direction, blockage propagation, chemical loads, pipe condition, and crew actions."
    }
  ]);

  const modeOptions = [
    { value: 'compare', label: 'Compare Wards' },
    { value: 'general', label: 'General Q&A' },
    { value: 'predictive', label: 'Predictive Forecast' }
  ];

  const wardOptions = useMemo(() => {
    const uniqueNames = Array.from(new Set(iotSewerReadings.map(r => r.ward_name))).sort();
    return uniqueNames.map(name => ({ value: name, label: name }));
  }, [iotSewerReadings]);

  const handleModeChange = (newMode) => {
    setIotChatMode(newMode);
    setIotChatError("");
    if (newMode === "general") {
      setIotChatMessages([
        {
          role: "assistant",
          content: "Ask a general query about municipal sewerage, drainage, pipeline networks, fluid dynamics (Manning's Equation), or complaint statistics in Ahmedabad. I will decline vague or unrelated requests to maintain high operational precision."
        }
      ]);
    } else if (newMode === "predictive") {
      setIotChatMessages([
        {
          role: "assistant",
          content: "Ask about monsoon failure risk mappings, statistical GWR localized risk forecasts, OLS models, or pre-monsoon prevention guides."
        }
      ]);
    } else {
      setIotChatMessages([
        {
          role: "assistant",
          content: "Select two wards and ask how their drainage and sewage conditions affect each other. I will stay focused on flow direction, blockage propagation, chemical loads, pipe condition, and crew actions."
        }
      ]);
    }
  };

  const hasIotReadings = iotSewerReadings.length > 0;

  // Auto-initialize selected chatbot wards
  useEffect(() => {
    if (!hasIotReadings) return;

    const wards = iotSewerReadings.map((record) => record.ward_name).filter(Boolean);
    if (!wards.length) return;

    const firstWard = wards[0];
    const priorityWard = iotSewerReadings.find((record) => record.state_of_sewage !== 'normal')?.ward_name || wards[1] || firstWard;

    if (!chatWardA || !wards.includes(chatWardA)) {
      setChatWardA(firstWard);
    }
    if (!chatWardB || !wards.includes(chatWardB) || chatWardB === firstWard) {
      setChatWardB(priorityWard !== firstWard ? priorityWard : (wards[1] || firstWard));
    }
  }, [hasIotReadings, iotSewerReadings, chatWardA, chatWardB]);

  const handleIotChatSubmit = async (event, quickPrompt = "") => {
    event?.preventDefault();
    setIotChatError("");

    const mode = iotChatMode || "compare";
    const defaultMsg = mode === "general" 
      ? "What is the Manning gravity flow equation?"
      : mode === "predictive"
      ? "Which wards are likely to have sewer issues next monsoon based on GWR outputs?"
      : "Compare these two wards and explain how drainage and sewage conditions in one can affect the other.";
      
    const message = (quickPrompt || iotChatInput).trim() || defaultMsg;

    if (mode === "compare") {
      if (!chatWardA || !chatWardB) {
        setIotChatError("Load telemetry first, then select two wards.");
        return;
      }
      if (chatWardA === chatWardB) {
        setIotChatError("Choose two different wards for a relationship analysis.");
        return;
      }
    } else {
      if (!message) {
        setIotChatError("Please enter a question or query first.");
        return;
      }
    }

    const userMessage = { role: "user", content: message };
    const nextMessages = [...iotChatMessages, userMessage];
    setIotChatMessages(nextMessages);
    setIotChatInput("");
    setIotChatLoading(true);

    try {
      const res = await axios.post(`${API_BASE_URL}/iot/chat`, {
        mode,
        ward_a: mode === "compare" ? chatWardA : "",
        ward_b: mode === "compare" ? chatWardB : "",
        message,
        history: iotChatMessages
          .filter((item) => item.role === "user" || item.role === "assistant")
          .slice(-6)
      });

      let sourceLabel = "local engineering fallback";
      if (res.data?.source === "groq_llama3") {
        sourceLabel = "Groq LLaMA 3.3";
      } else if (res.data?.source === "rejection_filter") {
        sourceLabel = "Rejection Filter";
      } else if (res.data?.source === "fallback_spatial_hydrological_general") {
        sourceLabel = "Local Engineering Fallback";
      } else if (res.data?.source === "fallback_predictive_monsoon") {
        sourceLabel = "GWR Monsoon Fallback";
      } else if (res.data?.source === "fallback_anomaly_radar") {
        sourceLabel = "Anomaly Radar Fallback";
      }

      setIotChatMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: res.data?.message || "I could not produce a response for your query.",
          source: sourceLabel,
          topology: res.data?.topology
        }
      ]);
    } catch (err) {
      console.error("IoT ward relationship chat failed:", err);
      setIotChatError(err.response?.data?.detail || "Unable to reach the ward relationship assistant right now.");
      setIotChatMessages(nextMessages);
    } finally {
      setIotChatLoading(false);
    }
  };

  return (
    <div className="glass-card p-5 rounded-2xl">
      <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
            <Bot className="text-brand-600 animate-pulse" size={18} />
            Municipal Sewerage Intelligence Hub
          </h3>
          <p className="text-[11px] text-slate-500 font-medium mt-1">
            {iotChatMode === 'compare' && "Groq-powered flow direction and load analysis between selected wards."}
            {iotChatMode === 'general' && "Ask any infrastructure, hydraulic, chemical, or regression question."}
            {iotChatMode === 'predictive' && "Monsoon failure risk mappings and statistical GWR localized risk forecasts."}
          </p>
        </div>
        <div className="flex items-center">
          <CustomDropdown
            value={iotChatMode}
            onChange={handleModeChange}
            options={modeOptions}
          />
        </div>
      </div>

      {iotChatMode === 'compare' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Ward A</span>
            <CustomDropdown
              value={chatWardA}
              onChange={setChatWardA}
              options={wardOptions}
              className="w-full"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Ward B</span>
            <CustomDropdown
              value={chatWardB}
              onChange={setChatWardB}
              options={wardOptions}
              className="w-full"
            />
          </div>
        </div>
      )}

      <div className="h-72 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-3">
        {iotChatMessages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`rounded-xl p-3 border text-xs ${
              message.role === "user"
                ? "ml-6 bg-brand-600 text-white border-brand-500"
                : "mr-3 bg-white text-slate-700 border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className={`font-extrabold uppercase tracking-wider text-[9px] ${
                message.role === "user" ? "text-brand-100" : "text-slate-400"
              }`}>
                {message.role === "user" ? "You" : "Hydraulic Assistant"}
              </span>
              {message.source && (
                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded text-[10px]">
                  {message.source}
                </span>
              )}
            </div>
            {message.role === "user" ? (
              <p className="text-[11px] leading-relaxed text-white">{message.content}</p>
            ) : (
              <div className="leading-relaxed">
                {renderChatMarkdown(message.content, `iot-chat-${index}`)}
              </div>
            )}
          </div>
        ))}
        {iotChatLoading && (
          <div className="mr-3 bg-white text-slate-500 border border-slate-200 rounded-xl p-3 flex items-center gap-2 text-[11px] font-bold">
            <Loader2 size={14} className="animate-spin text-brand-600" />
            {iotChatMode === 'general' 
              ? "Analyzing your general infrastructure query..." 
              : iotChatMode === 'predictive'
              ? "Generating GWR predictive risk forecast..."
              : "Analyzing flow paths, load, and blockage propagation..."}
          </div>
        )}
      </div>

      {iotChatError && (
        <div className="mt-3 bg-rose-50 border border-rose-100 text-rose-700 text-[11px] font-semibold rounded-xl p-2.5">
          {iotChatError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 mt-3">
        {iotChatMode === 'general' ? (
          [
            "What is the Manning gravity flow equation?",
            "Explain GWR regression in Ahmedabad.",
            "How does DBSCAN locate blockage hotspots?"
          ].map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={(event) => handleIotChatSubmit(event, prompt)}
              disabled={iotChatLoading}
              className="text-left px-3 py-2 rounded-lg bg-white hover:bg-brand-50 border border-slate-200 hover:border-brand-100 text-[11px] font-bold text-slate-600 hover:text-brand-700 transition-colors disabled:opacity-60 font-sans"
            >
              {prompt}
            </button>
          ))
        ) : iotChatMode === 'predictive' ? (
          [
            "Which wards are likely to have sewer issues next monsoon based on GWR?",
            "Explain GWR regression risk and OLS coefficient drift.",
            "Detail the pre-monsoon preventive jetting schedule."
          ].map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={(event) => handleIotChatSubmit(event, prompt)}
              disabled={iotChatLoading}
              className="text-left px-3 py-2 rounded-lg bg-white hover:bg-brand-50 border border-slate-200 hover:border-brand-100 text-[11px] font-bold text-slate-600 hover:text-brand-700 transition-colors disabled:opacity-60 font-sans"
            >
              {prompt}
            </button>
          ))
        ) : (
          [
            "Explain how these two wards are connected.",
            `If ${chatWardA || "Ward A"} has a blockage, how does it affect ${chatWardB || "Ward B"}?`,
            `Can Gota affect ${chatWardA || "Ward A"} and ${chatWardB || "Ward B"} together?`
          ].map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={(event) => handleIotChatSubmit(event, prompt)}
              disabled={iotChatLoading || !hasIotReadings}
              className="text-left px-3 py-2 rounded-lg bg-white hover:bg-brand-50 border border-slate-200 hover:border-brand-100 text-[11px] font-bold text-slate-600 hover:text-brand-700 transition-colors disabled:opacity-60 font-sans"
            >
              {prompt}
            </button>
          ))
        )}
      </div>

      <form onSubmit={handleIotChatSubmit} className="mt-3 flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 focus-within:border-brand-300">
          <MessageCircle size={14} className="text-slate-400" />
          <input
            value={iotChatInput}
            onChange={(event) => setIotChatInput(event.target.value)}
            placeholder={
              iotChatMode === 'general'
                ? 'Ask about Manning flow, GWR regression, chemicals, or complaints...'
                : iotChatMode === 'predictive'
                ? 'Ask about GWR monsoon risk predictions, OLS formulas, or desilting guides...'
                : 'Try: "How can Gota affect Navrangpura and Naranpura at the same time?"'
            }
            className="w-full outline-none text-xs font-medium text-slate-700 placeholder:text-slate-400"
            disabled={iotChatLoading}
          />
        </div>
        <button
          type="submit"
          disabled={iotChatLoading || (iotChatMode === 'compare' && !hasIotReadings)}
          className="p-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-100 transition-colors disabled:opacity-60"
          aria-label="Send ward relationship question"
        >
          {iotChatLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </form>
    </div>
  );
}
