import { Bot, FileText, Gauge, LogOut, Menu, MessageSquarePlus, Settings, ShieldCheck, Users, X } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { createElement, useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import Logo from "./Logo.jsx";

const links = [["/", "Chat", Bot], ["/dashboard", "Dashboard", Gauge], ["/agents", "Agents", Users], ["/documents", "Documents", FileText], ["/settings", "Settings", Settings]];

export default function Shell({ children }) {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const visibleLinks = user?.role === "admin" ? [...links, ["/admin", "Admin", ShieldCheck]] : links;
  const navigate = useNavigate();
  async function signOut() { await logout(); navigate("/login"); }
  return <div className="app-shell">
    <button className="mobile-menu" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu /></button>
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="sidebar-head"><Logo /><button className="icon-button mobile-only" aria-label="Close navigation" onClick={() => setOpen(false)}><X /></button></div>
      <NavLink to="/" className="new-chat" onClick={() => setOpen(false)}><MessageSquarePlus size={18} /> New chat</NavLink>
      <nav>{visibleLinks.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === "/"} onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>{createElement(Icon, { size: 18 })}<span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-user"><span className="avatar">{user?.name?.[0]?.toUpperCase()}</span><span className="user-copy"><strong>{user?.name}</strong><small>{user?.email}</small></span><button className="icon-button" aria-label="Sign out" onClick={signOut}><LogOut size={17} /></button></div>
    </aside>
    {open ? <button className="backdrop" aria-label="Close navigation" onClick={() => setOpen(false)} /> : null}
    <main className="main-area">{children}</main>
  </div>;
}
