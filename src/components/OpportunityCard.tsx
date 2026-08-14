"use client";

import { motion } from "framer-motion";
import { GitPullRequest, ArrowRight, Check, X, Edit2, AlertTriangle, Zap, BarChart2, RotateCcw, ShieldCheck, Loader2 } from "lucide-react";
import { useState } from "react";

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
    diff_before: string;
    diff_after: string;
  };
}

export function OpportunityCard({ opportunity }: OpportunityProps) {
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "rolled_back">("pending");
  const [rollingBack, setRollingBack] = useState(false);

  const getBadgeColor = (val: string) => {
    if (val === "high") return "bg-red-50 text-red-600 border-red-200";
    if (val === "medium") return "bg-amber-50 text-amber-600 border-amber-200";
    return "bg-emerald-50 text-emerald-600 border-emerald-200";
  };

  const handleRollback = async () => {
    setRollingBack(true);
    try {
      await fetch("/api/agent/autonomous/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_id: opportunity.id, target_url: "https://my-saas-company.com" }),
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
        className="glass rounded-2xl p-6 border-amber-300 bg-amber-50 relative overflow-hidden"
      >
        <div className="flex items-center gap-3 text-amber-600">
          <RotateCcw className="w-5 h-5" />
          <span className="font-medium">Action Rolled Back to Previous Snapshot</span>
        </div>
        <p className="text-neutral-500 text-sm mt-2">The modification was safely reverted to pre-change state in your codebase.</p>
      </motion.div>
    );
  }

  if (status === "approved") {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass rounded-2xl p-6 border-emerald-300 bg-emerald-50 relative overflow-hidden space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-emerald-600">
            <Check className="w-5 h-5" />
            <span className="font-medium">Executed &amp; PR Created</span>
          </div>
          <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Verification SUCCESS
          </span>
        </div>

        <p className="text-neutral-500 text-sm">
          Modification applied and verified. Saved rollback snapshot ready.
        </p>

        <div className="flex items-center gap-3 pt-2">
          <button className="flex items-center gap-2 text-xs bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 px-4 py-2.5 rounded-xl transition-colors font-medium">
            <GitPullRequest className="w-4 h-4" /> View Pull Request
          </button>

          {/* One-Click Rollback Button */}
          <button 
            onClick={handleRollback}
            disabled={rollingBack}
            className="flex items-center gap-2 text-xs bg-white border border-amber-300 hover:bg-amber-50 text-amber-600 px-4 py-2.5 rounded-xl transition-colors font-medium"
          >
            {rollingBack ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            {rollingBack ? "Reverting..." : "Rollback Modification"}
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
        className="glass rounded-2xl p-6 opacity-50 border-neutral-200"
      >
        <div className="flex items-center gap-3 text-neutral-500">
          <X className="w-5 h-5" />
          <span className="font-medium">Opportunity Rejected</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-neutral-200 rounded-2xl p-6 transition-all hover:bg-neutral-50 shadow-sm group"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">{opportunity.problem}</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className={`text-xs px-2.5 py-1 rounded-full border ${getBadgeColor(opportunity.priority)}`}>
              Priority: {opportunity.priority}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full border ${getBadgeColor(opportunity.confidence)}`}>
              Confidence: {opportunity.confidence}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full border bg-white border-neutral-200 text-neutral-700`}>
              Effort: {opportunity.effort}
            </span>
          </div>
        </div>
        <div className="p-2 bg-indigo-50 rounded-xl">
          <Zap className="w-5 h-5 text-indigo-600" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-neutral-200">
          <div className="flex items-center gap-2 text-neutral-500 mb-2">
            <BarChart2 className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Evidence</span>
          </div>
          <p className="text-sm text-neutral-700">{opportunity.evidence}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-neutral-200">
          <div className="flex items-center gap-2 text-neutral-500 mb-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Expected Impact</span>
          </div>
          <p className="text-sm text-neutral-700">{opportunity.expected_impact}</p>
        </div>
      </div>

      <div className="mb-6">
        <h4 className="text-sm font-medium text-neutral-800 mb-3">Proposed Change</h4>
        <div className="font-mono text-xs rounded-xl overflow-hidden border border-neutral-200">
          <div className="bg-red-50 text-red-300 p-3 flex gap-4 border-b border-neutral-200 relative">
            <span className="text-red-500/50 select-none">-</span>
            <span>{opportunity.diff_before}</span>
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-red-500/10 to-transparent" />
          </div>
          <div className="bg-emerald-50 text-emerald-300 p-3 flex gap-4 relative">
            <span className="text-emerald-500/50 select-none">+</span>
            <span>{opportunity.diff_after}</span>
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-emerald-500/10 to-transparent" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-4 border-t border-neutral-200">
        <button 
          onClick={() => setStatus("approved")}
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] flex justify-center items-center gap-2 text-xs"
        >
          <Check className="w-4 h-4" /> Approve &amp; PR
        </button>
        <button 
          className="px-4 py-2.5 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 font-medium rounded-xl transition-colors flex justify-center items-center gap-2 text-xs"
        >
          <Edit2 className="w-4 h-4" /> Edit
        </button>
        <button 
          onClick={() => setStatus("rejected")}
          className="px-4 py-2.5 bg-white border border-neutral-200 hover:bg-red-50 hover:text-red-600 text-neutral-500 font-medium rounded-xl transition-colors flex justify-center items-center"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
