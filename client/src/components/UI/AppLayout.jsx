import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import AppSidebar from "../Sidebar/AppSidebar.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import { api } from "../../services/api.js";

export default function AppLayout({ children, sidebarProps = {} }) {
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState([]);

  async function refresh() {
    try {
      setConversations((await api.get("/conversations")).data.conversations);
    } catch {
      // Authentication routing handles unavailable sidebar data.
    }
  }

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("nexora-conversations-changed", handler);
    return () => window.removeEventListener("nexora-conversations-changed", handler);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <AppSidebar
        conversations={conversations}
        mobileOpen={open}
        onClose={() => setOpen(false)}
        {...sidebarProps}
        onNewChat={() => {
          sidebarProps.onNewChat?.();
          setOpen(false);
        }}
        onSelectConversation={(id) => {
          sidebarProps.onSelectConversation?.(id);
          setOpen(false);
        }}
      />
      <div className="min-w-0 flex-1 overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white/75 px-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/75 lg:hidden">
          <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Menu size={18} />
          </button>
          <ThemeToggle />
        </header>
        {children}
      </div>
    </div>
  );
}
