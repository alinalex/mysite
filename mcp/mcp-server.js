#!/usr/bin/env node
/* eslint-disable import/no-unresolved */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs';
import path from 'path';
import chatWithGPT4 from './open-ai.js';

// eslint-disable-next-line camelcase
const a11yMatchPrompt = 'You are a Web Engineering Specialist. You are given Javascript code and can determine the HTML code that will be rendered and then match it to the HTML code that is provided.';
const blockPath = '/Users/alinrauta/WebstormProjects/mysite/blocks';

// Helper function to read all code files from a directory
async function readDirectoryCode(dirPath = blockPath, extensions = ['.js', '.css']) {
  try {
    const files = [];

    // eslint-disable-next-line no-inner-declarations
    function readFilesRecursively(currentPath) {
      const items = fs.readdirSync(currentPath);

      // eslint-disable-next-line no-restricted-syntax
      for (const item of items) {
        const fullPath = path.join(currentPath, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          // Skip common directories that shouldn't be included
          if (!['node_modules', '.git', '.next', 'dist', 'build', '.cache', 'coverage'].includes(item)) {
            readFilesRecursively(fullPath);
          }
        } else if (stat.isFile()) {
          const ext = path.extname(item);
          if (extensions.includes(ext)) {
            try {
              const content = fs.readFileSync(fullPath, 'utf8');
              const relativePath = path.relative(dirPath, fullPath);
              files.push({
                path: relativePath,
                content,
              });
            } catch (err) {
              console.warn(`Could not read file ${fullPath}: ${err.message}`);
            }
          }
        }
      }
    }

    if (fs.existsSync(dirPath)) {
      readFilesRecursively(dirPath);
    } else {
      throw new Error(`Directory does not exist: ${dirPath}`);
    }

    return files;
  } catch (error) {
    throw new Error(`Error reading directory: ${error.message}`);
  }
}

// Helper function to format directory code for context
function formatDirectoryContext(files, maxLength = 50000) {
  let context = '\n\n--- DIRECTORY CODE CONTEXT ---\n\n';
  let totalLength = context.length;

  // eslint-disable-next-line no-restricted-syntax
  for (const file of files) {
    const fileHeader = `\n## File: ${file.path}\n\`\`\`\n`;
    const fileFooter = '\n```\n';
    const fileContent = fileHeader + file.content + fileFooter;

    if (totalLength + fileContent.length > maxLength) {
      context += '\n[... Additional files truncated to stay within token limits ...]\n';
      break;
    }

    context += fileContent;
    totalLength += fileContent.length;
  }

  context += '\n--- END DIRECTORY CODE CONTEXT ---\n\n';
  return context;
}

// Create MCP server
const server = new Server(
  {
    name: 'eds-auto-fix-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'match_html_to_block',
      description: 'Find the block that generates the html code that is provided',
      inputSchema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'The message/question',
          },
          systemPrompt: {
            type: 'string',
            description: 'Optional system prompt to set context',
          },
          temperature: {
            type: 'number',
            description: 'Temperature for response randomness (0-2, default: 0.7)',
          },
          maxTokens: {
            type: 'number',
            description: 'Maximum tokens to generate (default: 1000)',
          },
        },
        required: ['message'],
      },
    },
    {
      name: 'fix_block_based_on_suggestion',
      description: 'Generate fixes in a block based on suggestion',
      inputSchema: {
        type: 'object',
        properties: {
          blockName: {
            type: 'string',
            description: 'The name of the block where the accessibility problem lies',
          },
          suggestion: {
            type: 'string',
            description: 'The suggestion on how to fix the accessibility problem',
          },
          systemPrompt: {
            type: 'string',
            description: 'Optional system prompt to set context',
          },
          temperature: {
            type: 'number',
            description: 'Temperature for response randomness (0-2, default: 0.7)',
          },
          maxTokens: {
            type: 'number',
            description: 'Maximum tokens to generate (default: 2000)',
          },
          fileExtensions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional array of file extensions to include (default: [.js, .css])',
          },
        },
        required: ['blockName', 'suggestion'],
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'match_html_to_block': {
        const {
          message, systemPrompt, temperature, maxTokens,
        } = args;

        let enhancedMessage = message;
        let enhancedSystemPrompt = systemPrompt;

        try {
          const files = await readDirectoryCode();
          const directoryContext = formatDirectoryContext(files);

          // Add directory context to the message
          enhancedMessage = `${message}\n${directoryContext}`;

          // Enhance system prompt to mention the code context
          const contextNote = '\n\nYou have been provided with the complete code context from the blocks directory. Use this code context to provide a response. Do not make up any information. Be sure to also check for class names and other attributes that may be used in the code. Tell me the name of the block that generates the html code that is provided.';
          enhancedSystemPrompt = (systemPrompt || a11yMatchPrompt) + contextNote;
        } catch (dirError) {
          return {
            content: [
              {
                type: 'text',
                text: `Error reading directory ${blockPath}: ${dirError.message}`,
              },
            ],
            isError: true,
          };
        }

        const result = await chatWithGPT4(enhancedMessage, enhancedSystemPrompt, {
          temperature,
          maxTokens,
        });

        if (result.success) {
          return {
            content: [
              {
                type: 'text',
                text: result.content,
              },
            ],
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: `Error calling Azure OpenAI: ${result.error}`,
            },
          ],
          isError: true,
        };
      }

      case 'fix_block_based_on_suggestion': {
        const {
          blockName,
          suggestion,
          systemPrompt,
          fileExtensions,
        } = args;

        // Default system prompt for accessibility fixes
        const defaultSystemPrompt = `You are a Web Accessibility Expert and Frontend Developer. Your task is to analyze accessibility problems in HTML and provide specific code changes to fix them.

Given:
1. Block code content with accessibility problems (JavaScript and CSS)
2. A suggestion for fixing the accessibility problem

You should:
1. Analyze the block code and identify the specific accessibility issue
2. Understand how the block code generates or styles the HTML
3. Provide exact code changes needed in the JavaScript and CSS files to implement the accessibility fix
4. Focus on practical, implementable solutions. Do not make up any information. Be sure to also check for class names and other attributes that may be used in the code.
5. Ensure the fix follows WCAG guidelines and best practices

Format your response with:
- Clear explanation of the accessibility issue
- Specific changes for JavaScript files (if needed)
- Specific changes for CSS files (if needed)
- Implementation notes or considerations`;

        let enhancedMessage = `
Block with accessibility problem:
\`\`\`
${blockName}
\`\`\`

Accessibility fix suggestion:
${suggestion}

Please analyze this accessibility issue and provide the specific code changes needed and then do these changes in the JavaScript and CSS files to implement the suggested fix.`;

        let enhancedSystemPrompt = systemPrompt || defaultSystemPrompt;

        try {
          const extensions = fileExtensions || ['.js', '.css'];
          const files = await readDirectoryCode(`${blockPath}/${blockName}`, extensions);
          const directoryContext = formatDirectoryContext(files);

          // Add directory context to the message
          enhancedMessage += `\n${directoryContext}`;

          // Enhance system prompt to mention the code context
          const contextNote = '\n\nYou have been provided with the complete code context from the blocks directory. Use this code context to understand the existing patterns and structure. Provide changes that are consistent with the existing codebase style and patterns. Be sure to also check if there are needed any changes in the CSS styles as a result of the fix.';
          enhancedSystemPrompt += contextNote;
        } catch (dirError) {
          return {
            content: [
              {
                type: 'text',
                text: `Error reading directory ${blockPath}/${blockName}: ${dirError.message}`,
              },
            ],
            isError: true,
          };
        }

        const result = await chatWithGPT4(enhancedMessage, enhancedSystemPrompt);

        if (result.success) {
          return {
            content: [
              {
                type: 'text',
                text: result.content,
              },
            ],
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: `Error calling Azure OpenAI: ${result.error}`,
            },
          ],
          isError: true,
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Handle process signals gracefully
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
