import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, Sparkles, User } from "lucide-react";

function CodePre({ children }) {
  const [copied, setCopied] = useState(false);
  const code = String(children?.props?.children ?? "").replace(/\n$/, "");
  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }
  return (
    <div className="group/code relative my-4">
      <button onClick={copy} className="absolute right-2 top-2 z-10 rounded-md bg-zinc-800 px-2 py-1 text-[10px] text-zinc-300 opacity-0 transition group-hover/code:opacity-100">
        {copied ? "Copied" : "Copy"}
      </button>
      <pre>{children}</pre>
    </div>
  );
}

export default function ChatMessage({ message }) {
  const [copied, setCopied] = useState(false);
  const assistant = message.role === "assistant";
  async function copy() {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className={`group flex gap-3 px-4 py-6 ${assistant ? "bg-white dark:bg-zinc-950" : "bg-zinc-50 dark:bg-zinc-900/30"}`}>
      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${assistant ? "bg-violet-500/15 text-violet-500" : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`}>
        {assistant ? <Sparkles size={16} /> : <User size={16} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-2 text-xs font-semibold text-zinc-500">{assistant ? "Nexora AI" : "You"}</div>
        {assistant ? (
          message.content ? (
            <div className="prose-agent">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  pre: CodePre,
                  code({ className, children, ...props }) {
                    const inline = !className;
                    return inline ? (
                      <code className="rounded bg-zinc-200 px-1 py-.5 dark:bg-zinc-800" {...props}>{children}</code>
                    ) : (
                      <code className={className} {...props}>{children}</code>
                    );
                  }
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <span className="flex gap-1">
                <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500" />
                <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500 [animation-delay:150ms]" />
                <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500 [animation-delay:300ms]" />
              </span>
              AI team is working…
            </div>
          )
        ) : (
          <div className="whitespace-pre-wrap text-[15px] leading-7">{message.content}</div>
        )}
        {assistant && message.content && (
          <button onClick={copy} className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500 opacity-0 transition group-hover:opacity-100">
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy response"}
          </button>
        )}
      </div>
    </div>
  );
}
