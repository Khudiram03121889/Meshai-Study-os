// Local Deno Router Gateway for Supabase Edge Functions (CORS enabled)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const PORT = 54321;

const proxyMap: Record<string, number> = {
  "ai-chat-v2": 8001,
  "parse-quick-log": 8002,
  "revision-suggest": 8003,
  "study-mode": 8004,
};

// Spawn subprocesses
const runFunc = (name: string, port: number) => {
  const cmd = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-net",
      "--allow-env",
      `./supabase/functions/${name}/index.ts`,
    ],
    env: {
      PORT: port.toString(),
      MESH_API_KEY: Deno.env.get("MESH_API_KEY") || "",
      SUPABASE_URL: Deno.env.get("SUPABASE_URL") || "",
      SUPABASE_ANON_KEY: Deno.env.get("SUPABASE_ANON_KEY") || "",
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    },
    stdout: "piped",
    stderr: "piped",
  });
  const child = cmd.spawn();
  
  // Pipe output to console
  (async () => {
    const decoder = new TextDecoder();
    for await (const chunk of child.stdout) {
      console.log(`[${name}] ${decoder.decode(chunk).trim()}`);
    }
  })();
  (async () => {
    const decoder = new TextDecoder();
    for await (const chunk of child.stderr) {
      console.error(`[${name} ERR] ${decoder.decode(chunk).trim()}`);
    }
  })();

  return child;
};

// Load environment variables manually if Deno.env doesn't have them
const envPath = "./.env";
try {
  const text = await Deno.readTextFile(envPath);
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (!Deno.env.get(key)) {
      Deno.env.set(key, val);
    }
  }
} catch {
  console.log("No root .env found or failed to read. Relying on system env.");
}

// Map supabase client envs to standard ones if needed
if (Deno.env.get("VITE_SUPABASE_URL") && !Deno.env.get("SUPABASE_URL")) {
  Deno.env.set("SUPABASE_URL", Deno.env.get("VITE_SUPABASE_URL")!);
}
if (Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") && !Deno.env.get("SUPABASE_ANON_KEY")) {
  Deno.env.set("SUPABASE_ANON_KEY", Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!);
}
if (Deno.env.get("meshai_api") && !Deno.env.get("MESH_API_KEY")) {
  Deno.env.set("MESH_API_KEY", Deno.env.get("meshai_api")!);
}

const processes = [
  runFunc("ai-chat-v2", 8001),
  runFunc("parse-quick-log", 8002),
  runFunc("revision-suggest", 8003),
  runFunc("study-mode", 8004),
];

// Clean shutdown
globalThis.addEventListener("unload", () => {
  console.log("Shutting down child processes...");
  for (const proc of processes) {
    try {
      proc.kill();
    } catch { /* ignore */ }
  }
});

console.log(`[Gateway] Starting local Supabase Edge Functions proxy gateway on port ${PORT}...`);

await serve(async (req) => {
  // CORS Preflight Headers
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "*",
      },
    });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const functionName = pathParts[3] || pathParts[2] || "";
  const targetPort = proxyMap[functionName];

  if (!targetPort) {
    return new Response(JSON.stringify({ error: `Function ${functionName} not mapped` }), {
      status: 404,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  // Forward request to local Deno process
  const targetUrl = `http://localhost:${targetPort}${url.pathname}${url.search}`;
  console.log(`[Gateway] Proxying ${req.method} ${url.pathname} to port ${targetPort}`);

  try {
    const headers = new Headers(req.headers);
    headers.delete("host");
    
    const targetRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.body,
      redirect: "manual",
    });

    const resHeaders = new Headers(targetRes.headers);
    resHeaders.set("Access-Control-Allow-Origin", "*");
    resHeaders.set("Access-Control-Allow-Headers", "*");
    resHeaders.set("Access-Control-Allow-Methods", "*");

    return new Response(targetRes.body, {
      status: targetRes.status,
      headers: resHeaders,
    });
  } catch (err: any) {
    console.error(`[Gateway] Proxy failed:`, err);
    return new Response(JSON.stringify({ error: `Proxy failed: ${err.message}` }), {
      status: 502,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
}, { port: PORT });
