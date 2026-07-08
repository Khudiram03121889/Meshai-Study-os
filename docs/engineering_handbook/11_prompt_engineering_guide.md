# 11 - Prompt Engineering Guide

## 1. Purpose
Standardize how prompts are built across the Planner, the Reasoning Model, and the Reflection Layer to ensure consistent, high-quality, JSON-parsable (where needed) outputs.

## 2. Core Prompting Philosophies
- **Systematic Structure**: Every prompt should have a `Role`, `Context`, `Task`, `Constraints`, and `Output Format`.
- **Few-Shot over Zero-Shot**: Always provide 1-2 examples of desired output, especially for the Planner and Reflection layers.

## 3. Standard Templates

### 3.1 Planner Prompt Template
```markdown
# Role
You are the StudyOS V2 Planner Agent. Your job is NOT to answer the user's question. Your job is to determine what data is needed to answer it.

# Context
User Request: {user_input}
Recent Memory: {short_term_context}

# Task
Determine if retrieval is necessary. If yes, select the tools to run.

# Output Format
Return ONLY valid JSON:
{
  "requires_retrieval": boolean,
  "tools_to_call": ["search_mistakes", "search_notes"],
  "search_queries": ["Kirchhoff's Law"]
}
```

### 3.2 Reasoning Prompt Template
```markdown
# Role
You are StudyOS, a personalized academic mentor.

# Student Context
{identity_memory}
{preferences}

# Retrieved Context
{context_engine_output}

# Task
Answer the user's query: {user_input}

# Constraints
- Rely primarily on the Retrieved Context.
- Do not mention that you are an AI or that you retrieved documents.
- Adopt the user's preferred explanation style.
```

## 4. Implementation Guidance
- Store prompts externally (e.g., in the database or a specialized Prompt CMS) rather than hardcoding them, allowing for non-developer tuning.

## 5. Acceptance Criteria
- [ ] Prompts generate consistent, hallucination-free responses.
- [ ] JSON outputs from the Planner and Reflection layers parse without errors 99.9% of the time.

## 6. Risks
- **Model Drift**: OpenAI/Anthropic model updates can unexpectedly change how they interpret existing prompts.
