import { Agent } from '@/types';

/**
 * Get agent name from agents array by agentId
 * Falls back to 'Unknown Agent' if not found
 */
export function getAgentName(agents: Agent[], agentId: string): string {
  return agents.find(a => a.id === agentId)?.name || 'Unknown Agent';
}

/**
 * Get agent by ID from agents array
 */
export function getAgentById(agents: Agent[], agentId: string): Agent | undefined {
  return agents.find(a => a.id === agentId);
}
