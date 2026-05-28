import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserPlus, Loader2, Mail, Lock, Building2, User, Phone, MapPin } from 'lucide-react';

interface AddRepDialogProps {
  isOpen: boolean;
  onClose: () => void;
  managerId: string;
  onRepAdded: () => void;
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

export function AddRepDialog({ isOpen, onClose, managerId, onRepAdded }: AddRepDialogProps) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setBusinessName('');
    setContactName('');
    setPhone('');
    setCity('');
    setState('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password || !businessName || !contactName || !phone || !city || !state) {
      toast.error('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (authError) {
        toast.error('Failed to create account: ' + authError.message);
        setLoading(false);
        return;
      }

      if (!authData.user) {
        toast.error('User creation failed — no user returned');
        setLoading(false);
        return;
      }

      // 2. Insert into users table with sales_rep role and this manager
      const { error: insertError } = await supabase.from('users').insert({
        id: authData.user.id,
        email: email.trim(),
        business_name: businessName.trim(),
        contact_name: contactName.trim(),
        phone: phone.trim(),
        city: city.trim(),
        state,
        role: 'sales_rep',
        manager_id: managerId,
        status: 'approved',
        source: 'manager_invite',
      });

      if (insertError) {
        toast.error('Failed to save profile: ' + insertError.message);
        setLoading(false);
        return;
      }

      // 3. Log audit
      await supabase.from('audit_log').insert({
        action: 'rep_created_by_manager',
        table_name: 'users',
        record_id: authData.user.id,
        new_data: JSON.stringify({ email, business_name: businessName, contact_name: contactName, state, city }),
        user_id: managerId,
      });

      toast.success(`Sales rep ${contactName} created successfully!`);
      resetForm();
      onRepAdded();
      onClose();
    } catch (err: any) {
      toast.error('Error: ' + (err?.message || 'Unknown error'));
    }

    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-[#0a0514] border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#44f80c]" />
            Add New Sales Rep
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Create a new sales rep account. They will receive an email confirmation to activate their account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="rep-email" className="text-gray-300 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-[#9a02d0]" />
              Email Address *
            </Label>
            <Input
              id="rep-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rep@company.com"
              className="bg-[#150f24] border-white/10 text-white placeholder:text-gray-600"
              required
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="rep-password" className="text-gray-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#9a02d0]" />
              Temporary Password *
            </Label>
            <Input
              id="rep-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              className="bg-[#150f24] border-white/10 text-white placeholder:text-gray-600"
              required
              minLength={6}
            />
            <p className="text-xs text-gray-500">They can change this after first login.</p>
          </div>

          {/* Contact Name */}
          <div className="space-y-1.5">
            <Label htmlFor="rep-contact" className="text-gray-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#9a02d0]" />
              Contact Name *
            </Label>
            <Input
              id="rep-contact"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="John Smith"
              className="bg-[#150f24] border-white/10 text-white placeholder:text-gray-600"
              required
            />
          </div>

          {/* Business Name */}
          <div className="space-y-1.5">
            <Label htmlFor="rep-business" className="text-gray-300 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#9a02d0]" />
              Business / Company Name *
            </Label>
            <Input
              id="rep-business"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="ACME Sales LLC"
              className="bg-[#150f24] border-white/10 text-white placeholder:text-gray-600"
              required
            />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="rep-phone" className="text-gray-300 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-[#9a02d0]" />
              Phone Number *
            </Label>
            <Input
              id="rep-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              className="bg-[#150f24] border-white/10 text-white placeholder:text-gray-600"
              required
            />
          </div>

          {/* City + State */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rep-city" className="text-gray-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#9a02d0]" />
                City *
              </Label>
              <Input
                id="rep-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Los Angeles"
                className="bg-[#150f24] border-white/10 text-white placeholder:text-gray-600"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300">State *</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger className="bg-[#150f24] border-white/10 text-white">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent className="bg-[#150f24] border-white/10 max-h-60">
                  {US_STATES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="border-white/10 text-gray-300 hover:bg-white/5 flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-[#44f80c] to-[#9a02d0] text-white hover:opacity-90 flex-1"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4 mr-1" />
              )}
              {loading ? 'Creating...' : 'Create Sales Rep'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
