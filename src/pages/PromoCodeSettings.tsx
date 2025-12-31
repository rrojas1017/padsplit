import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tag, Plus, Pencil, Trash2, Sparkles, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { usePromoCodes, useCreatePromoCode, useUpdatePromoCode, useDeletePromoCode, PromoCode } from '@/hooks/usePromoCodes';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface PromoCodeFormData {
  code: string;
  discount_amount: number;
  discount_type: 'fixed' | 'percentage';
  valid_from: string;
  valid_until: string;
  max_uses: string;
  is_active: boolean;
  description: string;
}

const initialFormData: PromoCodeFormData = {
  code: '',
  discount_amount: 0,
  discount_type: 'fixed',
  valid_from: '',
  valid_until: '',
  max_uses: '',
  is_active: true,
  description: '',
};

export default function PromoCodeSettings() {
  const { user } = useAuth();
  const { data: promoCodes, isLoading } = usePromoCodes();
  const createMutation = useCreatePromoCode();
  const updateMutation = useUpdatePromoCode();
  const deleteMutation = useDeletePromoCode();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<PromoCode | null>(null);
  const [formData, setFormData] = useState<PromoCodeFormData>(initialFormData);

  const handleOpenCreate = () => {
    setEditingCode(null);
    setFormData(initialFormData);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (code: PromoCode) => {
    setEditingCode(code);
    setFormData({
      code: code.code,
      discount_amount: code.discount_amount,
      discount_type: code.discount_type,
      valid_from: code.valid_from || '',
      valid_until: code.valid_until || '',
      max_uses: code.max_uses?.toString() || '',
      is_active: code.is_active,
      description: code.description || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.code.trim()) {
      toast.error('Please enter a promo code');
      return;
    }
    if (formData.discount_amount <= 0) {
      toast.error('Please enter a valid discount amount');
      return;
    }

    const payload = {
      code: formData.code,
      discount_amount: formData.discount_amount,
      discount_type: formData.discount_type,
      valid_from: formData.valid_from || null,
      valid_until: formData.valid_until || null,
      max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
      is_active: formData.is_active,
      description: formData.description || null,
      created_by: user?.id || null,
    };

    if (editingCode) {
      await updateMutation.mutateAsync({ id: editingCode.id, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }

    setIsDialogOpen(false);
    setFormData(initialFormData);
    setEditingCode(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this promo code?')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  return (
    <DashboardLayout title="Promo Codes" subtitle="Manage promotional codes for move-in discounts">
      <div className="space-y-6">
        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/15 via-primary/10 to-transparent border border-primary/20 p-6 md:p-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Tag className="w-6 h-6 text-primary" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                  Promo Code Management
                </h1>
                <p className="text-muted-foreground max-w-2xl">
                  Create and manage promotional codes for move-in discounts.
                  Track usage and set validity periods.
                </p>
              </div>
            </div>
            <Button onClick={handleOpenCreate} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Promo Code
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Tag className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Codes</p>
                  <p className="text-2xl font-bold">{promoCodes?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Codes</p>
                  <p className="text-2xl font-bold">
                    {promoCodes?.filter((c) => c.is_active).length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Uses</p>
                  <p className="text-2xl font-bold">
                    {promoCodes?.reduce((sum, c) => sum + c.current_uses, 0) || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Promo Codes Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Promo Codes</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : promoCodes && promoCodes.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Validity</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promoCodes.map((code) => (
                    <TableRow key={code.id}>
                      <TableCell>
                        <span className="font-mono font-semibold">{code.code}</span>
                        {code.description && (
                          <p className="text-xs text-muted-foreground mt-1">{code.description}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        {code.discount_type === 'fixed'
                          ? `$${code.discount_amount.toFixed(2)}`
                          : `${code.discount_amount}%`}
                      </TableCell>
                      <TableCell>
                        {code.valid_from && code.valid_until ? (
                          <span className="text-sm">
                            {format(new Date(code.valid_from), 'MMM d')} -{' '}
                            {format(new Date(code.valid_until), 'MMM d, yyyy')}
                          </span>
                        ) : code.valid_until ? (
                          <span className="text-sm">
                            Until {format(new Date(code.valid_until), 'MMM d, yyyy')}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">No expiry</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {code.max_uses ? (
                          <span>
                            {code.current_uses} / {code.max_uses}
                          </span>
                        ) : (
                          <span>{code.current_uses} uses</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={code.is_active ? 'default' : 'secondary'}>
                          {code.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(code)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(code.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <Tag className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">No promo codes yet</p>
                <Button onClick={handleOpenCreate} variant="outline" className="mt-4">
                  Create your first promo code
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingCode ? 'Edit Promo Code' : 'Create Promo Code'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g., SAVE200"
                  className="font-mono uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="discount">Discount Amount</Label>
                  <Input
                    id="discount"
                    type="number"
                    value={formData.discount_amount}
                    onChange={(e) =>
                      setFormData({ ...formData, discount_amount: parseFloat(e.target.value) || 0 })
                    }
                    min={0}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={formData.discount_type}
                    onValueChange={(value: 'fixed' | 'percentage') =>
                      setFormData({ ...formData, discount_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed ($)</SelectItem>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="valid_from">Valid From</Label>
                  <Input
                    id="valid_from"
                    type="date"
                    value={formData.valid_from}
                    onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valid_until">Valid Until</Label>
                  <Input
                    id="valid_until"
                    type="date"
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_uses">Max Uses (leave empty for unlimited)</Label>
                <Input
                  id="max_uses"
                  type="number"
                  value={formData.max_uses}
                  onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                  placeholder="Unlimited"
                  min={1}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What is this promo code for?"
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Active</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingCode ? 'Save Changes' : 'Create Code'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
