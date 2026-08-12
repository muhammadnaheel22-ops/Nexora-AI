import { z } from "zod";

export const specialistAgentSchema = z.enum(["scout", "logic", "forge", "scribe", "memory"]);
export const agentNameSchema = z.enum(["core", "scout", "logic", "forge", "scribe", "sentinel", "memory"]);

export const planTaskSchema = z.object({
  id: z.string().min(1).max(80),
  agent: specialistAgentSchema,
  objective: z.string().min(5).max(4000),
  dependencies: z.array(z.string()).default([]),
  tools: z.array(z.enum(["webSearch", "calculator", "fileSearch", "database"])).default([])
});

export const executionPlanSchema = z.object({
  goal: z.string().min(5).max(4000),
  strategy: z.enum(["sequential", "parallel", "hybrid"]).default("hybrid"),
  tasks: z.array(planTaskSchema).min(1).max(12),
  finalFormat: z.string().min(1).max(1000).default("Clear Markdown response")
});

export const scoutOutputSchema = z.object({
  agent: z.literal("scout"),
  status: z.enum(["completed", "partial"]),
  findings: z.array(z.object({ fact: z.string(), importance: z.string().optional(), sourceIds: z.array(z.string()).default([]) })).default([]),
  sources: z.array(z.object({ id: z.string(), title: z.string(), url: z.string().optional(), excerpt: z.string().optional() })).default([]),
  summary: z.string()
});

export const logicOutputSchema = z.object({
  agent: z.literal("logic"),
  status: z.enum(["completed", "partial"]),
  insights: z.array(z.string()).default([]),
  comparisons: z.array(z.object({ topic: z.string(), observations: z.array(z.string()) })).default([]),
  calculations: z.array(z.object({ expression: z.string(), result: z.string() })).default([]),
  advantages: z.array(z.string()).default([]),
  disadvantages: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  summary: z.string()
});

export const forgeOutputSchema = z.object({
  agent: z.literal("forge"),
  status: z.enum(["completed", "partial"]),
  solution: z.string(),
  artifacts: z.array(z.object({ name: z.string(), type: z.string(), content: z.string() })).default([]),
  implementationNotes: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  validation: z.array(z.string()).default([])
});

export const scribeOutputSchema = z.object({
  agent: z.literal("scribe"),
  status: z.enum(["completed", "partial"]),
  title: z.string().optional(),
  content: z.string().min(1),
  format: z.string().default("markdown")
});

export const memoryOutputSchema = z.object({
  agent: z.literal("memory"),
  status: z.enum(["completed", "partial"]),
  relevantMemories: z.array(z.object({ type: z.string().optional(), content: z.string(), relevance: z.string().optional() })).default([]),
  documentContext: z.array(z.object({ documentId: z.string(), chunkIndex: z.number().int().nonnegative(), text: z.string(), score: z.number().optional() })).default([]),
  summary: z.string()
});

export const sentinelOutputSchema = z.object({
  approved: z.boolean(),
  score: z.number().min(0).max(100),
  issues: z.array(z.object({
    type: z.enum(["factual", "missing", "contradiction", "format", "quality", "safety"]),
    severity: z.enum(["low", "medium", "high"]),
    description: z.string(),
    targetAgent: specialistAgentSchema.optional()
  })).default([]),
  improvements: z.array(z.string()).default([])
});

export const toolDecisionSchema = z.object({
  requests: z.array(z.object({
    tool: z.enum(["webSearch", "calculator", "fileSearch", "database"]),
    input: z.record(z.string(), z.any()),
    reason: z.string().max(500)
  })).max(4).default([])
});
