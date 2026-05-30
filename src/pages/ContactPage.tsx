import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Mail, Phone, MapPin, Clock, Send, Loader2, CheckCircle, MessageSquare } from 'lucide-react';

const INQUIRY_TYPES = [
  { value: 'sales', label: 'Sales Inquiry' },
  { value: 'support', label: 'Customer Support' },
  { value: 'partnership', label: 'Partnership Opportunity' },
  { value: 'media', label: 'Media Inquiry' },
  { value: 'other', label: 'Other' },
];

export function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    inquiryType: '',
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setSuccess(true);
    setLoading(false);
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0514] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 pt-24">
        <Card className="bg-[#150f24] border-white/10 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Message Sent!</h2>
            <p className="text-gray-400 mb-6">
              Thank you for reaching out. We'll get back to you within 24 hours.
            </p>
            <Link to="/">
              <Button className="bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white font-semibold">
                Return to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0514] py-12 px-4 sm:px-6 lg:px-8 pt-24">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Get in <span className="text-[#9a02d0]">Touch</span>
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Have questions? We'd love to hear from you. Send us a message and we'll respond as soon
            as possible.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <Card className="bg-[#150f24] border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-[#9a02d0]" />
                  Send us a Message
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-gray-300">
                        Full Name <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => updateField('name', e.target.value)}
                        placeholder="John Doe"
                        required
                        className="bg-[#0a0514] border-white/10 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-gray-300">
                        Email Address <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => updateField('email', e.target.value)}
                        placeholder="john@example.com"
                        required
                        className="bg-[#0a0514] border-white/10 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="company" className="text-gray-300">
                        Company (Optional)
                      </Label>
                      <Input
                        id="company"
                        value={formData.company}
                        onChange={(e) => updateField('company', e.target.value)}
                        placeholder="Your Company"
                        className="bg-[#0a0514] border-white/10 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inquiryType" className="text-gray-300">
                        Inquiry Type <span className="text-red-400">*</span>
                      </Label>
                      <Select
                        value={formData.inquiryType}
                        onValueChange={(v) => updateField('inquiryType', v)}
                      >
                        <SelectTrigger className="bg-[#0a0514] border-white/10 text-white">
                          <SelectValue placeholder="Select Type" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#150f24] border-white/10">
                          {INQUIRY_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value} className="text-white">
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-gray-300">
                      Message <span className="text-red-400">*</span>
                    </Label>
                    <Textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) => updateField('message', e.target.value)}
                      placeholder="How can we help you?"
                      required
                      rows={6}
                      className="bg-[#0a0514] border-white/10 text-white resize-none"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white font-semibold"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        Send Message
                        <Send className="ml-2 w-4 h-4" />
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Contact Info */}
          <div className="space-y-6">
            <Card className="bg-[#150f24] border-white/10">
              <CardContent className="p-6 space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#9a02d0]/10 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-[#9a02d0]" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Email</h3>
                    <a href="mailto:info@microdos2u.com" className="text-gray-400 text-sm hover:text-[#9a02d0] transition-colors">
                      info@microdos2u.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#9a02d0]/10 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-[#9a02d0]" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Phone</h3>
                    <a href="tel:702-421-5202" className="text-gray-400 text-sm hover:text-[#9a02d0] transition-colors">
                      702-421-5202
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#9a02d0]/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-[#9a02d0]" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Address</h3>
                    <p className="text-gray-400 text-sm">
                      9555 Las Vegas Blvd South, Suite 100
                      <br />
                      Las Vegas, NV 89123
                      <br />
                      United States
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#9a02d0]/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-[#9a02d0]" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Hours</h3>
                    <p className="text-gray-400 text-sm">Monday - Friday: 9AM - 5PM PCT</p>
                    <p className="text-gray-400 text-sm">Saturday - Sunday: Closed</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Links */}
            <Card className="bg-[#150f24] border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-lg">Quick Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link to="/wholesale-application">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-gray-400 hover:text-[#9a02d0] hover:bg-[#9a02d0]/10"
                  >
                    Apply for Wholesale
                  </Button>
                </Link>
                <Link to="/wholesaler-portal">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-gray-400 hover:text-[#9a02d0] hover:bg-[#9a02d0]/10"
                  >
                    Wholesaler Portal
                  </Button>
                </Link>
                <Link to="/store-locator">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-gray-400 hover:text-[#9a02d0] hover:bg-[#9a02d0]/10"
                  >
                    Find a Store
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
