import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CostSummary } from '@/hooks/useBillingData';
import { formatCurrency, FUNCTION_LABELS } from '@/utils/billingCalculations';

interface FunctionCostsTableProps {
  summary: CostSummary;
}

const FunctionCostsTable = ({ summary }: FunctionCostsTableProps) => {
  const functionData = Object.entries(summary.byFunction)
    .map(([fn, data]) => ({
      name: FUNCTION_LABELS[fn] || fn,
      rawName: fn,
      ...data,
      avgCost: data.cost / data.count,
    }))
    .sort((a, b) => b.cost - a.cost);

  const totalCost = functionData.reduce((sum, f) => sum + f.cost, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Cost by Edge Function</CardTitle>
        <CardDescription>
          Breakdown of API costs by function type
        </CardDescription>
      </CardHeader>
      <CardContent>
        {functionData.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Function</TableHead>
                <TableHead className="text-right">Calls</TableHead>
                <TableHead className="text-right">Total Cost</TableHead>
                <TableHead className="text-right">Avg/Call</TableHead>
                <TableHead className="text-right">% of Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {functionData.map((fn) => (
                <TableRow key={fn.rawName}>
                  <TableCell>
                    <div className="font-medium">{fn.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {fn.rawName}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary">{fn.count}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(fn.cost)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCurrency(fn.avgCost)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline">
                      {totalCost > 0 ? ((fn.cost / totalCost) * 100).toFixed(1) : 0}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            No function cost data available
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FunctionCostsTable;
