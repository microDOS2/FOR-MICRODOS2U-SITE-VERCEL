import { Timer, TrendingUp, Hourglass, Pill, ArrowLeftRight } from 'lucide-react';

export function IntroductionSection() {
  return (
    <section id="science" className="py-20 bg-black/50 border-y border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-sm text-psy-neonGreen font-bold tracking-widest uppercase mb-2">
              Introduction
            </h2>
            <h3 className="text-3xl md:text-4xl font-bold mb-6">
              What's in <span className="text-psy-neonGreen">micro</span>
              <span className="text-psy-neonPurple">DOS</span>
              <span className="text-psy-neonPink">(2)</span>?
            </h3>

            <div className="bg-psy-card border border-white/10 rounded-2xl p-8 mb-6 card-hover">
              <h4 className="text-2xl font-bold text-psy-neonPurple mb-1">4-HO-MET</h4>
              <p className="text-sm text-gray-400 mb-4 font-mono">
                4-hydroxy-N-methyl-N-ethyltryptamine
              </p>
              <p className="text-gray-300 mb-6">
                A precision psychedelic tryptamine first synthesized by Alexander "Sasha" Shulgin
                in the 1970s, representing decades of psychedelic research and innovation.
              </p>
              <div className="border-t border-white/10 pt-4 mt-4">
                <h5 className="font-bold text-white mb-2 flex items-center gap-2">
                  <ArrowLeftRight className="text-psy-neonGreen" /> Comparable to Psilocin
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
              <div className="bg-psy-card p-6 rounded-xl border border-white/5 text-center">
                <Timer className="w-8 h-8 text-psy-neonGreen mb-3 mx-auto" />
                <div className="text-sm text-gray-400 uppercase tracking-wider mb-1">Onset</div>
                <div className="text-2xl font-bold">~15 min</div>
              </div>
              <div className="bg-psy-card p-6 rounded-xl border border-white/5 text-center">
                <TrendingUp className="w-8 h-8 text-psy-neonPurple mb-3 mx-auto" />
                <div className="text-sm text-gray-400 uppercase tracking-wider mb-1">Peak</div>
                <div className="text-2xl font-bold">1.5-2 hrs</div>
              </div>
              <div className="bg-psy-card p-6 rounded-xl border border-white/5 text-center">
                <Hourglass className="w-8 h-8 text-psy-neonPink mb-3 mx-auto" />
                <div className="text-sm text-gray-400 uppercase tracking-wider mb-1">Duration</div>
                <div className="text-2xl font-bold">≈4 hrs</div>
              </div>
              <div className="bg-psy-card p-6 rounded-xl border border-white/5 text-center">
                <Pill className="w-8 h-8 text-white mb-3 mx-auto" />
                <div className="text-sm text-gray-400 uppercase tracking-wider mb-1">Form</div>
                <div className="text-xl font-bold">2mg scored tab</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
