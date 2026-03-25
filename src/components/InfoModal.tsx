'use client';

import { X, Sparkles, Shield, Zap, Target, BookOpen } from 'lucide-react';
import { useEffect } from 'react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function InfoModal({ isOpen, onClose }: InfoModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        style={{ animation: 'infoFadeIn 0.2s ease-out' }}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-3xl max-h-[90vh] mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{ animation: 'infoSlideUp 0.3s ease-out' }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-white px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">💎 Šta je SEO GEM?</h2>
                <p className="text-emerald-100 text-sm mt-0.5">Arhitektura za vidljivost u eri veštačke inteligencije</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="hover:bg-white/20 rounded-lg p-2 transition-colors"
              aria-label="Zatvori"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-180px)] px-8 py-8">
          <div className="space-y-8 text-gray-700 leading-relaxed">

            {/* Intro */}
            <div>
              <p className="text-lg leading-8">
                <strong className="text-gray-900">SEO GEM</strong> nije samo još jedan u nizu SEO alata –
                to je napredna <em className="text-emerald-700">Generative Engine Optimization (GEO)</em> infrastruktura
                dizajnirana da osigura da vaš sadržaj ne bude samo indeksiran, već i{' '}
                <strong className="text-gray-900">citiran</strong> od strane vodećih AI pretraživača
                i istaknut u <em>Google Discover</em> feed-u.
              </p>
              <p className="text-base mt-4 leading-7 text-gray-600">
                U svetu gde tradicionalna pretraga ustupa mesto AI odgovorima (AI Overviews), SEO GEM
                omogućava vašoj redakciji da pređe put od pukog nizanja ključnih reči (&quot;strings&quot;)
                do strukturiranja stvarnih pojmova (&quot;entities&quot;) koje algoritmi tretiraju
                kao neosporne izvore istine.
              </p>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-100" />

            {/* What you get */}
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
                <Target className="w-5 h-5 text-emerald-600" />
                <span>Šta dobijate korišćenjem SEO GEM alata?</span>
              </h3>
              <p className="text-sm text-gray-500 mb-5">
                Sistem generiše rezultate u sekundi, isporučujući vam gotove elemente spremne za objavu:
              </p>

              <div className="space-y-4">
                {/* Feature 1 */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Zap className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">Dominacija u AI odgovorima</h4>
                      <p className="text-sm text-gray-600 leading-6">
                        Automatsko generisanje &quot;Answer Nugget&quot; meta opisa dizajniranih da postanu
                        primarni izvor informacija za ChatGPT, Perplexity i Google AI Overviews.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Feature 2 */}
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-5 border border-emerald-100">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <BookOpen className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">Matrica od 6 naslova (Urednička kontrola)</h4>
                      <p className="text-sm text-gray-600 leading-6">
                        Alat ne preuzima vaš posao, već vam nudi &quot;švedski sto&quot; od 6 naslova prilagođenih
                        različitim algoritmima (Discover, AI, tradicionalni SEO).
                        <strong> Novinar uvek zadržava kontrolu i bira najbolji ugao</strong>.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Feature 3 */}
                <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl p-5 border border-purple-100">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Shield className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">Izgradnja tematskog autoriteta</h4>
                      <p className="text-sm text-gray-600 leading-6">
                        Generisanje 100% validnog <em>Entity-first Schema Markup-a</em> (JSON-LD) u pozadini teksta,
                        čime se drastično jača E-E-A-T vašeg portala.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-100" />

            {/* Why necessary */}
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
                <Shield className="w-5 h-5 text-emerald-600" />
                <span>Zašto je SEO GEM neophodan vašoj redakciji?</span>
              </h3>
              <p className="text-base text-gray-600 mb-5 leading-7">
                Digitalni pejzaž 2026. godine ne prašta statičnost. Više od{' '}
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-bold bg-red-100 text-red-700">
                  60%
                </span>{' '}
                pretraga završava se bez ijednog klika, a tradicionalni organski saobraćaj pada i do{' '}
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-bold bg-amber-100 text-amber-700">
                  42%
                </span>
                . SEO GEM vam omogućava:
              </p>

              <div className="space-y-3">
                <div className="flex items-start space-x-3 bg-gray-50 rounded-lg p-4">
                  <span className="flex items-center justify-center w-7 h-7 bg-emerald-600 text-white rounded-full text-sm font-bold flex-shrink-0">1</span>
                  <div>
                    <strong className="text-gray-900">Odbranu organskog saobraćaja:</strong>{' '}
                    <span className="text-gray-600">Pretvorite pretnju od AI pretraživača u novi kanal distribucije kroz ekskluzivne citate.</span>
                  </div>
                </div>
                <div className="flex items-start space-x-3 bg-gray-50 rounded-lg p-4">
                  <span className="flex items-center justify-center w-7 h-7 bg-emerald-600 text-white rounded-full text-sm font-bold flex-shrink-0">2</span>
                  <div>
                    <strong className="text-gray-900">Besprekoran Newsroom Workflow:</strong>{' '}
                    <span className="text-gray-600">Drastično smanjenje vremena potrebnog za tehničku optimizaciju vesti.</span>
                  </div>
                </div>
                <div className="flex items-start space-x-3 bg-gray-50 rounded-lg p-4">
                  <span className="flex items-center justify-center w-7 h-7 bg-emerald-600 text-white rounded-full text-sm font-bold flex-shrink-0">3</span>
                  <div>
                    <strong className="text-gray-900">Stratešku prednost na tržištu:</strong>{' '}
                    <span className="text-gray-600">Pozicionirajte svoj portal kao lidera u inovacijama.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-100" />

            {/* How to start */}
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center space-x-2">
                <Zap className="w-5 h-5 text-emerald-600" />
                <span>Kako da počnete?</span>
              </h3>
              <p className="text-base text-gray-600 leading-7">
                Unesite link ili sirovi tekst vaše vesti u polje za ekstrakciju. SEO GEM će analizirati
                vaš sadržaj, prepoznati nameru pretrage i isporučiti vam SEO elemente koji vašu vest
                lansiraju direktno u fokus modernih algoritama.
              </p>
            </div>

            {/* Mission */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-5">
              <p className="text-sm text-emerald-800 italic leading-6 text-center">
                ✨ Misija SEO GEM-a: Jednostavnost u korišćenju, superiornost u rezultatima
                i maksimalna etika u primeni veštačke inteligencije u novinarstvu.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-8 py-4 border-t">
          <button
            onClick={onClose}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 hover:shadow-lg"
          >
            Razumem, započni optimizaciju →
          </button>
        </div>
      </div>

      {/* Animations - using plain style tag for Vercel compatibility */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes infoFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes infoSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}} />
    </div>
  );
}
