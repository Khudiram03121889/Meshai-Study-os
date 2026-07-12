import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { detectIntent, detectSubjectLLM } from "./intent.ts";
import { runPlanner, type PlannerDecision } from "./planner.ts";
import { executeTool } from "./tool-registry.ts";
import { buildContext, buildSystemPrompt } from "./context-engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { query, history = [], subjectId, language = "english", imageUrl } = await req.json();
    if (!query && !imageUrl) throw new Error("Query or image is required");

    let resolvedSubjectId = subjectId;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let meshApiKey = Deno.env.get("MESH_API_KEY");
    if (!meshApiKey || meshApiKey === "CG" || meshApiKey.length < 5) {
      const { data: dbKey, error: dbError } = await supabase.rpc("get_mesh_key");
      if (dbError) {
        console.error("[ai-chat-v2] Failed to fetch get_mesh_key RPC:", dbError);
      } else if (dbKey) {
        meshApiKey = dbKey;
      }
    }
    if (!meshApiKey) throw new Error("Missing Mesh API API Key");

    // 1. Intent Detection (<5ms)
    const start = Date.now();
    const intentRes = detectIntent(query || "Solve this problem");

    // 2. Fetch User Preferences (parallel with Planner)
    const prefsPromise = adminClient
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single()
      .then((r: any) => r.data || {});

    // 3. Subject Classification & Planning (Concurrently)
    const subjectPromise = (async () => {
      if (resolvedSubjectId && ["physics", "chemistry", "mathematics"].includes(resolvedSubjectId)) {
        return resolvedSubjectId as "physics" | "chemistry" | "mathematics" | "general";
      }
      return detectSubjectLLM(query || "Explain this", history, meshApiKey);
    })();

    let plannerLatency = 0;
    const plannerPromise = (async () => {
      if (!intentRes.requires_planner) return { tools_to_run: [] } as PlannerDecision;
      const pStart = Date.now();
      const res = await runPlanner(meshApiKey, query, intentRes.intent);
      plannerLatency = Date.now() - pStart;
      return res;
    })();

    const [plan, resolvedSubject] = await Promise.all([plannerPromise, subjectPromise]);
    resolvedSubjectId = resolvedSubject === "general" ? undefined : resolvedSubject;
    console.log(`[ai-chat-v2] Intent: ${intentRes.intent} (${intentRes.confidence}), resolvedSubjectId: ${resolvedSubjectId}`);
    console.log(`[ai-chat-v2] Planner tools:`, plan.tools_to_run.map(t => t.tool));

    // Always include long-term memory & prior chats so the tutor stays personalized
    // and can honor / correct past insights across conversations.
    const hasMemories = plan.tools_to_run.some(t => t.tool === "SearchMemories");
    const hasPrevChats = plan.tools_to_run.some(t => t.tool === "SearchPreviousChats");
    if (!hasMemories) plan.tools_to_run.push({ tool: "SearchMemories", args: { limit: 6 }, reasoning: "always-on personalization" });
    if (!hasPrevChats) plan.tools_to_run.push({ tool: "SearchPreviousChats", args: { limit: 6 }, reasoning: "cross-session continuity" });

    // 4. Generate Embedding for vector search tools (if needed)
    let queryEmbedding: number[] | undefined;
    const needsEmbedding = plan.tools_to_run.some(t => 
      t.tool === "SearchNotes" || t.tool === "SearchMemories"
    );
    if (needsEmbedding) {
      const embedRes = await fetch("https://api.meshapi.ai/v1/embeddings", {
        method: "POST",
        headers: { "Authorization": `Bearer ${meshApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "openai/text-embedding-3-small", input: query || "Solve this problem" })
      });
      const embedData = await embedRes.json();
      queryEmbedding = embedData.data[0].embedding;
    }

    // 5. Execute Tools (concurrently)
    const tStart = Date.now();
    const toolResults = await Promise.all(plan.tools_to_run.map(t => {
      const args = { ...t.args, query_embedding: queryEmbedding, subject: resolvedSubjectId };
      return executeTool(t.tool as any, adminClient, user.id, args);
    }));
    const retrievalLatency = Date.now() - tStart;

    // 6. Build Context & System Prompt
    const { xmlContext, totalTokensEstimate } = buildContext(toolResults, plan.context_budget_override || 4000);
    const prefs = await prefsPromise;
    const systemPrompt = buildSystemPrompt(prefs, xmlContext, language);

    // 7. Invoke main LLM (Streaming) with subject-based routing
    // ponytail: claude-sonnet-4-5 is the current affordable Sonnet; upgrade to claude-sonnet-5 when it lands on MeshAPI
    const selectedModel = resolvedSubjectId === "mathematics"
      ? "anthropic/claude-sonnet-4-5"
      : resolvedSubjectId === "physics"
      ? "openai/gpt-4o"
      : resolvedSubjectId === "chemistry"
      ? "google/gemini-2.5-pro"
      : "openai/gpt-4o";

    let userContent: any = query || "Solve or explain this image.";
    if (imageUrl) {
      userContent = [
        { type: "text", text: query || "Solve or explain this image." },
        { type: "image_url", image_url: { url: imageUrl } }
      ];
    }

    const messages = [
      { role: "system", content: systemPrompt },
      ...history.map((m: any) => ({ role: m.role, content: m.message || m.content })),
      { role: "user", content: userContent }
    ];

    const llmStart = Date.now();
    const meshResponse = await fetch("https://api.meshapi.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${meshApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: selectedModel,
        messages,
        temperature: 0.7,
        stream: true
      })
    });

    if (!meshResponse.ok) {
      const err = await meshResponse.text();
      throw new Error(`Mesh API Error: ${err}`);
    }

    // 8. Log trace to planner_logs (fire and forget)
    adminClient.from("planner_logs").insert({
      user_id: user.id,
      trace_id: crypto.randomUUID(),
      intent: intentRes.intent,
      intent_confidence: intentRes.confidence,
      planner_decision: plan,
      tools_called: plan.tools_to_run.map(t => t.tool) as any,
      context_tokens_used: totalTokensEstimate,
      planner_latency_ms: plannerLatency,
      retrieval_latency_ms: retrievalLatency,
      total_latency_ms: Date.now() - start
    }).then(
      () => {},
      (e: any) => console.error("Log failed", e)
    );

    // Create a modified stream that prepends the model information in SSE format.
    // On error, emit a typed SSE error event before closing so the client can show a toast.
    const encoder = new TextEncoder();
    const customStream = new ReadableStream({
      async start(controller) {
        try {
          const modelInfoChunk = `data: ${JSON.stringify({
            choices: [{ delta: { model: selectedModel } }]
          })}\n\n`;
          controller.enqueue(encoder.encode(modelInfoChunk));

          const reader = meshResponse.body!.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } catch (e: any) {
          // Emit an SSE error event so the client can surface it instead of spinning
          const errChunk = `data: ${JSON.stringify({ error: e?.message || "Stream error" })}\n\n`;
          controller.enqueue(encoder.encode(errChunk));
        } finally {
          controller.close();
        }
      }
    });

    // Return SSE stream
    return new Response(customStream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream"
      }
    });

  } catch (err: any) {
    console.error("[ai-chat-v2] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}, { port: parseInt(Deno.env.get("PORT") || "8000") });
