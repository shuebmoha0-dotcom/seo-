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

import { useWebsite } from "@/lib/context/WebsiteContext";

export function OpportunityCard({ opportunity }: OpportunityProps) {
  const { currentWebsite } = useWebsite();
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-neutral-200 rounded-xl p-5 transition-colors shadow-xs group"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-neutral-900 mb-2">{opportunity.problem}</h3>
          <div className="flex flex-wrap gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${getBadgeColor(opportunity.priority)}`}>
              Priority: {opportunity.priority}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${getBadgeColor(opportunity.confidence)}`}>
              Confidence: {opportunity.confidence}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-md border bg-neutral-50 border-neutral-200 text-neutral-600 font-medium">
              Effort: {opportunity.effort}
            </span>
          </div>
        </div>
        <div className="p-2 bg-neutral-100 rounded-lg text-neutral-600">
          <Zap className="w-4 h-4" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <div className="bg-neutral-50/70 p-3.5 rounded-lg border border-neutral-200/80">
          <div className="flex items-center gap-1.5 text-neutral-500 mb-1">
            <BarChart2 className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Evidence</span>
          </div>
          <p className="text-xs text-neutral-700 leading-relaxed">{opportunity.evidence}</p>
        </div>
        <div className="bg-neutral-50/70 p-3.5 rounded-lg border border-neutral-200/80">
          <div className="flex items-center gap-1.5 text-neutral-500 mb-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Expected Impact</span>
          </div>
          <p className="text-xs text-neutral-700 leading-relaxed">{opportunity.expected_impact}</p>
        </div>
      </div>

      {(opportunity.diff_before || opportunity.diff_after) && (
        <div className="mb-5">
          <h4 className="text-xs font-medium text-neutral-700 mb-2">Proposed Code/Content Change</h4>
          <div className="font-mono text-xs rounded-lg overflow-hidden border border-neutral-200">
            {opportunity.diff_before && (
              <div className="bg-red-50 text-red-800 p-2.5 flex items-start gap-3 border-b border-red-100">
                <span className="text-red-500 select-none font-bold">-</span>
                <span className="break-all">{opportunity.diff_before}</span>
              </div>
            )}
            {opportunity.diff_after && (
              <div className="bg-emerald-50 text-emerald-800 p-2.5 flex items-start gap-3">
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
          className="inline-flex h-8 items-center justify-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium px-4 rounded-lg transition-colors shadow-xs"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Approve &amp; Queue</span>
        </button>
        <button 
          onClick={() => setStatus("rejected")}
          className="inline-flex h-8 items-center justify-center gap-1.5 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-600 text-xs font-medium px-3 rounded-lg transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          <span>Dismiss</span>
        </button>
      </div>
    </motion.div>
  );
}
