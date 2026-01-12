import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PromoCode {
  id: string;
  code: string;
  discount_amount: number;
  discount_type: 'fixed' | 'percentage';
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  current_uses: number;
  is_active: boolean;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromoCodeValidation {
  isValid: boolean;
  code: PromoCode | null;
  error: string | null;
  savings: number | null;
}

export function usePromoCodes() {
  return useQuery({
    queryKey: ['promo-codes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PromoCode[];
    },
  });
}

export function useActivePromoCodes() {
  return useQuery({
    queryKey: ['promo-codes', 'active'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('promo_codes')
        .select('code, discount_amount, discount_type, description, max_uses, current_uses, valid_from, valid_until')
        .eq('is_active', true);

      if (error) throw error;
      
      // Filter to only show currently valid codes that haven't exceeded usage limits
      return (data || []).filter(code => {
        // Check validity dates
        if (code.valid_from && today < code.valid_from) return false;
        if (code.valid_until && today > code.valid_until) return false;
        // Check usage limits
        if (code.max_uses !== null && code.current_uses >= code.max_uses) return false;
        return true;
      }) as Pick<PromoCode, 'code' | 'discount_amount' | 'discount_type' | 'description' | 'max_uses' | 'current_uses' | 'valid_from' | 'valid_until'>[];
    },
  });
}

export function useValidatePromoCode() {
  return useMutation({
    mutationFn: async ({ code, weeklyRent }: { code: string; weeklyRent: number }): Promise<PromoCodeValidation> => {
      if (!code.trim()) {
        return { isValid: false, code: null, error: null, savings: null };
      }

      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', code.toUpperCase().trim())
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        return { isValid: false, code: null, error: 'Error validating code', savings: null };
      }

      if (!data) {
        return { isValid: false, code: null, error: 'Invalid promo code', savings: null };
      }

      const promoCode = data as PromoCode;
      const today = new Date().toISOString().split('T')[0];

      // Check validity dates
      if (promoCode.valid_from && today < promoCode.valid_from) {
        return { isValid: false, code: null, error: 'Promo code not yet active', savings: null };
      }

      if (promoCode.valid_until && today > promoCode.valid_until) {
        return { isValid: false, code: null, error: 'Promo code has expired', savings: null };
      }

      // Check usage limits
      if (promoCode.max_uses !== null && promoCode.current_uses >= promoCode.max_uses) {
        return { isValid: false, code: null, error: 'Promo code usage limit reached', savings: null };
      }

      // Calculate savings
      let savings: number;
      if (promoCode.discount_type === 'percentage') {
        savings = (weeklyRent * promoCode.discount_amount) / 100;
      } else {
        savings = promoCode.discount_amount;
      }

      return { isValid: true, code: promoCode, error: null, savings };
    },
  });
}

export function useCreatePromoCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (promoCode: Omit<PromoCode, 'id' | 'current_uses' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('promo_codes')
        .insert({
          code: promoCode.code.toUpperCase().trim(),
          discount_amount: promoCode.discount_amount,
          discount_type: promoCode.discount_type,
          valid_from: promoCode.valid_from,
          valid_until: promoCode.valid_until,
          max_uses: promoCode.max_uses,
          is_active: promoCode.is_active,
          description: promoCode.description,
          created_by: promoCode.created_by,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promo-codes'] });
      toast.success('Promo code created successfully');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('A promo code with this code already exists');
      } else {
        toast.error('Failed to create promo code');
      }
    },
  });
}

export function useUpdatePromoCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PromoCode> & { id: string }) => {
      const { data, error } = await supabase
        .from('promo_codes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promo-codes'] });
      toast.success('Promo code updated successfully');
    },
    onError: () => {
      toast.error('Failed to update promo code');
    },
  });
}

export function useDeletePromoCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('promo_codes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promo-codes'] });
      toast.success('Promo code deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete promo code');
    },
  });
}
