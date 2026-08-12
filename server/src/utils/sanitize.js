export function untrustedContextBlock(label, content) { return `[UNTRUSTED REFERENCE: ${label}]\n${String(content)}\n[END UNTRUSTED REFERENCE]`; }
export function safeToolPreview(value, max=800) { const text=typeof value==="string"?value:JSON.stringify(value); return text.length>max?`${text.slice(0,max)}…`:text; }
