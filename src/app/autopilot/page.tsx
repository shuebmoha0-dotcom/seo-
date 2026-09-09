"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/Sidebar';
import { 
  Bot, Play, Pause, Trash2, Clock, Calendar, CheckCircle2, 
  AlertCircle, ArrowRight, Activity, Plus, Globe, Loader2, 
  Sparkles, Zap, RefreshCw, Check, CheckCircle, ShieldCheck
} from 'lucide-react';
import { useWebsite } from '@/lib/context/WebsiteContext';
import { WebsiteFavicon } from '@/components/WebsiteFavicon';

export default function AutopilotPage() {
  const { currentWebsite, openAddModal } = useWebsite();
  const [prompt, setPrompt] = useState('');
  const [frequencyOverride, setFrequencyOverride] = useState('auto');
  const [executionMode, setExecutionMode] = useState<'auto' | 'immediate' | 'recurring'>('auto');
  const [isParsing, setIsParsing] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [executions, setExecutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<{ message: string; ok: boolean } | null>(null);
  const [lastAction, setLastAction] = useState<{
    intent_type: string;
    action_type: string;
    summary: string;
    link_url?: string;
    link_label?: string;
  } | null>(null);

  const fetchTasks = async (silent = false) => {
    if (!currentWebsite) {
      setTasks([]);
      setExecutions([]);
      setLoading(false);
      return;
    }

    try {
      if (!silent) setLoading(true);
      const res = await fetch(`/api/autopilot/tasks?website_id=${currentWebsite.id}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
        setExecutions(data.executions || []);
      }
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [currentWebsite?.id]);

  // Polling watchdog: poll every 3 seconds if any task is executing in the background
  useEffect(() => {
    const hasRunning = tasks.some(t => t.last_run?.includes('Running') || t.last_run?.includes('Never')) || runningTaskId !== null;
    if (!hasRunning) return;

    const timer = setInterval(() => {
      fetchTasks(true);
    }, 3500);

    return () => clearInterval(timer);
  }, [tasks, runningTaskId]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !currentWebsite) return;
    
    setIsParsing(true);
    setStatusFeedback(null);
    setLastAction(null);
    try {
      const response = await fetch('/api/autopilot/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website_id: currentWebsite.id,
          prompt: prompt.trim(),
          frequency_override: frequencyOverride,
          mode_override: executionMode,
        })
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        setPrompt('');
        if (data.intent_type === 'immediate_action') {
          setLastAction({
            intent_type: data.intent_type,
            action_type: data.action_type,
            summary: data.summary,
            link_url: data.link_url,
            link_label: data.link_label,
          });
          setStatusFeedback({ 
            message: data.summary, 
            ok: true 
          });
        } else {
          setLastAction(null);
          setStatusFeedback({ 
            message: data.summary || 'Task scheduled successfully! Initial autonomous cycle is running in the background.', 
            ok: true 
          });
        }
        await fetchTasks(false);
      } else {
        setStatusFeedback({ message: data.error || 'Failed to process instruction.', ok: false });
      }
    } catch (err: any) {
      console.error(err);
      setStatusFeedback({ message: 'Network error while processing instruction.', ok: false });
    } finally {
      setIsParsing(false);
    }
  };

  const handleRunTaskNow = async (taskId: string) => {
    if (!currentWebsite) return;
    setRunningTaskId(taskId);
    setStatusFeedback(null);

    try {
      const res = await fetch('/api/autopilot/tasks/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, website_id: currentWebsite.id })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatusFeedback({ 
          message: data.summary || 'Task executed successfully!', 
          ok: true 
        });
        await fetchTasks(false);
      } else {
        setStatusFeedback({ 
          message: data.error || 'Execution failed', 
          ok: false 
        });
      }
    } catch (err: any) {
      setStatusFeedback({ 
        message: 'Task execution request failed', 
        ok: false 
      });
    } finally {
      setRunningTaskId(null);
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      await fetch('/api/autopilot/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: id, status: nextStatus })
      });
      setTasks(tasks.map(t => t.id === id ? { ...t, status: nextStatus } : t));
    } catch (err) {
      console.error(err);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await fetch(`/api/autopilot/tasks?task_id=${id}`, {
        method: 'DELETE'
      });
      setTasks(tasks.filter(t => t.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const PRESET_IDEAS = [
    { label: "✍️ Write an article on AI workflows", text: `Write an in-depth article about AI workflows and automation for ${currentWebsite?.domain || 'my site'}` },
    { label: "🔍 Discover high-intent keywords", text: `Discover high-converting topical keyword clusters for ${currentWebsite?.domain || 'my site'}` },
    { label: "🛠️ Audit technical SEO & crawl", text: `Audit technical SEO, indexability, and crawl errors` },
    { label: "🕒 Schedule weekly article", text: `Every Monday at 09:00 publish an SEO article for ${currentWebsite?.domain || 'my site'}` },
  ];

  return (
    <div className="flex min-h-screen bg-white text-neutral-900 font-sans selection:bg-indigo-500/20">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="max-w-[1400px] w-full mx-auto p-8 space-y-8">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
                <span>Autonomous Operations</span>
                <span>&gt;</span>
                <span className="text-neutral-700 font-medium">Autopilot Scheduler</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900 flex items-center gap-2.5">
                Continuous Autonomous Operations
              </h1>
              <p className="text-xs text-neutral-500 mt-0.5">
                {currentWebsite
                  ? `Autonomous agent scheduler running 24/7 SEO optimizations for ${currentWebsite.domain}.`
                  : "Connect your website to schedule autonomous tasks."}
              </p>
            </div>

            {currentWebsite && (
              <div className="flex items-center gap-2 bg-neutral-50 border border-neutral-200/90 pl-2 pr-3 py-1.5 rounded-xl self-start md:self-auto shadow-2xs">
                <WebsiteFavicon domain={currentWebsite.domain} className="w-5 h-5 rounded-md" size={32} />
                <span className="text-xs font-bold text-neutral-900">{currentWebsite.domain}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-1" />
              </div>
            )}
          </div>

          {/* Feedback Banner */}
          {statusFeedback && (
            <div className={`p-4 rounded-xl text-xs flex items-center justify-between border transition-all animate-fadeIn ${
              statusFeedback.ok 
                ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                : "bg-red-50 text-red-700 border-red-200"
            }`}>
              <div className="flex items-center gap-2">
                {statusFeedback.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
                <span className="font-semibold leading-relaxed">{statusFeedback.message}</span>
              </div>
              <button onClick={() => setStatusFeedback(null)} className="text-neutral-400 hover:text-neutral-600 text-sm font-bold ml-4">✕</button>
            </div>
          )}

          {/* ── STATE 1: NO WEBSITE CONNECTED ── */}
          {!currentWebsite ? (
            <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-3xl space-y-4 max-w-lg mx-auto mt-8 shadow-xs">
              <div className="w-12 h-12 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-center mx-auto text-indigo-600">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">Connect your website to get started</h3>
                <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                  Autopilot schedules recurrent audits, content generation, and ranking checks against your connected website.
                </p>
              </div>
              <button
                onClick={openAddModal}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors inline-flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Connect Website</span>
              </button>
            </div>
          ) : (
            <>
              {/* Last Action Executed Banner */}
              {lastAction && (
                <div className="bg-indigo-50/90 border border-indigo-200 rounded-2xl p-5 shadow-sm space-y-2 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="bg-indigo-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                        {lastAction.intent_type === 'immediate_action' ? '⚡ Immediate Action Launched' : '🕒 Schedule Created'}
                      </span>
                      <span className="text-xs font-bold text-neutral-900 capitalize">
                        {lastAction.action_type?.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <button onClick={() => setLastAction(null)} className="text-neutral-400 hover:text-neutral-600 text-xs font-bold">✕</button>
                  </div>
                  <p className="text-xs text-neutral-700 leading-relaxed font-medium">{lastAction.summary}</p>
                  {lastAction.link_url && (
                    <div className="pt-1">
                      <Link
                        href={lastAction.link_url}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors bg-white px-3 py-1.5 rounded-lg border border-indigo-200 shadow-2xs"
                      >
                        <span>{lastAction.link_label || 'View Generated Output'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* Natural Language Task Input */}
              <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-neutral-900">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>Give Autopilot a Natural Language Instruction</span>
                  </div>

                  {/* Mode Selector */}
                  <div className="flex items-center gap-1 bg-white border border-neutral-200 rounded-xl p-1 text-[11px] font-semibold shadow-2xs">
                    {[
                      { id: 'auto', label: '⚡ Auto-Detect' },
                      { id: 'immediate', label: '🚀 Run Once Now' },
                      { id: 'recurring', label: '🕒 Schedule' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setExecutionMode(m.id as any)}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          executionMode === m.id
                            ? "bg-indigo-600 text-white shadow-2xs"
                            : "text-neutral-600 hover:text-neutral-900"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleCreateTask} className="space-y-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder={
                        executionMode === 'immediate'
                          ? `e.g. "Write an article about 7 best email warm-up strategies for ${currentWebsite.domain}"`
                          : executionMode === 'recurring'
                          ? `e.g. "Every Monday at 09:00 publish an article and check keywords"`
                          : `e.g. "Write an article about AI workflows" OR "Every Monday at 9am audit my site"`
                      }
                      className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-3.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
                    />
                  </div>

                  {/* Preset Quick Chips */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[11px] font-semibold text-neutral-500">Quick ideas:</span>
                    {PRESET_IDEAS.map((idea, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPrompt(idea.text)}
                        className="text-[11px] bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-700 px-2.5 py-1 rounded-lg transition-colors shadow-2xs"
                      >
                        {idea.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2 text-xs">
                      {executionMode !== 'immediate' && (
                        <>
                          <span className="font-semibold text-neutral-600">Frequency:</span>
                          <select
                            value={frequencyOverride}
                            onChange={(e) => setFrequencyOverride(e.target.value)}
                            className="bg-white border border-neutral-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-neutral-700 focus:outline-none focus:border-indigo-500 shadow-2xs"
                          >
                            <option value="auto">Auto-detect from prompt</option>
                            <option value="daily">Every Day</option>
                            <option value="weekly">Every Week</option>
                            <option value="monthly">Every Month</option>
                          </select>
                        </>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isParsing || !prompt.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                      {isParsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      <span>
                        {isParsing
                          ? "Processing with AI..."
                          : executionMode === 'immediate'
                          ? "Execute Action Now"
                          : executionMode === 'recurring'
                          ? "Schedule Recurring Task"
                          : "Run / Schedule with AI"}
                      </span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Tasks List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    Active Scheduled Tasks ({tasks.length})
                  </h3>
                  <button
                    onClick={() => fetchTasks(false)}
                    disabled={loading}
                    className="text-xs text-neutral-500 hover:text-neutral-800 flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                    <span>Refresh</span>
                  </button>
                </div>

                {tasks.length === 0 && !loading ? (
                  <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-3xl space-y-3 max-w-lg mx-auto shadow-2xs">
                    <Bot className="w-8 h-8 text-neutral-400 mx-auto" />
                    <h3 className="text-base font-bold text-neutral-900">No Scheduled Tasks Yet</h3>
                    <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                      Use the prompt box above to instruct the autonomous agents to perform recurring SEO tasks for {currentWebsite.domain}.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs space-y-3 hover:shadow-sm transition-shadow flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase flex items-center gap-1.5 ${
                              task.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-neutral-100 text-neutral-600 border-neutral-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${task.status === 'active' ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                              {task.status}
                            </span>
                            <span className="text-[10px] text-neutral-400 font-mono">
                              {task.schedule?.frequency || 'daily'} @ {task.schedule?.time || '09:00'}
                            </span>
                          </div>

                          <h4 className="font-bold text-sm text-neutral-900 leading-snug">{task.goal}</h4>
                          <p className="text-xs text-neutral-500 leading-relaxed line-clamp-2">
                            {task.natural_language_instruction || task.goal}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-neutral-100 text-xs">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-neutral-500 font-medium">
                              Last run: <strong className="text-neutral-800">{task.last_run}</strong>
                            </span>
                            <span className="text-[11px] text-neutral-600 font-medium">Next run: {task.next_run}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Run Immediately Action */}
                            <button
                              onClick={() => handleRunTaskNow(task.id)}
                              disabled={runningTaskId === task.id}
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-[11px] flex items-center gap-1.5 transition-colors disabled:opacity-50"
                              title="Execute this autonomous task immediately"
                            >
                              {runningTaskId === task.id ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                                  <span>Running...</span>
                                </>
                              ) : (
                                <>
                                  <Zap className="w-3 h-3 text-indigo-600" />
                                  <span>Run Now</span>
                                </>
                              )}
                            </button>

                            {/* Pause / Resume */}
                            <button
                              onClick={() => toggleStatus(task.id, task.status)}
                              className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-600 transition-colors"
                              title={task.status === 'active' ? "Pause Task" : "Resume Task"}
                            >
                              {task.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => deleteTask(task.id)}
                              className="p-1.5 hover:bg-red-50 rounded-lg text-red-600 transition-colors"
                              title="Delete Task"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Real Execution History Log */}
              {executions.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-neutral-200/80">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-600" />
                      Recent Autonomous Executions ({executions.length})
                    </h3>
                  </div>

                  <div className="bg-white border border-neutral-200 rounded-2xl divide-y divide-neutral-100 overflow-hidden shadow-2xs">
                    {executions.map((exec) => (
                      <div key={exec.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs hover:bg-neutral-50/60 transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md text-[10px] uppercase flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              {exec.status}
                            </span>
                            <span className="text-neutral-400 font-mono text-[10px]">
                              {exec.completed_at ? new Date(exec.completed_at).toLocaleString() : new Date(exec.started_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-neutral-700 font-medium leading-relaxed">
                            {exec.result_summary || "Autonomous optimization run executed and logged."}
                          </p>
                        </div>
                        <div className="shrink-0 flex items-center gap-2 text-[11px] text-neutral-500">
                          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Auto-Verified</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </main>
    </div>
  );
}
