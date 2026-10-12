"use client";

import { motion } from "framer-motion";
import { GitPullRequest, ArrowRight, Check, X, Edit2, AlertTriangle, Zap, BarChart2, RotateCcw, ShieldCheck, Loader2 } from "lucide-react";
import { useState } from "react";
import { useWebsite } from "@/lib/context/WebsiteContext";

interface OpportunityProps {
  opportunity: {
    id: string;
    problem: string;
    evidence: string;
    recommended_action: string;
    expected_impact: string;
    confidence: "high" | "medium" | "low";
    effort: "high" | "medium" | "low";
    risk: "high" | "medium" | "low";
    priority: "high" | "medium" | "low";
    diff_before?: string;
    diff_after?: string;
  };
}

export function OpportunityCard({ opportunity }: OpportunityProps) {
  const { currentWebsite } = useWebsite();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "rolled_back">("pending");
  const [rollingBack, setRollingBack] = useState(false);

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "medium":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-neutral-50 text-neutral-700 border-neutral-200";
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case "high":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "medium":
        return "bg-blue-50 text-blue-700 border-blue-200";
      default:
        return "bg-neutral-50 text-neutral-600 border-neutral-200";
    }
  };

  const handleRollback = async () => {
    setRollingBack(true);
    try {
      const targetUrl = currentWebsite?.url || (currentWebsite?.domain ? `https://${currentWebsite.domain}` : "/");
      await fetch("/api/agent/autonomous/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_id: opportunity.id, target_url: targetUrl }),
      });
      setStatus("rolled_back");
    } catch (e) {
      console.error(e);
    } finally {
      setRollingBack(false);
    }
  };

  if (status === "rolled_back") {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-xl p-5 border border-amber-200 bg-amber-50/60 relative overflow-hidden"
      >
        <div className="flex items-center gap-2.5 text-amber-800 font-semibold text-sm">
          <RotateCcw className="w-4 h-4 text-amber-600" />
          <span>Action Rolled Back to Previous Snapshot</span>
        </div>
        <p className="text-neutral-600 text-xs mt-1.5">The modification was safely reverted to pre-change state.</p>
      </motion.div>
    );
  }

  if (status === "approved") {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl p-5 border border-emerald-200 bg-emerald-50/60 relative overflow-hidden space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>Queued for Autonomous Execution</span>
          </div>
          <span className="bg-emerald-100/70 text-emerald-800 border border-emerald-300/80 text-[11px] px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Verified
          </span>
        </div>

        <p className="text-neutral-600 text-xs">
          Modification approved and added to the execution queue.
        </p>

        <div className="flex items-center gap-2 pt-1">
          <button 
            onClick={handleRollback}
            disabled={rollingBack}
            className="inline-flex h-7 items-center gap-1.5 text-xs bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 px-3 rounded-md transition-colors font-medium shadow-2xs"
          >
            {rollingBack ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5 text-neutral-500" />}
            <span>{rollingBack ? "Reverting…" : "Rollback"}</span>
          </button>
        </div>
      </motion.div>
    );
  }

  if (status === "rejected") {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-xl p-4 border border-neutral-200 bg-neutral-50 text-neutral-500 text-xs flex items-center gap-2"
      >
        <X className="w-4 h-4 text-neutral-400" />
        <span>Opportunity dismissed</span>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-neutral-200 rounded-xl p-5 shadow-2xs hover:border-neutral-300 transition-colors"
    >
      <div className="flex items-start justify-between gap-4 mb-3.5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[11px] px-2 py-0.5 rounded-md border font-medium ${getPriorityBadge(opportunity.priority)}`}>
              Priority: {opportunity.priority.toUpperCase()}
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-md border font-medium ${getConfidenceBadge(opportunity.confidence)}`}>
              Confidence: {opportunity.confidence.toUpperCase()}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-md border bg-neutral-50 border-neutral-200 text-neutral-600 font-medium">
              Effort: {opportunity.effort}
            </span>
          </div>
          <h3 className="text-base font-semibold text-neutral-900 leading-snug">{opportunity.problem}</h3>
        </div>
        <div className="p-2 bg-neutral-50 border border-neutral-200/60 rounded-lg text-neutral-600 shrink-0">
          <Zap className="w-4 h-4 text-amber-500" />
        </div>
      </div>

      <p className="text-xs text-neutral-600 mb-4 leading-relaxed">
        <span className="font-semibold text-neutral-800">Recommended Action: </span>
        {opportunity.recommended_action}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="bg-neutral-50/80 p-3 rounded-lg border border-neutral-200/80">
          <div className="flex items-center gap-1.5 text-neutral-500 mb-1">
            <BarChart2 className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Evidence</span>
          </div>
          <p className="text-xs text-neutral-700 leading-relaxed">{opportunity.evidence}</p>
        </div>
        <div className="bg-neutral-50/80 p-3 rounded-lg border border-neutral-200/80">
          <div className="flex items-center gap-1.5 text-neutral-500 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Expected Impact</span>
          </div>
          <p className="text-xs text-neutral-700 leading-relaxed">{opportunity.expected_impact}</p>
        </div>
      </div>

      {(opportunity.diff_before || opportunity.diff_after) && (
        <div className="mb-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">Proposed Modification</h4>
          <div className="font-mono text-xs rounded-lg overflow-hidden border border-neutral-200">
            {opportunity.diff_before && (
              <div className="bg-rose-50/80 text-rose-800 p-2.5 flex items-start gap-3 border-b border-rose-100">
                <span className="text-rose-500 select-none font-bold">-</span>
                <span className="break-all">{opportunity.diff_before}</span>
              </div>
            )}
            {opportunity.diff_after && (
              <div className="bg-emerald-50/80 text-emerald-800 p-2.5 flex items-start gap-3">
                <span className="text-emerald-600 select-none font-bold">+</span>
                <span className="break-all">{opportunity.diff_after}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-3 border-t border-neutral-100">
        <button 
          onClick={() => setStatus("approved")}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-700 bg-indigo-600 px-3 text-[13px] font-medium text-white shadow-xs transition-colors hover:bg-indigo-700"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Approve &amp; Queue</span>
        </button>
        <button 
          onClick={() => setStatus("rejected")}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-700 shadow-2xs hover:bg-neutral-50 transition-colors"
        >
          <X className="w-3.5 h-3.5 text-neutral-400" />
          <span>Dismiss</span>
        </button>
      </div>
    </motion.div>
  );
}
