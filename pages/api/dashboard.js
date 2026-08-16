import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";

let clientPromise = null;

async function getClient() {
  if (clientPromise) return clientPromise;
  clientPromise = (async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(process.cwd(), "src/index.js")],
      cwd: process.cwd(),
    });
    const client = new Client({ name: "dashboard-web", version: "1.0.0" });
    await client.connect(transport);
    return client;
  })();
  return clientPromise;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { tool, args } = req.body || {};
  if (!tool) {
    res.status(400).json({ error: "Missing tool" });
    return;
  }

  try {
    const client = await getClient();
    const result = await client.callTool({ name: tool, arguments: args || {} });
    const text = result.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
    res.status(200).json(parsed);
  } catch (err) {
    console.error(`dashboard tool error (${tool}):`, err.message);
    res.status(500).json({ error: err.message, tool });
  }
}