Operation: explain

Using the authorized context JSON, produce a concise inferred explanation of the component.

Focus:
- responsibility: what the component appears to do according to evidence
- participation: how it relates to callers and dependencies in the context
- behavior: identifiable flow from observed/derived relations
- motivation: only when observed.rationale is non-null
- consequences: empty array for explain unless a clear, evidence-backed hypothesis exists

Return JSON only.
