"use client";

import React, { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Bot, Play, Pause, Trash2, Clock, Calendar, CheckCircle2, AlertCircle, ArrowRight, Activity, Plus, Globe } from 'lucide-react';
import { useWebsite } from '@/lib/context/WebsiteContext';

export default function AutopilotPage() {
  const { websites, currentWebsite } = useWebsite();
  const [prompt, setPrompt] = useState('');
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string>('');
  const [isParsing, setIsParsing] = useState(false);

  // Default selected website
  const activeSiteId = selectedWebsiteId || currentWebsite?.id || 'default';
  const activeSite = websites.find(w => w.id === activeSiteId) || currentWebsite;

  // Tasks based on the user's requirements
  const [tasks, setTasks] = useState([
    {
      id: 'task_1',
      goal: 'Write one SEO article every day.',
      website_domain: currentWebsite?.domain || 'example.com',
      website_id: activeSiteId,
      schedule: { frequency: 'daily', time: '09:00', timezone: 'UTC' },
      status: 'active',
      last_run: 'Today 09:00',
      next_run: 'Tomorrow 09:00',
      approvals: 1
    },
    {
      id: 'task_2',
      goal: 'Research competitors and analyze SERP.',
      website_domain: currentWebsite?.domain || 'example.com',
      website_id: activeSiteId,
      schedule: { frequency: 'daily', time: '18:00', timezone: 'UTC' },
      status: 'active',
      last_run: 'Yesterday 18:00',
      next_run: 'Today 18:00',
      approvals: 0
    },
  ]);

  const [frequencyOverride, setFrequencyOverride] = useState('auto');

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    
    setIsParsing(true);
    
    try {
      const response = await fetch('/api/autopilot/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      
      const data = await response.json();
      
      if (data.task) {
        // If the user explicitly picked a frequency, override Luna's parsed output
        if (frequencyOverride !== 'auto') {
          data.task.schedule.frequency = frequencyOverride;
        }
        
        setTasks([{
          id: data.task.task_id,
          goal: data.task.goal,
          schedule: data.task.schedule,
          status: 'active',
          last_run: 'Never',
          next_run: 'Tomorrow ' + data.task.schedule.time,
          approvals: 0
        }, ...tasks]);
        setPrompt('');
      } else {
        console.error('Failed to parse task:', data.error);
        alert('Failed to parse task scheduling. Please try again.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error while scheduling task.');
    } finally {
      setIsParsing(false);
    }
  };

  const toggleStatus = (id: string) => {
    setTasks(tasks.map(t => {
      if (t.id === id) {
        return { ...t, status: t.status === 'active' ? 'paused' : 'active', next_run: t.status === 'active' ? 'Paused' : 'Tomorrow 09:00' };
      }
      return t;
    }));
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  return (
    <div className="flex min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-8 space-y-8">
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-neutral-900 flex items-center gap-3">
                <Bot className="w-8 h-8 text-indigo-600" />
                SEO Autopilot
              </h1>
              <p className="text-neutral-500 mt-2 text-sm max-w-2xl">
                Define what you want done and how often. The Orchestrator will automatically plan the workflow, execute the necessary agents, and queue up consequential actions for your approval.
              </p>
            </div>
          </div>

          {/* NLP Input Section */}
          <section className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-indigo-50/50 to-white">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <SparkleIcon />
                Create Scheduled Task
              </h2>
              <form onSubmit={handleCreateTask}>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Activity className="h-5 w-5 text-indigo-400" />
                    </div>
                    <input
                      type="text"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="e.g. Write one SEO article for my website every day at 9 AM"
                      className="w-full pl-11 pr-4 py-4 bg-white border border-neutral-200 rounded-xl text-neutral-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition-shadow outline-none placeholder:text-neutral-400"
                      disabled={isParsing}
                    />
                  </div>
                  
                  {/* Website Selector */}
                  <select 
                    value={selectedWebsiteId || currentWebsite?.id || ""}
                    onChange={(e) => setSelectedWebsiteId(e.target.value)}
                    className="bg-white border border-neutral-200 rounded-xl px-3 text-neutral-700 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm cursor-pointer text-xs"
                    disabled={isParsing}
                  >
                    {websites.length > 0 ? (
                      websites.map(w => (
                        <option key={w.id} value={w.id}>
                          🌐 {w.domain}
                        </option>
                      ))
                    ) : (
                      <option value="default">{currentWebsite?.domain || "Default Website"}</option>
                    )}
                  </select>

                  <select 
                    value={frequencyOverride}
                    onChange={(e) => setFrequencyOverride(e.target.value)}
                    className="bg-white border border-neutral-200 rounded-xl px-4 text-neutral-700 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm cursor-pointer text-xs"
                    disabled={isParsing}
                  >
                    <option value="auto">Auto-detect Schedule (AI)</option>
                    <option value="daily">Every Day</option>
                    <option value="weekly">Every Week</option>
                    <option value="monthly">Every Month</option>
                  </select>

                  <button
                    type="submit"
                    disabled={!prompt.trim() || isParsing}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 rounded-xl font-medium text-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                  {isParsing ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Parsing...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Plus className="w-4 h-4" /> Schedule
                    </span>
                  )}
                </button>
                </div>
              </form>
            </div>
          </section>

          {/* Active Tasks Grid */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-neutral-900">Active Schedules</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tasks.map(task => (
                <div key={task.id} className="bg-white rounded-2xl border border-neutral-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
                  
                  <div className="p-5 flex-1 border-b border-neutral-100">
                    <div className="flex justify-between items-start mb-3">
                      <div className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                        task.status === 'active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${task.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
                        {task.status.toUpperCase()}
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => toggleStatus(task.id)}
                          className="p-1.5 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                          title={task.status === 'active' ? 'Pause Task' : 'Resume Task'}
                        >
                          {task.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={() => deleteTask(task.id)}
                          className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete Task"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <h3 className="font-semibold text-neutral-900 text-[15px] leading-snug mb-1">
                      {task.goal}
                    </h3>
                    <p className="text-sm text-indigo-600 font-medium flex items-center gap-1.5 mt-3">
                      <Clock className="w-3.5 h-3.5" />
                      Every {task.schedule.frequency === 'daily' ? 'day' : task.schedule.day_of_week} at {task.schedule.time}
                    </p>
                  </div>

                  <div className="bg-neutral-50 px-5 py-4 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-500">Last Run</span>
                      <span className="font-medium text-neutral-700">{task.last_run}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-500">Next Run</span>
                      <span className="font-medium text-neutral-700">{task.next_run}</span>
                    </div>
                  </div>

                  {task.approvals > 0 && (
                    <div className="px-5 py-3 bg-indigo-50 border-t border-indigo-100 flex items-center justify-between group cursor-pointer hover:bg-indigo-100 transition-colors">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-indigo-600" />
                        <span className="text-sm font-semibold text-indigo-700">{task.approvals} Action Pending Approval</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-indigo-600 group-hover:translate-x-1 transition-transform" />
                    </div>
                  )}

                </div>
              ))}
            </div>
          </div>

          {/* Pending Approvals Queue */}
          <div className="space-y-4 pt-8 border-t border-neutral-200">
            <h2 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-indigo-600" />
              Consequential Actions Awaiting Approval
            </h2>
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-neutral-900">Publish Content Package: "Best SEO Tools for SaaS"</h3>
                    <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full text-[10px] font-bold border border-indigo-200 uppercase tracking-wide">Ready</span>
                  </div>
                  <p className="text-sm text-neutral-500 mb-4">Autonomously generated by the Daily Content Task. Workflow halted pending approval.</p>
                  
                  <div className="flex gap-4 text-sm text-neutral-600 mb-6">
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> 1200 words</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> 3 AI Images generated</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> 5 Internal Links added</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Meta tags optimized</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm">
                  Approve & Execute Package
                </button>
                <button className="bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-700 px-5 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm">
                  Review Details
                </button>
                <button className="bg-white hover:bg-red-50 hover:text-red-600 border border-neutral-200 text-neutral-700 px-5 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm ml-auto">
                  Reject
                </button>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.8284 2.82843L12 1L13.1716 2.82843C14.078 4.24354 15.2435 5.40902 16.6586 6.31548L18.487 7.48705L16.6586 8.65863C15.2435 9.56509 14.078 10.7306 13.1716 12.1457L12 13.9741L10.8284 12.1457C9.92198 10.7306 8.75646 9.56509 7.34137 8.65863L5.51295 7.48705L7.34137 6.31548C8.75646 5.40902 9.92198 4.24354 10.8284 2.82843Z" fill="#4F46E5" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M21 16L22 15L23 16L22 17L21 16Z" fill="#4F46E5" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 19L4 18L5 19L4 20L3 19Z" fill="#4F46E5" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
