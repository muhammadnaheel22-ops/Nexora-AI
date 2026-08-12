import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import AppLayout from "../components/UI/AppLayout.jsx";
import ThemeToggle from "../components/UI/ThemeToggle.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api.js";

export default function SettingsPage() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [profileSaved, setProfileSaved] = useState(false);
  const [memories, setMemories] = useState([]);
  const [form, setForm] = useState({ key: "", value: "" });

  async function load() {
    setMemories((await api.get("/memory")).data.memories);
  }

  useEffect(() => {
    load();
  }, []);

  async function saveProfile(event) {
    event.preventDefault();
    await api.patch("/auth/profile", { name });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 1500);
  }

  async function add(event) {
    event.preventDefault();
    if (!form.key.trim() || !form.value.trim()) return;
    await api.post("/memory", form);
    setForm({ key: "", value: "" });
    load();
  }

  async function remove(id) {
    await api.delete(`/memory/${id}`);
    load();
  }

  return (
    <AppLayout>
      <main className="h-full overflow-auto p-5 lg:p-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-2xl font-semibold">Settings</h1>
          <div className="mt-6 grid gap-5">
            <section className="panel">
              <h2 className="panel-title">Profile</h2>
              <form onSubmit={saveProfile} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <label className="block">
                  <span className="mb-1.5 block text-xs text-zinc-500">Name</span>
                  <input className="input" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs text-zinc-500">Email</span>
                  <input className="input opacity-70" value={user?.email || ""} disabled />
                </label>
                <button className="primary-btn justify-center"><Save size={15} />{profileSaved ? "Saved" : "Save"}</button>
              </form>
            </section>

            <section className="panel flex items-center justify-between">
              <div>
                <h2 className="font-medium">Appearance</h2>
                <p className="text-sm text-zinc-500">Switch between light and dark themes.</p>
              </div>
              <ThemeToggle />
            </section>

            <section className="panel">
              <h2 className="panel-title">Long-term memory</h2>
              <p className="mb-4 text-sm text-zinc-500">
                Store useful preferences or durable project context. Avoid secrets and sensitive information.
              </p>
              <form onSubmit={add} className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
                <input className="input" placeholder="Key, e.g. output-style" value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value })} />
                <input className="input" placeholder="Value" value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} />
                <button className="primary-btn justify-center"><Plus size={15} />Add</button>
              </form>
              <div className="mt-4 space-y-2">
                {memories.map((memory) => (
                  <div key={memory.id} className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold">{memory.key}</div>
                      <div className="mt-1 text-sm text-zinc-500">{memory.value}</div>
                    </div>
                    <button className="icon-btn" onClick={() => remove(memory.id)}><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </AppLayout>
  );
}
