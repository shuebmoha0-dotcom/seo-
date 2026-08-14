"use client";

import { Sidebar } from "@/components/Sidebar";
import { 
  Network, Bot, Clock, ChevronRight, Zap, Target, Search, Settings, 
  FileText, Link as LinkIcon, Image as ImageIcon, Play, CheckCircle2 
} from "lucide-react";

export default function WorkflowsPage() {
  const activeWorkflow = {
    id: "wf-run-1718224",
    status: "RUNNING",
    stage: "COMPETITOR_ANALYSIS",
    started_at: "14 mins ago",
    active_agent: "CompetitorAgent",
    history: [
      { agent: "MonitoringAgent", action: "Detected traffic anomaly on /pricing.", time: "14m ago" },
      { agent: "StrategyAgent", action: "Prioritized anomaly. Delegated to KeywordAgent.", time: "12m ago" },
      { agent: "KeywordAgent", action: "Found search intent shift for 'SaaS pricing'.", time: "8m ago" },
      { agent: "CompetitorAgent", action: "Analyzing top 10 SERP competitors...", time: "Just now", active: true }
    ],
    pending_tasks: [
      { target: "StrategyAgent", objective: "Update content priorities based on competitor gaps." },
      { target: "ContentAgent", objective: "Draft new comparison section for /pricing." }
    ]
  };

  const getAgentIcon = (name: string) => {
    switch (name) {
      case 'StrategyAgent': return <Target className="w-4 h-4" />;
      case 'KeywordAgent': return <Search className="w-4 h-4" />;
      case 'CompetitorAgent': return <Network className="w-4 h-4" />;
      case 'ContentAgent': return <FileText className="w-4 h-4" />;
      case 'TechnicalSEOAgent': return <Settings className="w-4 h-4" />;
      case 'InternalLinkingAgent': return <LinkIcon className="w-4 h-4" />;
      case 'ImageAgent': return <ImageIcon className="w-4 h-4" />;
      default: return <Bot className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#FAFAFA] text-neutral-900 font-sans selection:bg-indigo-500/20">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden max-w-[1600px] mx-auto">
        <header className="bg-white border-b border-neutral-200 px-8 py-6 sticky top-0 z-20 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
              <span>System</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-neutral-900 font-medium">Orchestrator</span>
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Multi-Agent Workflows</h1>
            <p className="text-sm text-neutral-500 mt-1">
              Live observability of autonomous agent collaboration and task delegation.
            </p>
          </div>
          <button className="bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-sm font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2">
            <Play className="w-4 h-4" /> Trigger Custom Workflow
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                <Network className="w-5 h-5 text-indigo-500" /> Active Workflow State
              </h2>
              <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
                Running
              </span>
            </div>

            <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
                <div>
                  <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Workflow ID</div>
                  <div className="font-mono text-sm text-neutral-900 font-medium">{activeWorkflow.id}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Stage</div>
                  <div className="text-sm font-bold text-indigo-700">{activeWorkflow.stage}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Started</div>
                  <div className="text-sm font-medium text-neutral-700 flex items-center gap-1.5 justify-end">
                    <Clock className="w-3.5 h-3.5 text-neutral-400" /> {activeWorkflow.started_at}
                  </div>
                </div>
              </div>

              <div className="p-6">
                <h3 className="text-sm font-bold text-neutral-900 mb-4">Execution Trace</h3>
                
                <div className="relative border-l-2 border-indigo-100 ml-4 space-y-6 pb-2">
                  {activeWorkflow.history.map((step, i) => (
                    <div key={i} className="relative pl-6">
                      <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${step.active ? 'bg-indigo-500' : 'bg-emerald-500'}`}>
                        {step.active ? (
                           <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                        ) : (
                           <CheckCircle2 className="w-3 h-3 text-white" />
                        )}
                      </div>
                      
                      <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm hover:border-indigo-300 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`p-1 rounded-md ${step.active ? 'bg-indigo-50 text-indigo-600' : 'bg-neutral-100 text-neutral-500'}`}>
                              {getAgentIcon(step.agent)}
                            </span>
                            <span className="text-xs font-bold text-neutral-900">{step.agent}</span>
                          </div>
                          <span className="text-[10px] font-medium text-neutral-400">{step.time}</span>
                        </div>
                        <p className={`text-sm ${step.active ? 'text-indigo-700 font-medium' : 'text-neutral-600'}`}>
                          {step.action}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8">
                  <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-neutral-400" /> Pending Tasks
                  </h3>
                  <div className="space-y-2 ml-4">
                    {activeWorkflow.pending_tasks.map((task, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-neutral-50 border border-neutral-100 rounded-lg text-sm">
                        <div className="text-neutral-400 shrink-0">{getAgentIcon(task.target)}</div>
                        <span className="text-xs font-bold text-neutral-700 shrink-0 w-32">{task.target}</span>
                        <span className="text-neutral-500 truncate">{task.objective}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
