import { useEffect, useMemo, useState } from "react";
import { FileText, MessageSquareText, ShieldCheck, Trash2, UserCog, Users } from "lucide-react";
import { api } from "../api.js";
import Loading from "../components/Loading.jsx";
import Shell from "../components/Shell.jsx";
import "../admin.css";

export default function AdminPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setError("");
    try { setData(await api("/admin/overview")); }
    catch (requestError) { setError(requestError.message); }
  }

  useEffect(() => { load(); }, []);

  const users = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return data?.users || [];
    return (data?.users || []).filter((user) => `${user.name} ${user.email} ${user.role}`.toLowerCase().includes(value));
  }, [data, search]);

  async function changeRole(user) {
    const role = user.role === "admin" ? "user" : "admin";
    setBusyId(user.id); setError("");
    try {
      const result = await api(`/admin/users/${user.id}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
      setData((current) => ({
        ...current,
        users: current.users.map((entry) => Number(entry.id) === Number(user.id) ? { ...entry, role: result.user.role } : entry),
        metrics: { ...current.metrics, admins: current.metrics.admins + (role === "admin" ? 1 : -1) },
      }));
    } catch (requestError) { setError(requestError.message); }
    finally { setBusyId(null); }
  }

  async function removeUser(user) {
    if (!window.confirm(`Delete ${user.name} and all of their Nexora data? This cannot be undone.`)) return;
    setBusyId(user.id); setError("");
    try { await api(`/admin/users/${user.id}`, { method: "DELETE" }); await load(); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusyId(null); }
  }

  return <Shell><div className="page admin-page">
    <header className="page-header"><div><span className="eyebrow">Administration</span><h1>Control center</h1><p>Monitor the workspace and manage user access.</p></div><span className="live-pill"><span /> Admin access</span></header>
    {error ? <div className="alert">{error}</div> : null}
    {!data ? <Loading /> : <>
      <section className="metric-grid admin-metrics">
        <article className="metric"><span><Users size={20} /></span><small>Total users</small><strong>{data.metrics.users}</strong></article>
        <article className="metric"><span><ShieldCheck size={20} /></span><small>Administrators</small><strong>{data.metrics.admins}</strong></article>
        <article className="metric"><span><MessageSquareText size={20} /></span><small>Conversations</small><strong>{data.metrics.conversations}</strong></article>
        <article className="metric"><span><FileText size={20} /></span><small>Documents</small><strong>{data.metrics.documents}</strong></article>
      </section>
      <section className="surface admin-users">
        <div className="admin-toolbar"><div><span className="eyebrow">Access management</span><h2>Users</h2></div><input aria-label="Search users" placeholder="Search name, email, or role…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>User</th><th>Role</th><th>Activity</th><th>Joined</th><th>Actions</th></tr></thead><tbody>
          {users.map((user) => {
            const self = Number(user.id) === Number(data.currentUserId);
            return <tr key={user.id}><td><strong>{user.name}</strong><small>{user.email}</small></td><td><span className={`role-badge ${user.role}`}>{user.role}</span>{self ? <small className="self-label">You</small> : null}</td><td><small>{user.conversations} chats · {user.messages} messages · {user.documents} docs</small></td><td><small>{new Date(user.createdAt).toLocaleDateString()}</small></td><td><div className="admin-actions"><button className="secondary-button" disabled={self || busyId === user.id} onClick={() => changeRole(user)}><UserCog size={15} />{user.role === "admin" ? "Make user" : "Make admin"}</button><button className="danger-button" aria-label={`Delete ${user.email}`} disabled={self || busyId === user.id} onClick={() => removeUser(user)}><Trash2 size={15} /></button></div></td></tr>;
          })}
        </tbody></table>{!users.length ? <p className="muted admin-empty">No users match your search.</p> : null}</div>
      </section>
    </>}
  </div></Shell>;
}
