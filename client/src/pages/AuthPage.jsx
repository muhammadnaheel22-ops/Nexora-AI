import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useAuth } from "../AuthContext.jsx";
import Logo from "../components/Logo.jsx";

const benefits = ["Persistent conversations", "Seven-agent workspace", "Local document context"];
export default function AuthPage({ register = false }) {
  const { user, login, register: createAccount } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  if (user) return <Navigate to="/" replace />;
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    try { if (register) await createAccount(form); else await login(form); navigate("/"); }
    catch (caught) { setError(caught.message); } finally { setBusy(false); }
  }
  return <main className="auth-page">
    <section className="auth-story"><Logo /><div><span className="eyebrow">Nexora intelligence system</span><h1>One workspace.<br />A whole AI team.</h1><p>Move from a rough question to a reviewed result with research, reasoning, building, writing, memory, and oversight working together.</p><div className="benefits">{benefits.map((benefit) => <span key={benefit}><CheckCircle2 size={16} />{benefit}</span>)}</div></div><small>Built for focused, serious work.</small></section>
    <section className="auth-form-wrap"><form className="auth-form" onSubmit={submit}><div className="mobile-logo"><Logo /></div><span className="eyebrow">{register ? "Get started" : "Welcome back"}</span><h2>{register ? "Create your workspace" : "Sign in to Nexora"}</h2><p>{register ? "Your coordinated AI workspace is one step away." : "Continue where your team left off."}</p>{error ? <div className="alert">{error}</div> : null}<div className="fields">{register ? <label><span>Name</span><input autoComplete="name" required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label> : null}<label><span>Email</span><input type="email" autoComplete="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label><span>Password</span><input type="password" autoComplete={register ? "new-password" : "current-password"} required minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label></div><button className="primary-button auth-submit" disabled={busy}>{busy ? "Please wait…" : register ? "Create account" : "Sign in"}<ArrowRight size={17} /></button><p className="auth-switch">{register ? "Already have an account?" : "New to Nexora?"} <Link to={register ? "/login" : "/register"}>{register ? "Sign in" : "Create account"}</Link></p></form></section>
  </main>;
}
