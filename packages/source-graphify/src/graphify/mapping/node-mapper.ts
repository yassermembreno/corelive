import { createEvidenceId } from '@corelive/core-engine';
import { NodeType, type GraphNode } from '@corelive/domain';
import { isAbsolute, relative } from 'node:path';

import type { NodeMapper } from '../../contracts/node-mapper.js';
import type { GraphifyNode } from '../graphify-node.js';
import type { GraphifyNodeMetadata } from './graphify-node-metadata.js';

const CODE_FILE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.py',
  '.java',
  '.go',
  '.rs',
  '.rb',
  '.php',
  '.cs',
  '.cpp',
  '.c',
  '.h',
  '.swift',
  '.kt',
  '.scala',
] as const;

const GRAPHIFY_NODE_ID_PREFIX = 'graphify:' as const;

export function toGraphifyNodeId(originalId: string): string {
  return `${GRAPHIFY_NODE_ID_PREFIX}${originalId}`;
}

function endsWithCodeExtension(value: string): boolean {
  const lower = value.toLowerCase();
  return CODE_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function inferNodeType(node: GraphifyNode): NodeType {
  const label = node.label;

  if (endsWithCodeExtension(label)) {
    return NodeType.FILE;
  }

  if (label.startsWith('.') && label.endsWith('()')) {
    return NodeType.METHOD;
  }

  if (label.endsWith('()')) {
    return NodeType.FUNCTION;
  }

  if (/^[A-Z][a-zA-Z0-9]*$/.test(label)) {
    return NodeType.CLASS;
  }

  return NodeType.UNKNOWN;
}

function parseStartLine(sourceLocation?: string): number | undefined {
  if (!sourceLocation) {
    return undefined;
  }

  const match = /^L(\d+)(?:-L(\d+))?$/.exec(sourceLocation.trim());
  if (!match) {
    return undefined;
  }

  return Number.parseInt(match[1], 10);
}

function parseEndLine(sourceLocation?: string): number | undefined {
  if (!sourceLocation) {
    return undefined;
  }

  const match = /^L(\d+)(?:-L(\d+))?$/.exec(sourceLocation.trim());
  if (!match?.[2]) {
    return undefined;
  }

  return Number.parseInt(match[2], 10);
}

export function relativizeSourceFile(
  sourceFile: string | undefined,
  repositoryRoot?: string,
): string {
  if (!sourceFile) {
    return '';
  }

  const normalized = sourceFile.replace(/\\/g, '/');

  if (repositoryRoot && isAbsolute(sourceFile)) {
    return relative(repositoryRoot, sourceFile).replace(/\\/g, '/');
  }

  return normalized;
}

export function mapGraphifyNode(
  node: GraphifyNode,
  options: { repositoryRoot?: string } = {},
): GraphNode<GraphifyNodeMetadata> {
  const type = inferNodeType(node);
  const filePath = relativizeSourceFile(node.source_file, options.repositoryRoot);
  const sourceType =
    typeof node.file_type === 'string'
      ? node.file_type
      : typeof node._origin === 'string'
        ? node._origin
        : undefined;

  return {
    id: toGraphifyNodeId(node.id),
    type,
    name: node.label,
    location: {
      filePath,
      startLine: parseStartLine(node.source_location),
      endLine: parseEndLine(node.source_location),
    },
    evidence: [
      {
        id: createEvidenceId(),
        source: 'graphify',
        origin: typeof node._origin === 'string' ? node._origin : 'unknown',
        filePath: filePath || undefined,
        location: node.source_location,
      },
    ],
    metadata: {
      producer: 'graphify',
      sourceFile: node.source_file,
      sourceLocation: node.source_location,
      ...(sourceType ? { sourceType } : {}),
    },
  };
}

export class GraphifyNodeMapper implements NodeMapper<GraphifyNode> {
  constructor(private readonly repositoryRoot?: string) {}

  map(node: GraphifyNode): GraphNode<GraphifyNodeMetadata> {
    return mapGraphifyNode(node, { repositoryRoot: this.repositoryRoot });
  }
}
