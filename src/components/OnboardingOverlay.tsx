import { Truck, Shield, ChevronRight, Check, Info } from 'lucide-react';
import type { AppState } from '../types';

interface OnboardingOverlayProps {
  onNavigate: (target: 'profil' | 'sos') => void;
  state: AppState;
}

export function OnboardingOverlay({ onNavigate, state }: OnboardingOverlayProps) {
  const p = state.profile;
  const s = state.sos;

  const profilDone =
    !!p.vehicleName &&
    !!p.emptyWeight &&
    !!p.maxWeight &&
    !!p.height &&
    !!p.width &&
    !!p.length &&
    !!p.freshWaterCapacity &&
    !!p.wasteWaterCapacity &&
    !!p.dieselCapacity;

  const sosDone =
    !!s.firstName &&
    !!s.lastName &&
    !!s.ice1Name &&
    !!s.ice1Phone &&
    !!s.bloodGroup &&
    !!s.street &&
    !!s.houseNumber &&
    !!s.zipCode &&
    !!s.city &&
    !!s.country;

  return (
    <div className="fixed inset-0 z-[200] bg-[var(--bg-app)] overflow-y-auto">
      <div className="min-h-screen flex flex-col items-center justify-start px-5 py-8 max-w-md mx-auto">

        {/* Logo */}
        <img
          src="/g4c-emblem-rund-tp.png"
          alt="Guard4Campers"
          className="w-[160px] h-[160px] object-contain mb-4"
        />

        {/* Titel */}
        <div className="typo-engraved text-center mb-1">Einrichtung</div>
        <div className="typo-section-title text-center mb-4">Wichtige Einstellungen</div>

        {/* Trennlinie */}
        <div className="w-10 h-[2px] bg-[var(--accent)] rounded-full mb-4" />

        {/* Was ist die App */}
        <p className="typo-body-dim text-center mb-3 px-2 leading-relaxed">
          Dein privates Kontrollcockpit fürs Wohnmobil — Inventar, Gewicht, Sicherheit und Logbuch an einem Ort.
        </p>
        <p className="typo-tiny text-center mb-5 px-4 opacity-50 leading-relaxed">
          Kein Stellplatzfinder. Keine Cloud. Alle Daten bleiben auf deinem Gerät.
        </p>

        {/* Beschreibung */}
        <p className="typo-body-dim text-center mb-6 px-2 leading-relaxed">
          Bitte hinterlege die folgenden Angaben, damit Guard4Campers dir alle Funktionen zur Verfügung stellen kann.
        </p>

        {/* Pflicht-Karten */}
        <div className="w-full flex flex-col gap-3 mb-5">

          {/* Fahrzeugdaten */}
          <button
            onClick={() => onNavigate('profil')}
            className="card-standard flex items-center gap-3.5 w-full text-left"
            style={profilDone ? { borderColor: 'var(--status-ok)' } : undefined}
          >
            <div className="icon-circle" style={profilDone ? { background: 'var(--status-ok)' } : undefined}>
              {profilDone ? <Check size={18} className="text-black" /> : <Truck size={18} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="typo-card-title">{profilDone ? 'Fahrzeugdaten ✓' : 'Fahrzeugdaten'}</div>
              <div className="typo-body-dim">{profilDone ? 'Vollständig hinterlegt' : 'Name, Gewichte, Abmessungen und Kapazitäten'}</div>
            </div>
            {profilDone
              ? <Check size={16} className="text-[var(--status-ok)] flex-shrink-0" />
              : <ChevronRight size={16} className="text-[var(--text-tertiary)] flex-shrink-0" />
            }
          </button>

          {/* Notfalldaten */}
          <button
            onClick={() => onNavigate('sos')}
            className="card-standard flex items-center gap-3.5 w-full text-left"
            style={sosDone ? { borderColor: 'var(--status-ok)' } : undefined}
          >
            <div className="icon-circle" style={sosDone ? { background: 'var(--status-ok)' } : undefined}>
              {sosDone ? <Check size={18} className="text-black" /> : <Shield size={18} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="typo-card-title">{sosDone ? 'Notfalldaten ✓' : 'Notfalldaten'}</div>
              <div className="typo-body-dim">{sosDone ? 'Vollständig hinterlegt' : 'ICE-Kontakte und medizinische Daten'}</div>
            </div>
            {sosDone
              ? <Check size={16} className="text-[var(--status-ok)] flex-shrink-0" />
              : <ChevronRight size={16} className="text-[var(--text-tertiary)] flex-shrink-0" />
            }
          </button>

        </div>

        {/* Wartungs-Hinweis */}
        <div className="w-full cg-dark-field px-3.5 py-2.5 mb-6">
          <p className="typo-tiny flex items-start gap-2">
            <Info size={14} className="text-[var(--accent)] flex-shrink-0 mt-0.5" />
            <span>Denk auch an deine Wartungstermine — TÜV, Gas, Dichtigkeit und Service findest du im Profil.</span>
          </p>
        </div>

        {/* Hinweis */}
        <p className="typo-tiny text-center mt-4 opacity-60">
          Diese Ansicht erscheint, bis alle Pflichtangaben hinterlegt sind.
        </p>

      </div>
    </div>
  );
}
