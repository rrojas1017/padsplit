import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle, XCircle, UserPlus, ArrowRight, AlertTriangle } from 'lucide-react';
import { Agent } from '@/types';

interface AgentMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  csvAgentNames: string[];
  existingAgents: Agent[];
  sites: { id: string; name: string }[];
  onConfirm: (mapping: AgentMapping) => void;
}

export interface AgentMapping {
  // Maps CSV agent name -> agent ID (either existing or to-be-created)
  mappings: Record<string, string>;
  // Agent names to create with their assigned site
  toCreate: { name: string; siteId: string }[];
  // Agent names to skip (records with these agents will be excluded)
  toSkip: string[];
}

export function AgentMappingDialog({
  open,
  onOpenChange,
  csvAgentNames,
  existingAgents,
  sites,
  onConfirm,
}: AgentMappingDialogProps) {
  // Match status for each CSV agent name
  const matchStatus = useMemo(() => {
    const status: Record<string, { matched: boolean; matchedAgent?: Agent; suggestions: Agent[] }> = {};
    
    for (const csvName of csvAgentNames) {
      const normalizedCsv = csvName.toLowerCase().trim();
      
      // Exact match
      const exactMatch = existingAgents.find(
        a => a.name.toLowerCase().trim() === normalizedCsv
      );
      
      if (exactMatch) {
        status[csvName] = { matched: true, matchedAgent: exactMatch, suggestions: [] };
        continue;
      }
      
      // Fuzzy match suggestions (first name match, partial match)
      const suggestions = existingAgents.filter(a => {
        const agentName = a.name.toLowerCase();
        const csvFirst = normalizedCsv.split(' ')[0];
        const agentFirst = agentName.split(' ')[0];
        
        return (
          agentFirst === csvFirst ||
          agentName.includes(normalizedCsv) ||
          normalizedCsv.includes(agentName)
        );
      }).slice(0, 3);
      
      status[csvName] = { matched: false, matchedAgent: undefined, suggestions };
    }
    
    return status;
  }, [csvAgentNames, existingAgents]);
  
  // Track manual mappings for unmatched agents
  const [manualMappings, setManualMappings] = useState<Record<string, string>>({});
  
  // Track which agents to auto-create
  const [autoCreateAgents, setAutoCreateAgents] = useState<Set<string>>(() => {
    // Default: auto-create all unmatched agents
    return new Set(csvAgentNames.filter(name => !matchStatus[name]?.matched));
  });
  
  // Track which agents to skip
  const [skipAgents, setSkipAgents] = useState<Set<string>>(new Set());
  
  // Site for auto-created agents - default to PadSplit Internal
  const [createSiteId, setCreateSiteId] = useState('');
  
  // Update site ID when sites become available (fix race condition)
  useEffect(() => {
    if (sites.length > 0 && !createSiteId) {
      // Default to PadSplit Internal for unmatched agents
      const padsplitSite = sites.find(s => 
        s.name.toLowerCase().includes('padsplit') && 
        s.name.toLowerCase().includes('internal')
      );
      setCreateSiteId(padsplitSite?.id || sites[0].id);
    }
  }, [sites, createSiteId]);
  
  const unmatchedAgents = csvAgentNames.filter(name => !matchStatus[name]?.matched);
  const matchedAgents = csvAgentNames.filter(name => matchStatus[name]?.matched);
  
  const handleManualMap = (csvName: string, agentId: string) => {
    setManualMappings(prev => ({ ...prev, [csvName]: agentId }));
    setAutoCreateAgents(prev => {
      const next = new Set(prev);
      next.delete(csvName);
      return next;
    });
    setSkipAgents(prev => {
      const next = new Set(prev);
      next.delete(csvName);
      return next;
    });
  };
  
  const handleToggleAutoCreate = (csvName: string, checked: boolean) => {
    if (checked) {
      setAutoCreateAgents(prev => new Set(prev).add(csvName));
      setSkipAgents(prev => {
        const next = new Set(prev);
        next.delete(csvName);
        return next;
      });
      setManualMappings(prev => {
        const next = { ...prev };
        delete next[csvName];
        return next;
      });
    } else {
      setAutoCreateAgents(prev => {
        const next = new Set(prev);
        next.delete(csvName);
        return next;
      });
    }
  };
  
  const handleToggleSkip = (csvName: string, checked: boolean) => {
    if (checked) {
      setSkipAgents(prev => new Set(prev).add(csvName));
      setAutoCreateAgents(prev => {
        const next = new Set(prev);
        next.delete(csvName);
        return next;
      });
      setManualMappings(prev => {
        const next = { ...prev };
        delete next[csvName];
        return next;
      });
    } else {
      setSkipAgents(prev => {
        const next = new Set(prev);
        next.delete(csvName);
        return next;
      });
    }
  };
  
  const handleConfirm = () => {
    const mappings: Record<string, string> = {};
    const toCreate: { name: string; siteId: string }[] = [];
    const toSkip: string[] = [];
    
    for (const csvName of csvAgentNames) {
      if (matchStatus[csvName]?.matched) {
        // Matched agent
        mappings[csvName] = matchStatus[csvName].matchedAgent!.id;
      } else if (manualMappings[csvName]) {
        // Manually mapped
        mappings[csvName] = manualMappings[csvName];
      } else if (autoCreateAgents.has(csvName)) {
        // To be created - use placeholder ID
        mappings[csvName] = `__create__${csvName}`;
        toCreate.push({ name: csvName, siteId: createSiteId });
      } else if (skipAgents.has(csvName)) {
        // Skip
        toSkip.push(csvName);
      }
    }
    
    onConfirm({ mappings, toCreate, toSkip });
  };
  
  const allUnmatchedHandled = unmatchedAgents.every(
    name => manualMappings[name] || autoCreateAgents.has(name) || skipAgents.has(name)
  );
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Agent Mapping
          </DialogTitle>
          <DialogDescription>
            Review how agent names from the CSV map to existing agents.
            {unmatchedAgents.length > 0 && (
              <span className="text-warning"> {unmatchedAgents.length} agent(s) need attention.</span>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-4">
            {/* Matched Agents */}
            {matchedAgents.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-success" />
                  Matched Agents ({matchedAgents.length})
                </h4>
                <div className="space-y-1">
                  {matchedAgents.map(name => (
                    <div key={name} className="flex items-center gap-2 py-1.5 px-3 bg-success/10 rounded-lg text-sm">
                      <span className="font-medium">{name}</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">{matchStatus[name].matchedAgent?.name}</span>
                      <Badge variant="outline" className="ml-auto text-xs">
                        {matchStatus[name].matchedAgent?.siteName}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Unmatched Agents */}
            {unmatchedAgents.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  Unmatched Agents ({unmatchedAgents.length})
                </h4>
                
                {/* Default site for auto-create */}
                <div className="mb-3 p-3 bg-muted/50 rounded-lg">
                  <label className="text-xs font-medium text-muted-foreground">
                    Site for new agents:
                  </label>
                  <Select value={createSiteId} onValueChange={setCreateSiteId}>
                    <SelectTrigger className="w-48 h-8 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sites.map(site => (
                        <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  {unmatchedAgents.map(name => (
                    <div key={name} className="p-3 border border-warning/30 bg-warning/5 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <XCircle className="w-4 h-4 text-warning" />
                        <span className="font-medium">{name}</span>
                      </div>
                      
                      <div className="flex flex-wrap gap-4 text-sm">
                        {/* Auto-create option */}
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={autoCreateAgents.has(name)}
                            onCheckedChange={(checked) => handleToggleAutoCreate(name, !!checked)}
                          />
                          <UserPlus className="w-3 h-3" />
                          <span>Create new agent</span>
                        </label>
                        
                        {/* Skip option */}
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={skipAgents.has(name)}
                            onCheckedChange={(checked) => handleToggleSkip(name, !!checked)}
                          />
                          <XCircle className="w-3 h-3" />
                          <span>Skip records</span>
                        </label>
                        
                        {/* Manual map */}
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">or map to:</span>
                          <Select
                            value={manualMappings[name] || ''}
                            onValueChange={(value) => handleManualMap(name, value)}
                          >
                            <SelectTrigger className="w-40 h-7 text-xs">
                              <SelectValue placeholder="Select agent..." />
                            </SelectTrigger>
                            <SelectContent>
                              {existingAgents.map(agent => (
                                <SelectItem key={agent.id} value={agent.id}>
                                  {agent.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      {/* Suggestions */}
                      {matchStatus[name]?.suggestions.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Similar: {matchStatus[name].suggestions.map(s => s.name).join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!allUnmatchedHandled}>
            Confirm Mapping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
