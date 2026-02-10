import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Settings, Edit2, Info } from 'lucide-react';
import { SOWPricingConfig, SOW_CATEGORY_LABELS, SOW_UNIT_LABELS, formatCurrency } from '@/utils/billingCalculations';
import { toast } from 'sonner';

interface SOWPricingConfigProps {
  pricing: SOWPricingConfig[];
  onUpdate: (id: string, updates: Partial<SOWPricingConfig>) => Promise<void>;
}

const SOWPricingConfigComponent = ({ pricing, onUpdate }: SOWPricingConfigProps) => {
  const [editingItem, setEditingItem] = useState<SOWPricingConfig | null>(null);
  const [formData, setFormData] = useState({
    base_rate: 0,
    volume_tier_1_threshold: 0,
    volume_tier_1_rate: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openEdit = (item: SOWPricingConfig) => {
    setEditingItem(item);
    setFormData({
      base_rate: Number(item.base_rate),
      volume_tier_1_threshold: item.volume_tier_1_threshold || 0,
      volume_tier_1_rate: Number(item.volume_tier_1_rate) || 0,
    });
  };

  const handleSave = async () => {
    if (!editingItem) return;
    setIsSubmitting(true);
    try {
      await onUpdate(editingItem.id, {
        base_rate: formData.base_rate,
        volume_tier_1_threshold: formData.volume_tier_1_threshold || null,
        volume_tier_1_rate: formData.volume_tier_1_rate || null,
      } as any);
      toast.success('Pricing updated');
      setEditingItem(null);
    } catch {
      toast.error('Failed to update pricing');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5" />
            SOW Pricing Configuration
          </CardTitle>
          <CardDescription>
            Manage per-unit pricing rates as defined in the Statement of Work
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Base Rate</TableHead>
                <TableHead className="text-right">Volume Tier</TableHead>
                <TableHead className="text-right">Discounted Rate</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pricing.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-sm">
                    {SOW_CATEGORY_LABELS[item.service_category] || item.service_category}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {SOW_UNIT_LABELS[item.unit] || item.unit}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatCurrency(Number(item.base_rate))}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {item.volume_tier_1_threshold
                      ? `≥ ${item.volume_tier_1_threshold.toLocaleString()}`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {item.volume_tier_1_rate ? formatCurrency(Number(item.volume_tier_1_rate)) : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.is_optional ? 'outline' : 'default'} className="text-xs">
                      {item.is_optional ? 'Optional' : 'Core'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* SOW Terms Reference */}
          <div className="mt-6 rounded-md bg-muted/50 p-4 text-sm space-y-2">
            <div className="flex items-center gap-2 font-medium">
              <Info className="h-4 w-4" />
              SOW Commercial Terms
            </div>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground text-xs">
              <li>No fixed platform fees, monthly subscriptions, or per-seat fees</li>
              <li>All charges are strictly usage-based and auditable</li>
              <li>Reprocessing billed at the same rate as original processing</li>
              <li>Voice Coaching is not subject to AI Processing volume discounts</li>
              <li>Invoices issued monthly · Payment Net 15 or Net 30</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit Pricing: {editingItem ? SOW_CATEGORY_LABELS[editingItem.service_category] : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Base Rate ($)</Label>
              <Input
                type="number"
                step="0.001"
                min="0"
                value={formData.base_rate}
                onChange={(e) => setFormData({ ...formData, base_rate: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Volume Discount Threshold (records/month)</Label>
              <Input
                type="number"
                min="0"
                value={formData.volume_tier_1_threshold}
                onChange={(e) => setFormData({ ...formData, volume_tier_1_threshold: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Discounted Rate ($)</Label>
              <Input
                type="number"
                step="0.001"
                min="0"
                value={formData.volume_tier_1_rate}
                onChange={(e) => setFormData({ ...formData, volume_tier_1_rate: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setEditingItem(null)}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SOWPricingConfigComponent;
