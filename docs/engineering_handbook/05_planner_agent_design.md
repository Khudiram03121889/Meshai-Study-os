# 05 - Planner Agent Design

## 1. Purpose
The Planner Agent is the most critical new component in StudyOS V2. It acts as the "brain" before the main LLM reasons. It replaces the old paradigm of "retrieve everything and let the LLM sort it out" with a structured, cost-aware decision-making process.

## 2. Responsibilities
Determine:
- What the user is asking.
- Which information is actually required.
- Whether retrieval is necessary at all.
- Which tools should be called from the Tool Registry.
- Which memories are relevant.
- How much token budget should be allocated.
- Whether cached knowledge can answer the request.

## 3. Workflow Examples

### Example 1: Conceptual Question
**Question**: "Explain Kirchhoff's Law."
**Planner Decision**:
- No note retrieval.
- No test retrieval.
- No mistake retrieval.
- Use general reasoning (GPT's internal knowledge).
- **Result**: Fast response, zero retrieval cost.

### Example 2: Personalized Diagnostic
**Question**: "Why did I lose marks in Kirchhoff's Law?"
**Planner Decision**:
- Retrieve mistakes (filter: Kirchhoff's Law).
- Retrieve previous tests (filter: Kirchhoff's Law).
- Retrieve confidence history.
- Retrieve revision history.
- **Result**: Deeply personalized analysis.

### Example 3: Predictive Planning
**Question**: "What will Physics sir probably teach tomorrow?"
**Planner Decision**:
- Retrieve lecture timeline.
- Retrieve continuity context.
- Retrieve syllabus progress.
- Retrieve lecturer profile.

## 4. Implementation Guidance
- The Planner should output structured JSON defining the execution plan.
- The Planner can be powered by a fast, cheap model (e.g., GPT-4o-mini or Claude 3 Haiku) instructed specifically to output JSON plans, not converse with the user.

## 5. Acceptance Criteria
- [ ] Planner accurately identifies when *not* to use retrieval.
- [ ] Planner selects the correct subset of tools for complex queries.

## 6. Risks
- **Planner Failure**: If the Planner classifies a request incorrectly, it may omit crucial context, leading to a poor final answer.

## 7. Future Extension Points
- Fine-tuning a smaller model specifically on historical Planner decisions to reduce latency and costs further.
