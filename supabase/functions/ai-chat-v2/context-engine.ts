/**
 * MeshStudy AI — Context Engine & Prompt Builder (Handbook §19 §8, §19 §9)
 *
 * Compresses raw database rows into dense XML context blocks to minimize
 * token usage. Applies strict token limits (default 4k).
 */

import { ToolResult } from "./tool-registry.ts";

export interface ContextData {
  xmlContext: string;
  totalTokensEstimate: number;
}

// Rough estimate: 1 word ~ 1.3 tokens
function estimateTokens(text: string): number {
  return Math.ceil((text.match(/\S+/g)?.length || 0) * 1.3);
}

export function buildContext(results: ToolResult[], tokenBudget: number = 4000): ContextData {
  let xml = "<context>\n";
  let usedTokens = 10; // Overhead

  for (const res of results) {
    if (!res.data || res.data.length === 0) continue;

    const blockStart = `  <source tool="${res.tool}">\n`;
    let blockContent = "";

    // Format based on tool
    if (res.tool === "SearchMistakes") {
      blockContent = res.data.map(d => `    Mistake[${d.topic}]: ${d.notes} (conf: ${d.confidence_score})`).join("\n");
    } else if (res.tool === "SearchNotes") {
      blockContent = res.data.map(d => `    Note[p${d.page_number}]: ${d.chunk_text}`).join("\n");
    } else if (res.tool === "SearchLectureTimeline") {
      blockContent = res.data.map(d => `    Class[${d.session_date}]: ${d.title} - ${d.summary}`).join("\n");
    } else if (res.tool === "SearchRevisionQueue") {
      blockContent = res.data.map(d => `    Revise[${d.topic}]: level ${d.confidence_level}, times revised: ${d.revision_count}`).join("\n");
    } else if (res.tool === "SearchMemories") {
      blockContent = res.data.map(d => `    Memory[${d.memory_type}]: ${d.content}`).join("\n");
    } else if (res.tool === "SearchPreviousChats") {
      blockContent = res.data.map(d => `    Chat[${d.role}]: ${d.message}`).join("\n");
    } else {
      blockContent = res.data.map(d => JSON.stringify(d)).join("\n");
    }

    const blockEnd = `\n  </source>\n`;
    const blockText = blockStart + blockContent + blockEnd;
    const blockTokens = estimateTokens(blockText);

    if (usedTokens + blockTokens > tokenBudget) {
      xml += `  <!-- truncated: token budget reached -->\n`;
      break;
    }

    xml += blockText;
    usedTokens += blockTokens;
  }

  xml += "</context>";

  // If no tools yielded data, provide empty context
  if (usedTokens <= 10) {
    xml = "<context>\n  <!-- no context retrieved -->\n</context>";
  }

  return {
    xmlContext: xml,
    totalTokensEstimate: usedTokens
  };
}

export function buildSystemPrompt(userPreferences: any, xmlContext: string, language: string = "english"): string {
  // Identity Memory and Preferences
  const style = userPreferences?.explanation_style || 'balanced';
  const detail = userPreferences?.detail_level || 'medium';
  const board = userPreferences?.board || 'CBSE';
  const exam = userPreferences?.exam_priority || 'boards';

  let languageRule = "";
  if (language === "hinglish") {
    languageRule = `\n- Language & Explanations: You MUST explain concepts in Hinglish (a natural, conversational mixture of Hindi and English, written in the Latin/Roman script), which is the standard instructional style of top Indian coaching institutes (like Allen, FIITJEE, PhysicsWallah). Use English for all formal technical terms (e.g., "electrostatics", "electronegativity", "calculus", "equation", "derivative") but explain the intuition, questions, and connecting logic in Hindi using Latin script (e.g., "Ab hum is formula ko application ke sath samjhenge", "Is equation ko derivative lekar simplify karo").`;
  } else if (language === "hindi") {
    languageRule = `\n- Language & Explanations: Explain concepts in Hindi (using Devanagari script). Keep all core technical exam terms (e.g., "force", "velocity", "differentiation") either in English or in parenthetical English transliteration so they remain recognizable for JEE/NEET/KCET exam preparation.`;
  } else {
    languageRule = `\n- Language & Explanations: Explain concepts strictly in English.`;
  }
  
  return `You are MeshStudy AI, a highly personalized, Socratic AI tutor.

User Preferences:
- Explanation Style: ${style}
- Detail Level: ${detail}
- Board: ${board} (Tailor your explanations, answers, and questions to how this specific board evaluates and formats questions)
- Competitive Exam Priority: ${exam.toUpperCase()} (Prioritize NEET or JEE relevant focus areas where applicable; if NEET, emphasize Botany/Zoology; if JEE, emphasize Mathematics)
${languageRule}

CRITICAL RULES:
1. Socratic Method: DO NOT just give the answer directly if the user is trying to solve a problem. Guide them.
2. Context: Actively USE the <context> below. The <source tool="SearchMemories"> block contains long-term memories about this student (mistakes, insights, preferences, working goals). The <source tool="SearchPreviousChats"> block contains prior AI tutor conversations. Reference them naturally ("Last time you struggled with...", "You mentioned you prefer...").
3. Contradictions: If the current conversation contradicts a stored memory (e.g. they now understand something they previously got wrong, or their preference changed), TRUST THE NEW EVIDENCE and briefly acknowledge the update. The reflection engine will refresh memory afterwards.
4. No Hallucinations: If the context doesn't contain the answer, rely on your base knowledge but mention it's not from their notes.
5. Encourage: Keep a supportive tone.

=== RETRIEVED CONTEXT ===
${xmlContext}
=========================
`;
}
