import { Link } from 'react-router-dom';
import {
  Flask,
  ShieldCheck,
  Target,
  Timer,
  TrendUp,
  Graph,
  CheckCircle,
  Info,
  Eye,
  Smiley,
  MusicNotes,
  Users,
  Waves,
  Lightning,
  Aperture,
  Brain,
  Heartbeat,
  ChartBar,
  Check,
  ArrowRight,
  Warning
} from '@phosphor-icons/react';
import { ContentLink } from '@/components/ContentLink';
import { contentLinks } from '@/lib/contentLinks';

export function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="hero-bg pt-32 pb-20 px-4 sm:px-6 lg:px-8 min-h-[80vh] flex items-center">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
            Discover
            <span className="text-[#44f80c]">micro</span>
            <span className="text-[#9a02d0]">DOS</span>
            <span className="text-[#ff66c4]">(2)</span>
          </h1>
          <p className="text-2xl md:text-3xl font-light text-gray-300 mb-4">
            Precision Psychedelic Wellness
          </p>
          <p className="text-lg md:text-xl text-gray-400 mb-12 uppercase tracking-widest">
            for the Modern Explorer
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <div className="flex items-center justify-center gap-2 text-[#44f80c] bg-white/5 px-6 py-3 rounded-full border border-[#44f80c]/30">
              <Flask className="text-xl" weight="fill" />
              <span className="font-medium">Research-Backed</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-[#9a02d0] bg-white/5 px-6 py-3 rounded-full border border-[#9a02d0]/30">
              <ShieldCheck className="text-xl" weight="fill" />
              <span className="font-medium">Safety First</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-[#ff66c4] bg-white/5 px-6 py-3 rounded-full border border-[#ff66c4]/30">
              <Target className="text-xl" weight="fill" />
              <span className="font-medium">Precise Dosing</span>
            </div>
          </div>
        </div>
      </section>

      {/* Introduction & Specs */}
      <section id="science" className="py-20 bg-black/50 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-sm text-[#44f80c] font-bold tracking-widest uppercase mb-2">
                Introduction
              </h2>
              <h3 className="text-3xl md:text-4xl font-bold mb-6">
                What's in
                <span className="text-[#44f80c]">micro</span>
                <span className="text-[#9a02d0]">DOS</span>
                <span className="text-[#ff66c4]">(2)</span>?
              </h3>
              <div className="bg-[#150f24] border border-white/10 rounded-2xl p-8 mb-6 card-hover">
                <h4 className="text-2xl font-bold text-[#9a02d0] mb-1">4-HO-MET</h4>
                <p className="text-sm text-gray-400 mb-4 font-mono">
                  4-hydroxy-N-methyl-N-ethyltryptamine
                </p>
                <p className="text-gray-300 mb-6">
                  A precision psychedelic tryptamine first synthesized by Alexander "Sasha" Shulgin
                  in the 1970s, representing decades of psychedelic research and innovation.
                </p>
                <div className="border-t border-white/10 pt-4 mt-4">
                  <h5 className="font-bold text-white mb-2 flex items-center gap-2">
                    <ArrowRight className="text-[#44f80c]" weight="bold" />
                    Comparable to Psilocin
                  </h5>
                  <p className="text-gray-400 text-sm">
                    Produces effects similar to psilocin from magic mushrooms, but with enhanced
                    predictability and clarity.
                  </p>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-6 border-b border-white/10 pb-2">
                Core Specifications
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#150f24] p-6 rounded-xl border border-white/5 text-center">
                  <Timer className="text-3xl text-[#44f80c] mb-3 mx-auto" weight="fill" />
                  <div className="text-sm text-gray-400 uppercase tracking-wider mb-1">Onset</div>
                  <div className="text-2xl font-bold">~15 min</div>
                </div>
                <div className="bg-[#150f24] p-6 rounded-xl border border-white/5 text-center">
                  <TrendUp className="text-3xl text-[#9a02d0] mb-3 mx-auto" weight="fill" />
                  <div className="text-sm text-gray-400 uppercase tracking-wider mb-1">Peak</div>
                  <div className="text-2xl font-bold">1.5-2 hrs</div>
                </div>
                <div className="bg-[#150f24] p-6 rounded-xl border border-white/5 text-center">
                  <div className="text-3xl text-[#ff66c4] mb-3 mx-auto font-bold">≈</div>
                  <div className="text-sm text-gray-400 uppercase tracking-wider mb-1">Duration</div>
                  <div className="text-2xl font-bold">4 hrs</div>
                </div>
                <div className="bg-[#150f24] p-6 rounded-xl border border-white/5 text-center">
                  <div className="text-3xl text-white mb-3 mx-auto font-bold">2mg</div>
                  <div className="text-sm text-gray-400 uppercase tracking-wider mb-1">Form</div>
                  <div className="text-2xl font-bold">scored tab</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mechanism of Action */}
      <section className="py-20 bg-[#0a0514]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">
            <span className="text-[#9a02d0]">Mechanism</span>{' '}
            <span className="text-white">of Action</span>
          </h2>

          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-white mb-2">The Science of Clarity</h3>
            <p className="text-gray-400">Serotonin Receptor Engagement</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="bg-[#150f24] p-6 rounded-xl text-center card-hover border border-white/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#9a02d0]/10 rounded-bl-full" />
              <Flask className="text-4xl text-[#9a02d0] mb-4 mx-auto" weight="fill" />
              <h4 className="text-xl font-bold mb-2">Primary Mechanism</h4>
              <p className="text-sm text-gray-400 font-bold uppercase mb-3">Receptor Binding</p>
              <p className="text-gray-300 text-sm">
                Metocin engages serotonin receptors, notably the{' '}
                <ContentLink href={contentLinks.ht2aReceptor} linkType="image" ariaLabel="View brain routing effects diagram">
                  <span className="text-[#44f80c]">5-HT2A receptor</span>
                </ContentLink>, similar to psilocin. This
                interaction yields psychedelic changes in perception, mood, and cognition while
                maintaining a clear, energetic headspace.
              </p>
            </div>

            <div className="bg-[#150f24] p-6 rounded-xl text-center card-hover border border-white/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#44f80c]/10 rounded-bl-full" />
              <ShieldCheck className="text-4xl text-[#44f80c] mb-4 mx-auto" weight="fill" />
              <h4 className="text-xl font-bold mb-2">Anti-Inflammatory</h4>
              <p className="text-sm text-gray-400 font-bold uppercase mb-3">Systemic Response</p>
              <p className="text-gray-300 text-sm">
                <ContentLink href={contentLinks.antiInflammatoryCytokines} linkType="pdf" ariaLabel="Read Mushrooms Microdosing research PDF">
                  Blocks TNF-α, IL-1β, and IL-6 cytokines through 5-HT2A activation
                </ContentLink>{' '}
                <ContentLink href={contentLinks.antiInflammatoryPathways} linkType="image" ariaLabel="View brain routing effects diagram">
                  providing significant anti-inflammatory pathways
                </ContentLink>
              </p>
            </div>

            <div className="bg-[#150f24] p-6 rounded-xl text-center card-hover border border-white/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#ff66c4]/10 rounded-bl-full" />
              <Graph className="text-4xl text-[#ff66c4] mb-4 mx-auto" weight="fill" />
              <h4 className="text-xl font-bold mb-2">Neuroplasticity</h4>
              <p className="text-sm text-gray-400 font-bold uppercase mb-3">Cellular Growth</p>
              <p className="text-gray-300 text-sm">
                <ContentLink href={contentLinks.bdnfNeuroplasticity} linkType="pdf" ariaLabel="Read Psilocybin Microdosers research PDF">
                  Enhances BDNF (Brain-Derived Neurotrophic Factor) stimulation, promoting synaptic
                  growth and neural connectivity
                </ContentLink>.
              </p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 md:p-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div>
                <h4 className="text-2xl font-bold mb-6 border-b border-white/10 pb-4">
                  What It Does
                </h4>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="text-[#44f80c] text-xl mt-1 shrink-0" weight="fill" />
                    <span>Modulates mood and emotional processing</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="text-[#44f80c] text-xl mt-1 shrink-0" weight="fill" />
                    <span>Enhances cognitive flexibility and creativity</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="text-[#44f80c] text-xl mt-1 shrink-0" weight="fill" />
                    <span>Alters sensory perception and visual processing</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="text-[#44f80c] text-xl mt-1 shrink-0" weight="fill" />
                    <span>Reduces activity in the default mode network (DMN)</span>
                  </li>
                </ul>
              </div>
              <div className="bg-[#0a0514] p-8 rounded-xl border border-[#9a02d0]/30">
                <h4 className="text-sm uppercase tracking-widest text-[#9a02d0] mb-4 font-bold">
                  User Reports
                </h4>
                <blockquote className="text-xl italic font-light leading-relaxed">
                  "Users often report a clear, energetic headspace with vivid sensory enhancement—a
                  uniquely manageable psychedelic experience."
                </blockquote>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Advantages */}
      <section className="py-20 bg-black/50 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-sm text-center text-[#44f80c] font-bold tracking-widest uppercase mb-2">
            Key Advantages
          </h2>
          <h3 className="text-3xl md:text-5xl font-bold text-center mb-16">
            Why Choose
            <span className="text-[#44f80c]">micro</span>
            <span className="text-[#9a02d0]">DOS</span>
            <span className="text-[#ff66c4]">(2)</span>?
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-[#150f24] p-6 rounded-xl border border-white/5 card-hover">
              <div className="flex justify-between items-start mb-4">
                <h4 className="text-lg font-bold">Less Mentally Intense</h4>
                <span className="text-xs bg-[#44f80c]/20 text-[#44f80c] px-2 py-1 rounded">
                  Ideal for beginners
                </span>
              </div>
              <p className="text-gray-400 text-sm">
                Highly visual experiences with a clearheaded, easygoing mental state compared to LSD
                or psilocin. Easier to navigate and manage.
              </p>
            </div>

            <div className="bg-[#150f24] p-6 rounded-xl border border-white/5 card-hover">
              <div className="flex justify-between items-start mb-4">
                <h4 className="text-lg font-bold">Fast & Predictable</h4>
                <span className="text-xs bg-white/10 px-2 py-1 rounded">Plan your day</span>
              </div>
              <p className="text-gray-400 text-sm">
                Rapid onset (~15 min) with a shorter duration (4-6 hours). Perfect for those who want
                a manageable time window.
              </p>
            </div>

            <div className="bg-[#150f24] p-6 rounded-xl border border-white/5 card-hover">
              <div className="flex justify-between items-start mb-4">
                <h4 className="text-lg font-bold">Mood Enhancement</h4>
                <span className="text-xs bg-[#ff66c4]/20 text-[#ff66c4] px-2 py-1 rounded">
                  Positive headspace
                </span>
              </div>
              <p className="text-gray-400 text-sm">
                Consistent mood improvement and euphoria with minimal anxiety for most users.
                Life-affirming experiences.
              </p>
            </div>

            <div className="bg-[#150f24] p-6 rounded-xl border border-white/5 card-hover">
              <div className="flex justify-between items-start mb-4">
                <h4 className="text-lg font-bold">Vivid Visuals</h4>
              </div>
              <p className="text-gray-400 text-sm">
                Bright, colorful OEVs and CEVs with geometric patterns. One of the most visual
                psychedelics available.
              </p>
            </div>

            <div className="bg-[#150f24] p-6 rounded-xl border border-white/5 card-hover">
              <div className="flex justify-between items-start mb-4">
                <h4 className="text-lg font-bold">Precise Dosing</h4>
              </div>
              <p className="text-gray-400 text-sm">
                2mg scored tablets allow for accurate, consistent dosing. Start low and titrate to
                your ideal experience.
              </p>
            </div>

            <div className="bg-[#150f24] p-6 rounded-xl border border-white/5 card-hover">
              <div className="flex justify-between items-start mb-4">
                <h4 className="text-lg font-bold">Sensory Enhancement</h4>
              </div>
              <p className="text-gray-400 text-sm">
                Enhanced music appreciation, increased sociability, and pleasurable body sensations
                create a holistic experience.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Dosage Guide */}
      <section id="dosage" className="py-20 bg-[#0a0514]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-sm text-center text-[#9a02d0] font-bold tracking-widest uppercase mb-2">
            Dosage Guide
          </h2>
          <h3 className="text-3xl md:text-5xl font-bold text-center mb-4">
            Find Your Personalized Journey
          </h3>
          <p className="text-center text-gray-400 mb-16">
            Each
            <span className="text-[#44f80c]">micro</span>
            <span className="text-[#9a02d0]">DOS</span>
            <span className="text-[#ff66c4]">(2)</span>
            tablet contains 2mg of Metocin
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            <div className="bg-[#150f24] border border-green-900/50 p-6 rounded-2xl relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-[#44f80c] rounded-t-2xl opacity-50" />
              <h4 className="text-2xl font-bold mb-1">LIGHT</h4>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-4xl font-bold text-[#44f80c]">1</span>
                <span className="text-sm text-gray-400">tab</span>
              </div>
              <div className="text-lg font-bold text-white mb-4">2mg</div>
              <ul className="space-y-3 mb-8 text-sm text-gray-300 min-h-[100px]">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#44f80c]" />
                  Social & playful
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#44f80c]" />
                  Subtle lift
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#44f80c]" />
                  Great for beginners
                </li>
              </ul>
              <div className="text-xs text-gray-500 pt-4 border-t border-white/10">
                ≈ ½ gram dried mushrooms
              </div>
            </div>

            <div className="bg-[#150f24] border border-blue-900/50 p-6 rounded-2xl relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 rounded-t-2xl opacity-50" />
              <h4 className="text-2xl font-bold mb-1">MODERATE</h4>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-4xl font-bold text-blue-400">2</span>
                <span className="text-sm text-gray-400">tabs</span>
              </div>
              <div className="text-lg font-bold text-white mb-4">4mg</div>
              <ul className="space-y-3 mb-8 text-sm text-gray-300 min-h-[100px]">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  Noticeable effects
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  Gentle visuals
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  Enhanced mood
                </li>
              </ul>
              <div className="text-xs text-gray-500 pt-4 border-t border-white/10">
                ≈ 1 gram dried mushrooms
              </div>
            </div>

            <div className="bg-[#150f24] border border-[#9a02d0]/50 p-6 rounded-2xl relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-[#9a02d0] rounded-t-2xl opacity-50" />
              <h4 className="text-2xl font-bold mb-1">TRIPPY</h4>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-4xl font-bold text-[#9a02d0]">4</span>
                <span className="text-sm text-gray-400">tabs</span>
              </div>
              <div className="text-lg font-bold text-white mb-4">8mg</div>
              <ul className="space-y-3 mb-8 text-sm text-gray-300 min-h-[100px]">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#9a02d0]" />
                  Clear trip characteristics
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#9a02d0]" />
                  Strong perceptual changes
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#9a02d0]" />
                  Vivid visuals
                </li>
              </ul>
              <div className="text-xs text-gray-500 pt-4 border-t border-white/10">
                ≈ 2 grams dried mushrooms
              </div>
            </div>

            <div className="bg-[#150f24] border border-[#ff66c4]/50 p-6 rounded-2xl relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-[#ff66c4] rounded-t-2xl opacity-50" />
              <h4 className="text-2xl font-bold mb-1">TRANSCEND</h4>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-4xl font-bold text-[#ff66c4]">6+</span>
                <span className="text-sm text-gray-400">tabs</span>
              </div>
              <div className="text-lg font-bold text-white mb-4">
                <span className="text-[#ff66c4] font-bold">12mg+</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm text-gray-300 min-h-[100px]">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#ff66c4]" />
                  Deep experiences
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#ff66c4]" />
                  Transcendental states
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#ff66c4]" />
                  Experienced users only
                </li>
              </ul>
              <div className="text-xs text-gray-500 pt-4 border-t border-white/10">
                ≈ 3+ grams dried mushrooms
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-6 flex items-start gap-4 max-w-3xl mx-auto">
            <Info className="text-2xl text-[#44f80c] shrink-0 mt-1" weight="fill" />
            <div>
              <h5 className="font-bold text-lg mb-1">Pro Tip</h5>
              <p className="text-gray-300 text-sm">
                Start low and assess. Quarter- or half-tab microdosing provides gentler effects for
                daily wellness. Effects typically begin around 1-2mg.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Microdosing vs Macrodosing */}
      <section className="py-20 bg-black/50 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-5xl font-bold text-center mb-16">
            Microdosing vs Macrodosing
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
            <div className="bg-[#150f24] border border-white/10 p-8 rounded-2xl">
              <h3 className="text-3xl font-bold mb-2 text-[#44f80c]">Microdosing</h3>
              <p className="text-gray-400 uppercase tracking-widest text-sm mb-8">
                Sub-Hallucinogenic Doses
              </p>
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-white mb-1">Dosage</h4>
                  <p className="text-gray-300 text-sm">
                    0.5-1 tab (1-2mg) — quarter or half tablets for gentler effects
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-white mb-1">Schedule</h4>
                  <p className="text-gray-300 text-sm">
                    3x weekly or 4 days on, 3 days off. No daily tolerance buildup.
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-white mb-3">Benefits:</h4>
                  <ul className="text-sm text-gray-300 space-y-2">
                    <li className="flex items-center gap-2">
                      <Check className="text-[#44f80c]" weight="bold" />
                      Improved mood & focus
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="text-[#44f80c]" weight="bold" />
                      Enhanced creativity
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="text-[#44f80c]" weight="bold" />
                      Decreased anxiety & stress
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="text-[#44f80c]" weight="bold" />
                      Daily wellness without intoxication
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="text-[#44f80c]" weight="bold" />
                      No perceptual disturbances
                    </li>
                  </ul>
                </div>
                <div className="pt-4 border-t border-white/10">
                  <span className="text-gray-400 text-sm">Best for: </span>
                  <strong className="text-[#44f80c]">Daily optimization</strong>
                </div>
              </div>
            </div>

            <div className="bg-[#150f24] border border-white/10 p-8 rounded-2xl">
              <h3 className="text-3xl font-bold mb-2 text-[#9a02d0]">Macrodosing</h3>
              <p className="text-gray-400 uppercase tracking-widest text-sm mb-8">
                Full Psychedelic Experiences
              </p>
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-white mb-1">Dosage</h4>
                  <p className="text-gray-300 text-sm">
                    2-6+ tabs (4-12mg+) — full therapeutic or recreational doses
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-white mb-1">Duration</h4>
                  <p className="text-gray-300 text-sm">
                    4-6 hours of immersive experience with 1.5-2 hour peak
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-white mb-3">Benefits:</h4>
                  <ul className="text-sm text-gray-300 space-y-2">
                    <li className="flex items-center gap-2">
                      <Check className="text-[#9a02d0]" weight="bold" />
                      Deep introspection & insight
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="text-[#9a02d0]" weight="bold" />
                      Personal growth & healing
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="text-[#9a02d0]" weight="bold" />
                      Transcendental experiences
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="text-[#9a02d0]" weight="bold" />
                      Strong visual & sensory effects
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="text-[#9a02d0]" weight="bold" />
                      Breakthrough moments
                    </li>
                  </ul>
                </div>
                <div className="pt-4 border-t border-white/10">
                  <span className="text-gray-400 text-sm">Best for: </span>
                  <strong className="text-[#9a02d0]">Transformational journeys</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center border-t border-white/10 pt-12">
            <div>
              <div className="text-4xl md:text-5xl font-bold text-white mb-2">47%</div>
              <p className="text-gray-400 text-sm uppercase tracking-wide">
                of psilocybin users microdose
              </p>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-white mb-2">271K+</div>
              <p className="text-gray-400 text-sm uppercase tracking-wide">
                online community members
              </p>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-white mb-2">8M</div>
              <p className="text-gray-400 text-sm uppercase tracking-wide">
                Americans used psilocybin (2023)
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Clinical Data / Safety */}
      <section id="safety" className="py-20 bg-[#0a0514]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-sm text-center text-[#44f80c] font-bold tracking-widest uppercase mb-2">
            Clinical Data
          </h2>
          <h3 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Safety Profile & Scientific Evidence
          </h3>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="bg-[#150f24] p-8 rounded-xl text-center border border-white/5">
              <div className="text-6xl font-bold text-[#44f80c] mb-2">500×</div>
              <div className="text-xl font-bold text-white mb-2">Safety Margin</div>
              <p className="text-gray-400 text-sm">
                Lethal dose estimated at 500 times a therapeutic dose of up to 30mg. One of the
                safest psychedelics with a remarkably wide safety window.
              </p>
            </div>

            <div className="bg-[#150f24] p-8 rounded-xl text-center border border-white/5">
              <div className="w-16 h-16 mx-auto mb-4 bg-[#9a02d0]/20 rounded-full flex items-center justify-center">
                <ShieldCheck className="w-8 h-8 text-[#9a02d0]" weight="fill" />
              </div>
              <div className="text-xl font-bold text-white mb-2">Anti-Addictive Properties</div>
              <p className="text-gray-400 text-sm">
                Psilocybin and related tryptamines do not show evidence of addiction potential.
                Daily intake leads to loss of therapeutic benefits.
              </p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-12">
            <div className="text-center mb-8">
              <div className="text-5xl font-bold text-[#44f80c] mb-2">110</div>
              <p className="text-gray-400">Healthy subjects analyzed</p>
              <p className="text-gray-500 text-sm">
                Across 8 double-blind placebo-controlled studies
              </p>
            </div>

            <blockquote className="text-center text-gray-300 italic mb-8">
              "All acute adverse drug reactions were successfully managed by providing interpersonal
              support."
              <footer className="text-gray-500 text-sm mt-2">— Studerus et al.</footer>
            </blockquote>

            <div className="grid md:grid-cols-3 gap-4 text-center">
              <div className="text-[#44f80c]">✓ No subsequent drug abuse</div>
              <div className="text-[#44f80c]">✓ No persisting perception disorders</div>
              <div className="text-[#44f80c]">✓ No prolonged psychosis</div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white/5 p-6 rounded-xl border border-white/10">
              <h4 className="font-bold mb-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#9a02d0]" />
                FDA Breakthrough Therapy
              </h4>
              <ul className="text-sm text-gray-300 space-y-2">
                <li>
                  <strong>2018:</strong> Treatment-Resistant Depression
                </li>
                <li>
                  <strong>2019:</strong> Major Depressive Disorder
                </li>
              </ul>
            </div>

            <div className="bg-white/5 p-6 rounded-xl border border-white/10">
              <h4 className="font-bold mb-4 flex items-center gap-2">
                <Heartbeat className="text-[#ff66c4]" weight="fill" />
                Mental Health
              </h4>
              <ul className="text-sm text-gray-300 space-y-2">
                <li>• Depression & anxiety reduction</li>
                <li>• OCD symptom improvement</li>
                <li>• Addiction treatment</li>
              </ul>
            </div>

            <div className="bg-white/5 p-6 rounded-xl border border-white/10">
              <h4 className="font-bold mb-4 flex items-center gap-2">
                <ChartBar className="text-[#9a02d0]" weight="fill" />
                Key Study Results
              </h4>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="flex justify-between">
                    <span>Mood Improvement</span>
                    <strong className="text-[#44f80c]">85%</strong>
                  </div>
                  <div className="w-full bg-black/50 rounded-full h-1.5 mt-1">
                    <div className="bg-[#44f80c] h-1.5 rounded-full" style={{ width: '85%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between">
                    <span>Anxiety Reduction</span>
                    <strong className="text-[#9a02d0]">78%</strong>
                  </div>
                  <div className="w-full bg-black/50 rounded-full h-1.5 mt-1">
                    <div className="bg-[#9a02d0] h-1.5 rounded-full" style={{ width: '78%' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* YouTube Video Section */}
      <section className="py-20 bg-black/50 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="youtube-square border-4 border-[#9a02d0]/30 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(154,2,208,0.2)]">
            <iframe
              src="https://www.youtube.com/embed/MLDChN3C1bI?autoplay=1&mute=1&loop=1&playlist=MLDChN3C1bI,0b-w8j6lIKQ,MOBdkkeXLto&controls=1&rel=0&modestbranding=1"
              title="microDOS(2) Experience Video"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      {/* What to Expect / Experience */}
      <section id="experience" className="py-20 bg-black/50 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-5xl font-bold text-center mb-16">
            What to Expect from
            <span className="text-[#44f80c]">micro</span>
            <span className="text-[#9a02d0]">DOS</span>
            <span className="text-[#ff66c4]">(2)</span>
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
              <h3 className="text-2xl font-bold mb-6 text-[#9a02d0]">Positive Effects</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <div className="flex items-center gap-3 bg-[#150f24] p-4 rounded-lg border border-white/5">
                  <Eye className="text-[#9a02d0] text-xl" weight="fill" />
                  <span className="text-sm">Open & closed eye visuals</span>
                </div>
                <div className="flex items-center gap-3 bg-[#150f24] p-4 rounded-lg border border-white/5">
                  <Smiley className="text-[#9a02d0] text-xl" weight="fill" />
                  <span className="text-sm">Increased humor & laughter</span>
                </div>
                <div className="flex items-center gap-3 bg-[#150f24] p-4 rounded-lg border border-white/5">
                  <MusicNotes className="text-[#9a02d0] text-xl" weight="fill" />
                  <span className="text-sm">Music enhancement</span>
                </div>
                <div className="flex items-center gap-3 bg-[#150f24] p-4 rounded-lg border border-white/5">
                  <Users className="text-[#9a02d0] text-xl" weight="fill" />
                  <span className="text-sm">Increased sociability</span>
                </div>
                <div className="flex items-center gap-3 bg-[#150f24] p-4 rounded-lg border border-white/5">
                  <Waves className="text-[#9a02d0] text-xl" weight="fill" />
                  <span className="text-sm">Pleasurable body sensations</span>
                </div>
                <div className="flex items-center gap-3 bg-[#150f24] p-4 rounded-lg border border-white/5">
                  <Lightning className="text-[#9a02d0] text-xl" weight="fill" />
                  <span className="text-sm">Increased energy</span>
                </div>
                <div className="flex items-center gap-3 bg-[#150f24] p-4 rounded-lg border border-white/5">
                  <Aperture className="text-[#9a02d0] text-xl" weight="fill" />
                  <span className="text-sm">Bright, colorful patterns</span>
                </div>
                <div className="flex items-center gap-3 bg-[#150f24] p-4 rounded-lg border border-white/5">
                  <Brain className="text-[#9a02d0] text-xl" weight="fill" />
                  <span className="text-sm">Clear mental state</span>
                </div>
              </div>

              <div className="bg-[#150f24] border-l-4 border-[#ff66c4] p-6 rounded-r-lg">
                <h4 className="font-bold mb-2">Visual Characteristics</h4>
                <p className="text-sm text-gray-300">
                  Known for very colorful open eye visuals—surfaces breathe and move, boundaries
                  between objects reduce.
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-bold mb-6 text-[#44f80c]">Timeline</h3>
              <div className="relative border-l border-white/20 ml-4 space-y-8 pb-8">
                <div className="relative">
                  <div className="absolute -left-[25px] bg-[#0a0514] border-2 border-[#44f80c] w-4 h-4 rounded-full mt-1.5" />
                  <div className="pl-6">
                    <h4 className="font-bold text-lg text-white">
                      Onset
                      <span className="text-sm font-normal text-[#44f80c] ml-2">15-30 min</span>
                    </h4>
                    <p className="text-gray-400 text-sm mt-1">First bodily sensations</p>
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute -left-[25px] bg-[#0a0514] border-2 border-[#9a02d0] w-4 h-4 rounded-full mt-1.5" />
                  <div className="pl-6">
                    <h4 className="font-bold text-lg text-white">
                      Peak
                      <span className="text-sm font-normal text-[#9a02d0] ml-2">1.5-2 hrs</span>
                    </h4>
                    <p className="text-gray-400 text-sm mt-1">Maximum effects</p>
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute -left-[25px] bg-[#0a0514] border-2 border-[#ff66c4] w-4 h-4 rounded-full mt-1.5" />
                  <div className="pl-6">
                    <h4 className="font-bold text-lg text-white">
                      Duration
                      <span className="text-sm font-normal text-[#ff66c4] ml-2">4-6 hrs</span>
                    </h4>
                    <p className="text-gray-400 text-sm mt-1">Return to baseline</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer / CTA */}
      <footer className="footer-bg pt-20 pb-10 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-20">
            <div>
              <h2 className="text-3xl md:text-5xl font-bold mb-8">
                Start Your
                <span className="text-[#44f80c]">micro</span>
                <span className="text-[#9a02d0]">DOS</span>
                <span className="text-[#ff66c4]">(2)</span>
                Journey Today
              </h2>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#9a02d0] text-white flex items-center justify-center font-bold shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Start with 1 tablet (2mg)</h4>
                    <p className="text-sm text-gray-400">Perfect for first-time users</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#9a02d0] text-white flex items-center justify-center font-bold shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Ensure proper set & setting</h4>
                    <p className="text-sm text-gray-400">Calm, comfortable environment</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#9a02d0] text-white flex items-center justify-center font-bold shrink-0">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Stay hydrated</h4>
                    <p className="text-sm text-gray-400">Have water and snacks</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#9a02d0] text-white flex items-center justify-center font-bold shrink-0">
                    4
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Allow 4-6 hours</h4>
                    <p className="text-sm text-gray-400">Clear your schedule</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 p-6 bg-red-900/20 border border-red-500/30 rounded-xl">
                <h5 className="font-bold text-red-400 mb-3 flex items-center gap-2">
                  <Warning weight="fill" />
                  Safety Reminders
                </h5>
                <ul className="text-sm text-gray-300 space-y-2">
                  <li>• Avoid driving or operating machinery</li>
                  <li>• Have a sober sitter for higher doses</li>
                  <li>• Start low, go slow</li>
                </ul>
              </div>
            </div>

            {/* CTA / Conclusion */}
            <div className="flex flex-col items-center justify-center bg-black/40 border border-white/10 rounded-3xl p-10 text-center">
              <h3 className="text-3xl font-bold mb-2">
                Elevate Your <br />
                <span className="gradient-text-pink">Consciousness</span>
              </h3>
              <p className="text-gray-400 mb-8">Experience the future of psychedelic wellness</p>

              <Link
                to="/store-locator"
                className="w-48 h-48 bg-white rounded-xl mb-8 flex flex-col items-center justify-center border-4 border-[#9a02d0] shadow-[0_0_30px_rgba(168,85,247,0.4)] hover:scale-105 transition-transform duration-200 group"
              >
                <div className="text-6xl mb-2 text-[#6b21a8] group-hover:text-[#9a02d0] transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="currentColor" viewBox="0 0 256 256">
                    <path d="M128,64a40,40,0,1,0,40,40A40,40,0,0,0,128,64Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,128Zm0-112A88.1,88.1,0,0,0,40,104c0,72,80,128,88,128s88-56,88-128A88.1,88.1,0,0,0,128,16Zm0,206.4C115.2,214,56,167.2,56,104a72,72,0,0,1,144,0C200,167.2,140.8,214,128,222.4Z" />
                  </svg>
                </div>
                <span className="text-gray-900 font-bold text-lg">Find a Store</span>
                <span className="text-[#6b21a8] text-xs uppercase tracking-widest mt-1">Store Finder</span>
              </Link>

              <div className="space-y-4 w-full text-left">
                <div className="bg-white/5 p-4 rounded-lg flex items-center gap-3">
                  <Target className="text-[#ff66c4] text-xl" weight="fill" />
                  <div>
                    <div className="font-bold text-sm">Precision Dosing</div>
                    <div className="text-xs text-gray-400">2mg scored tablets</div>
                  </div>
                </div>
                <div className="bg-white/5 p-4 rounded-lg flex items-center gap-3">
                  <Timer className="text-[#9a02d0] text-xl" weight="fill" />
                  <div>
                    <div className="font-bold text-sm">Predictable Effects</div>
                    <div className="text-xs text-gray-400">Fast onset, consistent duration</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </footer>
    </div>
  );
}
