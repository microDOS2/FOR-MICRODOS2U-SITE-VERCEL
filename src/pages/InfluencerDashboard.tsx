import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QRCodeSVG } from 'qrcode.react';
import {
  Sparkles,
  TrendingUp,
  DollarSign,
  Users,
  Copy,
  Check,
  LogOut,
  Package,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { formatPrice, getPrice } from '@/data/products';
import type { Product } from '@/types/products';

interface InfluencerStats {
  referralCode: string;
  totalSales: number;
  referralCount: number;
  qrUrl: string;
}

export function InfluencerDashboard() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products'>('dashboard');
  const [stats, setStats] = useState<InfluencerStats>({
    referralCode: 'MICRO2-DEMO',
    totalSales: 2847.50,
    referralCount: 12,
    qrUrl: 'https://for-microdos-2-u-site-vercel.vercel.app/#/wholesale-application?ref=MICRO2-DEMO',
  });
  const [copied, setCopied] = useState(false);
  const [userName, setUserName] = useState('Influencer');
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const fetchInfluencerData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('users')
          .select('business_name, referral_code, total_referral_sales, referral_count')
          .eq('id', user.id)
          .single();
        if (data) {
          setUserName(data.business_name || 'Influencer');
          if (data.referral_code) {
            setStats({
              referralCode: data.referral_code,
              totalSales: data.total_referral_sales || 0,
              referralCount: data.referral_count || 0,
              qrUrl: `https://for-microdos-2-u-site-vercel.vercel.app/#/wholesale-application?ref=${data.referral_code}`,
            });
          }
        }
      }
    };
    const fetchProducts = async () => {
      try {
        // Fetch active products
        const { data: dbProducts } = await supabase
          .from('products')
          .select('*')
          .eq('is_active', true)
          .order('name');

        // Fetch variants from site_settings
        const { data: setting } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'product_variants')
          .single();

        const variants = setting?.value?.variants || [];

        if (dbProducts) {
          const transformed: Product[] = dbProducts
            .filter((p: any) => p.sku !== 'MD2-KIT')
            .map((dbp: any) => {
              const prodVariants = variants.filter((v: any) => v.product_id === dbp.id);
              const firstV = prodVariants[0];
              return {
                id: dbp.id,
                name: dbp.name,
                description: dbp.description || '',
                basePillCount: firstV ? Math.round(firstV.total_pills / firstV.quantity) : 10,
                image: dbp.image_url || '/placeholder-box.png',
                packagingOptions: prodVariants.map((v: any) => ({
                  id: v.sku,
                  tier: v.tier,
                  name: v.name,
                  quantity: v.quantity,
                  totalPills: v.total_pills,
                  pricing: {
                    msrp: v.msrp_price,
                    wholesalerPrice: v.wholesaler_price,
                    distributorPrice: v.distributor_price,
                  },
                  sku: v.sku,
                  inStock: v.in_stock,
                })),
              };
            });
          setProducts(transformed);
        }
      } catch {
        // Silently fail - products tab will be empty
      }
    };
    fetchInfluencerData();
    fetchProducts();
  }, []);

  const copyReferralLink = () => {
    navigator.clipboard.writeText(stats.qrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Referral link copied!');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  // Mock recent referral activity
  const recentReferrals = [
    { id: 1, name: 'Wellness Store Co.', date: 'Apr 15, 2026', amount: 249.00 },
    { id: 2, name: 'Holistic Healing LLC', date: 'Apr 12, 2026', amount: 498.00 },
    { id: 3, name: 'Mindful Living Shop', date: 'Apr 10, 2026', amount: 125.50 },
    { id: 4, name: 'Conscious Collective', date: 'Apr 8, 2026', amount: 750.00 },
  ];

  return (
    <div className="min-h-screen bg-[#0a0514]">
      {/* Mobile Header */}
      <header className="lg:hidden bg-[#150f24] border-b border-white/10 p-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1">
            <span className="text-[#44f80c] font-bold">micro</span>
            <span className="text-[#9a02d0] font-bold">DOS</span>
            <span className="text-[#ff66c4] font-bold">(2)</span>
          </Link>
          <span className="text-gray-400 text-sm">Influencer</span>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:block w-64 bg-[#150f24] border-r border-white/10 min-h-screen">
          <div className="p-6 border-b border-white/10">
            <Link to="/" className="flex items-center gap-1">
              <span className="text-[#44f80c] font-bold text-xl">micro</span>
              <span className="text-[#9a02d0] font-bold text-xl">DOS</span>
              <span className="text-[#ff66c4] font-bold text-xl">(2)</span>
            </Link>
            <p className="text-gray-400 text-sm mt-1">Influencer Portal</p>
          </div>
          <nav className="p-4 space-y-2">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-gradient-to-r from-[#9a02d0]/20 to-[#44f80c]/20 text-white border border-white/10'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sparkles className="w-5 h-5 text-[#44f80c]" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === 'products'
                  ? 'bg-gradient-to-r from-[#9a02d0]/20 to-[#44f80c]/20 text-white border border-white/10'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Package className="w-5 h-5 text-[#9a02d0]" />
              <span>Products</span>
            </button>
          </nav>
          <div className="p-4 border-t border-white/10 mt-auto">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 w-full text-gray-400 hover:text-white hover:bg-white/5 rounded-lg"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 p-4 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white mb-1">
                  {activeTab === 'dashboard' ? `Welcome back, ${userName}!` : 'Product Catalog'}
                </h1>
                <p className="text-gray-400">
                  {activeTab === 'dashboard' ? 'Track your referrals and commission' : 'Products you can promote to wholesalers & distributors'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {activeTab === 'products' && (
                  <a
                    href="https://for-microdos-2-u-site-vercel.vercel.app/#/products"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" className="border-white/10 text-gray-300 hover:bg-white/5">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Full Catalog
                    </Button>
                  </a>
                )}
                <div className="w-10 h-10 bg-gradient-to-br from-[#9a02d0] to-[#44f80c] rounded-full flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>

            {activeTab === 'dashboard' ? (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                  <Card className="bg-[#150f24] border-white/10">
                    <CardContent className="p-4 lg:p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-gray-400 text-sm">Total Referral Sales</p>
                          <p className="text-2xl font-bold text-white">${stats.totalSales.toLocaleString()}</p>
                        </div>
                        <DollarSign className="w-6 h-6 text-[#44f80c]" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-[#150f24] border-white/10">
                    <CardContent className="p-4 lg:p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-gray-400 text-sm">Referrals</p>
                          <p className="text-2xl font-bold text-white">{stats.referralCount}</p>
                        </div>
                        <Users className="w-6 h-6 text-[#9a02d0]" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-[#150f24] border-white/10">
                    <CardContent className="p-4 lg:p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-gray-400 text-sm">Conversion Rate</p>
                          <p className="text-2xl font-bold text-white">8.4%</p>
                        </div>
                        <TrendingUp className="w-6 h-6 text-[#ff66c4]" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* QR Code Section */}
                  <Card className="bg-[#150f24] border-white/10">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-[#9a02d0]" />
                        Your QR Code
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col items-center gap-4">
                        <div className="bg-white p-4 rounded-xl">
                          <QRCodeSVG value={stats.qrUrl} size={180} />
                        </div>
                        <div className="w-full">
                          <p className="text-gray-400 text-sm mb-2">Your Referral Link</p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 bg-[#0a0514] p-3 rounded text-[#44f80c] font-mono text-sm truncate">
                              {stats.qrUrl}
                            </code>
                            <Button
                              onClick={copyReferralLink}
                              variant="outline"
                              className="border-white/10"
                            >
                              {copied ? <Check className="w-4 h-4 text-[#44f80c]" /> : <Copy className="w-4 h-4" />}
                            </Button>
                          </div>
                        </div>
                        <div className="w-full bg-[#0a0514] p-3 rounded-lg border border-white/10">
                          <p className="text-gray-400 text-xs">Referral Code</p>
                          <p className="text-white font-mono font-bold">{stats.referralCode}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recent Referrals */}
                  <Card className="bg-[#150f24] border-white/10">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-[#44f80c]" />
                        Recent Referrals
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {recentReferrals.map((ref) => (
                          <div key={ref.id} className="flex items-center justify-between p-3 bg-[#0a0514] rounded-lg border border-white/10">
                            <div>
                              <p className="text-white font-medium text-sm">{ref.name}</p>
                              <p className="text-gray-500 text-xs">{ref.date}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[#44f80c] font-bold">${ref.amount.toFixed(2)}</p>
                              <Badge className="bg-green-500/20 text-green-500 text-xs">Completed</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              /* Products Tab */
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {products.map((product) => (
                    <Card key={product.id} className="bg-[#150f24] border-white/10">
                      <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                          <Package className="w-5 h-5 text-[#9a02d0]" />
                          {product.name}
                        </CardTitle>
                        <p className="text-sm text-gray-400">{product.description}</p>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {product.packagingOptions.map((option) => (
                            <div
                              key={option.id}
                              className="flex items-center justify-between p-3 bg-[#0a0514] rounded-lg border border-white/10"
                            >
                              <div>
                                <p className="text-white font-medium text-sm">{option.name}</p>
                                <p className="text-gray-500 text-xs">{option.sku} &bull; {option.totalPills} pills</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[#44f80c] font-bold text-sm">{formatPrice(getPrice(option.pricing, 'wholesaler'))}</p>
                                <p className="text-gray-500 text-xs">wholesale</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
