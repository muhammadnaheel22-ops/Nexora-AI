import { Save, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import Shell from "../components/Shell.jsx";
import Loading from "../components/Loading.jsx";
import { api } from "../api.js";

export default function SettingsPage() {
  const [settings, setSettings] = useState(null); const [notice, setNotice] = useState(""); const [error, setError] = useState("");
  useEffect(() => { api("/settings").then((data) => setSettings(data.settings)).catch((caught) => setError(caught.message)); }, []);
  async function save(event) { event.preventDefault(); setNotice(""); setError(""); try { const data = await api("/settings", { method: "PUT", body: JSON.stringify(settings) }); setSettings(data.settings); setNotice("Settings saved."); } catch (caught) { setError(caught.message); } }
  return <Shell><div className="page narrow"><header className="page-header"><div><span className="eyebrow">Preferences</span><h1>Settings</h1><p>Shape how your Nexora workspace behaves.</p></div></header>{error ? <div className="alert">{error}</div> : null}{!settings ? <Loading /> : <form className="surface settings-form" onSubmit={save}><span className="agent-icon"><SlidersHorizontal /></span><div><h2>Workspace preferences</h2><p className="muted">These settings are stored with your account.</p></div><label><span>Theme</span><select value={settings.theme} onChange={(event) => setSettings({ ...settings, theme: event.target.value })}><option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option></select></label><label><span>AI model</span><input value={settings.aiModel} onChange={(event) => setSettings({ ...settings, aiModel: event.target.value })} /></label><label><span>System guidance</span><textarea rows={6} value={settings.systemPrompt || ""} onChange={(event) => setSettings({ ...settings, systemPrompt: event.target.value })} placeholder="Describe how Nexora should approach your work…" /></label><div className="form-actions">{notice ? <span className="success">{notice}</span> : null}<button className="primary-button"><Save size={17} /> Save settings</button></div></form>}</div></Shell>;
}
