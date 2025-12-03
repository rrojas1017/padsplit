import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Agent } from '@/types';
import { mockAgents, mockSites } from '@/data/mockData';

interface AgentsContextType {
  agents: Agent[];
  addAgent: (agent: Omit<Agent, 'id'>) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  deleteAgent: (id: string) => void;
  toggleAgentStatus: (id: string) => void;
}

const AgentsContext = createContext<AgentsContextType | undefined>(undefined);

export function AgentsProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>(() => {
    const saved = localStorage.getItem('padsplit-agents');
    if (saved) {
      return JSON.parse(saved);
    }
    return mockAgents;
  });

  useEffect(() => {
    localStorage.setItem('padsplit-agents', JSON.stringify(agents));
  }, [agents]);

  const addAgent = (agentData: Omit<Agent, 'id'>) => {
    const site = mockSites.find(s => s.id === agentData.siteId);
    const newAgent: Agent = {
      ...agentData,
      id: `agent-${Date.now()}`,
      siteName: site?.name || agentData.siteName,
    };
    setAgents(prev => [...prev, newAgent]);
  };

  const updateAgent = (id: string, updates: Partial<Agent>) => {
    setAgents(prev => prev.map(agent => {
      if (agent.id === id) {
        const updated = { ...agent, ...updates };
        if (updates.siteId) {
          const site = mockSites.find(s => s.id === updates.siteId);
          updated.siteName = site?.name || updated.siteName;
        }
        return updated;
      }
      return agent;
    }));
  };

  const deleteAgent = (id: string) => {
    setAgents(prev => prev.filter(agent => agent.id !== id));
  };

  const toggleAgentStatus = (id: string) => {
    setAgents(prev => prev.map(agent =>
      agent.id === id ? { ...agent, active: !agent.active } : agent
    ));
  };

  return (
    <AgentsContext.Provider value={{ agents, addAgent, updateAgent, deleteAgent, toggleAgentStatus }}>
      {children}
    </AgentsContext.Provider>
  );
}

export function useAgents() {
  const context = useContext(AgentsContext);
  if (!context) {
    throw new Error('useAgents must be used within an AgentsProvider');
  }
  return context;
}
