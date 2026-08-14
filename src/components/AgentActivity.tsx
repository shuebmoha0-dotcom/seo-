"use client";

import { motion } from "framer-motion";
import { CheckCircle2, CircleDashed, Loader2, Shield, Lock, Zap, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

export function AgentActivity() {
  const [permissionLevel, setPermissionLevel] = useState<number>(2); // Level 2: Content Modifications
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const permissionLabels: Record<number, { name: string; desc: string; color: string }> = {
    0: { name: "Level 0: Read-Only", desc: "Crawl & analyze only. Zero automated changes.", color: "text-neutral-400 border-neutral-700 bg-neutral-900" },
    1: { name: "Level 1: Low-Risk SEO", desc: "Auto-execute Titles, Meta, Alt text, Internal links.", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
    2: { name: "Level 2: Content Mods", desc: "Auto-execute Content updates, Schema JSON-LD, Articles.", color: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10" },
    3: { name: "Level 3: Auto-Publish", desc: "Auto-execute Branch Merges & Publishing triggers.", color: "text-purple-400 border-purple-500/30 bg-purple-500/10" },
    4: { name: "Level 4: High-Risk (Locked)", desc: "URL changes & deletions ALWAYS require human approval.", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  };

  const stateMachineLogs = [
    {
      state: "OBSERVE",
      text: "Crawled 84 pages & synced Search Console",
      status: "completed",
      detail: "Extracted titles, metas, H1-H3, HTTP status codes, and 2,400 GSC queries."
    },
    {
      state: "ANALYZE & PRIORITIZE",
      text: "Identified 31 opportunities (8 high value)",
      status: "completed",
      detail: "Selected Homepage Title Tag optimization (Position 6.2 | 18.4K impressions | 1.4% CTR)."
    },
    {
      state: "PERMISSION CHECK",
      text: "Level 1 low-risk change approved autonomously",
      status: "completed",
      detail: `Action risk level (Level 1) is within site permission setting (Level ${permissionLevel}).`
    },
    {
      state: "EXECUTE & SNAPSHOT",
      text: "Modified title tag & created Git branch",
      status: "completed",
      detail: "Pre-change content snapshot saved to rollbacks table before committing."
    },
    {
      state: "VERIFY",
      text: "Verified title change on page (SUCCESS)",
      status: "completed",
      detail: "Re-crawled page URL. Extracted element matched expected change 'Project Management Software for Modern Teams'."
    },
    {
      state: "LEARN & RECORD",
      text: "Recorded win into Strategic Project Memory",
      status: "completed",
      detail: "Updated project memory. Step transition to NEXT_TASK complete."
    }
  ];

  return (
    <div className="glass rounded-2xl p-6 relative overflow-hidden space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
            <div className="absolute inset-0 bg-indigo-400/20 rounded-full animate-ping" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white leading-tight">Autonomous State Machine</h2>
            <span className="text-[10px] text-neutral-400 block">OBSERVE → EXECUTE → VERIFY → LEARN</span>
          </div>
        </div>
      </div>

      {/* Permission Level Selector Box */}
      <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-indigo-400" /> Autonomy Permission Level
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${permissionLabels[permissionLevel].color}`}>
            {permissionLabels[permissionLevel].name}
          </span>
        </div>

        <input
          type="range"
          min="0"
          max="4"
          step="1"
          value={permissionLevel}
          onChange={(e) => setPermissionLevel(parseInt(e.target.value))}
          className="w-full accent-indigo-500 cursor-pointer"
        />

        <p className="text-[11px] text-neutral-400">
          {permissionLabels[permissionLevel].desc}
        </p>
      </div>

      {/* Inspectable State Machine Activity Feed */}
      <div>
        <h3 className="text-xs font-semibold text-neutral-400 mb-3 uppercase tracking-wider">
          State Machine Execution Log
        </h3>

        <div className="space-y-2.5">
          {stateMachineLogs.map((log, i) => (
            <div key={i} className="bg-neutral-950/80 rounded-xl border border-neutral-900 overflow-hidden text-xs">
              <button
                onClick={() => setExpandedStep(expandedStep === i ? null : i)}
                className="w-full p-3 flex items-center justify-between text-left hover:bg-neutral-900/40 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest block">{log.state}</span>
                    <span className="text-neutral-200 font-medium">{log.text}</span>
                  </div>
                </div>
                {expandedStep === i ? <ChevronUp className="w-3.5 h-3.5 text-neutral-500" /> : <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />}
              </button>

              {expandedStep === i && (
                <div className="px-3 pb-3 pt-1 text-[11px] text-neutral-400 border-t border-neutral-900 bg-neutral-950 font-mono">
                  {log.detail}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
