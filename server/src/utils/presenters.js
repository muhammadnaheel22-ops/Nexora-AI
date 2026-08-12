export function messageView(message) {
  return { ...message, role: String(message.role).toLowerCase() };
}

export function taskStatusView(status) {
  return String(status || "").toLowerCase();
}

export function runStatusView(status) {
  return String(status || "").toLowerCase();
}
