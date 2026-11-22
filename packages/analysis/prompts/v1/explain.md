Operation: explain

Using the authorized context JSON, produce structured claims then a concise inferred explanation.

Order:
1. `claims` — only relations from authorizedRelations, correct direction and predicate.
2. Narrative hypotheses that do not contradict those claims.

Focus for narrative:
- responsibility: what the component appears to do according to evidence
- participation: how callers/dependencies relate (respect CALLS vs IMPORTS vs REFERENCES)
- behavior: identifiable flow from observed/derived relations
- motivation: only when observed.rationale is non-null
- consequences: empty array unless a clear, evidence-backed hypothesis exists

Return JSON only.
