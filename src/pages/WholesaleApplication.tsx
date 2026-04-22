import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Mail, Phone, MapPin, FileText, CheckCircle, ArrowRight, Loader2, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const VOLUME_OPTIONS = [
  { value: '0-100', label: '0-100 units/month' },
  { value: '100-500', label: '100-500 units/month' },
  { value: '500-1000', label: '500-1000 units/month' },
  { value: '1000+', label: '1000+ units/month' },
];

const BUSINESS_TYPE_OPTIONS = [
  { value: 'physical', label: 'Physical Store' },
  { value: 'online', label: 'Online Only' },
  { value: 'both', label: 'Both (Physical Store & Online)' },
];

const STATE_OPTIONS = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA',
  'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK',
  'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

export function WholesaleApplication() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showErrors, setShowErrors] = useState(false);
  const [influencerEnabled, setInfluencerEnabled] = useState(false);

  const [formData, setFormData] = useState({
    business_name: '',
    license_number: '',
    ein: '',
    website: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    volume_estimate: '',
    business_type: '',
    account_type: '', // 'wholesaler' | 'distributor' | 'influencer'
    agreeTerms: false,
    agreeCompliance: false,
  });

  // Fetch admin setting: is influencer application enabled?
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'application_config')
          .single();
        if (data?.value?.influencer_applications_enabled === true) {
          setInfluencerEnabled(true);
        }
      } catch {
        // Default: disabled
      }
    };
    fetchSettings();
  }, []);

  const updateField = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user types
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateStep1 = () => {
    if (!formData.business_name || !formData.license_number || !formData.ein || !formData.email || !formData.password || !formData.account_type) {
      return false;
    }
    // Business type required only for wholesalers
    if (formData.account_type === 'wholesaler' && !formData.business_type) {
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      return false;
    }
    if (formData.password.length < 8) {
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.phone || !formData.address || !formData.city || !formData.state || !formData.zip) {
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    // Volume estimate not required for influencers
    if (formData.account_type !== 'influencer' && !formData.volume_estimate) {
      return false;
    }
    if (!formData.agreeTerms) {
      return false;
    }
    return true;
  };

  const handleNext = () => {
    setShowErrors(true);
    if (step === 1 && validateStep1()) {
      setErrors({});
      setShowErrors(false);
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setErrors({});
      setShowErrors(false);
      setStep(3);
    } else if (step === 3 && validateStep3()) {
      handleSubmit();
    } else {
      // Show validation errors
      const newErrors: Record<string, string> = {};
      if (step === 1) {
        if (!formData.business_name) newErrors.business_name = 'Business name is required';
        if (!formData.license_number) newErrors.license_number = 'Business License # is required';
        if (!formData.ein) newErrors.ein = 'EIN/TaxID # is required';
        if (!formData.email) newErrors.email = 'Email is required';
        if (!formData.password) newErrors.password = 'Password is required';
        if (formData.password && formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
        if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
        if (!formData.account_type) newErrors.account_type = 'Account type is required';
        if (formData.account_type === 'wholesaler' && !formData.business_type) newErrors.business_type = 'Business type is required for wholesalers';
      } else if (step === 2) {
        if (!formData.phone) newErrors.phone = 'Phone number is required';
        if (!formData.address) newErrors.address = 'Address is required';
        if (!formData.city) newErrors.city = 'City is required';
        if (!formData.state) newErrors.state = 'State is required';
        if (!formData.zip) newErrors.zip = 'ZIP code is required';
      } else if (step === 3) {
        if (formData.account_type !== 'influencer' && !formData.volume_estimate) newErrors.volume_estimate = 'Please select estimated volume';
        if (!formData.agreeTerms) newErrors.agreeTerms = 'You must agree to the Terms of Service';
      }
      setErrors(newErrors);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // 1. Create Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
      });
      if (authError) {
        toast.error(authError.message);
        setLoading(false);
        return;
      }
      if (!authData.user) {
        toast.error('Failed to create account');
        setLoading(false);
        return;
      }

      // 2. Prepare user profile data
      const role = formData.account_type as 'wholesaler' | 'distributor' | 'influencer';
      const referralCode = role === 'influencer'
        ? `MICRO2-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
        : null;

      const userPayload = {
        id: authData.user.id,
        email: formData.email.trim(),
        role,
        business_name: formData.business_name,
        license_number: formData.license_number,
        ein: formData.ein,
        website: formData.website || null,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip: formData.zip,
        status: 'pending' as const,
        volume_estimate: role === 'influencer' ? null : (formData.volume_estimate || null),
        referral_code: referralCode,
        referral_count: 0,
        total_referral_sales: 0,
      };

      // 3. Insert into users table
      const { error: insertError } = await supabase.from('users').insert(userPayload);
      if (insertError) {
        // Rollback: delete auth user if profile insert fails
        await supabase.auth.admin.deleteUser(authData.user.id);
        toast.error('Failed to create profile: ' + insertError.message);
        setLoading(false);
        return;
      }

      toast.success('Application submitted successfully!');
      setSuccess(true);
    } catch (err: any) {
      toast.error(err?.message || 'An unexpected error occurred');
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0514] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 pt-24">
        <Card className="bg-[#150f24] border-white/10 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Application Submitted!</h2>
            <p className="text-gray-400 mb-6">
              Thank you for applying to join the microDOS(2) team. Our team will review your
              application and get back to you within 48 hours.
            </p>
            <div className="space-y-3">
              <Link to="/">
                <Button className="w-full bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white font-semibold">
                  Return to Home
                </Button>
              </Link>
              <Link to="/wholesaler-portal">
                <Button variant="outline" className="w-full border-[#9a02d0] text-[#9a02d0] hover:bg-[#9a02d0]/10">
                  Sign In
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0514] py-12 px-4 sm:px-6 lg:px-8 pt-24">
      <div className="max-w-2xl mx-auto">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <span className="text-3xl font-bold text-white">
              micro<span className="text-[#9a02d0]">DOS</span>
              <span className="text-[#44f80c]">(2)</span>
            </span>
          </Link>
          <h2 className="mt-4 text-2xl font-bold text-white">Commercial Account Application</h2>
          <p className="mt-2 text-gray-400">Apply to become an authorized microDOS(2) business partner</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  s <= step
                    ? 'bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white'
                    : 'bg-[#150f24] text-gray-500 border border-white/10'
                }`}
              >
                {s}
              </div>
              {s < 3 && (
                <div className={`w-16 h-0.5 ${s < step ? 'bg-gradient-to-r from-[#9a02d0] to-[#44f80c]' : 'bg-white/10'}`} />
              )}
            </div>
          ))}
        </div>

        <Card className="bg-[#150f24] border-white/10">
          <CardHeader>
            <CardTitle className="text-white">
              {step === 1 && 'Business Information'}
              {step === 2 && 'Contact Details'}
              {step === 3 && (formData.account_type === 'influencer' ? 'Terms & Agreement' : 'Terms & Volume')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              {step === 1 && (
                <>
                  {/* Account Type Selection */}
                  <div className="space-y-3">
                    <Label className="text-gray-300">
                      Account Type <span className="text-red-400">*</span>
                    </Label>
                    <div className={`flex gap-4 ${influencerEnabled ? 'flex-col sm:flex-row' : ''}`}>
                      <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors flex-1 ${
                        formData.account_type === 'wholesaler'
                          ? 'border-[#44f80c] bg-[#44f80c]/10'
                          : 'border-white/10 hover:border-white/30'
                      }`}>
                        <input
                          type="radio"
                          name="account_type"
                          value="wholesaler"
                          checked={formData.account_type === 'wholesaler'}
                          onChange={(e) => updateField('account_type', e.target.value)}
                          className="w-4 h-4 accent-[#44f80c]"
                        />
                        <span className="text-white">Wholesaler</span>
                      </label>
                      <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors flex-1 ${
                        formData.account_type === 'distributor'
                          ? 'border-[#9a02d0] bg-[#9a02d0]/10'
                          : 'border-white/10 hover:border-white/30'
                      }`}>
                        <input
                          type="radio"
                          name="account_type"
                          value="distributor"
                          checked={formData.account_type === 'distributor'}
                          onChange={(e) => updateField('account_type', e.target.value)}
                          className="w-4 h-4 accent-[#9a02d0]"
                        />
                        <span className="text-white">Distributor</span>
                      </label>
                      {influencerEnabled && (
                        <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors flex-1 ${
                          formData.account_type === 'influencer'
                            ? 'border-[#ff66c4] bg-[#ff66c4]/10'
                            : 'border-white/10 hover:border-white/30'
                        }`}>
                          <input
                            type="radio"
                            name="account_type"
                            value="influencer"
                            checked={formData.account_type === 'influencer'}
                            onChange={(e) => updateField('account_type', e.target.value)}
                            className="w-4 h-4 accent-[#ff66c4]"
                          />
                          <Users className="w-4 h-4 text-[#ff66c4]" />
                          <span className="text-white">Influencer</span>
                        </label>
                      )}
                    </div>
                    {showErrors && errors.account_type && (
                      <p className="text-red-400 text-xs">{errors.account_type}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="business_name" className="text-gray-300">
                      Business Name <span className="text-red-400">*</span>
                    </Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <Input
                        id="business_name"
                        value={formData.business_name}
                        onChange={(e) => updateField('business_name', e.target.value)}
                        placeholder="Your Business LLC"
                        className={`pl-10 bg-[#0a0514] text-white ${showErrors && errors.business_name ? 'border-red-500' : 'border-white/10'}`}
                      />
                    </div>
                    {showErrors && errors.business_name && (
                      <p className="text-red-400 text-xs">{errors.business_name}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="license_number" className="text-gray-300">
                      Business License # <span className="text-red-400">*</span>
                    </Label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <Input
                        id="license_number"
                        value={formData.license_number}
                        onChange={(e) => updateField('license_number', e.target.value)}
                        placeholder="License Number"
                        className={`pl-10 bg-[#0a0514] text-white ${showErrors && errors.license_number ? 'border-red-500' : 'border-white/10'}`}
                      />
                    </div>
                    {showErrors && errors.license_number && (
                      <p className="text-red-400 text-xs">{errors.license_number}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ein" className="text-gray-300">
                      EIN/TaxID # <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      id="ein"
                      value={formData.ein}
                      onChange={(e) => updateField('ein', e.target.value)}
                      placeholder="XX-XXXXXXX"
                      className={`bg-[#0a0514] text-white ${showErrors && errors.ein ? 'border-red-500' : 'border-white/10'}`}
                    />
                    {showErrors && errors.ein && (
                      <p className="text-red-400 text-xs">{errors.ein}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website" className="text-gray-300">
                      Website
                    </Label>
                    <Input
                      id="website"
                      value={formData.website}
                      onChange={(e) => updateField('website', e.target.value)}
                      placeholder="https://yourbusiness.com"
                      className="bg-[#0a0514] border-white/10 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-gray-300">
                      Email Address <span className="text-red-400">*</span>
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => updateField('email', e.target.value)}
                        placeholder="you@company.com"
                        className={`pl-10 bg-[#0a0514] text-white ${showErrors && errors.email ? 'border-red-500' : 'border-white/10'}`}
                      />
                    </div>
                    {showErrors && errors.email && (
                      <p className="text-red-400 text-xs">{errors.email}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-gray-300">
                        Password <span className="text-red-400">*</span>
                      </Label>
                      <PasswordInput
                        id="password"
                        value={formData.password}
                        onChange={(e) => updateField('password', e.target.value)}
                        placeholder="••••••••"
                        showLockIcon={false}
                        className={`bg-[#0a0514] text-white ${showErrors && errors.password ? 'border-red-500' : 'border-white/10'}`}
                      />
                      {showErrors && errors.password && (
                        <p className="text-red-400 text-xs">{errors.password}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-gray-300">
                        Confirm Password <span className="text-red-400">*</span>
                      </Label>
                      <PasswordInput
                        id="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={(e) => updateField('confirmPassword', e.target.value)}
                        placeholder="••••••••"
                        showLockIcon={false}
                        className={`bg-[#0a0514] text-white ${showErrors && errors.confirmPassword ? 'border-red-500' : 'border-white/10'}`}
                      />
                      {showErrors && errors.confirmPassword && (
                        <p className="text-red-400 text-xs">{errors.confirmPassword}</p>
                      )}
                    </div>
                  </div>

                  {/* Business Type - Only for Wholesalers (hidden for Distributor and Influencer) */}
                  {formData.account_type === 'wholesaler' && (
                    <div className="space-y-2">
                      <Label htmlFor="business_type" className="text-gray-300">
                        Business Type <span className="text-red-400">*</span>
                      </Label>
                      <Select
                        value={formData.business_type}
                        onValueChange={(v) => updateField('business_type', v)}
                      >
                        <SelectTrigger className={`bg-[#0a0514] text-white ${showErrors && errors.business_type ? 'border-red-500' : 'border-white/10'}`}>
                          <SelectValue placeholder="Select Business Type" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#150f24] border-white/10">
                          {BUSINESS_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value} className="text-white">
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {showErrors && errors.business_type && (
                        <p className="text-red-400 text-xs">{errors.business_type}</p>
                      )}
                    </div>
                  )}
                </>
              )}

              {step === 2 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-gray-300">
                      Business/Contact Phone <span className="text-red-400">*</span>
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => updateField('phone', e.target.value)}
                        placeholder="(555) 123-4567"
                        className={`pl-10 bg-[#0a0514] text-white ${showErrors && errors.phone ? 'border-red-500' : 'border-white/10'}`}
                      />
                    </div>
                    {showErrors && errors.phone && (
                      <p className="text-red-400 text-xs">{errors.phone}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address" className="text-gray-300">
                      Street Address <span className="text-red-400">*</span>
                    </Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => updateField('address', e.target.value)}
                        placeholder="123 Main St"
                        className={`pl-10 bg-[#0a0514] text-white ${showErrors && errors.address ? 'border-red-500' : 'border-white/10'}`}
                      />
                    </div>
                    {showErrors && errors.address && (
                      <p className="text-red-400 text-xs">{errors.address}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city" className="text-gray-300">
                        City <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => updateField('city', e.target.value)}
                        placeholder="City"
                        className={`bg-[#0a0514] text-white ${showErrors && errors.city ? 'border-red-500' : 'border-white/10'}`}
                      />
                      {showErrors && errors.city && (
                        <p className="text-red-400 text-xs">{errors.city}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state" className="text-gray-300">
                        State <span className="text-red-400">*</span>
                      </Label>
                      <Select value={formData.state} onValueChange={(v) => updateField('state', v)}>
                        <SelectTrigger className={`bg-[#0a0514] text-white ${showErrors && errors.state ? 'border-red-500' : 'border-white/10'}`}>
                          <SelectValue placeholder="Select State" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#150f24] border-white/10">
                          {STATE_OPTIONS.map((state) => (
                            <SelectItem key={state} value={state} className="text-white">
                              {state}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {showErrors && errors.state && (
                        <p className="text-red-400 text-xs">{errors.state}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="zip" className="text-gray-300">
                      ZIP Code <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      id="zip"
                      value={formData.zip}
                      onChange={(e) => updateField('zip', e.target.value)}
                      placeholder="12345"
                      className={`bg-[#0a0514] text-white ${showErrors && errors.zip ? 'border-red-500' : 'border-white/10'}`}
                    />
                    {showErrors && errors.zip && (
                      <p className="text-red-400 text-xs">{errors.zip}</p>
                    )}
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  {formData.account_type !== 'influencer' && (
                    <div className="space-y-2">
                      <Label htmlFor="volume" className="text-gray-300">
                        Estimated Monthly Volume <span className="text-red-400">*</span>
                      </Label>
                      <Select
                        value={formData.volume_estimate}
                        onValueChange={(v) => updateField('volume_estimate', v)}
                      >
                        <SelectTrigger className={`bg-[#0a0514] text-white ${showErrors && errors.volume_estimate ? 'border-red-500' : 'border-white/10'}`}>
                          <SelectValue placeholder="Select Volume" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#150f24] border-white/10">
                          {VOLUME_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value} className="text-white">
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {showErrors && errors.volume_estimate && (
                        <p className="text-red-400 text-xs">{errors.volume_estimate}</p>
                      )}
                    </div>
                  )}

                  <div className="space-y-4 pt-4">
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="terms"
                        checked={formData.agreeTerms}
                        onCheckedChange={(checked) => updateField('agreeTerms', checked as boolean)}
                        className={`border-2 ${showErrors && errors.agreeTerms ? 'border-red-500' : 'border-white/50'}`}
                      />
                      <Label htmlFor="terms" className="text-sm text-gray-400 leading-relaxed cursor-pointer">
                        I agree to the{' '}
                        <a href="#" className="text-[#9a02d0] hover:underline">
                          Terms of Service
                        </a>{' '}
                        and{' '}
                        <a href="#" className="text-[#9a02d0] hover:underline">
                          Wholesale Agreement
                        </a>
                        . I understand that my application is subject to review and approval.
                      </Label>
                    </div>
                    {showErrors && errors.agreeTerms && (
                      <p className="text-red-400 text-xs ml-7">{errors.agreeTerms}</p>
                    )}
                  </div>
                </>
              )}

              <div className="flex gap-4 pt-4">
                {step > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(step - 1)}
                    className="flex-1 border-white/10 text-gray-300 hover:bg-white/5"
                  >
                    Back
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white font-semibold"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : step === 3 ? (
                    <>
                      Submit Application
                      <CheckCircle className="ml-2 w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Footer Links */}
        <div className="text-center mt-8 space-y-2">
          <Link to="/" className="text-sm text-gray-500 hover:text-gray-400 block">
            ← Back to Home
          </Link>
          <Link to="/contact" className="text-sm text-[#9a02d0] hover:underline block">
            Contact Us
          </Link>
        </div>
      </div>
    </div>
  );
}
