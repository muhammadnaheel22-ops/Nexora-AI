import { Sparkles } from "lucide-react";

export default function Logo({ compact = false }) {
  return <div className="brand"><span className="brand-mark"><Sparkles size={20} /></span><span><strong>Nexora AI</strong>{compact ? null : <small>Multi-agent workspace</small>}</span></div>;
}
