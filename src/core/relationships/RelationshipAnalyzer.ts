import { ParseResult, ParsedNode } from '../types';
import { Relationship } from './Relationship';

export interface NodeMap {
  [key: string]: {
    node: ParsedNode;
    result: ParseResult;
  };
}

export interface RelationshipAnalyzer {
  analyze(parseResults: ParseResult[], nodeMap: Map<string, {node: ParsedNode, result: ParseResult}>): Relationship[];
  getName(): string;
}