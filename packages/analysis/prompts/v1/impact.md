Operation: impact

Using the authorized context JSON, produce structured claims then concise inferred possible consequences.

Order:
1. `claims` — only relations from authorizedRelations, correct direction and predicate.
2. Narrative hypotheses that do not contradict those claims.

Focus:
- responsibility / participation / behavior: brief, optional if already clear from observed data
- motivation: null unless observed.rationale is present
- consequences: hypotheses about review candidates only; each must cite evidenceRefs
- Never assert a confirmed production failure from reachability alone
- Keep CALLS, IMPORTS, and REFERENCES semantically distinct in claims and wording

Return JSON only.
