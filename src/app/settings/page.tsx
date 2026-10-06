"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { useWebsite } from "@/lib/context/WebsiteContext";
import { 
  Settings, 
  Users, 
  CreditCard, 
  Key, 
  Webhook, 
  ShieldAlert,
  CheckCircle2
} from "lucide-react";

type Tab = "general" | "team" | "billing" | "api-keys" | "webhooks" | "advanced";

export default function SettingsPage() {
  const { currentWebsite } = useWebsite();
  
  const [activeTab, setActiveTab] = useState<Tab>("general");
  
  const [siteName, setSiteName] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (currentWebsite) {
      setSiteName(currentWebsite.name || currentWebsite.domain || "");
      const url = currentWebsite.url || (currentWebsite.domain ? `https://${currentWebsite.domain}` : "");
      setSiteUrl(url);
    }
  }, [currentWebsite]);

  const handleSave = async () => {
    setSaving(true);
    // Mock save delay
    setTimeout(() => {
      setSaving(false);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }, 800);
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "general", label: "General", icon: Settings },
    { id: "team", label: "Team", icon: Users },
    { id: "billing", label: "Billing", icon: CreditCard },
    { id: "api-keys", label: "API Keys", icon: Key },
    { id: "webhooks", label: "Webhooks", icon: Webhook },
    { id: "advanced", label: "Advanced", icon: ShieldAlert },
  ];

  return (
    <div className="flex min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      <Sidebar />
      
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-10 md:px-10 lg:px-12">
          
          <div className="mb-8 border-b border-neutral-200 pb-8">
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Settings</h1>
            <p className="text-sm text-neutral-500 mt-2">Manage your workspace settings and preferences.</p>
          </div>

          <div className="flex flex-col md:flex-row gap-8 lg:gap-12 items-start">
            
            {/* Sidebar Tabs */}
            <aside className="w-full md:w-56 shrink-0">
              <nav className="flex flex-col space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive 
                          ? "bg-neutral-200/50 text-neutral-900" 
                          : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? "text-neutral-900" : "text-neutral-400"}`} />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </aside>

            {/* Content Area */}
            <div className="flex-1 w-full space-y-8">
              
              {activeTab === "general" && (
                <div className="space-y-8 animate-in fade-in duration-200">
                  {/* Card 1 */}
                  <section className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-6 md:p-8">
                      <h2 className="text-lg font-medium text-neutral-900">Workspace Name</h2>
                      <p className="text-sm text-neutral-500 mt-1">
                        This is your workspace's visible name within the application.
                      </p>
                      
                      <div className="mt-6 max-w-md">
                        <input
                          type="text"
                          value={siteName}
                          onChange={(e) => setSiteName(e.target.value)}
                          className="w-full border border-neutral-300 rounded-lg px-4 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:border-neutral-900 transition-all"
                          placeholder="My Workspace"
                        />
                      </div>
                    </div>
                    <div className="bg-neutral-50 px-6 py-4 md:px-8 border-t border-neutral-200 flex items-center justify-between">
                      <span className="text-sm text-neutral-500">Please use 32 characters at maximum.</span>
                      <button 
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-neutral-900 text-white px-4 py-2 text-sm font-medium rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-70 flex items-center gap-2"
                      >
                        {saving ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </section>

                  {/* Card 2 */}
                  <section className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-6 md:p-8">
                      <h2 className="text-lg font-medium text-neutral-900">Website URL</h2>
                      <p className="text-sm text-neutral-500 mt-1">
                        The primary production URL of your website.
                      </p>
                      
                      <div className="mt-6 max-w-md">
                        <input
                          type="url"
                          value={siteUrl}
                          onChange={(e) => setSiteUrl(e.target.value)}
                          className="w-full border border-neutral-300 rounded-lg px-4 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:border-neutral-900 transition-all"
                          placeholder="https://example.com"
                        />
                      </div>
                    </div>
                    <div className="bg-neutral-50 px-6 py-4 md:px-8 border-t border-neutral-200 flex items-center justify-between">
                      <span className="text-sm text-neutral-500">Used for automated SEO audits.</span>
                      <button 
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-neutral-900 text-white px-4 py-2 text-sm font-medium rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-70"
                      >
                        {saving ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </section>
                </div>
              )}

              {activeTab === "team" && (
                <div className="space-y-8 animate-in fade-in duration-200">
                  <section className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-6 md:p-8">
                      <h2 className="text-lg font-medium text-neutral-900">Team Members</h2>
                      <p className="text-sm text-neutral-500 mt-1">
                        Manage who has access to this workspace.
                      </p>
                      
                      <div className="mt-6 border border-neutral-200 rounded-lg overflow-hidden">
                        <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200 text-sm font-medium text-neutral-700 flex justify-between">
                          <span>User</span>
                          <span>Role</span>
                        </div>
                        <div className="divide-y divide-neutral-100">
                          <div className="px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-semibold">
                                ME
                              </div>
                              <span className="text-sm font-medium text-neutral-900">You (Owner)</span>
                            </div>
                            <span className="text-xs font-medium text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded-md border border-neutral-200">Admin</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-neutral-50 px-6 py-4 md:px-8 border-t border-neutral-200 flex items-center justify-between">
                      <span className="text-sm text-neutral-500">Enterprise plans support unlimited members.</span>
                      <button className="bg-white border border-neutral-300 text-neutral-900 px-4 py-2 text-sm font-medium rounded-lg hover:bg-neutral-50 transition-colors">
                        Invite Member
                      </button>
                    </div>
                  </section>
                </div>
              )}

              {activeTab === "billing" && (
                <div className="space-y-8 animate-in fade-in duration-200">
                  <section className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-6 md:p-8">
                      <h2 className="text-lg font-medium text-neutral-900">Current Plan</h2>
                      <p className="text-sm text-neutral-500 mt-1">
                        You are currently on the <strong className="text-neutral-900">Pro Plan</strong>.
                      </p>
                      
                      <div className="mt-6 bg-neutral-50 border border-neutral-200 rounded-lg p-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-2xl font-semibold text-neutral-900">$49<span className="text-sm font-normal text-neutral-500">/mo</span></span>
                            <p className="text-sm text-neutral-500 mt-1">Billed monthly</p>
                          </div>
                          <span className="px-3 py-1 bg-neutral-900 text-white text-xs font-medium rounded-full">Active</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-neutral-50 px-6 py-4 md:px-8 border-t border-neutral-200 flex items-center justify-between">
                      <span className="text-sm text-neutral-500">Manage your subscription via Stripe.</span>
                      <button className="bg-neutral-900 text-white px-4 py-2 text-sm font-medium rounded-lg hover:bg-neutral-800 transition-colors">
                        Manage Billing
                      </button>
                    </div>
                  </section>
                </div>
              )}

              {activeTab === "api-keys" && (
                <div className="space-y-8 animate-in fade-in duration-200">
                  <section className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-6 md:p-8">
                      <h2 className="text-lg font-medium text-neutral-900">API Keys</h2>
                      <p className="text-sm text-neutral-500 mt-1">
                        Use these keys to authenticate API requests.
                      </p>
                      
                      <div className="mt-6">
                        <div className="flex items-center gap-4">
                          <input
                            type="password"
                            readOnly
                            value="key_••••••••••••••••••••••••••••••"
                            className="flex-1 border border-neutral-300 rounded-lg px-4 py-2 text-sm text-neutral-500 font-mono focus:outline-none bg-neutral-50"
                          />
                          <button className="bg-white border border-neutral-300 text-neutral-900 px-4 py-2 text-sm font-medium rounded-lg hover:bg-neutral-50 transition-colors shrink-0">
                            Copy Key
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="bg-neutral-50 px-6 py-4 md:px-8 border-t border-neutral-200 flex items-center justify-between">
                      <span className="text-sm text-neutral-500">Never share your secret keys.</span>
                      <button className="bg-neutral-900 text-white px-4 py-2 text-sm font-medium rounded-lg hover:bg-neutral-800 transition-colors">
                        Generate New Key
                      </button>
                    </div>
                  </section>
                </div>
              )}

              {activeTab === "webhooks" && (
                <div className="space-y-8 animate-in fade-in duration-200">
                  <section className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-6 md:p-8">
                      <h2 className="text-lg font-medium text-neutral-900">Webhooks</h2>
                      <p className="text-sm text-neutral-500 mt-1">
                        Configure webhooks to receive real-time event payloads.
                      </p>
                      
                      <div className="mt-8 text-center py-10 bg-neutral-50 border border-dashed border-neutral-300 rounded-lg">
                        <Webhook className="w-8 h-8 text-neutral-400 mx-auto mb-3" />
                        <h3 className="text-sm font-medium text-neutral-900">No Webhooks configured</h3>
                        <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">Get notified when events happen in your workspace.</p>
                      </div>
                    </div>
                    <div className="bg-neutral-50 px-6 py-4 md:px-8 border-t border-neutral-200 flex items-center justify-between">
                      <span className="text-sm text-neutral-500">Listen to events like article generation.</span>
                      <button className="bg-white border border-neutral-300 text-neutral-900 px-4 py-2 text-sm font-medium rounded-lg hover:bg-neutral-50 transition-colors">
                        Add Webhook
                      </button>
                    </div>
                  </section>
                </div>
              )}

              {activeTab === "advanced" && (
                <div className="space-y-8 animate-in fade-in duration-200">
                  <section className="bg-white border border-red-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-6 md:p-8">
                      <h2 className="text-lg font-medium text-red-600">Danger Zone</h2>
                      <p className="text-sm text-neutral-500 mt-1">
                        Irreversible actions related to your workspace.
                      </p>
                      
                      <div className="mt-6 border border-red-100 bg-red-50/50 rounded-lg p-5 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium text-neutral-900">Delete Workspace</h3>
                          <p className="text-xs text-neutral-500 mt-1">Permanently remove this workspace and all its data.</p>
                        </div>
                        <button className="bg-red-600 text-white px-4 py-2 text-sm font-medium rounded-lg hover:bg-red-700 transition-colors">
                          Delete
                        </button>
                      </div>
                    </div>
                  </section>
                </div>
              )}
              
            </div>
          </div>

        </div>
      </main>

      {/* Toast Notification */}
      {savedSuccess && (
        <div className="fixed bottom-6 right-6 bg-neutral-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-medium">Settings saved successfully</span>
        </div>
      )}
    </div>
  );
}
