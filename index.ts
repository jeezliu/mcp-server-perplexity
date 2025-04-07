#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getParamValue, getAuthValue } from "@chatmcp/sdk/utils/index.js";
import { RestServerTransport } from "@chatmcp/sdk/server/rest.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * Definition of the Perplexity Ask Tool.
 * This tool accepts an array of messages and returns a chat completion response
 * from the Perplexity API, with citations appended to the message if provided.
 */
const DAILY_TODO_TOOL: Tool = {
  name: "get_daily_todo",
  description:
    "获取日常待办事项 ",
  inputSchema: {
    type: "object",
    properties: {
      erp: {
        type: "string",
      }
    }
  },
};

const perplexityApiKey = getParamValue("perplexity_api_key") || "";

const mode = getParamValue("mode") || "stdio";
const port = getParamValue("port") || 9593;
const endpoint = getParamValue("endpoint") || "/rest";

// Retrieve the Perplexity API key from environment variables
// const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
// if (!PERPLEXITY_API_KEY) {
//   console.error("Error: PERPLEXITY_API_KEY environment variable is required");
//   process.exit(1);
// }

/**
 * Performs a chat completion by sending a request to the Perplexity API.
 * Appends citations to the returned message content if they exist.
 *
 * @param {Array<{ role: string; content: string }>} messages - An array of message objects.
 * @param {string} model - The model to use for the completion.
 * @returns {Promise<string>} The chat completion result with appended citations.
 * @throws Will throw an error if the API request fails.
 */
async function performChatCompletion(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  model: string = "sonar-pro"
): Promise<string> {
  // Construct the API endpoint URL and request body
  const tasks = [
    {
      title: "完成项目需求文档",
      description: "编写项目需求文档，包括功能需求、非功能需求和用户故事。", 
      dueDate: "2024-10-05",
      priority: "高",
      status: "进行中",
    },
    {
      title: "代码审查",
      description: "对团队成员提交的代码进行审查，确保代码质量和规范性。",
      dueDate: "2024-10-06",
      priority: "中",
      status: "待办",
    },
    {
      title: "数据库优化",
      description: "优化数据库查询性能，减少响应时间。",
      dueDate: "2024-10-07",
      priority: "低",
      status: "待办",
    },
    {
      title: "客户反馈处理",
      description: "处理客户反馈，解决用户遇到的问题。",
      dueDate: "2024-10-08",
      priority: "高",
      status: "待办",
    },
    {
      title: "项目进度报告",
      description: "编写项目进度报告，汇报项目进展情况。",
      dueDate: "2024-10-09",
      priority: "中",
      status: "待办",
    },
  ];

  const formattedTasks = tasks.map((task) =>
    [
      `**${task.title}**`,
      `描述: ${task.description}`,
      `截止日期: ${task.dueDate}`,
      `优先级: ${task.priority}`,
      `状态: ${task.status}`,
      "---",
    ].join("\n"),
  );
  
  const todoListText = `待办事项列表:\n\n${formattedTasks.join("\n")}`;

  return todoListText
}

// Initialize the server with tool metadata and capabilities
const server = new Server(
  {
    name: "example-servers/get-daily-todo",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Registers a handler for listing available tools.
 * When the client requests a list of tools, this handler returns all available Perplexity tools.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    DAILY_TODO_TOOL
  ],
}));

/**
 * Registers a handler for calling a specific tool.
 * Processes requests by validating input and invoking the appropriate tool.
 *
 * @param {object} request - The incoming tool call request.
 * @returns {Promise<object>} The response containing the tool's result or an error.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const apiKey =
      perplexityApiKey || getAuthValue(request, "PERPLEXITY_API_KEY");
    if (!apiKey) {
      throw new Error("PERPLEXITY_API_KEY not set");
    }

    const { name, arguments: args } = request.params;
    if (!args) {
      throw new Error("No arguments provided");
    }
    switch (name) {
      case "get_daily_todo": {
        const messages = args.messages as any;
        const result = await performChatCompletion(
          apiKey,
          messages,
          "sonar-pro"
        );
        return {
          content: [{ type: "text", text: result }],
          isError: false,
        };
      }
      default:
        // Respond with an error if an unknown tool is requested
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    // Return error details in the response
    return {
      content: [
        {
          type: "text",
          text: `Error: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
      isError: true,
    };
  }
});

/**
 * Initializes and runs the server using standard I/O for communication.
 * Logs an error and exits if the server fails to start.
 */
async function runServer() {
  try {
    if (mode === "rest") {
      const transport = new RestServerTransport({
        port,
        endpoint,
      });
      await server.connect(transport);

      await transport.startServer();

      return;
    }

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(
      "Perplexity MCP Server running on stdio with Ask, Research, and Reason tools"
    );
  } catch (error) {
    console.error("Fatal error running server:", error);
    process.exit(1);
  }
}

// Start the server and catch any startup errors
runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
