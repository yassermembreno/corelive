# CoreLive

> A living knowledge model for understanding software systems.

CoreLive transforms source code repositories into a structured, queryable model of software knowledge.

Instead of treating a repository as a collection of files, CoreLive builds a **living representation of the system**: its architecture, dependencies, execution flows, concepts, and evolution.

The goal is to enable humans and AI agents to understand, analyze, and reason about any software system.

---

## The Problem

Modern software systems are difficult to understand.

A repository contains:

- thousands of files
- implicit architectural decisions
- hidden dependencies
- undocumented business rules
- historical context

Traditional tools answer questions about code files.

CoreLive aims to answer questions about the **system itself**.

Examples:

- How does this feature work?
- What depends on this module?
- What breaks if I change this service?
- Where are architectural boundaries violated?
- How did the architecture evolve?

---



# Vision

CoreLive is building a **Digital Twin of software systems**.

The repository is transformed into a knowledge model:

```
Repository

      ↓

CoreLive Engine

      ↓

Software Knowledge Model

      ↓

Human & AI Reasoning
```

The model becomes the source of truth for:

- architecture analysis
- impact analysis
- documentation generation
- AI-assisted engineering
- software evolution understanding

---



# Core Principles



## Evidence First

CoreLive does not rely on AI guesses.

Every answer should be backed by evidence from:

- source code
- dependency graphs
- execution paths
- documentation
- repository history

---



## Core Before AI

The intelligence comes from the knowledge model.

LLMs and agents are consumers of CoreLive, not the foundation.

```
Repository

↓

Knowledge Model

↓

Agents

↓

LLM
```

---



## Language Agnostic

CoreLive should understand multiple ecosystems.

Initial targets:

- TypeScript
- JavaScript
- Python
- Java
- Go

Language support is implemented through parser plugins.

---



# Architecture

```
                         Repository

                              |

                              v

                         Parser Layer

                              |

                              v

                        Domain Model

                              |

                              v

                       Knowledge Graph

                              |

             +----------------+----------------+

             |                                 |

             v                                 v

      Semantic Knowledge              Reasoning Engine

             |                                 |

             +----------------+----------------+

                              |

                              v

                          AI Agents

                              |

                              v

                             LLM
```

---



# Monorepo Structure

```
corelive/

├── apps/

│   ├── api/          # Hono API

│   ├── cli/          # CoreLive CLI

│   └── dashboard/    # React visualization

│

├── packages/

│   ├── engine/       # Pipeline orchestration

│   ├── parser/       # Tree-sitter + language plugins

│   ├── graph/        # Knowledge graph engine

│   ├── knowledge/    # Semantic index and documents

│   ├── planner/      # Evidence planner

│   ├── agents/       # AI agents

│   ├── mcp/          # MCP server

│   ├── storage/      # Persistence adapters

│   ├── domain/       # CoreLive concepts

│   └── shared/       # Shared contracts

```

---



# Current Status

🚧 Early development

Current focus:

- [x] Monorepo foundation
- [ ] Domain model
- [ ] Repository indexing
- [ ] AST extraction
- [ ] Knowledge graph
- [ ] Query engine
- [ ] AI reasoning layer

---



# Roadmap



## Phase 1 — Core Engine

Build the foundation.

Capabilities:

- repository indexing
- file discovery
- symbol extraction
- graph creation

---



## Phase 2 — Knowledge Graph

Create the software model.

Support:

- nodes
- relationships
- traversal
- dependency analysis

---



## Phase 3 — Reasoning Engine

Allow CoreLive to answer questions.

Examples:

```
Who calls PaymentService?

Explain checkout flow.

What depends on Customer?
```

---



## Phase 4 — AI Agents

Specialized agents:

- Architecture Agent
- Impact Analysis Agent
- Documentation Agent
- Security Agent

---



## Phase 5 — Living Software Model

Connect software evolution:

- Git history
- pull requests
- runtime signals
- architecture changes

---



# Development



## Requirements

- Node.js >= 22
- pnpm >= 9

---



## Install

```bash
git clone <repository>

cd corelive

pnpm install
```

---



## Run development

```bash
pnpm dev
```

---



# Future Vision

CoreLive aims to become an intelligence layer for software engineering.

A future where developers and AI agents do not need to rediscover a codebase every time.

Instead:

```
Repository

↓

CoreLive

↓

Understanding

↓

Better Decisions
```

---



# License

TBD