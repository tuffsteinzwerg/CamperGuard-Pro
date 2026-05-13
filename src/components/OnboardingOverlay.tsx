import { Truck, Shield, ChevronRight, Info } from 'lucide-react';

interface OnboardingOverlayProps {
  onNavigate: (target: 'profil' | 'sos') => void;
}

export function OnboardingOverlay({ onNavigate }: OnboardingOverlayProps) {
  return (
    <div className="fixed inset-0 z-[200] bg-[var(--bg-app)] overflow-y-auto">
      <div className="min-h-screen flex flex-col items-center justify-start px-5 py-8 max-w-md mx-auto">

        {/* Logo */}
        <div className="w-[120px] h-[120px] rounded-full cg-instrument-frame flex items-center justify-center mb-4">
          <img
            src="/CGP3DLogo.png"
            alt="CamperGuard Pro"
            className="w-[90px] h-[90px] object-contain"
          />
        </div>

        {/* Titel */}
        <div className="typo-engraved text-center mb-1">Einrichtung</div>
        <div className="typo-section-title text-center mb-4">Wichtige Einstellungen</div>

        {/* Trennlinie */}
        <div className="w-10 h-[2px] bg-[var(--accent)] rounded-full mb-4" />

        {/* Beschreibung */}
        <p className="typo-body-dim text-center mb-6 px-2 leading-relaxed">
          Bitte hinterlege die folgenden Angaben, damit CamperGuard Pro dir alle Funktionen zur Verfügung stellen kann.
        </p>

        {/* Pflicht-Karten */}
        <div className="w-full flex flex-col gap-3 mb-5">

          {/* Fahrzeugdaten */}
          <button
            onClick={() => onNavigate('profil')}
            className="card-standard flex items-center gap-3.5 w-full text-left"
          >
            <div className="icon-circle">
              <Truck size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="typo-card-title">Fahrzeugdaten</div>
              <div className="typo-body-dim">Name, Gewichte, Abmessungen und Kapazitäten</div>
            </div>
            <ChevronRight size={16} className="text-[var(--text-tertiary)] flex-shrink-0" />
          </button>

          {/* Notfalldaten */}
          <button
            onClick={() => onNavigate('sos')}
            className="card-standard flex items-center gap-3.5 w-full text-left"
          >
            <div className="icon-circle">
              <Shield size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="typo-card-title">Notfalldaten</div>
              <div className="typo-body-dim">ICE-Kontakte und medizinische Daten</div>
            </div>
            <ChevronRight size={16} className="text-[var(--text-tertiary)] flex-shrink-0" />
          </button>

        </div>

        {/* Wartungs-Hinweis */}
        <div className="w-full cg-dark-field px-3.5 py-2.5 mb-6">
          <p className="typo-tiny flex items-start gap-2">
            <Info size={14} className="text-[var(--accent)] flex-shrink-0 mt-0.5" />
            <span>Denk auch an deine Wartungstermine — TÜV, Gas, Dichtigkeit und Service findest du im Profil.</span>
          </p>
        </div>

        {/* Einrichten-Button */}
        <button
          onClick={() => onNavigate('profil')}
          className="btn-primary px-10"
        >
          Einrichten
        </button>

        {/* Hinweis */}
        <p className="typo-tiny text-center mt-4 opacity-60">
          Diese Ansicht erscheint, bis alle Pflichtangaben hinterlegt sind.
        </p>

      </div>
    </div>
  );
}
