import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Get the directory of the current module
const currentFilename = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilename);

// Load environment variables from parent directory (mysite/.env)
dotenv.config({ path: path.join(currentDir, '..', '.env') });

// Azure OpenAI Configuration
const AZURE_OPENAI_CONFIG = {
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  deploymentName: process.env.AZURE_COMPLETION_DEPLOYMENT,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION,
};

/**
 * Makes a request to Azure OpenAI GPT-4
 * @param {Object} options - Request options
 * @param {Array} options.messages - Array of message objects with role and content
 * @param {number} options.maxTokens - Maximum tokens to generate (default: 1000)
 * @param {number} options.temperature - Temperature for response randomness (default: 0.7)
 * @param {number} options.frequencyPenalty - Frequency penalty (default: 0)
 * @param {number} options.presencePenalty - Presence penalty (default: 0)
 * @param {Array} options.stop - Stop sequences (optional)
 * @returns {Promise<Object>} Response from Azure OpenAI
 */
async function makeAzureOpenAIRequest(options = {}) {
  const {
    messages = [],
    maxTokens = 10000,
    temperature = 0.2,
    frequencyPenalty = 0,
    presencePenalty = 0,
    stop = null,
  } = options;

  // Validate required configuration
  if (!AZURE_OPENAI_CONFIG.apiKey || AZURE_OPENAI_CONFIG.apiKey === 'your-api-key-here') {
    throw new Error('Azure OpenAI API key is not configured. Please set AZURE_OPENAI_API_KEY environment variable.');
  }

  if (!AZURE_OPENAI_CONFIG.endpoint || AZURE_OPENAI_CONFIG.endpoint === 'https://your-resource-name.openai.azure.com') {
    throw new Error('Azure OpenAI endpoint is not configured. Please set AZURE_OPENAI_ENDPOINT environment variable.');
  }

  // Validate messages
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('Messages array is required and must not be empty.');
  }

  // Construct the API URL
  const url = `${AZURE_OPENAI_CONFIG.endpoint}/openai/deployments/${AZURE_OPENAI_CONFIG.deploymentName}/chat/completions?api-version=${AZURE_OPENAI_CONFIG.apiVersion}`;

  // Prepare request body
  const requestBody = {
    messages,
    max_tokens: maxTokens,
    temperature,
    frequency_penalty: frequencyPenalty,
    presence_penalty: presencePenalty,
    ...(stop && { stop }),
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_OPENAI_CONFIG.apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    // Check if response is ok
    if (!response.ok) {
      const errorData = await response.text();
      console.error('Azure OpenAI API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      throw new Error(`Azure OpenAI API request failed: ${response.status} ${response.statusText} - ${errorData}`);
    }

    const data = await response.json();
    return {
      success: true,
      data,
      usage: data.usage,
      content: data.choices?.[0]?.message?.content || '',
      finishReason: data.choices?.[0]?.finish_reason || '',
    };
  } catch (error) {
    console.error('Error making Azure OpenAI request:', error);
    return {
      success: false,
      error: error.message,
      data: null,
    };
  }
}

/**
 * Helper function to create a simple chat completion request
 * @param {string} userMessage - The user's message
 * @param {string} systemMessage - Optional system message (default: helpful assistant)
 * @param {Object} options - Additional options for the request
 * @returns {Promise<Object>} Response from Azure OpenAI
 */
export default async function chatWithGPT4(userMessage, systemMessage = 'You are a helpful AI assistant.', options = {}) {
  const messages = [
    { role: 'system', content: systemMessage },
    { role: 'user', content: userMessage },
  ];

  // eslint-disable-next-line no-return-await
  return await makeAzureOpenAIRequest({
    messages,
    ...options,
  });
}
