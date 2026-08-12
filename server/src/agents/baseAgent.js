import { generateStructured, usageTotal } from "../services/aiService.js";
import { toolDecisionSchema } from "./contracts.js";
import { executeTool, toolDescriptions } from "../tools/registry.js";
import { untrustedContextBlock } from "../utils/sanitize.js";
import { getAgentConfig } from "../services/agentConfigService.js";

function compactJson(value, max = 28000) {
  const text = JSON.stringify(value, null, 2);
  return text.length > max ? `${text.slice(0, max)}\n...[truncated]` : text;
}

export class BaseAgent {
  constructor({ name, systemPrompt, outputSchema, outputName }) {
    this.name = name;
    this.systemPrompt = systemPrompt;
    this.outputSchema = outputSchema;
    this.outputName = outputName;
  }

  async chooseTools({ task, context, documentIds, allowedTools = [], signal }) {
    const config = await getAgentConfig(this.name);
    const available = toolDescriptions(this.name, allowedTools);
    if (!available.length || config.maxTools <= 0) return [];

    const response = await generateStructured({
      schema: toolDecisionSchema,
      schemaName: `${this.name} tool request`,
      signal,
      messages: [
        { role: "system", content: this.systemPrompt },
        {
          role: "user",
          content: [
            `Task: ${task}`,
            `Tools granted specifically to this task: ${JSON.stringify(available)}`,
            `Selected document IDs: ${JSON.stringify(documentIds || [])}`,
            "Choose only tools that materially improve this task. Do not request any tool outside this list.",
            "Context summary:",
            compactJson(context, 10000)
          ].join("\n\n")
        }
      ]
    });

    const allowedNames = new Set(available.map((t) => t.name));
    return response.data.requests.filter((request) => allowedNames.has(request.tool)).slice(0, config.maxTools);
  }

  async run({
    task,
    context,
    documentIds = [],
    allowedTools = [],
    agentRunId,
    workflowRunId,
    userId,
    emit,
    signal,
    reviewFeedback = null
  }) {
    const toolRequests = await this.chooseTools({ task, context, documentIds, allowedTools, signal });
    const toolResults = [];

    for (const request of toolRequests) {
      const input = { ...request.input };
      if (request.tool === "fileSearch" && documentIds.length && !input.documentIds) input.documentIds = documentIds;
      const output = await executeTool({
        agentName: this.name,
        taskAllowedTools: allowedTools,
        toolName: request.tool,
        input,
        agentRunId,
        workflowRunId,
        userId,
        emit,
        signal
      });
      toolResults.push({ tool: request.tool, input, output });
    }

    const referenceBlocks = toolResults.map((result, index) => untrustedContextBlock(`tool-${index + 1}:${result.tool}`, compactJson(result, 9000)));
    const response = await generateStructured({
      schema: this.outputSchema,
      schemaName: this.outputName,
      signal,
      messages: [
        { role: "system", content: this.systemPrompt },
        {
          role: "user",
          content: [
            `Assigned task:\n${task}`,
            `Upstream structured context:\n${compactJson(context)}`,
            referenceBlocks.length ? `Tool reference data:\n${referenceBlocks.join("\n\n")}` : "Tool reference data: none",
            reviewFeedback ? `Reviewer feedback to address:\n${compactJson(reviewFeedback, 8000)}` : ""
          ].filter(Boolean).join("\n\n")
        }
      ]
    });

    return {
      output: response.data,
      tokenUsage: usageTotal(response.usage),
      usage: response.usage || null,
      toolRequests: toolRequests.map(({ tool, input }) => ({ tool, input }))
    };
  }
}
