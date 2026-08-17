"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Bot, Play, Pause, Trash2, Clock, Calendar, CheckCircle2, AlertCircle, ArrowRight, Activity, Plus, Globe, Loader2, Sparkles } from 'lucide-react';
import { useWebsite } from '@/lib/context/WebsiteContext';

export default function AutopilotPage() {
  const { currentWebsite, openAddModal } = useWebsite();
  const [prompt, setPrompt] = useState('');
  const [frequencyOverride, setFrequencyOverride] = useState('auto');
  const [isParsing, setIsParsing] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    if (!currentWebsite) {
      setTasks([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/autopilot/tasks?website_id=${currentWebsite.id}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [currentWebsite?.id]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !currentWebsite) return;
    
    setIsParsing(true);
    try {
      const response = await fetch('/api/autopilot/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website_id: currentWebsite.id,
          prompt,
          frequency_override: frequencyOverride,
        })
      });
      
      if (response.ok) {
        setPrompt('');
        await fetchTasks();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to create task.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error while scheduling task.');
    } finally {
      setIsParsing(false);
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
                <span className="text-neutral-700">Autopilot Tasks</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
                Continuous Autonomous Operations
              </h1>
              <p className="text-xs text-neutral-500 mt-0.5">
                {currentWebsite
                  ? `Autonomous agent scheduler running SEO optimizations in the background for ${currentWebsite.domain}.`
                  : "Connect your website to schedule autonomous tasks."}
              </p>
            </div>
          </div>

          {/* ── STATE 1: NO WEBSITE CONNECTED ── */}
          {!currentWebsite ? (
            <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-3xl space-y-4 max-w-lg mx-auto mt-8 shadow-sm">
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
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors inline-flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Connect Website</span>
              </button>
            </div>
          ) : (
            <>
              {/* Natural Language Task Input */}
              <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-neutral-900">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>Give Autopilot an SEO Instruction</span>
                </div>

                <form onSubmit={handleCreateTask} className="space-y-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder='e.g. "Research high-intent keywords every Monday and write one draft weekly."'
                      className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-3.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-indigo-500 shadow-sm"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-neutral-600">Frequency:</span>
                      <select
                        value={frequencyOverride}
                        onChange={(e) => setFrequencyOverride(e.target.value)}
                        className="bg-white border border-neutral-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-neutral-700 focus:outline-none focus:border-indigo-500 shadow-sm"
                      >
                        <option value="auto">Auto-detect from prompt</option>
                        <option value="daily">Every Day</option>
                        <option value="weekly">Every Week</option>
                        <option value="monthly">Every Month</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={isParsing || !prompt.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      {isParsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      <span>{isParsing ? "Scheduling Task..." : "Schedule Autopilot Task"}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Tasks List */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  Active Scheduled Tasks ({tasks.length})
                </h3>

                {tasks.length === 0 && !loading ? (
                  <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-3xl space-y-3 max-w-lg mx-auto">
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
                        className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                            task.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-neutral-100 text-neutral-600 border-neutral-200'
                          }`}>
                            {task.status}
                          </span>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            {task.schedule?.frequency || 'daily'} @ {task.schedule?.time || '09:00'}
                          </span>
                        </div>

                        <h4 className="font-bold text-sm text-neutral-900">{task.goal}</h4>
                        <p className="text-xs text-neutral-500 font-mono truncate">{task.natural_language_instruction || task.goal}</p>

                        <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-xs">
                          <span className="text-[11px] text-neutral-400">Next run: {task.next_run}</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => toggleStatus(task.id, task.status)}
                              className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-600"
                              title={task.status === 'active' ? "Pause Task" : "Resume Task"}
                            >
                              {task.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => deleteTask(task.id)}
                              className="p-1.5 hover:bg-red-50 rounded-lg text-red-600"
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
            </>
          )}

        </div>
      </main>
    </div>
  );
}
