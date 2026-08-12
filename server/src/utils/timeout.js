import { TimeoutError } from "./errors.js";
export async function withTimeout(factory, ms, label="operation", parentSignal) {
  const controller=new AbortController(); let timedOut=false;
  const onAbort=()=>controller.abort(parentSignal?.reason || "cancelled");
  parentSignal?.addEventListener("abort", onAbort, { once:true });
  const timer=setTimeout(()=>{ timedOut=true; controller.abort("timeout"); }, ms);
  try { return await factory(controller.signal); }
  catch (error) { if (timedOut) throw new TimeoutError(`${label} timed out after ${ms}ms`); throw error; }
  finally { clearTimeout(timer); parentSignal?.removeEventListener("abort", onAbort); }
}
