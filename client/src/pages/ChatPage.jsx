import { useEffect, useMemo, useRef, useState } from "react";
import { Download, PanelRightOpen, RotateCcw, Trash2, X } from "lucide-react";

import AppLayout from "../components/UI/AppLayout.jsx";
import ChatMessage from "../components/Chat/ChatMessage.jsx";
import Composer from "../components/Chat/Composer.jsx";
import EmptyState from "../components/UI/EmptyState.jsx";
import WorkflowPanel from "../components/Workflow/WorkflowPanel.jsx";
import ActivityLog from "../components/Agents/ActivityLog.jsx";
import DocumentSelector from "../components/Files/DocumentSelector.jsx";
import ThemeToggle from "../components/UI/ThemeToggle.jsx";

import { api } from "../services/api.js";
import { streamChat } from "../services/streamService.js";

/*
|--------------------------------------------------------------------------
| Workflow Content
|--------------------------------------------------------------------------
*/

function WorkflowContent({ activities }) {
  return (
    <>
      <div className="mb-3">
        <h2 className="text-sm font-semibold">Agent Workflow</h2>

        <p className="text-xs text-zinc-500">
          Live orchestration state and safe execution events.
        </p>
      </div>

      <WorkflowPanel activities={activities} />

      <div className="mt-4">
        <ActivityLog events={activities} />
      </div>
    </>
  );
}

/*
|--------------------------------------------------------------------------
| Chat Page
|--------------------------------------------------------------------------
*/

export default function ChatPage() {
  /*
  |--------------------------------------------------------------------------
  | State
  |--------------------------------------------------------------------------
  */

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const [conversationId, setConversationId] = useState(null);
  const [workflowId, setWorkflowId] = useState(null);

  const [running, setRunning] = useState(false);
  const [activities, setActivities] = useState([]);

  const [rightOpen, setRightOpen] = useState(true);
  const [mobileWorkflowOpen, setMobileWorkflowOpen] = useState(false);

  const [docs, setDocs] = useState([]);
  const [selected, setSelected] = useState([]);
  const [filesOpen, setFilesOpen] = useState(false);

  const abortRef = useRef(null);
  const endRef = useRef(null);

  /*
  |--------------------------------------------------------------------------
  | Load Documents
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let mounted = true;

    async function loadDocuments() {
      try {
        const response = await api.get("/documents");

        if (!mounted) return;

        setDocs(
          Array.isArray(response?.data?.documents)
            ? response.data.documents
            : [],
        );
      } catch (error) {
        console.error("Unable to load documents:", error);
      }
    }

    loadDocuments();

    return () => {
      mounted = false;
    };
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Scroll To Latest Message
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  /*
  |--------------------------------------------------------------------------
  | Select Existing Conversation
  |--------------------------------------------------------------------------
  */

  async function selectConversation(id) {
    if (running || id === null || id === undefined) {
      return;
    }

    try {
      const normalizedId = String(id);

      const response = await api.get(`/conversations/${normalizedId}`);

      setConversationId(normalizedId);

      setMessages(
        Array.isArray(response?.data?.messages) ? response.data.messages : [],
      );

      setActivities([]);

      setWorkflowId(
        response?.data?.runs?.[0]?.id ? String(response.data.runs[0].id) : null,
      );
    } catch (error) {
      console.error("Unable to load conversation:", error);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | New Chat
  |--------------------------------------------------------------------------
  */

  function newChat() {
    if (running) {
      return;
    }

    setConversationId(null);
    setWorkflowId(null);

    setMessages([]);
    setActivities([]);

    setSelected([]);
    setInput("");
  }

  /*
  |--------------------------------------------------------------------------
  | Build Chat Request
  |--------------------------------------------------------------------------
  |
  | IMPORTANT:
  |
  | Backend expects IDs using:
  |
  | z.string().regex(/^\d+$/)
  |
  | Therefore:
  |
  | conversationId: null       ❌
  | conversationId: 1          ❌
  | conversationId: "1"        ✅
  |
  | For a NEW conversation we completely omit conversationId.
  |
  */

  function buildChatPayload({ text, regenerate }) {
    const payload = {
      message: String(text ?? "").trim(),

      documentIds: Array.isArray(selected)
        ? selected
            .filter(
              (id) =>
                id !== null && id !== undefined && String(id).trim() !== "",
            )
            .map((id) => String(id))
        : [],

      regenerate: Boolean(regenerate),
    };

    /*
     * Do NOT send:
     *
     * conversationId: null
     *
     * New chats should omit the property completely.
     */

    if (
      conversationId !== null &&
      conversationId !== undefined &&
      String(conversationId).trim() !== ""
    ) {
      payload.conversationId = String(conversationId);
    }

    return payload;
  }

  /*
  |--------------------------------------------------------------------------
  | Send Message
  |--------------------------------------------------------------------------
  */

  async function send(customText = null, { regenerate = false } = {}) {
    const text = String(customText ?? input ?? "").trim();

    if (!text || running) {
      return;
    }

    setInput("");
    setRunning(true);
    setActivities([]);

    /*
    |--------------------------------------------------------------------------
    | Add Temporary UI Message
    |--------------------------------------------------------------------------
    */

    if (regenerate) {
      setMessages((current) => {
        const next = [...current];

        const lastAssistantIndex = [...next]
          .map((item) => item.role)
          .lastIndexOf("assistant");

        if (lastAssistantIndex >= 0) {
          next.splice(lastAssistantIndex, 1);
        }

        return [
          ...next,
          {
            id: "stream",
            role: "assistant",
            content: "",
          },
        ];
      });
    } else {
      setMessages((current) => [
        ...current,

        {
          id: `u-${Date.now()}`,
          role: "user",
          content: text,
        },

        {
          id: "stream",
          role: "assistant",
          content: "",
        },
      ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Abort Controller
    |--------------------------------------------------------------------------
    */

    const controller = new AbortController();

    abortRef.current = controller;

    try {
      /*
      |--------------------------------------------------------------------------
      | Create Correct Backend Payload
      |--------------------------------------------------------------------------
      */

      const payload = buildChatPayload({
        text,
        regenerate,
      });

      /*
       * Helpful while debugging.
       *
       * This does NOT contain passwords or API keys.
       */

      console.log("Nexora chat payload:", payload);

      /*
      |--------------------------------------------------------------------------
      | Start Streaming Request
      |--------------------------------------------------------------------------
      */

      await streamChat(
        payload,

        {
          /*
          |--------------------------------------------------------------------------
          | Abort Signal
          |--------------------------------------------------------------------------
          */

          signal: controller.signal,

          /*
          |--------------------------------------------------------------------------
          | Workflow Metadata
          |--------------------------------------------------------------------------
          */

          onMeta: (meta) => {
            console.log("Nexora stream metadata:", meta);

            if (
              meta?.conversationId !== null &&
              meta?.conversationId !== undefined
            ) {
              setConversationId(String(meta.conversationId));
            }

            /*
             * Support either backend property name.
             */

            const nextWorkflowId =
              meta?.workflowRunId ?? meta?.workflowId ?? null;

            if (nextWorkflowId !== null && nextWorkflowId !== undefined) {
              setWorkflowId(String(nextWorkflowId));
            }
          },

          /*
          |--------------------------------------------------------------------------
          | Agent Activity
          |--------------------------------------------------------------------------
          */

          onActivity: (event) => {
            if (!event) {
              return;
            }

            setActivities((current) => [...current, event]);
          },

          /*
          |--------------------------------------------------------------------------
          | Streaming Token
          |--------------------------------------------------------------------------
          */

          onToken: (token) => {
            if (typeof token !== "string" || token.length === 0) {
              return;
            }

            setMessages((current) =>
              current.map((message) =>
                message.id === "stream"
                  ? {
                      ...message,

                      content: String(message.content ?? "") + token,
                    }
                  : message,
              ),
            );
          },

          /*
          |--------------------------------------------------------------------------
          | Streaming Completed
          |--------------------------------------------------------------------------
          */

          onDone: (data) => {
            console.log("Nexora stream completed:", data);

            setMessages((current) =>
              current.map((message) => {
                if (message.id !== "stream") {
                  return message;
                }

                /*
                 * Use server message when available.
                 */

                if (data?.message) {
                  return data.message;
                }

                /*
                 * Otherwise keep streamed content.
                 */

                return {
                  ...message,
                  id: `assistant-${Date.now()}`,
                };
              }),
            );

            window.dispatchEvent(new Event("nexora-conversations-changed"));
          },

          /*
          |--------------------------------------------------------------------------
          | Server Stream Error
          |--------------------------------------------------------------------------
          */

          onError: (error) => {
            console.error("Nexora stream error:", error);

            const message =
              error?.message || error?.error?.message || "AI execution failed.";

            throw new Error(message);
          },
        },
      );
    } catch (error) {
      /*
      |--------------------------------------------------------------------------
      | Request Error
      |--------------------------------------------------------------------------
      */

      if (error?.name !== "AbortError") {
        console.error("Nexora chat request failed:", error);

        const errorMessage = error?.message || "Unable to complete AI request.";

        setMessages((current) =>
          current.map((message) =>
            message.id === "stream"
              ? {
                  ...message,

                  content: `⚠️ ${errorMessage}`,
                }
              : message,
          ),
        );
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Stop Workflow
  |--------------------------------------------------------------------------
  */

  async function stop() {
    abortRef.current?.abort();

    if (workflowId) {
      try {
        await api.post(`/agents/${workflowId}/cancel`);
      } catch (error) {
        console.error("Unable to cancel workflow:", error);
      }
    }

    setRunning(false);
  }

  /*
  |--------------------------------------------------------------------------
  | Clear / Delete Conversation
  |--------------------------------------------------------------------------
  */

  async function clear() {
    if (!conversationId) {
      newChat();
      return;
    }

    const confirmed = window.confirm("Delete this conversation?");

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/conversations/${conversationId}`);

      newChat();

      window.dispatchEvent(new Event("nexora-conversations-changed"));
    } catch (error) {
      console.error("Unable to delete conversation:", error);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Regenerate Last Answer
  |--------------------------------------------------------------------------
  */

  function regenerate() {
    if (running || !conversationId) {
      return;
    }

    const lastUser = [...messages]
      .reverse()
      .find((message) => message.role === "user");

    if (!lastUser?.content) {
      return;
    }

    send(lastUser.content, {
      regenerate: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Export Conversation
  |--------------------------------------------------------------------------
  */

  function exportChat() {
    if (!conversationId) {
      return;
    }

    const base = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

    window.open(`${base}/conversations/${conversationId}/export`, "_blank");
  }

  /*
  |--------------------------------------------------------------------------
  | Sidebar
  |--------------------------------------------------------------------------
  */

  const sidebarProps = useMemo(
    () => ({
      onNewChat: newChat,
      onSelectConversation: selectConversation,
    }),
    [running],
  );

  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <AppLayout sidebarProps={sidebarProps}>
      <div className="flex h-[calc(100vh-3.5rem)] lg:h-screen">
        {/* Main Chat */}

        <section className="flex min-w-0 flex-1 flex-col">
          {/* Desktop Header */}

          <header className="hidden h-16 items-center justify-between border-b border-zinc-200 px-5 dark:border-zinc-800 lg:flex">
            <div>
              <h1 className="text-sm font-semibold">Agent Workspace</h1>

              <p className="text-xs text-zinc-500">
                Orchestrated multi-agent execution
              </p>
            </div>

            <div className="flex items-center gap-1">
              {/* Regenerate */}

              <button
                className="icon-btn"
                title="Regenerate"
                onClick={regenerate}
                disabled={running || !conversationId}
              >
                <RotateCcw size={16} />
              </button>

              {/* Export */}

              <button
                className="icon-btn"
                title="Export"
                onClick={exportChat}
                disabled={!conversationId}
              >
                <Download size={16} />
              </button>

              {/* Delete */}

              <button
                className="icon-btn"
                title="Clear"
                onClick={clear}
                disabled={running}
              >
                <Trash2 size={16} />
              </button>

              {/* Theme */}

              <ThemeToggle />

              {/* Workflow Panel */}

              <button
                className="icon-btn"
                title="Toggle workflow panel"
                onClick={() => setRightOpen((current) => !current)}
              >
                <PanelRightOpen size={17} />
              </button>
            </div>
          </header>

          {/* Mobile Header */}

          <div className="flex h-11 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800 xl:hidden">
            <span className="text-xs text-zinc-500">
              {running ? "Agents are working…" : "Agent workspace"}
            </span>

            <button
              className="secondary-btn"
              onClick={() => setMobileWorkflowOpen(true)}
            >
              <PanelRightOpen size={15} />
              Workflow
            </button>
          </div>

          {/* Messages */}

          <div className="flex-1 overflow-auto">
            {messages.length > 0 ? (
              messages.map((message, index) => (
                <ChatMessage
                  key={message.id || message._id || `message-${index}`}
                  message={message}
                />
              ))
            ) : (
              <EmptyState />
            )}

            <div ref={endRef} />
          </div>

          {/* Composer */}

          <Composer
            value={input}
            onChange={setInput}
            onSend={() => send()}
            running={running}
            onStop={stop}
            selectedCount={selected.length}
            onOpenFiles={() => setFilesOpen(true)}
          />
        </section>

        {/* Desktop Workflow Panel */}

        {rightOpen && (
          <aside className="hidden w-[410px] shrink-0 overflow-auto border-l border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 xl:block">
            <WorkflowContent activities={activities} />
          </aside>
        )}
      </div>

      {/* Mobile Workflow Drawer */}

      {mobileWorkflowOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/45 xl:hidden"
          onClick={() => setMobileWorkflowOpen(false)}
        >
          <aside
            className="ml-auto h-full w-[min(92vw,410px)] overflow-auto border-l border-zinc-200 bg-white p-4 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex justify-end">
              <button
                className="icon-btn"
                onClick={() => setMobileWorkflowOpen(false)}
              >
                <X size={17} />
              </button>
            </div>

            <WorkflowContent activities={activities} />
          </aside>
        </div>
      )}

      {/* Document Selector */}

      <DocumentSelector
        open={filesOpen}
        onClose={() => setFilesOpen(false)}
        documents={docs}
        selected={selected}
        onToggle={(id) => {
          const normalizedId = String(id);

          setSelected((current) => {
            const normalizedCurrent = current.map((item) => String(item));

            if (normalizedCurrent.includes(normalizedId)) {
              return normalizedCurrent.filter((item) => item !== normalizedId);
            }

            return [...normalizedCurrent, normalizedId];
          });
        }}
      />
    </AppLayout>
  );
}
