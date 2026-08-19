"use client";

import React, { useState } from "react";
import { useWebsite } from "@/lib/context/WebsiteContext";
import { Globe, Plus, Loader2, CheckCircle2, AlertCircle, ShieldAlert, Sparkles, X } from "lucide-react";

export function AddWebsiteModal() {
  const { isAddModalOpen, closeAddModal, refreshWebsites, planLimit, setCurrentWebsite } = useWebsite();

  const [form, setForm] = useState({
    url: "",
    name: "",
    connection_type: "wordpress" as "wordpress" | "github" | "custom_api" | "none",
    wp_auth_method: "application_password" as "application_password" | "botcreds",
    wp_username: "",
    wp_app_password: "",
    wp_seo_plugin: "none",
    gh_owner: "",
    gh_repo: "",
    gh_branch: "main",
    gh_token: "",
    api_base_url: "",
    api_auth_type: "bearer_token" as "bearer_token" | "api_key",
    api_key: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAddModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload: any = {
      url: form.url,
      name: form.name || undefined,
      connection_type: form.connection_type,
    };

    if (form.connection_type === "wordpress") {
      if (!form.wp_username || !form.wp_app_password) {
        setError(`WordPress Username and ${form.wp_auth_method === 'botcreds' ? 'BotCreds Key' : 'Application Password'} are required.`);
        setSubmitting(false);
        return;
      }
      payload.wordpress_config = {
        username: form.wp_username,
        app_password: form.wp_app_password,
        auth_method: form.wp_auth_method,
        seo_plugin: form.wp_seo_plugin,
      };
    } else if (form.connection_type === "github") {
      if (!form.gh_owner || !form.gh_repo) {
        setError("GitHub Owner and Repository Name are required.");
        setSubmitting(false);
        return;
      }
      payload.github_config = {
        owner: form.gh_owner,
        repo: form.gh_repo,
        branch: form.gh_branch || "main",
        access_token: form.gh_token || undefined,
      };
    } else if (form.connection_type === "custom_api") {
      if (!form.api_base_url || !form.api_key) {
        setError("API Base URL and Secret Key / Token are required.");
        setSubmitting(false);
        return;
      }
      payload.custom_api_config = {
        api_base_url: form.api_base_url,
        auth_type: form.api_auth_type,
        api_key: form.api_key,
      };
    }

    try {
      const res = await fetch("/api/websites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.website) {
        await refreshWebsites();
        setCurrentWebsite(data.website);
        closeAddModal();
      } else if (!res.ok || data.error) {
        setError(data.error || "Failed to add website.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to submit website.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-600">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 text-base leading-tight">Connect a New Website</h3>
              <p className="text-neutral-500 text-xs mt-0.5">Central source of truth for all autonomous SEO agents.</p>
            </div>
          </div>
          <button type="button" onClick={closeAddModal} className="text-neutral-400 hover:text-neutral-600 font-bold p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Feedback */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* URL & Name */}
          <div>
            <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1">Website URL *</label>
            <input
              type="url"
              value={form.url}
              onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              required
              placeholder="https://example.com"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-neutral-900 focus:outline-none focus:border-indigo-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1">Website Display Name (Optional)</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="My SaaS Marketing Site"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-neutral-900 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Connection Type Selection */}
          <div>
            <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1.5">Execution & Publishing Layer</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "wordpress", name: "WordPress", icon: "🟦" },
                { id: "github", name: "GitHub Code", icon: "🐙" },
                { id: "custom_api", name: "Custom API", icon: "⚡" },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, connection_type: opt.id as any }))}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    form.connection_type === opt.id
                      ? "border-indigo-600 bg-indigo-50/50 text-indigo-900 font-semibold"
                      : "border-neutral-200 hover:bg-neutral-50 text-neutral-700"
                  }`}
                >
                  <span className="text-lg block mb-1">{opt.icon}</span>
                  <span className="text-[11px] block">{opt.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* WordPress Configuration Fields */}
          {form.connection_type === "wordpress" && (
            <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-neutral-500 block">WordPress Authentication</span>
              </div>

              {/* Auth Method Selector */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, wp_auth_method: 'application_password' }))}
                  className={`p-2 rounded-lg border text-left flex items-center gap-2 transition-all ${
                    form.wp_auth_method === 'application_password'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-semibold'
                      : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full border flex items-center justify-center shrink-0 ${
                    form.wp_auth_method === 'application_password' ? 'border-indigo-600' : 'border-neutral-400'
                  }`}>
                    {form.wp_auth_method === 'application_password' && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                  </div>
                  <span className="text-[11px]">App Password</span>
                </button>

                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, wp_auth_method: 'botcreds' }))}
                  className={`p-2 rounded-lg border text-left flex items-center gap-2 transition-all ${
                    form.wp_auth_method === 'botcreds'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-semibold'
                      : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full border flex items-center justify-center shrink-0 ${
                    form.wp_auth_method === 'botcreds' ? 'border-indigo-600' : 'border-neutral-400'
                  }`}>
                    {form.wp_auth_method === 'botcreds' && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                  </div>
                  <span className="text-[11px]">BotCreds</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] text-neutral-500 mb-1">
                    {form.wp_auth_method === 'botcreds' ? 'Agent / Username *' : 'Username *'}
                  </label>
                  <input
                    type="text"
                    value={form.wp_username}
                    onChange={e => setForm(f => ({ ...f, wp_username: e.target.value }))}
                    placeholder={form.wp_auth_method === 'botcreds' ? 'agent_seo' : 'editor_admin'}
                    className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs text-neutral-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-neutral-500 mb-1">SEO Plugin</label>
                  <select
                    value={form.wp_seo_plugin}
                    onChange={e => setForm(f => ({ ...f, wp_seo_plugin: e.target.value }))}
                    className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs text-neutral-900 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="none">Auto-Detect</option>
                    <option value="yoast">Yoast SEO</option>
                    <option value="rankmath">Rank Math</option>
                    <option value="aioseo">All in One SEO</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-neutral-500 mb-1">
                  {form.wp_auth_method === 'botcreds' ? 'BotCreds Agent Key *' : 'Application Password *'}
                </label>
                <input
                  type="password"
                  value={form.wp_app_password}
                  onChange={e => setForm(f => ({ ...f, wp_app_password: e.target.value }))}
                  placeholder={form.wp_auth_method === 'botcreds' ? 'Generated in WP Admin → Settings → BotCreds' : 'xxxx xxxx xxxx xxxx'}
                  className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-neutral-900 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* GitHub Configuration Fields */}
          {form.connection_type === "github" && (
            <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-3">
              <span className="text-[10px] font-bold uppercase text-neutral-500 block">GitHub Repository Details</span>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] text-neutral-500 mb-1">Owner / Org *</label>
                  <input
                    type="text"
                    value={form.gh_owner}
                    onChange={e => setForm(f => ({ ...f, gh_owner: e.target.value }))}
                    placeholder="acme-corp"
                    className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs text-neutral-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-neutral-500 mb-1">Repository Name *</label>
                  <input
                    type="text"
                    value={form.gh_repo}
                    onChange={e => setForm(f => ({ ...f, gh_repo: e.target.value }))}
                    placeholder="website"
                    className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs text-neutral-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] text-neutral-500 mb-1">Base Branch</label>
                  <input
                    type="text"
                    value={form.gh_branch}
                    onChange={e => setForm(f => ({ ...f, gh_branch: e.target.value }))}
                    placeholder="main"
                    className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs text-neutral-900 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-neutral-500 mb-1">GitHub Token (Optional)</label>
                  <input
                    type="password"
                    value={form.gh_token}
                    onChange={e => setForm(f => ({ ...f, gh_token: e.target.value }))}
                    placeholder="ghp_xxxxxxxx"
                    className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs text-neutral-900 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Custom API Configuration Fields */}
          {form.connection_type === "custom_api" && (
            <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-3">
              <span className="text-[10px] font-bold uppercase text-neutral-500 block">Custom SaaS / Headless CMS API</span>
              <div>
                <label className="block text-[10px] text-neutral-500 mb-1">API Base URL *</label>
                <input
                  type="url"
                  value={form.api_base_url}
                  onChange={e => setForm(f => ({ ...f, api_base_url: e.target.value }))}
                  placeholder="https://api.example.com"
                  className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs text-neutral-900 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] text-neutral-500 mb-1">Auth Type</label>
                  <select
                    value={form.api_auth_type}
                    onChange={e => setForm(f => ({ ...f, api_auth_type: e.target.value as any }))}
                    className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs text-neutral-900 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="bearer_token">Bearer Token</option>
                    <option value="api_key">API Key Header</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-neutral-500 mb-1">Secret Key / Token *</label>
                  <input
                    type="password"
                    value={form.api_key}
                    onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
                    placeholder="secret_token"
                    className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs text-neutral-900 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Connect Website
            </button>
            <button
              type="button"
              onClick={closeAddModal}
              className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-4 py-2.5 rounded-xl font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
