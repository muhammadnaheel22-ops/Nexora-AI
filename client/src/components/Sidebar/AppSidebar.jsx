import { createElement } from "react";
import { Bot, FileText, Gauge, LogOut, MessageSquarePlus, PanelLeftClose, Settings, Users } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import Logo from "../UI/Logo.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

const links = [
  ["/", "Chat", Bot],
  ["/dashboard", "Dashboard", Gauge],
  ["/agents", "Agents", Users],
  ["/documents", "Documents", FileText],
  ["/settings", "Settings", Settings],
];

export default function AppSidebar({ conversations = [], onNewChat, onSelectConversation, mobileOpen, onClose }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <aside className={`${mobileOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-zinc-200 bg-white/95 backdrop-blur transition dark:border-zinc-800 dark:bg-zinc-950/95 lg:static lg:translate-x-0`}>
      <div className="flex h-16 items-center justify-between px-4">
        <Logo />
        <button aria-label="Close sidebar" className="icon-btn lg:hidden" onClick={onClose}>
          <PanelLeftClose size={18} />
        </button>
      </div>
      <div className="px-3">
        <button onClick={onNewChat} className="primary-btn w-full justify-center">
          <MessageSquarePlus size={17} />
          New chat
        </button>
      </div>
      <nav className="mt-4 space-y-1 px-3">
        {links.map(([to, label, Icon]) => (
          <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link-active" : ""}`}>
            {createElement(Icon, { size: 17 })}
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-5 border-t border-zinc-200 px-3 pt-4 dark:border-zinc-800">
        <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Recent conversations</div>
        <div className="max-h-[35vh] space-y-1 overflow-auto">
          {conversations.slice(0, 12).map((conversation) => (
            <button
              key={conversation.id || conversation._id}
              onClick={() => onSelectConversation?.(conversation.id || conversation._id)}
              className="w-full truncate rounded-lg px-2 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              {conversation.title}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-auto p-3">
        <button onClick={handleLogout} className="sidebar-link w-full">
          <LogOut size={17} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
