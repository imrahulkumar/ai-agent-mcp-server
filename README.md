# ai-agent-mcp-server

A beginner-friendly example of an **MCP server** written in Node.js. It gives an AI assistant (such as Claude) one new ability: looking up the weather for a city.

<img width="692" height="753" alt="image" src="https://github.com/user-attachments/assets/224b964b-7d03-414b-8650-bcaa415f2b75" />

> **Note:** The weather data is **made up**. It is hardcoded for four cities so you can learn how MCP works without signing up for a weather API. See [Next steps](#10-next-steps) to connect real data.

---

## Table of contents

1. [What is MCP?](#1-what-is-mcp)
2. [What this project does](#2-what-this-project-does)
3. [Prerequisites](#3-prerequisites)
4. [Installation](#4-installation)
5. [Project structure](#5-project-structure)
6. [How the code works](#6-how-the-code-works)
7. [Testing the server](#7-testing-the-server)
8. [Connecting the server to an AI assistant](#8-connecting-the-server-to-an-ai-assistant)
9. [Adding your own tool](#9-adding-your-own-tool)
10. [Next steps](#10-next-steps)
11. [Troubleshooting](#11-troubleshooting)
12. [Glossary](#12-glossary)

---

## 1. What is MCP?

**MCP (Model Context Protocol)** is an open standard for connecting AI assistants to outside tools and data.

On its own, an AI model can only work with the text you give it. It cannot check the weather, read your database, or call an API. MCP fixes this by letting you write a small program, an **MCP server**, that offers **tools** the AI can call.

```
┌──────────────┐    "What's the weather     ┌──────────────────┐
│     You      │ ──────── in London?" ────► │   AI assistant   │
└──────────────┘                            │ (the MCP client) │
                                            └────────┬─────────┘
                                                     │ calls tool:
                                                     │ getWeatherDataByCityName({ city: "London" })
                                                     ▼
                                            ┌──────────────────┐
                                            │  This MCP server │
                                            │    (index.js)    │
                                            └────────┬─────────┘
                                                     │ returns:
                                                     │ { temperature: "15 degrees celsius", condition: "Cloudy" }
                                                     ▼
                                     AI replies: "It's 15°C and cloudy in London."
```

The terms:

| Term | Meaning |
|------|---------|
| **MCP server** | Your program. It lists the tools it offers and runs them on request. |
| **MCP client** | The AI app that connects to your server, such as Claude Code or Claude Desktop. |
| **Tool** | A function the AI can call. It has a name, a description, and the inputs it accepts. |
| **Transport** | How the client and server talk. This project uses **stdio**: the client starts your server as a child process and they exchange JSON messages over standard input and output. |

---

## 2. What this project does

The server is called **Weather Data Fetcher** and offers one tool:

| Tool name | Input | Output |
|-----------|-------|--------|
| `getWeatherDataByCityName` | `city` (text) | The temperature and condition for that city |

Cities with data:

| City | Temperature | Condition |
|------|-------------|-----------|
| London | 15 degrees celsius | Cloudy |
| New York | 20 degrees celsius | Sunny |
| Tokyo | 18 degrees celsius | Rainy |
| Paris | 17 degrees celsius | Windy |

City names are not case-sensitive, so `london`, `London`, and `LONDON` all work. Any other city returns `undefined` (see [Known limitations](#known-limitations)).

---

## 3. Prerequisites

You need:

- **Node.js 20 or newer.** The MCP SDK requires it. Check your version:
  ```bash
  node --version
  ```
  If it prints something lower than `v20`, or "command not found", download Node.js from [nodejs.org](https://nodejs.org/) (choose the **LTS** version). npm comes with it.
- **Git**, to download the project.
- **An MCP client** to try the server with an AI, such as [Claude Code](https://claude.com/claude-code) or [Claude Desktop](https://claude.ai/download). This is optional; you can test without one (see [Testing the server](#7-testing-the-server)).

You don't need an API key to run this project.

---

## 4. Installation

**Step 1: Clone the repository**

```bash
git clone <your-repo-url> ai-agent-mcp-server
cd ai-agent-mcp-server
```

**Step 2: Install dependencies**

```bash
npm install
```

This reads `package.json` and downloads the libraries into a `node_modules/` folder.

**Step 3: Get the full path to `index.js`**

MCP clients need the **absolute path** (the full path from the root of your disk) to the server file. From inside the project folder, run:

```bash
echo "$(pwd)/index.js"
```

It prints something like `/Users/yourname/projects/ai-agent-mcp-server/index.js`. Copy it; you'll need it in [section 8](#8-connecting-the-server-to-an-ai-assistant).

---

## 5. Project structure

```
ai-agent-mcp-server/
├── index.js              ← The MCP server (all the code is here)
├── package.json          ← Project info and list of dependencies
├── package-lock.json     ← Exact dependency versions (generated by npm; don't edit)
├── .mcp.json             ← Tells Claude Code how to start this server
├── .gitignore            ← Files Git should not track (node_modules, .env, ...)
├── .slingshot/           ← Settings for the Slingshot VS Code extension (not needed to run the server)
└── README.md             ← This file
```

### Dependencies

| Package | Used for | Used in `index.js`? |
|---------|----------|:-------------------:|
| `@modelcontextprotocol/server` | Building the MCP server and the stdio transport | ✅ |
| `zod` | Describing and checking the tool's input | ✅ |
| `@modelcontextprotocol/client` | Writing an MCP client | Not yet |
| `@modelcontextprotocol/node` | Node.js helpers for MCP | Not yet |
| `@anthropic-ai/sdk` | Calling Claude from your own code | Not yet |
| `dotenv` | Loading secrets from a `.env` file | Not yet |

The packages marked "Not yet" are installed for future work but `index.js` doesn't use them.

`package.json` contains `"type": "module"`, which lets the code use modern `import` syntax instead of `require()`.

---

## 6. How the code works

All the code is in [index.js](index.js). Here it is in four parts.

### Part 1: Imports

```js
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
```

- `McpServer` is the main class for building a server.
- `StdioServerTransport` lets the server talk over standard input and output.
- `z` (from Zod) describes what inputs a tool accepts.

### Part 2: Create the server

```js
const server = new McpServer({ name: 'Weather Data Fetcher', version: '1.0.0' });
```

The name and version are sent to the AI client when it connects, so it knows what it is talking to.

### Part 3: The weather lookup

```js
async function fetchWeatherData(city) {
    if (city.toLowerCase() === 'london') {
        return { temperature: '15 degrees celsius', condition: 'Cloudy' };
    }
    // ... New York, Tokyo, Paris ...
}
```

This is a plain JavaScript function. It lowercases the city name and returns hardcoded data. It is `async` so you can later swap in a real API call (which takes time) without changing anything else.

### Part 4: Register the tool

```js
server.registerTool(
    'getWeatherDataByCityName',                       // 1. tool name
    {
        description: 'Fetch weather data by city name', // 2. description
        inputSchema: z.object({ city: z.string() })     // 3. inputs
    },
    async ({ city }) => ({                              // 4. handler
        content: [{ type: 'text', text: `Fetching weather data for ${JSON.stringify(await fetchWeatherData(city))}` }]
    })
);
```

1. **Name**: what the AI calls the tool.
2. **Description**: the AI reads this to decide **when** to use the tool, so write it clearly.
3. **Input schema**: here, one required text field called `city`. The SDK rejects calls that don't match.
4. **Handler**: the function that runs when the tool is called. It must return an object with a `content` array. Each item is usually `{ type: 'text', text: '...' }`.

### Part 5: Start the server

```js
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main();
```

This connects the server to stdio and keeps it running, waiting for messages from the client.

> ⚠️ **Important for stdio servers:** standard output (stdout) is reserved for MCP messages. **Don't use `console.log()`** in this server, because it will corrupt the messages and break the connection. To print debug information, use `console.error()`, which writes to standard error instead.

---

## 7. Testing the server

### Option A: Run it directly

```bash
node index.js
```

**Nothing will be printed and the terminal will appear to hang. That's expected.** The server is waiting for an MCP client to send it messages. Press `Ctrl + C` to stop it.

### Option B: Send it messages by hand

You can play the client's role yourself by piping JSON messages into the server. Run this from the project folder:

```bash
{
  echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}'
  echo '{"jsonrpc":"2.0","method":"notifications/initialized"}'
  echo '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
  echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"getWeatherDataByCityName","arguments":{"city":"London"}}}'
  sleep 1
} | node index.js
```

What each message does:

1. `initialize`: the handshake. Client and server agree on a protocol version.
2. `notifications/initialized`: the client says it's ready.
3. `tools/list`: asks which tools the server has.
4. `tools/call`: calls the weather tool for London.

The last line of output should be:

```json
{"result":{"content":[{"type":"text","text":"Fetching weather data for {\"temperature\":\"15 degrees celsius\",\"condition\":\"Cloudy\"}"}]},"jsonrpc":"2.0","id":3}
```

### Option C: MCP Inspector (visual tool)

The [MCP Inspector](https://github.com/modelcontextprotocol/inspector) is an official web app for testing MCP servers:

```bash
npx @modelcontextprotocol/inspector node index.js
```

It opens a page in your browser. Click **Connect**, open the **Tools** tab, click **List Tools**, choose `getWeatherDataByCityName`, type a city, and click **Run Tool**.

---

## 8. Connecting the server to an AI assistant

### Claude Code

**Way 1: Use the included `.mcp.json`**

Claude Code automatically reads a `.mcp.json` file in the project folder. This project already has one:

```json
{
  "mcpServers": {
    "my-mcp-server-7907eb68": {
      "type": "stdio",
      "command": "node",
      "args": ["/Users/rahkumar38/Movies/ai-agent-mcp-server/index.js"]
    }
  }
}
```

> ⚠️ The path in `args` belongs to the original author's computer. **Replace it with your own path** from [Installation, Step 3](#4-installation), or the server will fail to start.

What each field means:

- `"my-mcp-server-7907eb68"`: a name for the server. You can rename it, for example to `"weather"`.
- `"type": "stdio"`: the transport used.
- `"command"` and `"args"`: the command Claude Code runs to start the server, here `node /path/to/index.js`.

Then start Claude Code from the project folder:

```bash
claude
```

The first time, Claude Code asks whether to trust the servers in `.mcp.json`. Approve it. Type `/mcp` to check the server shows as **connected**.

**Way 2: Add it with a command**

```bash
claude mcp add weather -- node /full/path/to/ai-agent-mcp-server/index.js
```

### Claude Desktop

1. Open Claude Desktop, then go to **Settings → Developer → Edit Config**. This opens `claude_desktop_config.json`:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
2. Add the server (use your own path):
   ```json
   {
     "mcpServers": {
       "weather": {
         "command": "node",
         "args": ["/full/path/to/ai-agent-mcp-server/index.js"]
       }
     }
   }
   ```
   On Windows, write paths with double backslashes, for example `"C:\\Users\\you\\ai-agent-mcp-server\\index.js"`.
3. Quit Claude Desktop completely and reopen it.

### Try it

Ask the assistant:

> What's the weather in Tokyo?

It should ask permission to use `getWeatherDataByCityName`, then answer that it's 18 degrees celsius and rainy.

---

## 9. Adding your own tool

Every tool follows the same pattern. As an example, here's a tool that converts Celsius to Fahrenheit. Add it to `index.js` **above** the `async function main()` line:

```js
server.registerTool(
    'convertCelsiusToFahrenheit',
    {
        description: 'Convert a temperature from Celsius to Fahrenheit',
        inputSchema: z.object({ celsius: z.number() })
    },
    async ({ celsius }) => ({
        content: [{ type: 'text', text: `${celsius}°C is ${celsius * 9 / 5 + 32}°F` }]
    })
);
```

Then restart your MCP client so it reloads the server:

- **Claude Code:** exit and run `claude` again.
- **Claude Desktop:** quit completely and reopen.

Tips for good tools:

- Use a **clear name** and a **specific description**. The AI chooses tools based on them.
- Keep inputs simple and give them meaningful names.
- Return helpful messages for errors (for example "City not found") instead of crashing.

---

## 10. Next steps

### Known limitations

These are good first exercises:

- **Unknown cities return `undefined`.** `fetchWeatherData` returns nothing for cities outside the list, so the tool replies `Fetching weather data for undefined`. Add a final `return` with a clear message, such as `{ error: 'No weather data for this city' }`.
- **The data is fake.** Replace it with a real weather API (see below).
- **No error handling.** If something throws inside the handler, the AI gets an unhelpful error.

### Use a real weather API

1. Sign up for a free weather API, such as [Open-Meteo](https://open-meteo.com/) (no key required) or [OpenWeatherMap](https://openweathermap.org/api) (free key).
2. If the API needs a key, put it in a `.env` file in the project folder (already ignored by Git, so it won't be uploaded):
   ```
   WEATHER_API_KEY=your-key-here
   ```
3. Load it at the top of `index.js` with `import 'dotenv/config';` and read it with `process.env.WEATHER_API_KEY`.
4. Replace the body of `fetchWeatherData` with a `fetch()` call to the API. Node.js 20 has `fetch` built in.

> 🔒 Never commit API keys or put them directly in the code.

### Learn more

- [MCP documentation](https://modelcontextprotocol.io)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Claude Code MCP guide](https://docs.claude.com/en/docs/claude-code/mcp)

---

## 11. Troubleshooting

| Problem | Likely cause and fix |
|---------|----------------------|
| `node index.js` prints nothing and seems stuck | Normal. The server is waiting for a client. Press `Ctrl + C` to stop. |
| `Cannot find package '@modelcontextprotocol/server'` | Dependencies aren't installed. Run `npm install` in the project folder. |
| `SyntaxError: Cannot use import statement outside a module` | `"type": "module"` is missing from `package.json`. Add it back. |
| Errors about unsupported syntax, or the SDK refusing to install | Node.js is too old. Run `node --version` and upgrade to 20 or newer. |
| `/mcp` in Claude Code shows the server as **failed** | The path in `.mcp.json` is wrong. Check that it is the full path to **your** `index.js`. |
| The AI doesn't use the tool | Restart the client after changing the server. Mention the tool directly, e.g. "Use the weather tool for Paris". |
| The tool replies `...for undefined` | The city isn't one of London, New York, Tokyo, or Paris. See [Known limitations](#known-limitations). |
| Connection breaks after you add logging | You used `console.log()`. Use `console.error()` instead (see [Part 5](#part-5-start-the-server)). |

---

## 12. Glossary

| Word | Meaning |
|------|---------|
| **Absolute path** | A full file location starting from the root of the disk, such as `/Users/you/project/index.js`. |
| **async / await** | JavaScript keywords for code that waits on something slow (like a network request) without freezing the program. |
| **Dependency** | A library your project uses, listed in `package.json`. |
| **JSON-RPC** | The message format MCP uses: JSON objects with a `method`, `params`, and an `id`. |
| **npm** | Node's package manager. Installs dependencies. |
| **Schema** | A description of what shape data must have, for example "an object with a text field called `city`". |
| **stdio** | Standard input and output, the basic text channels every program has. |
| **Zod** | A JavaScript library for defining and checking schemas. |
