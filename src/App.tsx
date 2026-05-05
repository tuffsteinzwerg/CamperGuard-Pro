import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShieldCheck, Settings, Map as MapIcon, BookOpen, Package, Activity, 
  Plus, Trash2, ChevronRight, Save, Search, Navigation, AlertTriangle,
  FileDown, ChevronDown, ChevronUp, Printer, MapPin, Volume2, Archive, CheckCircle, Check,
  ShieldPlus, Phone, Truck, Edit2, User, Droplet, HeartPulse, Pill, Fuel, Flame,
  ArrowLeftRight, ArrowUpDown, Weight, Scale
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { openDB } from 'idb';
import { INITIAL_STATE, AppState, InventoryItem, FuelEntry, TripEntry, FuelType, Currency, TireProfile, SpotEntry, FAQEntry, EmergencyGear, PharmacyItem } from './types.ts';

// Fix Leaflet icons
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

let globalLeafletMap: L.Map | null = null;
const DB_NAME = 'CamperGuardDB_V2';

async function initDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('store')) {
        db.createObjectStore('store');
      }
    },
  });
}

const formatNumber = (num: number, decimals: number = 2) => num.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const formatWeight = (kg: number): string => {
  if (kg <= 0) return '';
  if (kg < 1) {
    const grams = Math.round(kg * 1000);
    return `${grams} g`;
  }
  return `${kg.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;
};

const ViewTitle = ({ children, right }: { children: React.ReactNode, right?: React.ReactNode }) => (
  <div className="flex justify-between items-end mb-4 px-2 no-print">
      <h1 className="typo-section-title" style={{ fontSize: '14px' }}>{children}</h1>
      {right}
  </div>
);

const Card = (props: any) => {
  const { children, className, ...rest } = props;
  return (
    <div className={`cg-master-card-small rounded-lg p-4 ${className || ""}`} {...rest}>
      {children}
    </div>
  );
};

export default function App() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'status' | 'inhalt' | 'logbuch' | 'reise' | 'profil'>('status');
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [orientation, setOrientation] = useState({ pitch: 0, roll: 0, heading: 0 });
  const [showChangelog, setShowChangelog] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const db = await initDB();
        const saved = await db.get('store', 'state');
        // Ensure default SOS exists if loaded from old DB
        if (saved) {
           const loadedSos = saved.sos || INITIAL_STATE.sos;
           
           // Migrate old 'name', 'address', 'iceName', 'icePhone' if they exist
           if ('name' in loadedSos) {
             const parts = (loadedSos.name || "").split(" ");
             loadedSos.firstName = parts[0] || "";
             loadedSos.lastName = parts.slice(1).join(" ") || "";
             delete loadedSos.name;
           }
           if ('iceName' in loadedSos) {
             loadedSos.ice1Name = loadedSos.iceName || "";
             loadedSos.ice1Phone = loadedSos.icePhone || "";
             delete loadedSos.iceName;
             delete loadedSos.icePhone;
           }
           
           // Ensure all new fields have defaults
           ['address', 'houseNumber', 'zipCode', 'city', 'country', 'ice2Name', 'ice2Phone', 'medications'].forEach(k => {
              if (loadedSos[k] === undefined) loadedSos[k] = "";
           });

           if (loadedSos.gear) {
               loadedSos.gear = loadedSos.gear.map((g: any) => {
                   const migrated = { ...g };
                   if (migrated.count === undefined) {
                       migrated.count = migrated.checked ? 1 : 0;
                   }
                   if (migrated.locations === undefined) {
                       if (typeof migrated.location === 'string') {
                           migrated.locations = migrated.location.trim() ? [migrated.location] : (migrated.checked ? [''] : []);
                       } else {
                           migrated.locations = migrated.checked ? [''] : [];
                       }
                       delete migrated.location;
                   }
                   return migrated;
               });
               
               const requiredCategories = ['Feuerlöscher', 'Feuerlöschdecke', 'Warnwesten', 'Erste-Hilfe-Kasten', 'Warndreieck'];
               requiredCategories.forEach((cat, idx) => {
                   if (!loadedSos.gear.some((g: any) => g.name === cat)) {
                       loadedSos.gear.push({
                           id: `g_new_${idx}`,
                           name: cat,
                           checked: false,
                           count: 0,
                           locations: [],
                           weight: '',
                           weightUnit: 'kg'
                       });
                   }
               });
           }

           // Migrate tank fields
           const loadedProfile = saved.profile || INITIAL_STATE.profile;
           if ('fuelCapacity' in loadedProfile && !('freshWaterCapacity' in loadedProfile)) {
             loadedProfile.freshWaterCapacity = loadedProfile.fuelCapacity || 0;
             loadedProfile.wasteWaterCapacity = 0;
             loadedProfile.dieselCapacity = 0;
             delete loadedProfile.fuelCapacity;
           }
           if ('adBlueCapacity' in loadedProfile) {
             delete loadedProfile.adBlueCapacity;
           }
           const migratedWasteWaterLevel = saved.wasteWaterLevel ?? 0;
           const migratedDieselLevel = saved.dieselLevel ?? 50;

           // Subcategories absichern und aus vorhandenen Artikeln rekonstruieren
           const loadedSubcategories = saved.subcategories || { "Küche": [], "Wohnen": [], "Bad": [], "Garage": [], "Technik": [] };
           // Sicherstellen dass alle Kategorien als Key existieren
           ["Küche", "Wohnen", "Bad", "Garage", "Technik"].forEach(cat => {
             if (!loadedSubcategories[cat]) loadedSubcategories[cat] = [];
           });
           // Fehlende Lagerorte aus den Artikeln rekonstruieren
           if (saved.inventory && Array.isArray(saved.inventory)) {
             saved.inventory.forEach((item: any) => {
               if (item.category && item.subcategory && item.subcategory.trim() !== '') {
                 const subs = loadedSubcategories[item.category];
                 if (subs && !subs.includes(item.subcategory)) {
                   subs.push(item.subcategory);
                 }
               }
             });
           }

           setState({ 
             ...INITIAL_STATE, 
             ...saved, 
             profile: { ...INITIAL_STATE.profile, ...loadedProfile },
             wasteWaterLevel: migratedWasteWaterLevel,
             dieselLevel: migratedDieselLevel,
             subcategories: loadedSubcategories,
             exchangeRates: saved.exchangeRates || INITIAL_STATE.exchangeRates,
             sos: loadedSos 
           });
        }
      } catch (err) {
        console.error(err);
      }
      
      try {
        const res = await fetch('https://open.er-api.com/v6/latest/EUR');
        const data = await res.json();
        if (data && data.rates) {
           setState(prev => ({...prev, exchangeRates: data.rates}));
        }
      } catch(e) {}
      
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (loading) return;

    const timer = setTimeout(() => {
      initDB().then(db => db.put('store', state, 'state'));
    }, 700);

    return () => clearTimeout(timer);
  }, [state, loading]);

  // Unified orientation logic
  useEffect(() => {
    let lastUpdate = 0;
    const handleOrientation = (e: DeviceOrientationEvent) => {
      try {
        const now = Date.now();
        if (now - lastUpdate < 50) return; // Max 20Hz for Fold-Fix
        lastUpdate = now;

        let h = 0;
        if (e.alpha !== null) h = e.alpha;
        // @ts-ignore
        if (e.webkitCompassHeading !== undefined) h = e.webkitCompassHeading;
        
        setOrientation({ pitch: e.beta || 0, roll: e.gamma || 0, heading: h });
      } catch (err) {
        console.warn("DeviceOrientation handling error:", err);
      }
    };

    try {
      window.addEventListener('deviceorientation', handleOrientation);
    } catch (err) {
      console.warn("Could not attach deviceorientation", err);
    }
    
    return () => {
      try {
        window.removeEventListener('deviceorientation', handleOrientation);
      } catch (err) {}
    };
  }, []);

  const demoSeed = () => {
      setState(INITIAL_STATE);
      alert("Demo init gestartet.");
  };

  if (loading) return <div className="fixed inset-0 bg-[var(--bg-app)] z-[999]" />;

  return (
    <div className="min-h-screen pb-24 lg:max-w-none max-w-md mx-auto relative bg-[var(--bg-app)] text-white">
      
      <header className="h-[60px] px-4 bg-[var(--bg-input)] border-b-2 border-[var(--accent)] sticky top-0 z-40 flex justify-between items-center no-print overflow-hidden gap-4">
        <div className="flex items-center gap-2 flex-shrink-0">
          <ShieldCheck className="text-[var(--accent)]" size={20} />
          <span className="brand-title whitespace-nowrap">
            <span className="brand-big">C</span>amper<span className="brand-big">G</span>uard Pro
          </span>
        </div>
        <div className="flex items-center justify-end min-w-0 gap-3">
          <button onClick={() => setActiveTab('profil')} className="cg-master-button !p-2 !rounded flex-shrink-0">
            <Settings size={16} />
          </button>
        </div>
      </header>

      <main className="p-4 overflow-y-auto lg:max-w-6xl lg:mx-auto min-h-[80vh]">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            {activeTab === 'status' && <StatusView state={state} setState={setState} orientation={orientation} />}
            {activeTab === 'inhalt' && <InhaltView state={state} setState={setState} />}
            {activeTab === 'logbuch' && <LogbuchView state={state} setState={setState} />}
            {activeTab === 'reise' && <ReiseView state={state} setState={setState} orientation={orientation} />}
            {activeTab === 'profil' && <ProfilView state={state} setState={setState} demoSeed={demoSeed} />}
          </motion.div>
        </AnimatePresence>
        <div 
          className="mt-8 mb-4 text-center text-[10px] text-[var(--text-muted)] opacity-50 no-print cursor-pointer"
          onClick={() => setShowChangelog(true)}
        >
          CamperGuard Pro v0.1.0-dev
        </div>

        {showChangelog && (
          <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col p-4 overflow-y-auto no-print">
            <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border)] max-w-2xl mx-auto w-full text-[12px] text-white">
              <h2 className="text-lg font-bold text-[var(--primary)] mb-1">CamperGuard Pro v0.1.0-dev</h2>
              <p className="text-[var(--text-muted)] mb-4">Stand: 05.05.2026</p>
              
              <h3 className="font-bold mb-2">Änderungen:</h3>
              <ul className="space-y-1 text-gray-300">
                <li>001. BusinessTripLog im Typensystem ergänzt.</li>
                <li>002. BusinessTripEntry angelegt.</li>
                <li>003. BusinessTripEntry um driver: string erweitert.</li>
                <li>004. businessTripLog im App-State ergänzt.</li>
                <li>005. Tanklogik analysiert: Verbrauchsberechnung basiert auf Tankdaten.</li>
                <li>006. Volltankungen werden in der Verbrauchsberechnung berücksichtigt.</li>
                <li>007. Teilbetankungen werden gesammelt und korrekt in Verbrauchssegmente einbezogen.</li>
                <li>008. Verbrauch wird segmentweise zwischen Volltankungen berechnet.</li>
                <li>009. Fahrtenbuch-Kilometer werden nicht mehr mit Tank-Kilometern vermischt.</li>
                <li>010. Tankformular gegen ungültige Literwerte abgesichert.</li>
                <li>011. Literwerte dürfen nicht 0 oder negativ sein.</li>
                <li>012. Preiswerte dürfen nicht 0 oder negativ sein.</li>
                <li>013. Fehler im Tankformular werden sichtbar angezeigt.</li>
                <li>014. Fehlerhafte Tankformularfelder erhalten rote Markierung bzw. Hinweis.</li>
                <li>015. Tankformular-Eingaben gegen Minuszeichen und Sonderzeichen verbessert.</li>
                <li>016. Tankkapazität wird gegen den Profilwert geprüft.</li>
                <li>017. Löschen von Tankeinträgen in Google AI Studio Preview analysiert.</li>
                <li>018. Mögliche Ursachen für Tank-Löschproblem notiert: alte Einträge ohne id, window.confirm im Preview-iframe, Storage-/Preview-Verhalten.</li>
                <li>019. Entscheidung getroffen: Tank-Löschproblem später in echter App erneut testen.</li>
                <li>020. Profil um Kapazitäten für Frischwasser, Abwasser und Kraftstoff erweitert.</li>
                <li>021. Aktuelle Tankfüllstände werden prozentual gepflegt.</li>
                <li>022. Profilbereich „Tankstände & Füllmengen“ erweitert.</li>
                <li>023. Bedienbare Füllstandsbalken/Slider für Tankstände eingebaut.</li>
                <li>024. Prozentwerte und berechnete Liter werden angezeigt.</li>
                <li>025. Fahrzeugmaße im Profil werden in cm geführt.</li>
                <li>026. Fahrzeughöhe validiert.</li>
                <li>027. Fahrzeugbreite validiert.</li>
                <li>028. Fahrzeuglänge validiert.</li>
                <li>029. Maße dürfen nicht 0 oder negativ sein.</li>
                <li>030. Maximalwert Höhe auf 500 cm ergänzt.</li>
                <li>031. Maximalwert Breite auf 300 cm ergänzt.</li>
                <li>032. Maximalwert Länge auf 1200 cm ergänzt.</li>
                <li>033. Fehler für ungültige Fahrzeugmaße werden sichtbar angezeigt.</li>
                <li>034. Reifendruckbereich geprüft.</li>
                <li>035. Reifendruckfelder VL, VR, HL, HR, HL außen und HR außen bestätigt.</li>
                <li>036. Zwillingsbereifung im Reifendruckbereich bestätigt.</li>
                <li>037. Reifendruckwerte gegen negative Werte abgesichert.</li>
                <li>038. Reifendruckwerte &lt;= 0 als ungültig behandelt.</li>
                <li>039. Maximalwert für Reifendruck auf 10 bar gesetzt.</li>
                <li>040. Sichtbarer Fehlerhinweis für ungültige Reifendruckwerte ergänzt.</li>
                <li>041. Bug mit || bei Außenreifen erkannt.</li>
                <li>042. Außenreifen-Logik von || auf ?? umgestellt, damit 0 nicht fälschlich als leer gilt.</li>
                <li>043. Gewichtsberechnung geprüft.</li>
                <li>044. Gesamtgewicht basiert auf Leergewicht, Frischwasser, Abwasser, Kraftstoff und Inventar.</li>
                <li>045. Kraftstofffaktor ca. 0.84 kg/l bestätigt.</li>
                <li>046. Prozentwerte werden für Gewichtsberechnung in Liter umgerechnet.</li>
                <li>047. Rundungsfehler in der Gewichtsberechnung reduziert.</li>
                <li>048. Zwischenwerte werden intern nicht mehr gerundet.</li>
                <li>049. Rundung soll nur für Anzeige erfolgen.</li>
                <li>050. Drei Kilometerquellen definiert: fuelLog.km, tripLog.toKm und businessTripLog.toKm.</li>
                <li>051. Zentrale Funktion getLastKnownKm() eingeführt.</li>
                <li>052. getLastKnownKm() ermittelt höchsten bekannten Kilometerstand aus Tanklog, Fahrtenbuch und BusinessTripLog.</li>
                <li>053. getLastKnownKm() als globale Kilometerquelle verwendet.</li>
                <li>054. Start-Kilometer werden automatisch vorgeschlagen.</li>
                <li>055. Start-Kilometer bleiben manuell änderbar.</li>
                <li>056. Warnung ergänzt, wenn neuer Kilometerwert kleiner als höchster bekannter Kilometerstand ist.</li>
                <li>057. End-Kilometer kleiner als Start-Kilometer bleibt harter Fehler.</li>
                <li>058. Fahrer-Feld im BusinessTripLog ergänzt.</li>
                <li>059. driver ist Pflichtfeld bei Business-Fahrten.</li>
                <li>060. Pflichtfelder bei Business-Fahrten definiert: Start-KM, Ziel-KM, Kategorie und Fahrer.</li>
                <li>061. Zweck bei Business-Fahrten bleibt optional.</li>
                <li>062. Fahrer wird gespeichert.</li>
                <li>063. Fahrer wird angezeigt.</li>
                <li>064. 24h-Logik im Fahrtenbuch bleibt erhalten.</li>
                <li>065. Rückwirkende Fahrten als fachlich kritisch notiert.</li>
                <li>066. Statusseite deutlich überarbeitet.</li>
                <li>067. Gesamtgewicht als Hero-Element auf der Statusseite dargestellt.</li>
                <li>068. Rundes Gewichts-Gauge auf der Statusseite eingebaut.</li>
                <li>069. Gauge nutzt Ring-/Progress-Darstellung.</li>
                <li>070. Gewichtstatus wird angezeigt: sicherer Bereich oder Überladen.</li>
                <li>071. Restgewicht bzw. Überladung wird angezeigt.</li>
                <li>072. Zahl, Maximalgewicht und Status im bzw. unter dem Gauge dargestellt.</li>
                <li>073. Status-Gauge als noch nicht final premium-final notiert.</li>
                <li>074. Designziel für Status-Gauge notiert: näher an Reise-Kompass, mehr Tiefe, dunklerer Innenkörper, hochwertigerer Rahmen.</li>
                <li>075. Design-System in src/index.css vorbereitet.</li>
                <li>076. Klasse cg-card vorhanden.</li>
                <li>077. Klasse cg-panel vorhanden.</li>
                <li>078. Klasse cg-instrument-frame vorhanden.</li>
                <li>079. Klasse cg-instrument-inner vorhanden.</li>
                <li>080. Klasse cg-dark-field vorhanden.</li>
                <li>081. Klasse cg-soft-button vorhanden.</li>
                <li>082. card-standard angepasst.</li>
                <li>083. Reise-Tab mit Kompass/Wasserwaage als visuelle Master-Referenz festgelegt.</li>
                <li>084. Statusseite als bereits bearbeitet bestätigt.</li>
                <li>085. Rundes Gewichtsgauge im Code bestätigt.</li>
                <li>086. cg-* Designklassen in index.css bestätigt.</li>
                <li>087. Reise-Kompass/Wasserwaage im Code bestätigt.</li>
                <li>088. getLastKnownKm() im Code bestätigt.</li>
                <li>089. BusinessTripEntry.driver im Code bestätigt.</li>
                <li>090. Checklisten-Plus als offener Bug notiert.</li>
                <li>091. Tab-Flackern als offener Bug notiert.</li>
                <li>092. CamperGuard Pro Funktionskern dokumentiert: Status, Profil, Logbuch, Inventar, Reise, Safety Hub, Druck/Export und lokale Speicherung.</li>
                <li>093. Primäre Zielgruppe festgelegt: Wohnmobilfahrer, Campervan-Besitzer, Wohnwagen-/Anhänger-Nutzer und mobile Camper.</li>
                <li>094. Hauptnutzen festgelegt: Sicherheit und Kontrolle über Fahrzeugzustand, Gewicht, Beladung, Reisevorbereitung und Notfalldaten.</li>
                <li>095. Nicht gesicherte Kernfunktionen notiert: Diebstahlschutz, Hardware-Sensorik, Community, Live-Tracking und Campingplatzbewertung.</li>
                <li>096. Positionierung festgelegt: integriertes Camper-Cockpit statt reine Stellplatz-/Community-App.</li>
                <li>097. Medikamentenfeld expiry analysiert.</li>
                <li>098. expiry als Verfallsdatum / Haltbar bis identifiziert.</li>
                <li>099. expiry wird als leerer String initialisiert.</li>
                <li>100. expiry nutzt input type="month".</li>
                <li>101. expiry wird über updateSos in state.sos.pharmacy gespeichert.</li>
                <li>102. expiry wurde zuvor nackt im Meta-String angezeigt.</li>
                <li>103. Keine bestehende Statusseiten-Warnlogik für Medikamentenablauf gefunden.</li>
                <li>104. Medikamentenfeld im Formular sichtbar als Haltbar bis / Verfallsdatum verständlicher gemacht.</li>
                <li>105. ReadOnly-Kartenansicht zeigt expiry nicht mehr nackt, sondern als „Haltbar bis: YYYY-MM“.</li>
                <li>106. Lokale Ablauf-Erkennung für Medikamente im Safety Hub vorbereitet.</li>
                <li>107. expiredPharmacyItems eingeführt.</li>
                <li>108. soonExpiringPharmacyItems eingeführt.</li>
                <li>109. YYYY-MM wird als gültig bis zum letzten Tag des Monats interpretiert.</li>
                <li>110. Abgelaufene Medikamente werden erkannt.</li>
                <li>111. Bald ablaufende Medikamente werden erkannt.</li>
                <li>112. Einträge ohne expiry werden ignoriert.</li>
                <li>113. Ungültige expiry-Werte werden ignoriert.</li>
                <li>114. Abgelaufene Medikamente werden nicht zusätzlich als bald fällig gezählt.</li>
                <li>115. Sicherheitsprüfung für Monatswerte ergänzt bzw. empfohlen: Monat muss zwischen 1 und 12 liegen.</li>
                <li>116. Lokale Medikamenten-Ablaufübersicht im Safety Hub ergänzt.</li>
                <li>117. Abgelaufene Medikamente werden im Medikamentenbereich gesammelt angezeigt.</li>
                <li>118. Bald ablaufende Medikamente werden im Medikamentenbereich gesammelt angezeigt.</li>
                <li>119. Ablaufübersicht zeigt maximal die ersten 3 betroffenen Einträge.</li>
                <li>120. Ablaufübersicht zeigt „+ X weitere“, wenn mehr als 3 Einträge betroffen sind.</li>
                <li>121. Statusseite um Sammelwarnung für abgelaufene Medikamente erweitert.</li>
                <li>122. Statusseite um Sammelwarnung für bald ablaufende Medikamente erweitert.</li>
                <li>123. Statusseite zeigt keine Medikamentennamen und keine Lagerorte.</li>
                <li>124. Details bleiben im Safety Hub / Apotheke.</li>
                <li>125. Entscheidung getroffen: Medikamentenwarnungen nutzen gleiche Warnlogik mit Warndreieck wie technische Hinweise.</li>
                <li>126. Entscheidung getroffen: Statusseite bleibt Zusammenfassung, Safety Hub bleibt Detailzentrale.</li>
                <li>127. Medikamentenformular-Raster auf sauberes 2-Spalten-Grid umgestellt.</li>
                <li>128. Felder Medikament und Zweck in einheitlichem Raster angeordnet.</li>
                <li>129. Felder Verfallsdatum und Lagerort in einheitlichem Raster angeordnet.</li>
                <li>130. Felder Menge und Einheit in einheitlichem Raster angeordnet.</li>
                <li>131. Felder Gewicht/Stk. und Gewichtseinheit in einheitlichem Raster angeordnet.</li>
                <li>132. Fertig-Button über beide Spalten gesetzt.</li>
                <li>133. Äußeres Label „HALTBAR BIS“ entfernt.</li>
                <li>134. Verfallsdatum als visueller Text ins Feld verlegt.</li>
                <li>135. Native Month-Striche im leeren Datumsfeld als Problem erkannt.</li>
                <li>136. Fake-Field-Lösung für Verfallsdatum eingeführt.</li>
                <li>137. Sichtbares Fake-Field zeigt bei leerem Wert „Verfallsdatum“.</li>
                <li>138. Sichtbares Fake-Field zeigt bei gesetztem Wert YYYY-MM.</li>
                <li>139. Echter input type="month" liegt unsichtbar über dem Fake-Field.</li>
                <li>140. Kalender-/Month-Picker-Funktion bleibt erhalten.</li>
                <li>141. Äußeres Label „GEWICHT/STK.“ entfernt.</li>
                <li>142. Gewichtsfeld nutzt Placeholder „Gewicht/Stk.“.</li>
                <li>143. Doppelte Medikamenten-Löschbuttons analysiert.</li>
                <li>144. Innerer Löschbutton im geöffneten Medikamentenformular als redundant erkannt.</li>
                <li>145. Innerer Medikamenten-Löschbutton entfernt.</li>
                <li>146. Äußerer Medikamenten-Löschbutton behalten.</li>
                <li>147. Medikamenten-Löschen mit window.confirm abgesichert.</li>
                <li>148. Bestätigungstext „Medikament wirklich löschen?“ ergänzt.</li>
                <li>149. Medikamentenname und Verfallsdatum als Pflichtfelder festgelegt.</li>
                <li>150. Zweck, Lagerort, Menge, Einheit, Gewicht/Stk. und Gewichtseinheit bleiben optional.</li>
                <li>151. Fertig-Button schließt den Editor nicht mehr, wenn Medikamentenname fehlt.</li>
                <li>152. Fertig-Button schließt den Editor nicht mehr, wenn Verfallsdatum fehlt.</li>
                <li>153. Fehlender Medikamentenname wird sichtbar rot markiert.</li>
                <li>154. Fehlendes Verfallsdatum wird sichtbar rot markiert.</li>
                <li>155. Fehlerhinweis „Medikament und Verfallsdatum ausfüllen.“ ergänzt.</li>
                <li>156. Entscheidung getroffen: Medikamenten-Vorwarnzeit von 90 Tagen auf 30 Tage reduzieren.</li>
                <li>157. Entscheidung getroffen: Einträge ohne Name sollen nicht in Medikamenten-Ablaufwarnungen erscheinen.</li>
                <li>158. Audio-Level-Assist im Reise-Tab analysiert.</li>
                <li>159. Audio-Logik in ReiseView lokalisiert.</li>
                <li>160. Verwendete Web Audio API bestätigt.</li>
                <li>161. AudioContext / webkitAudioContext bestätigt.</li>
                <li>162. OscillatorNode für Richtungstöne bestätigt.</li>
                <li>163. GainNode für Lautstärke-Hüllkurve bestätigt.</li>
                <li>164. StereoPannerNode für Links/Rechts-Panning bestätigt.</li>
                <li>165. Start/Stop über handleAudioToggle analysiert.</li>
                <li>166. scheduleNextPulse als Loop-Steuerung analysiert.</li>
                <li>167. playDirectionTone als Richtungston-Funktion analysiert.</li>
                <li>168. playLockTone als Zentrum-/Lock-Ton analysiert.</li>
                <li>169. Eingehende Level-Werte calibratedPitch und calibratedRoll identifiziert.</li>
                <li>170. tiltIntensity als Pythagoras-Intensität aus Pitch/Roll identifiziert.</li>
                <li>171. Aktuelle Richtungslogik mit needRaiseFront / needRaiseLeft etc. analysiert.</li>
                <li>172. Tonhöhe als Richtungsindikator analysiert: vorne höher, hinten tiefer, links/rechts mittig.</li>
                <li>173. Lautstärke bisher als konstant erkannt.</li>
                <li>174. Hartes Stereo-Panning -1 / 1 erkannt.</li>
                <li>175. Pulslogik als setTimeout-Loop erkannt.</li>
                <li>176. Bisherige stufenlose Pulslogik als schlecht hörbar bewertet.</li>
                <li>177. Entscheidung getroffen: Audio soll als Zielannäherungs-System funktionieren.</li>
                <li>178. Audio-Ziel festgelegt: weit weg vom Level = langsamer Puls.</li>
                <li>179. Audio-Ziel festgelegt: näher am Level = schnellerer Puls.</li>
                <li>180. Audio-Ziel festgelegt: fast Level = sehr schneller Puls.</li>
                <li>181. Audio-Ziel festgelegt: im grünen Bereich = Lock-/Zentrumston.</li>
                <li>182. Audio Schritt 1: Intervalllogik in scheduleNextPulse stufig gemacht.</li>
                <li>183. Delay-Stufen zuerst auf 1200 / 800 / 450 / 250 ms gesetzt.</li>
                <li>184. Audio Schritt 2: Richtungston von sine auf triangle geändert.</li>
                <li>185. Richtungston-Hüllkurve kurz/trocken gehalten.</li>
                <li>186. Audio-Test: Richtungston als zu leise erkannt.</li>
                <li>187. Audio-Test: Pulsfrequenz als zu langsam erkannt.</li>
                <li>188. Richtungston-Gain von 0.1 auf 0.28 erhöht.</li>
                <li>189. Delay-Stufen beschleunigt auf 500 / 350 / 220 / 120 ms.</li>
                <li>190. Versionsanzeige CamperGuard Pro v0.1.0-dev unten ergänzt.</li>
                <li>191. Versionsanzeige klein, unaufdringlich und no-print gesetzt.</li>
                <li>192. Horizontal-/Vertikal-Zahlen im Reise-Tab analysiert.</li>
                <li>193. Box X (Roll) als Horizontal-Anzeige identifiziert.</li>
                <li>194. Box Y (Pitch) als Vertikal-Anzeige identifiziert.</li>
                <li>195. Werte basieren auf calibratedPitch / calibratedRoll und Normalisierung.</li>
                <li>196. Zahlenformatierung mit Math.abs und Math.round bestätigt.</li>
                <li>197. Gradient-Text-Technik als Ursache schlechter Lesbarkeit erkannt.</li>
                <li>198. WebkitBackgroundClip/TextFillColor-Ansatz als problematisch erkannt.</li>
                <li>199. Starker textShadow als zusätzliche Ursache schlechter Lesbarkeit erkannt.</li>
                <li>200. Horizontal-/Vertikal-Zahlen auf solide Textfarben umgestellt.</li>
                <li>201. Gradient-Text für Horizontal-/Vertikal-Zahlen entfernt.</li>
                <li>202. Text-Glow der Zahlen stark reduziert.</li>
                <li>203. Zahlenklasse von text-3xl auf text-4xl erhöht.</li>
                <li>204. Berechnung der Horizontal-/Vertikal-Werte unverändert gelassen.</li>
                <li>205. Bubble-/Luftblasen-Position im Reise-Tab analysiert.</li>
                <li>206. Bubble unter Kommentar „The Bubble (LED Sphere) - Z-30“ identifiziert.</li>
                <li>207. Bubble-Position wird über rollNormalized * 3.8 und pitchNormalized * 3.8 gesteuert.</li>
                <li>208. Rechteckiger Clamp von pitchNormalized / rollNormalized erkannt.</li>
                <li>209. Diagonales Herausspringen durch rechteckigen Clamp und Spring-Overshoot erklärt.</li>
                <li>210. Framer-Motion-Spring-Overshoot als Ursache erkannt.</li>
                <li>211. Fehlendes overflow-hidden am wirksamen Bubble-Container erkannt.</li>
                <li>212. Runder overflow-hidden Wrapper um zentrale Bubble ergänzt.</li>
                <li>213. Bubble bleibt dadurch optisch im Instrumentbereich begrenzt.</li>
                <li>214. Sensorlogik der Bubble unverändert gelassen.</li>
                <li>215. Bubble-Animation unverändert gelassen.</li>
                <li>216. Mathematischer Kreis-Clamp für Bubble-Zielposition als nächster möglicher Schritt notiert.</li>
                <li>217. Offener nächster Bubble-Schritt: prüfen, ob Wrapper reicht.</li>
                <li>218. Offener nächster Bubble-Schritt: falls nötig kreisförmiges Clamping der Zielposition ergänzen.</li>
                <li>219. Offener Sound-Schritt: neuen schnelleren, lauteren Audio-Test auf Handy und Kopfhörer prüfen.</li>
                <li>220. Offener Sound-Schritt: falls Grundgefühl passt, vorne/hinten über Rhythmusmuster unterscheiden.</li>
                <li>221. Offener Sound-Schritt: vorne = Doppel-Tack prüfen.</li>
                <li>222. Offener Sound-Schritt: hinten = längerer Tack prüfen.</li>
                <li>223. Offener Sound-Schritt: links/rechts weiter über Stereo-Panning prüfen.</li>
              </ul>
              
              <button 
                className="cg-master-button mt-6 w-full"
                onClick={() => setShowChangelog(false)}
              >
                Schließen
              </button>
            </div>
          </div>
        )}

        <img src="/CHAMPERGUARD-PRO%20LOGO1.png" alt="CamperGuard Pro" className="hidden print-only fixed bottom-4 left-4 w-32 style-print-logo" />
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md lg:max-w-none bg-[var(--bg-input)] border-t border-[var(--border)] h-[70px] px-4 flex justify-between items-center z-40 no-print">
        <NavButton active={activeTab === 'status'} onClick={() => setActiveTab('status')} icon={<Activity size={20} />} label="Status" />
        <NavButton active={activeTab === 'inhalt'} onClick={() => setActiveTab('inhalt')} icon={<Package size={24} />} label="Inhalt" />
        <NavButton active={activeTab === 'logbuch'} onClick={() => setActiveTab('logbuch')} icon={<BookOpen size={24} />} label="Logbuch" />
        <NavButton active={activeTab === 'reise'} onClick={() => setActiveTab('reise')} icon={<MapIcon size={24} />} label="Reise" />
        <NavButton active={activeTab === 'profil'} onClick={() => setActiveTab('profil')} icon={<Settings size={24} />} label="Profil" />
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button onClick={onClick} className={`flex-1 flex flex-col items-center gap-1 transition-all ${active ? 'text-[var(--accent)]' : 'text-white/60 hover:text-white'}`}>
      <motion.div animate={active ? { scale: 1.1 } : { scale: 1 }}>{icon}</motion.div>
      <span className="typo-label" style={{ fontSize: '9px', color: 'inherit' }}>{label}</span>
      {active && <motion.div layoutId="nav-indicator" className="w-4 h-0.5 bg-[var(--accent)] mt-1" />}
    </button>
  );
}
// --- SUBVIEWS ---
function StatusView({ state, setState, orientation }: any) {
  const [editingPharmacyId, setEditingPharmacyId] = useState<string | null>(null);
  const [showSos, setShowSos] = useState(false);
  const [sosTab, setSosTab] = useState<'hilfe'|'id'|'inhalt'>('hilfe');
  const [isEditingId, setIsEditingId] = useState(false);
  const [gpsAlt, setGpsAlt] = useState<number|null>(null);
  const [gpsCoords, setGpsCoords] = useState<{lat: number, lng: number} | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'offline'|'loading'|'active'>('offline');
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [editingChecklistItemId, setEditingChecklistItemId] = useState<string | null>(null);
  const [editingChecklistText, setEditingChecklistText] = useState("");

  const pitchNormalized = Math.max(-20, Math.min(20, orientation.pitch));
  const rollNormalized = Math.max(-20, Math.min(20, orientation.roll));
  const heading = orientation.heading;
  
  const freshWaterLiters = (state.waterLevel / 100) * (state.profile.freshWaterCapacity || 0);
  const wasteWaterLiters = (state.wasteWaterLevel / 100) * (state.profile.wasteWaterCapacity || 0);
  const fuelLiters = (state.dieselLevel / 100) * (state.profile.dieselCapacity || 0);

  const waterWeightImpact = freshWaterLiters * 1;
  const wasteWaterWeight = wasteWaterLiters * 1;
  const dieselWeight = fuelLiters * 0.84;

  const inventoryWeight = (state.inventory || []).reduce((acc: number, item: any) => {
    if (item.weight !== undefined && item.weight !== null && !isNaN(item.weight)) {
      const unit = (item.weightUnit || 'kg').toLowerCase();
      if (unit === 'g' || unit === 'gr') return acc + (item.weight * (item.quantity || 0)) / 1000;
      return acc + (item.weight * (item.quantity || 0));
    }
    return acc;
  }, 0);
  const totalWeight = (state.profile.emptyWeight || 0) + waterWeightImpact + wasteWaterWeight + dieselWeight + inventoryWeight;
  const remainingWeight = (state.profile.maxWeight || 0) - totalWeight;

  useEffect(() => {
     let watchId: number | undefined;
     if (state.sos.gpsEnabled !== false) {
       setGpsStatus('loading');
       try {
         watchId = navigator.geolocation.watchPosition(
            p => {
               setGpsAlt(p.coords.altitude);
               setGpsCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
               setGpsStatus('active');
            },
            e => {
               console.warn(e);
               setGpsStatus('offline');
               setGpsCoords(null);
               setGpsAlt(null);
            },
            { enableHighAccuracy: true }
         );
       } catch (err) {
         console.warn("Geolocation start error:", err);
         setGpsStatus('offline');
       }
     } else {
       setGpsStatus('offline');
       setGpsCoords(null);
       setGpsAlt(null);
     }
     return () => {
       if (watchId !== undefined) {
         try { navigator.geolocation.clearWatch(watchId); } catch(e){}
       }
     };
  }, [state.sos.gpsEnabled]);

  const updateSos = (field: string, val: any) => setState({...state, sos: {...state.sos, [field]: val}});

  const overLbs = remainingWeight < 0 ? Math.abs(remainingWeight) : 0;
  const warnings: {type: 'danger' | 'warn', text: string}[] = [];
  if (overLbs > 0) {
      warnings.push({ type: 'danger', text: `Fahrzeug überladen! ${formatNumber(overLbs, 0)} kg über ZGG` });
  }
  const nowMs = new Date().getTime();
  (state.maintenance || []).forEach((m: any) => {
      if (!m.date) return;
      const dateMs = new Date(m.date).getTime();
      const diffDays = (dateMs - nowMs) / (1000 * 3600 * 24);
      if (diffDays < 0) {
          warnings.push({ type: 'danger', text: `${m.name} überfällig seit ${new Date(m.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}` });
      } else if (diffDays <= 30) {
          warnings.push({ type: 'warn', text: `${m.name} fällig am ${new Date(m.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}` });
      }
  });

  // --- Medikamenten Ablauf Logik Start ---
  const expiredPharmacyItems: any[] = [];
  const soonExpiringPharmacyItems: any[] = [];
  (() => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      (state.sos?.pharmacy || []).forEach((p: any) => {
          if (!p || !p.name || String(p.name).trim() === '' || typeof p.expiry !== 'string' || !p.expiry) return;
          const parts = p.expiry.split('-');
          if (parts.length !== 2) return;
          const expYear = parseInt(parts[0], 10);
          const expMonth = parseInt(parts[1], 10);
          if (isNaN(expYear) || isNaN(expMonth)) return;
          const expiryDate = new Date(expYear, expMonth, 0);
          if (expiryDate < today) {
              expiredPharmacyItems.push(p);
          } else {
              const diffTime = expiryDate.getTime() - today.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              if (diffDays <= 90) {
                  soonExpiringPharmacyItems.push(p);
              }
          }
      });
  })();
  if (expiredPharmacyItems.length > 0) {
      warnings.push({ type: 'danger', text: `${expiredPharmacyItems.length === 1 ? '1 Medikament abgelaufen' : `${expiredPharmacyItems.length} Medikamente abgelaufen`} - Safety Hub · Apotheke prüfen` });
  }
  if (soonExpiringPharmacyItems.length > 0) {
      warnings.push({ type: 'warn', text: `${soonExpiringPharmacyItems.length === 1 ? '1 Medikament läuft bald ab' : `${soonExpiringPharmacyItems.length} Medikamente laufen bald ab`} - Safety Hub · Apotheke prüfen` });
  }
  // --- Medikamenten Ablauf Logik Ende ---

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6 pb-24 px-2 pt-4">
      {/* Element 1: SOS-Button */}
      {!showSos && (
      <div className="fixed top-[11px] left-1/2 -translate-x-1/2 w-full max-w-md lg:max-w-none px-4 z-[60] pointer-events-none flex justify-end">
          <div className="pointer-events-auto mr-[46px]">
              <button onClick={() => setShowSos(true)} className="cg-master-button animate-pulse flex items-center gap-1.5">
                  <ShieldPlus size={16} strokeWidth={3} />
                  SOS
              </button>
          </div>
      </div>
      )}

      {/* Element 3: Gewichts-Hero-Anzeige */}
      <div className="cg-panel relative overflow-hidden p-6 z-0">
        {/* Deep Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.6)_100%)] pointer-events-none z-0" />

        {/* Subtle technical background structure */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.03),transparent_50%)] pointer-events-none" />
        
        {/* Premium Metallic Screws (Panel Corners) */}
        <div className="absolute top-3 left-3 w-[12px] h-[12px] rounded-full bg-gradient-to-br from-[#444] to-[#111] border border-[#000] flex items-center justify-center z-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(0,0,0,0.8)]">
            <div className="w-[6px] h-[6px] rounded-full bg-gradient-to-b from-[#111] to-[#2a2c30] shadow-[inset_0_2px_3px_rgba(0,0,0,1)] relative">
                <div className="absolute top-[1px] left-[1.5px] w-[2px] h-[2px] bg-white/40 rounded-full blur-[0.5px] pointer-events-none" />
            </div>
        </div>
        <div className="absolute top-3 right-3 w-[12px] h-[12px] rounded-full bg-gradient-to-br from-[#444] to-[#111] border border-[#000] flex items-center justify-center z-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(0,0,0,0.8)]">
            <div className="w-[6px] h-[6px] rounded-full bg-gradient-to-b from-[#111] to-[#2a2c30] shadow-[inset_0_2px_3px_rgba(0,0,0,1)] relative">
                <div className="absolute top-[1px] left-[1.5px] w-[2px] h-[2px] bg-white/40 rounded-full blur-[0.5px] pointer-events-none" />
            </div>
        </div>
        <div className="absolute bottom-3 left-3 w-[12px] h-[12px] rounded-full bg-gradient-to-br from-[#444] to-[#111] border border-[#000] flex items-center justify-center z-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(0,0,0,0.8)]">
            <div className="w-[6px] h-[6px] rounded-full bg-gradient-to-b from-[#111] to-[#2a2c30] shadow-[inset_0_2px_3px_rgba(0,0,0,1)] relative">
                <div className="absolute top-[1px] left-[1.5px] w-[2px] h-[2px] bg-white/40 rounded-full blur-[0.5px] pointer-events-none" />
            </div>
        </div>
        <div className="absolute bottom-3 right-3 w-[12px] h-[12px] rounded-full bg-gradient-to-br from-[#444] to-[#111] border border-[#000] flex items-center justify-center z-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(0,0,0,0.8)]">
            <div className="w-[6px] h-[6px] rounded-full bg-gradient-to-b from-[#111] to-[#2a2c30] shadow-[inset_0_2px_3px_rgba(0,0,0,1)] relative">
                <div className="absolute top-[1px] left-[1.5px] w-[2px] h-[2px] bg-white/40 rounded-full blur-[0.5px] pointer-events-none" />
            </div>
        </div>

        <div className="text-[13px] text-[#8a939c] font-bold tracking-[0.3em] mb-8 text-center relative z-10 uppercase" style={{ textShadow: '0 -2px 2px rgba(0,0,0,0.9), 0 1px 1px rgba(255,255,255,0.08), 0 0 4px rgba(0,0,0,0.6)' }}>GESAMTGEWICHT</div>
        
        <div className="flex flex-col items-center gap-6 relative z-10">

          {/* Instrument Recess (Mulde) */}
          <div className="relative w-[280px] h-[280px] flex items-center justify-center bg-gradient-to-b from-[#08090a] to-[#16181b] rounded-full shadow-[inset_0_12px_24px_rgba(0,0,0,1),_0_1px_1px_rgba(255,255,255,0.04)] border border-black/90 shrink-0">
              
              {/* Actual Compass Outer Ring */}
              <div className="absolute w-[260px] h-[260px] rounded-full bg-gradient-to-br from-[#383b42] via-[#1f2125] to-[#0a0a0c] shadow-[0_10px_30px_rgba(0,0,0,0.9),_inset_0_1px_2px_rgba(255,255,255,0.1),_inset_0_-2px_8px_rgba(0,0,0,0.8)] border border-[#000] z-0 pointer-events-none" />
              
              {/* Inner Bevel of the ring */}
              <div className="absolute w-[214px] h-[214px] rounded-full bg-gradient-to-b from-[#020304] to-[#121418] shadow-[inset_0_4px_10px_rgba(0,0,0,0.9)] z-0 pointer-events-none border border-black/80" />

              {/* Inner Compass Glass Face */}
              <div className="absolute w-[210px] h-[210px] flex items-center justify-center rounded-full bg-[radial-gradient(circle_at_center,_#0a1a10_0%,_#030805_50%,_#010101_100%)] shadow-[inset_0_15px_30px_rgba(0,0,0,0.95)] overflow-hidden z-10">
                  {/* Glass highlight top */}
                  <div className="absolute top-[-5%] left-[10%] w-[80%] h-[40%] bg-gradient-to-b from-white/5 to-transparent rounded-[100%] pointer-events-none" />
                  
                  {/* Status Glow Bottom & Icon */}
                  {(() => {
                      const ratio = totalWeight / (state.profile.maxWeight || 3500);
                      const glowColor = ratio > 1 ? '#ff3b30' : ratio > 0.9 ? '#ffcc00' : '#00ff9c';
                      return (
                          <>
                              <div className="absolute bottom-0 w-full h-[40%] opacity-40 blur-md pointer-events-none" style={{ background: `radial-gradient(ellipse at bottom, ${glowColor} 0%, transparent 70%)` }} />
                              <div className="absolute bottom-0 left-[20%] w-[60%] h-[3px] blur-[1px] pointer-events-none" style={{ background: glowColor, boxShadow: `0 -2px 8px ${glowColor}` }} />
                              <div className="absolute bottom-[22px] left-1/2 -translate-x-1/2 pointer-events-none" style={{ color: glowColor, filter: `drop-shadow(0 0 4px ${glowColor}80)` }}>
                                  <Scale size={18} />
                              </div>
                          </>
                      );
                  })()}
                  
                  {/* Grid lines */}
                  <div className="absolute w-[1px] h-full bg-gradient-to-b from-transparent via-[#10b981]/60 to-transparent left-1/2 -translate-x-1/2" />
                  <div className="absolute h-[1px] w-full bg-gradient-to-r from-transparent via-[#10b981]/60 to-transparent top-1/2 -translate-y-1/2" />
                  
                  {/* Inner technical rings */}
                  <div className="absolute w-[140px] h-[140px] rounded-full border border-[#10b981]/10 shadow-[inset_0_1px_4px_rgba(0,0,0,0.8)]" />
                  <div className="absolute w-[80px] h-[80px] rounded-full border border-[#10b981]/15 shadow-[inset_0_1px_4px_rgba(0,0,0,0.8)]" />
                  
                  {/* Center glowing radar circle */}
                  <div className="absolute w-[36px] h-[36px] rounded-full border border-[#10b981]/50 bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.35)_0%,_transparent_70%)] shadow-[0_0_30px_rgba(16,185,129,0.5),_inset_0_0_15px_rgba(16,185,129,0.3)]" />
              </div>

              {/* Compass marks mounted on the Ring (z-20 so it sits freely above the inner face but inside the 260 box) */}
              <div className="absolute z-20 w-[254px] h-[254px] pointer-events-none">
                {[...Array(72)].map((_, i) => {
                  const deg = i * 5;
                  const isCardinal = deg % 90 === 0;
                  const isOrdinal = deg % 45 === 0 && !isCardinal;
                  const isTen = deg % 10 === 0 && !isCardinal;
                  
                  return (
                    <div 
                      key={i} 
                      className="absolute inset-0 flex justify-center z-10 pointer-events-none"
                      style={{ transform: `rotate(${deg}deg)` }}
                    >
                      {!isCardinal && isOrdinal && <div className="mt-[4px] w-[2.5px] h-[8px] bg-[#ff6600] rounded-sm shadow-[0_0_6px_rgba(255,102,0,0.7)]" />}
                      {!isCardinal && !isOrdinal && isTen && <div className="mt-[5px] w-[2px] h-[6px] bg-[#888] rounded-sm shadow-[0_1px_1px_rgba(0,0,0,1)]" />}
                      {!isCardinal && !isOrdinal && !isTen && <div className="mt-[6px] w-[1px] h-[4px] bg-[#555] rounded-sm shadow-[0_1px_1px_rgba(0,0,0,1)]" />}
                    </div>
                  );
                })}
              </div>

              {/* Center Weight Display */}
              <div className="absolute z-30 flex flex-col items-center justify-center pointer-events-none">
                  <div className="relative flex items-baseline justify-center" style={{ textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}>
                      <span className={`instrument-value text-5xl tracking-normal ${
                          (totalWeight / (state.profile.maxWeight || 3500)) > 1 ? 'instrument-value-danger' :
                          (totalWeight / (state.profile.maxWeight || 3500)) > 0.9 ? 'instrument-value-warning' :
                          'instrument-value-success'
                      }`}>
                          {Math.round(totalWeight)}
                      </span>
                      <div className="w-0">
                          <span className="instrument-value text-base opacity-40 ml-2">kg</span>
                      </div>
                  </div>
                  
                  <div className="text-[10px] uppercase font-bold tracking-widest text-[#666] mt-1 relative z-10" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>
                      Max {formatNumber(state.profile.maxWeight || 3500, 0)} kg
                  </div>
              </div>
          </div>
          <div className="flex w-full pt-5 border-t border-white/5 relative cg-inset">
              {remainingWeight >= 0 ? (
                  <div className="flex items-center justify-center gap-2 w-full text-[#00ff9c]">
                      <CheckCircle size={20} className="filter drop-shadow-[0_0_8px_rgba(0,255,156,0.3)]" />
                      <div className="flex flex-col items-start leading-tight">
                         <span className="instrument-value-success text-[11px] font-bold tracking-widest uppercase">IM SICHEREN BEREICH</span>
                         <span className="cg-technical-label text-white/40 mt-0.5">noch {formatNumber(remainingWeight, 0)} kg frei</span>
                      </div>
                  </div>
              ) : (
                  <div className="flex items-center justify-center gap-2 w-full text-[var(--status-danger)] animate-pulse">
                      <AlertTriangle size={20} className="filter drop-[var(--status-danger)]" />
                      <div className="flex flex-col items-start leading-tight">
                         <span className="instrument-value-danger text-[11px] font-bold tracking-widest uppercase">ÜBERLADEN</span>
                         <span className="cg-technical-label text-[#ff3b30]/80 mt-0.5">{formatNumber(Math.abs(remainingWeight), 0)} kg zu viel</span>
                      </div>
                  </div>
              )}
          </div>
        </div>
      </div>

      {/* Element 5: Gewichtsaufschlüsselung */}
      <div className="cg-panel p-4">
          <div className="typo-engraved mb-4">GEWICHTSAUFSCHLÜSSELUNG</div>
          <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center px-3 py-2 cg-inset rounded border border-white/5">
                  <span className="cg-technical-label">Leergewicht</span>
                  <span className="instrument-value text-sm">{formatNumber(state.profile.emptyWeight || 0, 0)} kg</span>
              </div>
              <div className="flex justify-between items-center px-3 py-2 cg-inset rounded border border-white/5">
                  <span className="cg-technical-label">Frischwasser</span>
                  <span className="instrument-value text-sm text-blue-400">+ {formatWeight(waterWeightImpact)}</span>
              </div>
              <div className="flex justify-between items-center px-3 py-2 cg-inset rounded border border-white/5">
                  <span className="cg-technical-label">Abwasser</span>
                  <span className="instrument-value text-sm text-gray-400">+ {formatWeight(wasteWaterWeight)}</span>
              </div>
              <div className="flex justify-between items-center px-3 py-2 cg-inset rounded border border-white/5">
                  <span className="cg-technical-label">Diesel</span>
                  <span className="instrument-value text-sm text-orange-400">+ {formatWeight(dieselWeight)}</span>
              </div>
              <div className="flex justify-between items-center px-3 py-2 cg-inset rounded border border-white/5">
                  <span className="cg-technical-label">Inventar</span>
                  <span className="instrument-value text-sm">+ {formatWeight(inventoryWeight)}</span>
              </div>
          </div>
          <hr className="divider my-4" />
          <div className="flex justify-between items-end">
              <span className="cg-technical-label">Gesamtgewicht</span>
              <div className="flex items-baseline gap-1">
                  <span className="instrument-value text-2xl">{formatNumber(totalWeight, 0)}</span>
                  <span className="instrument-value text-sm">kg</span>
              </div>
          </div>
      </div>

      {/* Element 2: Warnbereich */}
      {warnings.length > 0 && (
          <div className="flex flex-col gap-3">
              {warnings.map((w, idx) => (
                  <div key={idx} className={`card-alert alert-${w.type} flex items-center gap-3 cg-alert`}>
                      <AlertTriangle size={18} />
                      <span className="cg-technical-label">{w.text}</span>
                  </div>
              ))}
          </div>
      )}

      {/* Element 4: Tank-Stände (Hidden) */}
      {false && (
      <div className="cg-panel p-4">
          <div className="typo-engraved mb-4">TANKSTÄNDE</div>
          
          <div className="flex items-center gap-4 cg-inset-panel p-3">
              <div className="icon-circle shadow-none bg-transparent border border-white/5"><Droplet className="text-blue-400" /></div>
              <div className="flex-1">
                  <div className="flex justify-between items-end mb-2">
                      <div>
                         <div className="cg-technical-label">Frischwasser</div>
                         <div className="cg-technical-label opacity-60 mt-0.5">{formatNumber((state.waterLevel / 100) * (state.profile.freshWaterCapacity || 0), 0)} L von {state.profile.freshWaterCapacity || 0} L</div>
                      </div>
                      <div className="text-right">
                         <div className="instrument-value text-xl text-blue-400">{state.waterLevel}%</div>
                         <div className="cg-technical-label opacity-60 mt-1">= {formatWeight(waterWeightImpact)}</div>
                      </div>
                  </div>
                  <input type="range" min="0" max="100" step="25" value={state.waterLevel} onChange={(e) => setState({...state, waterLevel: parseInt(e.target.value)})} className="w-full h-2 bg-black/50 rounded-full appearance-none cursor-pointer accent-blue-500" />
              </div>
          </div>
          
          <div className="flex items-center gap-4 cg-inset-panel p-3 mt-3">
              <div className="icon-circle shadow-none bg-transparent border border-white/5"><Droplet className="text-orange-400" /></div>
              <div className="flex-1">
                  <div className="flex justify-between items-end mb-2">
                      <div>
                         <div className="cg-technical-label">Abwasser</div>
                         <div className="cg-technical-label opacity-60 mt-0.5">{formatNumber((state.wasteWaterLevel / 100) * (state.profile.wasteWaterCapacity || 0), 0)} L von {state.profile.wasteWaterCapacity || 0} L</div>
                      </div>
                      <div className="text-right">
                         <div className="instrument-value text-xl text-orange-400">{state.wasteWaterLevel}%</div>
                         <div className="cg-technical-label opacity-60 mt-1">= {formatWeight(wasteWaterWeight)}</div>
                      </div>
                  </div>
                  <input type="range" min="0" max="100" step="25" value={state.wasteWaterLevel} onChange={(e) => setState({...state, wasteWaterLevel: parseInt(e.target.value)})} className="w-full h-2 bg-black/50 rounded-full appearance-none cursor-pointer accent-orange-500" />
              </div>
          </div>
          
          <div className="flex items-center gap-4 cg-inset-panel p-3 mt-3">
              <div className="icon-circle shadow-none bg-transparent border border-white/5"><Fuel className="text-yellow-400" /></div>
              <div className="flex-1">
                  <div className="flex justify-between items-end mb-2">
                      <div>
                         <div className="cg-technical-label">Diesel</div>
                         <div className="cg-technical-label opacity-60 mt-0.5">{formatNumber((state.dieselLevel / 100) * (state.profile.dieselCapacity || 0), 0)} L von {state.profile.dieselCapacity || 0} L</div>
                      </div>
                      <div className="text-right">
                         <div className="instrument-value text-xl text-yellow-400">{state.dieselLevel}%</div>
                         <div className="cg-technical-label opacity-60 mt-1">= {formatWeight(dieselWeight)}</div>
                      </div>
                  </div>
                  <input type="range" min="0" max="100" step="10" value={state.dieselLevel} onChange={(e) => setState({...state, dieselLevel: parseInt(e.target.value)})} className="w-full h-2 bg-black/50 rounded-full appearance-none cursor-pointer accent-yellow-500" />
              </div>
          </div>
      </div>
      )}

      {/* Element 6: Wartungstermine */}
      <div className="cg-panel p-4">
          <div className="typo-engraved mb-4">WARTUNG</div>
          <div className="grid grid-cols-2 gap-4">
              {(state.maintenance || []).map((item: any) => {
                  const date = item.date ? new Date(item.date) : null;
                  const diffInDays = date ? (date.getTime() - new Date().getTime()) / (1000 * 3600 * 24) : 999;
                  const borderColor = diffInDays < 0 ? 'var(--status-danger)' : diffInDays < 60 ? 'var(--status-warn)' : 'rgba(255,255,255,0.05)';
                  return (
                      <div key={item.id} className="relative aspect-square w-full max-w-[120px] mx-auto rounded-full bg-gradient-to-b from-[#08090a] to-[#16181b] shadow-[inset_0_8px_16px_rgba(0,0,0,1),_0_1px_1px_rgba(255,255,255,0.04)] border border-black/90">
                          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#383b42] via-[#1f2125] to-[#0a0a0c] shadow-[0_4px_12px_rgba(0,0,0,0.8),_inset_0_1px_2px_rgba(255,255,255,0.1),_inset_0_-1px_4px_rgba(0,0,0,0.8)] border border-[#000]" />
                          <div className="absolute inset-[8%] rounded-full bg-gradient-to-b from-[#020304] to-[#121418] shadow-[inset_0_2px_6px_rgba(0,0,0,0.9)] border border-black/80" />
                          <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle_at_center,_#0a1a10_0%,_#030805_50%,_#010101_100%)] shadow-[inset_0_10px_20px_rgba(0,0,0,0.95)] overflow-hidden">
                              <div className="absolute top-[-5%] left-[10%] w-[80%] h-[40%] bg-gradient-to-b from-white/10 to-transparent rounded-[100%] pointer-events-none" />
                              <div className="absolute bottom-0 w-full h-[40%] opacity-40 blur-md pointer-events-none" style={{ background: `radial-gradient(ellipse at bottom, ${item.name.includes('TÜV') ? '#ff3b30' : item.name.includes('Gas') ? '#ffcc00' : '#00ff9c'} 0%, transparent 70%)` }} />
                              <div className="absolute bottom-0 left-[20%] w-[60%] h-[3px] blur-[1px] pointer-events-none" style={{ background: item.name.includes('TÜV') ? '#ff3b30' : item.name.includes('Gas') ? '#ffcc00' : '#00ff9c', boxShadow: `0 -2px 8px ${item.name.includes('TÜV') ? '#ff3b30' : item.name.includes('Gas') ? '#ffcc00' : '#00ff9c'}` }} />
                          </div>
                          <div className="relative z-30 flex flex-col items-center justify-center w-full h-full pt-1">
                              <div className="text-[10px] uppercase font-bold tracking-widest text-[#8a939c] mb-[2px]" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>{item.name}</div>
                              <div className="text-[15px] font-bold tracking-wider text-white instrument-value mb-[4px]" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                                  {item.date ? new Date(item.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : 'N/A'}
                              </div>
                              <div style={{ color: item.name.includes('TÜV') ? '#ff3b30' : item.name.includes('Gas') ? '#ffcc00' : '#00ff9c', filter: `drop-shadow(0 0 4px ${item.name.includes('TÜV') ? '#ff3b30' : item.name.includes('Gas') ? '#ffcc00' : '#00ff9c'}80)` }}>
                                  {item.name.includes('TÜV') ? <ShieldCheck size={16} /> : item.name.includes('Gas') ? <Flame size={16} /> : item.name.includes('Dicht') ? <Droplet size={16} /> : <Settings size={16} />}
                              </div>
                          </div>
                      </div>
                  );
              })}
          </div>
      </div>

      {/* Element 7: Abfahrt-Checkliste */}
      <div className="cg-panel p-4">
          <div 
              className="flex justify-between items-center cursor-pointer select-none"
              onClick={() => setIsChecklistOpen(!isChecklistOpen)}
          >
              <div className="typo-engraved">ABFAHRT-CHECKLISTE</div>
              <span className={`transition-transform duration-200 text-[#8a939c] ${isChecklistOpen ? 'rotate-180' : ''}`}>
                  <ChevronDown size={16} />
              </span>
          </div>
          {isChecklistOpen && (
              <div className="space-y-2 mt-4 pt-4 border-t border-white/5">
                  {(state.checklist || []).map((item: any) => {
                      return (
                          <div key={item.id} className="cg-inset py-2 flex items-center justify-between group hover:bg-black/20 transition-colors px-3 rounded border border-white/5">
                              {editingChecklistItemId === item.id ? (
                                  <div className="flex items-center gap-2 flex-1 w-full">
                                      <input
                                          type="text"
                                          value={editingChecklistText}
                                          onChange={(e) => setEditingChecklistText(e.target.value)}
                                          className="cg-master-input flex-1 py-1 bg-black/50 border-white/10"
                                          onKeyDown={(e) => {
                                              if (e.key === 'Enter' && editingChecklistText.trim() !== '') {
                                                  const nc = state.checklist.map((c:any) => c.id === item.id ? {...c, label: editingChecklistText.trim()} : c);
                                                  setState({...state, checklist: nc});
                                                  setEditingChecklistItemId(null);
                                              } else if (e.key === 'Escape') {
                                                  setEditingChecklistItemId(null);
                                              }
                                          }}
                                          autoFocus
                                      />
                                      <button 
                                          onClick={() => {
                                              if(editingChecklistText.trim() !== '') {
                                                  const nc = state.checklist.map((c:any) => c.id === item.id ? {...c, label: editingChecklistText.trim()} : c);
                                                  setState({...state, checklist: nc});
                                                  setEditingChecklistItemId(null);
                                              }
                                          }}
                                          className="cg-master-button !p-2 !rounded flex-shrink-0"
                                      >
                                          <Check size={16} />
                                      </button>
                                      <button onClick={() => setEditingChecklistItemId(null)} className="cg-master-button !p-2 !rounded flex-shrink-0">X</button>
                                  </div>
                              ) : (
                                  <>
                                      <div onClick={() => {
                                              const nc = state.checklist.map((c:any) => c.id === item.id ? {...c, checked: !c.checked} : c);
                                              setState({...state, checklist: nc});
                                          }}
                                          className="flex items-center gap-3 cursor-pointer flex-1 py-1"
                                      >
                                          <div className={`w-[18px] h-[18px] border-2 flex-shrink-0 border-[var(--accent)] rounded-sm relative flex items-center justify-center transition-colors ${item.checked ? 'bg-[var(--accent)]' : 'bg-transparent'}`}>
                                               {item.checked && <Check size={14} className="text-black" />}
                                          </div>
                                          <span className={`typo-body ${item.checked ? 'opacity-40 line-through' : ''}`}>{item.label}</span>
                                      </div>
                                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button onClick={(e) => { e.stopPropagation(); setEditingChecklistText(item.label); setEditingChecklistItemId(item.id); }} className="cg-master-button !p-2 !rounded flex-shrink-0"><Edit2 size={14}/></button>
                                          <button onClick={(e) => { e.stopPropagation(); setState({...state, checklist: state.checklist.filter((c:any) => c.id !== item.id)}); }} className="cg-master-button-danger !p-2 !rounded flex-shrink-0"><Trash2 size={14}/></button>
                                      </div>
                                  </>
                              )}
                          </div>
                      );
                  })}
                  <div className="cg-inset py-2 flex items-center gap-2 px-3 rounded border border-white/5">
                      <input 
                          type="text" 
                          placeholder="Neuer Eintrag..." 
                          value={newChecklistItem} 
                          onChange={(e) => setNewChecklistItem(e.target.value)} 
                          className="cg-master-input flex-1 bg-black/50 border-white/10"
                          onKeyDown={(e) => {
                              if (e.key === 'Enter' && newChecklistItem.trim() !== '') {
                                  const n = { id: Date.now().toString(), label: newChecklistItem.trim(), checked: false };
                                  setState({...state, checklist: [...(state.checklist || []), n]});
                                  setNewChecklistItem("");
                              }
                          }}
                      />
                      <button 
                          onClick={() => {
                              if (newChecklistItem.trim() !== '') {
                                  const n = { id: Date.now().toString(), label: newChecklistItem.trim(), checked: false };
                                  setState({...state, checklist: [...(state.checklist || []), n]});
                                  setNewChecklistItem("");
                              }
                          }} 
                          className="cg-master-button !p-2 !rounded flex-shrink-0"
                      >
                          <Plus size={16} />
                      </button>
                  </div>
              </div>
          )}
      </div>

      <AnimatePresence>
          {showSos && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 cg-master-shell flex flex-col p-4 overflow-y-auto">
                 <div className="flex justify-between items-center mb-6 pt-4">
                     <h2 className="cg-master-section-title !mb-0 flex items-center gap-2"><ShieldPlus size={24}/> SAFETY HUB</h2>
                     <button onClick={() => setShowSos(false)} className="cg-master-button !px-4 !py-1">X</button>
                 </div>

                 <div className="sticky top-0 z-[100] cg-master-inset cg-master-tabs mb-8">
                    {['hilfe', 'id', 'inhalt'].map(t => (
                        <button key={t} onClick={() => setSosTab(t as any)} className={`cg-master-tab ${sosTab === t ? 'cg-master-tab-active' : ''}`}>
                            {t}
                        </button>
                    ))}
                 </div>

                 {sosTab === 'hilfe' && (
                     <div className="space-y-4 flex-1 relative z-0">
                         <div className="cg-master-card-small relative group">
                             <div className="absolute top-0 left-0 w-1 h-full bg-[var(--accent)] relative z-10" />
                             <div className="flex justify-between items-center mb-3 relative z-10">
                                 <h3 className="cg-master-label !mb-0 flex items-center gap-2"><MapPin size={14} className="text-[var(--accent)]"/> DEINE POSITION</h3>
                                 <div className="flex items-center gap-2">
                                     <span className="cg-master-label !mb-0">GPS</span>
                                     <button 
                                         onClick={() => updateSos('gpsEnabled', state.sos.gpsEnabled === false ? true : false)}
                                         className={`cg-master-inset w-7 h-7 rounded flex items-center justify-center border border-transparent transition-colors ${state.sos.gpsEnabled !== false ? 'cg-master-control-active' : ''}`}
                                     >
                                         {state.sos.gpsEnabled !== false && <Check size={16} />}
                                     </button>
                                 </div>
                             </div>
                             <div className={`cg-master-inset flex flex-col justify-center relative z-10 ${gpsStatus === 'active' ? 'min-h-[80px] p-3' : 'min-h-[60px] p-3 items-center'}`}>
                                 {gpsStatus === 'loading' && <span className="cg-master-value text-[var(--accent)] animate-pulse !text-[12px]">Signal wird ermittelt...</span>}
                                 {gpsStatus === 'offline' && <span className="cg-master-label !mb-0 cg-master-muted">GPS DEAKTIVIERT</span>}
                                 {gpsStatus === 'active' && gpsCoords && (
                                     <div className="flex gap-4 justify-around w-full">
                                         <div className="flex flex-col text-center"><span className="cg-master-label !mb-0.5">Breite</span><span className="cg-master-value text-[var(--accent)]">{gpsCoords.lat.toFixed(6)}°</span></div>
                                         <div className="flex flex-col text-center"><span className="cg-master-label !mb-0.5">Länge</span><span className="cg-master-value text-[var(--accent)]">{gpsCoords.lng.toFixed(6)}°</span></div>
                                     </div>
                                 )}
                             </div>
                             {gpsStatus === 'active' && gpsAlt !== null && <div className="cg-master-label text-center text-[var(--accent)] mt-3 !mb-0 relative z-10">{Math.round(gpsAlt)} METER ÜBER NN</div>}
                         </div>

                         <div className="grid grid-cols-2 gap-4 mt-6">
                             <a href="tel:112" className="relative aspect-square w-full max-w-[120px] mx-auto rounded-full bg-gradient-to-b from-[#08090a] to-[#16181b] shadow-[inset_0_8px_16px_rgba(0,0,0,1),_0_1px_1px_rgba(255,255,255,0.04)] border border-black/90 block active:scale-95 transition-transform">
                                 <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#383b42] via-[#1f2125] to-[#0a0a0c] shadow-[0_4px_12px_rgba(0,0,0,0.8),_inset_0_1px_2px_rgba(255,255,255,0.1),_inset_0_-1px_4px_rgba(0,0,0,0.8)] border border-[#000]" />
                                 <div className="absolute inset-[8%] rounded-full bg-gradient-to-b from-[#020304] to-[#121418] shadow-[inset_0_2px_6px_rgba(0,0,0,0.9)] border border-black/80" />
                                 <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle_at_center,_#1a0a0a_0%,_#080303_50%,_#010101_100%)] shadow-[inset_0_10px_20px_rgba(0,0,0,0.95)] overflow-hidden">
                                     <div className="absolute top-[-5%] left-[10%] w-[80%] h-[40%] bg-gradient-to-b from-white/10 to-transparent rounded-[100%] pointer-events-none" />
                                     <div className="absolute bottom-0 w-full h-[40%] opacity-40 blur-md pointer-events-none bg-[radial-gradient(ellipse_at_bottom,_#ff3b30_0%,_transparent_70%)]" />
                                     <div className="absolute bottom-0 left-[20%] w-[60%] h-[3px] blur-[1px] pointer-events-none bg-[#ff3b30] shadow-[0_-2px_8px_#ff3b30]" />
                                 </div>
                                 <div className="relative z-30 flex flex-col items-center justify-center w-full h-full pt-1">
                                     <div className="text-[10px] text-[#555] opacity-80 font-bold tracking-widest mb-0.5 uppercase">Notruf</div>
                                     <div className="flex items-baseline justify-center">
                                         <span className="text-3xl leading-none font-mono font-bold text-white tracking-tight drop-shadow-md">112</span>
                                     </div>
                                     <Phone size={14} className="text-[#ff3b30] mt-1.5 opacity-80 drop-shadow-[0_0_4px_rgba(255,59,48,0.6)]"/>
                                 </div>
                             </a>
                             <a href={`tel:${state.sos.ice1Phone}`} className="relative aspect-square w-full max-w-[120px] mx-auto rounded-full bg-gradient-to-b from-[#08090a] to-[#16181b] shadow-[inset_0_8px_16px_rgba(0,0,0,1),_0_1px_1px_rgba(255,255,255,0.04)] border border-black/90 block active:scale-95 transition-transform">
                                 <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#383b42] via-[#1f2125] to-[#0a0a0c] shadow-[0_4px_12px_rgba(0,0,0,0.8),_inset_0_1px_2px_rgba(255,255,255,0.1),_inset_0_-1px_4px_rgba(0,0,0,0.8)] border border-[#000]" />
                                 <div className="absolute inset-[8%] rounded-full bg-gradient-to-b from-[#020304] to-[#121418] shadow-[inset_0_2px_6px_rgba(0,0,0,0.9)] border border-black/80" />
                                 <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle_at_center,_#1a0f0a_0%,_#080503_50%,_#010101_100%)] shadow-[inset_0_10px_20px_rgba(0,0,0,0.95)] overflow-hidden">
                                     <div className="absolute top-[-5%] left-[10%] w-[80%] h-[40%] bg-gradient-to-b from-white/10 to-transparent rounded-[100%] pointer-events-none" />
                                     <div className="absolute bottom-0 w-full h-[40%] opacity-40 blur-md pointer-events-none bg-[radial-gradient(ellipse_at_bottom,_#ff9a3c_0%,_transparent_70%)]" />
                                     <div className="absolute bottom-0 left-[20%] w-[60%] h-[3px] blur-[1px] pointer-events-none bg-[#ff9a3c] shadow-[0_-2px_8px_#ff9a3c]" />
                                 </div>
                                 <div className="relative z-30 flex flex-col items-center justify-center w-full h-full pt-1 px-4">
                                     <div className="text-[10px] text-[#555] opacity-80 font-bold tracking-widest mb-0.5 uppercase">ICE</div>
                                     <div className="flex items-baseline justify-center w-full overflow-hidden">
                                         <span className="text-sm leading-tight font-bold text-white tracking-tight drop-shadow-md truncate text-center w-full">
                                             {(state.sos.ice1Name || 'Kontakt').substring(0, 16)}
                                         </span>
                                     </div>
                                     <Phone size={14} className="text-[#ff9a3c] mt-1.5 opacity-80 drop-shadow-[0_0_4px_rgba(255,154,60,0.6)]"/>
                                 </div>
                             </a>
                         </div>

                         <a href="https://www.google.com/maps/search/Apotheke" target="_blank" rel="noreferrer" className="cg-master-button w-full mt-4"><MapPin size={14} className="text-[var(--accent)]"/> Nächste Apotheke</a>
                     </div>
                 )}

                 {sosTab === 'id' && (
  <div className="space-y-4 relative z-10">

    <div>
      <h4 className="cg-master-section-title !mb-2 !mt-4 flex items-center gap-2">
        <User size={16} className="text-[var(--accent)]" /> Notfall-Kontakte (ICE)
      </h4>

      <div className="cg-master-card-small !p-0">
        <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-[var(--cg-master-border)]">
          <div className="flex-1 p-3">
            <div className="cg-master-label text-[var(--accent)] !mb-1">ICE 1</div>
            <div className="cg-master-inset p-3">
              <input
                value={state.sos.ice1Name}
                onChange={e => updateSos('ice1Name', e.target.value)}
                className="w-full bg-transparent border-none outline-none cg-master-value !text-sm !p-0 !mb-2"
                placeholder="Name"
              />
              <div className="flex items-center gap-2 cg-master-muted">
                <Phone size={14} className="shrink-0 cg-master-muted" />
                <input
                  type="tel"
                  value={state.sos.ice1Phone}
                  onChange={e => updateSos('ice1Phone', e.target.value)}
                  className="w-full bg-transparent border-none outline-none cg-master-value !text-xs !font-normal !p-0"
                  placeholder="Telefonnummer"
                />
              </div>
            </div>
          </div>

          <div className="flex-1 p-3">
            <div className="cg-master-label text-[var(--accent)] !mb-1">ICE 2</div>
            <div className="cg-master-inset p-3">
              <input
                value={state.sos.ice2Name}
                onChange={e => updateSos('ice2Name', e.target.value)}
                className="w-full bg-transparent border-none outline-none cg-master-value !text-sm !p-0 !mb-2"
                placeholder="Name"
              />
              <div className="flex items-center gap-2 cg-master-muted">
                <Phone size={14} className="shrink-0 cg-master-muted" />
                <input
                  type="tel"
                  value={state.sos.ice2Phone}
                  onChange={e => updateSos('ice2Phone', e.target.value)}
                  className="w-full bg-transparent border-none outline-none cg-master-value !text-xs !font-normal !p-0"
                  placeholder="Telefonnummer"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div>
      <h4 className="cg-master-section-title !mb-2 !mt-4 flex items-center gap-2">
        <Droplet size={16} className="text-[var(--accent)]" /> Blutgruppe
      </h4>

      <div className="cg-master-card-small">
        <div className="cg-master-inset relative overflow-hidden">
          <select
            value={state.sos.bloodGroup || ""}
            onChange={e => updateSos('bloodGroup', e.target.value)}
            className="w-full bg-transparent border-none outline-none cg-master-value !text-sm p-3 appearance-none cursor-pointer relative z-10"
          >
            <option value="" className="text-black bg-white">Unbekannt</option>
            <option value="A+" className="text-black bg-white">A+</option>
            <option value="A-" className="text-black bg-white">A-</option>
            <option value="B+" className="text-black bg-white">B+</option>
            <option value="B-" className="text-black bg-white">B-</option>
            <option value="AB+" className="text-black bg-white">AB+</option>
            <option value="AB-" className="text-black bg-white">AB-</option>
            <option value="0+" className="text-black bg-white">0+</option>
            <option value="0-" className="text-black bg-white">0-</option>
          </select>
          <ChevronDown size={16} className="cg-master-muted pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 z-20" />
        </div>
      </div>
    </div>

    <div>
      <h4 className="cg-master-section-title !mb-2 !mt-4 flex items-center gap-2">
        <HeartPulse size={16} className="text-[var(--accent)]" /> Vorerkrankungen / Allergien
      </h4>

      <div className="cg-master-card-small">
        <div className="cg-master-inset p-3">
          <textarea
            value={state.sos.medicalConditions}
            onChange={e => updateSos('medicalConditions', e.target.value)}
            className="w-full bg-transparent border-none outline-none cg-master-value !font-normal !text-sm resize-none min-h-[90px]"
            placeholder="Bekannte Vorerkrankungen oder Allergien..."
          />
        </div>
      </div>
    </div>

    <div>
      <h4 className="cg-master-section-title !mb-2 !mt-4 flex items-center gap-2">
        <Pill size={16} className="text-[var(--accent)]" /> Medikamente
      </h4>

      <div className="cg-master-card-small">
        <div className="cg-master-inset p-3">
          <textarea
            value={state.sos.medications}
            onChange={e => updateSos('medications', e.target.value)}
            placeholder="Regelmäßige Medikationen hier eintragen..."
            className="w-full bg-transparent border-none outline-none cg-master-value !font-normal !text-sm resize-none min-h-[70px]"
          />
        </div>
      </div>
    </div>

    <div>
      <h4 className="cg-master-section-title !mb-2 !mt-4 flex items-center gap-2">
        {state.sos.address?.trim() ? (
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(state.sos.address)}`} target="_blank" rel="noreferrer">
                <MapPin size={16} className="text-[var(--accent)]" />
            </a>
        ) : (
            <MapPin size={16} className="text-[var(--accent)]" />
        )} Adresse
      </h4>

      <div className="cg-master-card-small">
        <div className="cg-master-label">Anschrift</div>
        <textarea 
          value={state.sos.address || ''} 
          onChange={e => updateSos('address', e.target.value)} 
          className="cg-master-textarea w-full" 
          rows={5}
          placeholder={"Max Mustermann\nMusterstraße 12\n12345 Musterstadt\nDeutschland"} 
        />
      </div>
    </div>
  </div>
)}

                 {sosTab === 'inhalt' && (
                     <div className="space-y-6">
                         <div>
                             <h3 className="cg-master-section-title !mb-3 !mt-4">Notfall-Ausrüstung</h3>
                             {(state.sos.gear || []).map((g: any, i: number) => {
                                 const validLocations = (g.locations || []).filter((l: string) => l.trim() !== '');
                                 
                                 return (
                                 <div key={g.id} className="cg-master-card-small mb-3">
                                     <div className="flex items-center justify-between gap-2">
                                         <div className="flex-1 min-w-0">
                                             <div className="typo-card-title truncate">{g.name}</div>
                                             {g.checked && validLocations.length > 0 && (
                                                 <div className="typo-body-dim text-[var(--text-tertiary)] !mb-0 truncate">{validLocations.join(', ')}</div>
                                             )}
                                         </div>
                                         <div className="flex flex-shrink-0 items-center justify-end">
                                             {g.checked && (
                                                <div className="text-right whitespace-nowrap mr-3">
                                                    {Number(g.count) > 0 && (
                                                        <div><span className="typo-value-normal">{g.count}</span><span className="typo-value-small ml-1">Stk</span></div>
                                                    )}
                                                    {g.weight !== undefined && g.weight !== null && g.weight !== '' && (
                                                        <div className="typo-body-dim !mb-0">{g.weight} {g.weightUnit || 'kg'}</div>
                                                    )}
                                                </div>
                                             )}
                                             <button 
                                             onClick={() => { 
                                                 const newChecked = !g.checked;
                                                 let newCount = g.count;
                                                 let newLocations = g.locations;
                                                 if (!newChecked) {
                                                     newCount = 0;
                                                 } else if (newCount === 0 || !newCount) {
                                                     newCount = 1;
                                                     if (!newLocations || newLocations.length === 0) newLocations = [''];
                                                 }
                                                 updateSos('gear', (state.sos.gear || []).map((gx: any, idx: number) => idx === i ? { ...gx, checked: newChecked, count: newCount, locations: newLocations } : gx)); 
                                             }} 
                                             className={`cg-master-inset w-7 h-7 rounded flex items-center justify-center border border-transparent ${g.checked ? 'cg-master-control-active' : ''}`}
                                         >
                                             {g.checked && <Check size={16} />}
                                         </button>
                                         </div>
                                     </div>
                                     {g.checked && (
                                        <div className="mt-3 space-y-4 pt-3 border-t border-[var(--cg-master-border)]">
                                            <div className="flex justify-between items-center">
                                                <span className="cg-master-label !mb-0">Menge</span>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => updateSos('gear', (state.sos.gear || []).map((gx: any, idx: number) => idx === i ? { ...gx, count: Math.max(1, (gx.count||0)-1) } : gx))} className="cg-master-inset cg-master-control w-8 h-8 rounded flex items-center justify-center">
                                                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                                    </button>
                                                    <input type="number" min="1" value={g.count} onChange={e => updateSos('gear', (state.sos.gear || []).map((gx: any, idx: number) => idx === i ? { ...gx, count: parseInt(e.target.value) || 1 } : gx))} className="cg-master-input !text-center !w-12 !h-8 !p-0" />
                                                    <button onClick={() => updateSos('gear', (state.sos.gear || []).map((gx: any, idx: number) => idx === i ? { ...gx, count: (gx.count||0)+1 } : gx))} className="cg-master-inset cg-master-control w-8 h-8 rounded flex items-center justify-center">
                                                        <Plus size={14}/>
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="cg-master-label !mb-0 whitespace-nowrap">Gewicht/Stk.</span>
                                                <div className="flex gap-2">
                                                    <input type="number" step="0.01" min="0" value={g.weight !== undefined ? g.weight : ''} onChange={e => updateSos('gear', (state.sos.gear || []).map((gx: any, idx: number) => idx === i ? { ...gx, weight: e.target.value } : gx))} placeholder="Gewicht" className="cg-master-input w-20 !h-8 !p-1 !text-center" />
                                                    <select value={g.weightUnit || 'kg'} onChange={e => updateSos('gear', (state.sos.gear || []).map((gx: any, idx: number) => idx === i ? { ...gx, weightUnit: e.target.value } : gx))} className="cg-master-input w-16 !h-8 !p-1 !pl-2">
                                                        <option value="kg">kg</option>
                                                        <option value="g">g</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="cg-master-label !mb-0 text-[var(--accent)]">Lagerorte</span>
                                                    <button onClick={() => updateSos('gear', (state.sos.gear || []).map((gx: any, idx: number) => idx === i ? { ...gx, locations: [...(gx.locations || []), ''] } : gx))} className="cg-master-button !py-1 !px-2"><Plus size={10}/> Ort</button>
                                                </div>
                                                <div className="space-y-2">
                                                    {(g.locations || []).map((loc: string, locIdx: number) => (
                                                        <div key={locIdx} className="flex items-center gap-2">
                                                            <input value={loc} onChange={e => updateSos('gear', (state.sos.gear || []).map((gx: any, idx: number) => idx === i ? { ...gx, locations: (gx.locations || []).map((l: string, lIdx: number) => lIdx === locIdx ? e.target.value : l) } : gx))} placeholder={`Lagerort ${locIdx + 1}`} className="cg-master-input w-full" />
                                                            <button onClick={() => updateSos('gear', (state.sos.gear || []).map((gx: any, idx: number) => idx === i ? { ...gx, locations: (gx.locations || []).filter((_: any, lIdx: number) => lIdx !== locIdx) } : gx))} className="cg-master-inset cg-master-control-danger w-10 h-[42px] rounded flex items-center justify-center"><Trash2 size={16} /></button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                     )}
                                 </div>
                                 );
                             })}
                         </div>
                         <div>
                             <h3 className="cg-master-section-title !mb-3 flex justify-between items-center">
                                 <span className="flex items-center"><Pill size={16} className="mr-2 text-[var(--accent)]"/>Apotheke</span>
                                 <button onClick={() => { const newId = Date.now().toString(); updateSos('pharmacy', [...(state.sos.pharmacy || []), {id: newId, name:'', purpose:'', expiry:'', location:'', quantity:1, unit:'stk', weight: '', weightUnit: 'kg'}]); setEditingPharmacyId(newId); }} className="cg-master-button !py-1 !px-2"><Plus size={10}/> Med.</button>
                             </h3>

                             {(expiredPharmacyItems.length > 0 || soonExpiringPharmacyItems.length > 0) && (
                                 <div className="mb-4 space-y-2">
                                     {expiredPharmacyItems.length > 0 && (
                                         <div className="cg-master-card-small !p-3 border-l-2 !border-l-[var(--status-danger)]">
                                             <div className="text-[var(--status-danger)] font-bold text-sm mb-1">{expiredPharmacyItems.length === 1 ? '1 Medikament abgelaufen' : `${expiredPharmacyItems.length} Medikamente abgelaufen`}</div>
                                             <div className="space-y-1">
                                                 {expiredPharmacyItems.slice(0, 3).map((item, idx) => (
                                                     <div key={idx} className="flex justify-between items-baseline text-xs">
                                                         <span className="truncate mr-2">{item.name || 'Unbenanntes Medikament'}</span>
                                                         {item.expiry && <span className="cg-master-muted whitespace-nowrap">Haltbar bis: {item.expiry}</span>}
                                                     </div>
                                                 ))}
                                                 {expiredPharmacyItems.length > 3 && (
                                                     <div className="text-xs cg-master-muted pt-1">+ {expiredPharmacyItems.length - 3} weitere</div>
                                                 )}
                                             </div>
                                         </div>
                                     )}
                                     {soonExpiringPharmacyItems.length > 0 && (
                                         <div className="cg-master-card-small !p-3 border-l-2 !border-l-[var(--status-warn)]">
                                             <div className="text-[var(--status-warn)] font-bold text-sm mb-1">{soonExpiringPharmacyItems.length === 1 ? '1 Medikament läuft bald ab' : `${soonExpiringPharmacyItems.length} Medikamente laufen bald ab`}</div>
                                             <div className="space-y-1">
                                                 {soonExpiringPharmacyItems.slice(0, 3).map((item, idx) => (
                                                     <div key={idx} className="flex justify-between items-baseline text-xs">
                                                         <span className="truncate mr-2">{item.name || 'Unbenanntes Medikament'}</span>
                                                         {item.expiry && <span className="cg-master-muted whitespace-nowrap">Haltbar bis: {item.expiry}</span>}
                                                     </div>
                                                 ))}
                                                 {soonExpiringPharmacyItems.length > 3 && (
                                                     <div className="text-xs cg-master-muted pt-1">+ {soonExpiringPharmacyItems.length - 3} weitere</div>
                                                 )}
                                             </div>
                                         </div>
                                     )}
                                 </div>
                             )}

                             {(state.sos.pharmacy || []).map((p: any, i: number) => {
                                  if (!p) return null;
                                  const isEditing = editingPharmacyId === String(p.id);
                                  const metaParts: string[] = [];
                                  if (p.purpose) metaParts.push(String(p.purpose));
                                  if (p.location) metaParts.push(String(p.location));
                                  if (p.expiry) metaParts.push(`Haltbar bis: ${p.expiry}`);
                                  return (
                                 <div key={p.id} className="cg-master-card-small mb-3 relative">
                                     {isEditing ? (
                                        <>
                                     <div className="grid grid-cols-2 gap-3">
                                         <input value={p.name || ''} onChange={e => updateSos('pharmacy', (state.sos.pharmacy || []).map((px: any, idx: number) => idx === i ? { ...px, name: e.target.value } : px))} placeholder="Medikament" className={`cg-master-input w-full ${(!p.name || String(p.name).trim() === '') ? '!border-[var(--status-danger)]' : ''}`} />
                                         <input value={p.purpose || ''} onChange={e => updateSos('pharmacy', (state.sos.pharmacy || []).map((px: any, idx: number) => idx === i ? { ...px, purpose: e.target.value } : px))} placeholder="Zweck" className="cg-master-input w-full" />
                                         <div className="relative w-full">
                                             <div className={`cg-master-input w-full flex items-center ${!p.expiry ? 'text-[var(--text-muted)] !border-[var(--status-danger)]' : ''}`}>
                                                 {p.expiry ? p.expiry : 'Verfallsdatum'}
                                             </div>
                                             <input type="month" value={p.expiry || ''} onChange={e => updateSos('pharmacy', (state.sos.pharmacy || []).map((px: any, idx: number) => idx === i ? { ...px, expiry: e.target.value } : px))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                         </div>
                                         <input value={p.location || ''} onChange={e => updateSos('pharmacy', (state.sos.pharmacy || []).map((px: any, idx: number) => idx === i ? { ...px, location: e.target.value } : px))} placeholder="Lagerort" className="cg-master-input w-full" />
                                         <input type="number" min="0" value={p.quantity} onChange={e => updateSos('pharmacy', (state.sos.pharmacy || []).map((px: any, idx: number) => idx === i ? { ...px, quantity: parseInt(e.target.value) || 0 } : px))} placeholder="Menge" className="cg-master-input w-full" />
                                         <select value={p.unit} onChange={e => updateSos('pharmacy', (state.sos.pharmacy || []).map((px: any, idx: number) => idx === i ? { ...px, unit: e.target.value } : px))} className="cg-master-select w-full">
                                             <option value="stk">Stk</option>
                                             <option value="ml">ml</option>
                                             <option value="l">l</option>
                                             <option value="g">g</option>
                                         </select>
                                         <input type="number" step="0.01" min="0" value={p.weight !== undefined ? p.weight : ''} onChange={e => updateSos('pharmacy', (state.sos.pharmacy || []).map((px: any, idx: number) => idx === i ? { ...px, weight: e.target.value } : px))} placeholder="Gewicht/Stk." className="cg-master-input w-full" />
                                         <select value={p.weightUnit || 'kg'} onChange={e => updateSos('pharmacy', (state.sos.pharmacy || []).map((px: any, idx: number) => idx === i ? { ...px, weightUnit: e.target.value } : px))} className="cg-master-select w-full">
                                             <option value="kg">kg</option>
                                             <option value="g">g</option>
                                         </select>
                                         <div className="col-span-2 mt-2">
                                             {((!p.name || String(p.name).trim() === '') || !p.expiry) && (
                                                 <div className="text-[var(--status-danger)] text-xs text-center mb-2">Medikament und Verfallsdatum ausfüllen.</div>
                                             )}
                                             <button onClick={() => {
                                                 if ((!p.name || String(p.name).trim() === '') || !p.expiry) return;
                                                 setEditingPharmacyId(null);
                                             }} className="cg-master-button w-full py-1 text-center rounded">Fertig</button>
                                         </div>
                                     </div>
                                    </>
                                  ) : (
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="typo-card-title truncate">{p.name || 'Neues Medikament'}</div>
                                            {metaParts.length > 0 && (
                                                <div className="typo-body-dim text-[var(--text-tertiary)] !mb-0 truncate">{metaParts.join(' • ')}</div>
                                            )}
                                        </div>
                                        <div className="flex flex-shrink-0 items-center justify-end">
                                            <div className="text-right whitespace-nowrap mr-3">
                                                {p.quantity !== undefined && p.quantity !== null && (
                                                    <div><span className="typo-value-normal">{p.quantity}</span><span className="typo-value-small ml-1">{p.unit}</span></div>
                                                )}
                                                {p.weight !== undefined && p.weight !== null && p.weight !== '' && (
                                                    <div className="typo-body-dim !mb-0">{p.weight} {p.weightUnit || 'kg'}</div>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => setEditingPharmacyId(p.id)} className="cg-master-button !p-2 !rounded flex-shrink-0"><Edit2 size={14}/></button>
                                                <button onClick={() => { if(confirm('Medikament wirklich löschen?')) { updateSos('pharmacy', (state.sos.pharmacy || []).filter((_: any, idx: number) => idx !== i)); } }} className="cg-master-button-danger !p-2 !rounded flex-shrink-0"><Trash2 size={14}/></button>
                                            </div>
                                        </div>
                                    </div>
                                  )}
                                 </div>
                                  );
                              })}
                         </div>
                     </div>
                 )}
              </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
}
// --- TAB: INHALT ---

function InhaltView({ state, setState }: any) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("Küche");
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isAddingSub, setIsAddingSub] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [editingSub, setEditingSub] = useState<{old: string, new: string} | null>(null);
  const [deletingSub, setDeletingSub] = useState<string | null>(null);
  
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deletingItem, setDeletingItem] = useState<any>(null);
  const [itemForm, setItemForm] = useState({ name: '', quantity: '1', unit: 'stk', weight: '', weightUnit: 'kg', subcategory: '' });
  const [activeAccordion, setActiveAccordion] = useState<string | null>(null);

  const [isAddingMainCategory, setIsAddingMainCategory] = useState(false);
  const [newMainCategoryName, setNewMainCategoryName] = useState("");
  const [deletingMainCategory, setDeletingMainCategory] = useState<string | null>(null);
  const [deletingMainCategoryError, setDeletingMainCategoryError] = useState<string | null>(null);
  const [showSortSubcategories, setShowSortSubcategories] = useState(false);

  const formatUnit = (u?: string) => {
    if (!u) return '';
    const lower = u.toLowerCase();
    if (lower === 'g' || lower === 'gr') return 'g';
    if (lower === 'stk' || lower === 'stück') return 'stk';
    if (lower === 'kg') return 'kg';
    if (lower === 'l' || lower === 'liter') return 'l';
    return u;
  };

  const moveSubcategory = (sub: string, direction: "up" | "down") => {
    const currentSubs = state.subcategories[activeCategory] || [];
    const index = currentSubs.indexOf(sub);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === currentSubs.length - 1) return;

    const newSubs = [...currentSubs];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newSubs[index], newSubs[targetIndex]] = [newSubs[targetIndex], newSubs[index]];

    setState({
      ...state,
      subcategories: {
        ...state.subcategories,
        [activeCategory]: newSubs
      }
    });
  };

  const fixedCategories = ["Küche", "Wohnen", "Bad", "Garage", "Technik"];
  const customCategories = Object.keys(state.subcategories || {}).filter(k => !fixedCategories.includes(k));
  const categories = [...fixedCategories, ...customCategories];

  const searchedItems = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    
    const inventoryResults = state.inventory.filter((item: any) => 
        (item.name && item.name.toLowerCase().includes(term)) || 
        (item.subcategory && item.subcategory.toLowerCase().includes(term)) ||
        (item.category && item.category.toLowerCase().includes(term))
    );

    const gearResults = (state.sos?.gear || [])
        .filter((g: any) => 
            g.checked === true && Number(g.count) > 0 && g.isHidden !== true && g.isDeleted !== true &&
            ((g.name && g.name.toLowerCase().includes(term)) ||
            (g.locations && g.locations.some((l: string) => l.toLowerCase().includes(term))) ||
            "notfall-ausrüstung".includes(term) ||
            "safety hub".includes(term))
        )
        .map((g: any) => ({
            id: `sos-gear-${g.id}`,
            name: g.name,
            category: "Safety Hub",
            subcategory: (g.locations && g.locations.length > 0 && g.locations[0]) ? g.locations[0] : "Notfall-Ausrüstung",
            quantity: g.count,
            unit: "stk",
            weight: g.weight,
            weightUnit: g.weightUnit || "kg",
            sourceType: "safety-gear"
        }));

    const pharmacyResults = (state.sos?.pharmacy || [])
        .filter((p: any) => {
            if (!p) return false;
            const pName = String(p.name || '');
            const pPurpose = String(p.purpose || '');
            const pLoc = String(p.location || '');
            const pUnit = String(p.unit || '');
            
            return pName.trim() !== '' && p.isHidden !== true && p.isDeleted !== true &&
            (pName.toLowerCase().includes(term) ||
            pPurpose.toLowerCase().includes(term) ||
            pLoc.toLowerCase().includes(term) ||
            pUnit.toLowerCase().includes(term) ||
            "apotheke".includes(term) ||
            "safety hub".includes(term));
        })
        .map((p: any) => ({
            id: `sos-pharmacy-${p.id}`,
            name: p.name,
            category: "Safety Hub",
            subcategory: p.location || "Apotheke",
            quantity: p.quantity,
            unit: p.unit,
            weight: p.weight,
            weightUnit: p.weightUnit || "kg",
            sourceType: "safety-pharmacy"
        }));

    return [...inventoryResults, ...gearResults, ...pharmacyResults];
  }, [state.inventory, state.sos, searchTerm]);

  const filteredItems = state.inventory.filter((item: any) => 
    item.category === activeCategory
  );

  const groupedBySub = useMemo(() => {
    const groups: Record<string, any[]> = {};
    const uniqueSubs = Array.from(new Set(state.subcategories[activeCategory] || []));
    uniqueSubs.forEach((sub:any) => groups[sub as string] = []);
    
    filteredItems.forEach((item: any) => {
        if (groups[item.subcategory]) {
            groups[item.subcategory].push(item);
        }
    });
    return groups;
  }, [filteredItems, activeCategory, state.subcategories]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-4 px-2 no-print">
          <h1 className="typo-section-title">INHALT</h1>
          <button onClick={() => window.print()} className="cg-master-button p-2"><Printer size={16}/></button>
      </div>

      <div className="relative no-print mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={14} />
        <input type="text" placeholder="Bestand durchsuchen..." className="cg-master-input w-full !pl-[34px]" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <div className="no-print pb-4 flex gap-2">
          <select 
              value={activeCategory} 
              onChange={e => {
                  if (e.target.value === '__sort__') {
                      setShowSortSubcategories(true);
                  } else {
                      setActiveCategory(e.target.value);
                  }
              }} 
              className="cg-master-input flex-1"
          >
              {categories.map(cat => (
                  <option key={cat} value={cat} className="bg-[var(--bg-card)] text-white">{cat}</option>
              ))}
              <option disabled className="bg-[var(--bg-card)] text-white/50" value="__divider__">──────────</option>
              <option value="__sort__" className="bg-[var(--bg-card)] text-[var(--accent)]">Lagerorte in „{activeCategory}“ sortieren</option>
          </select>
          <button onClick={() => setIsAddingMainCategory(true)} className="cg-master-button px-3"><Plus size={16} /></button>
          {!fixedCategories.includes(activeCategory) && (
              <button 
                  onClick={() => {
                      const hasSubcats = (state.subcategories[activeCategory] || []).length > 0;
                      const hasItems = state.inventory.some((i: any) => i.category === activeCategory);
                      if (hasSubcats || hasItems) {
                          setDeletingMainCategoryError("Dieser Bereich kann erst gelöscht werden, wenn er leer ist.");
                      } else {
                          setDeletingMainCategory(activeCategory);
                      }
                  }} 
                  className="cg-master-button px-3 text-red-500"
              >
                  <Trash2 size={16}/>
              </button>
          )}
      </div>

      {searchTerm ? (
          <div className="space-y-4 print-only print-table">
              <div className="mb-4">
                  <div className="flex justify-between items-baseline border-b border-[var(--border)] pb-1 mb-2">
                      <h3 className="typo-body text-white/70">Suchergebnisse ({searchedItems.length})</h3>
                  </div>
                  {searchedItems.length === 0 ? (
                      <div className="text-center py-10 typo-body-dim text-[var(--text-muted)]">Keine Ergebnisse gefunden</div>
                  ) : (
                      <div className="w-full mb-4 space-y-3">
                          {searchedItems.map((item:any) => (
                              <div key={item.id} className={`cg-master-card-small flex items-center justify-between ${item.quantity === 0 ? '!border-[var(--status-danger)]' : ''}`}>
                                  <div className="flex-1">
                                      <div className="typo-card-title">{item.name}</div>
                                      {item.weight !== undefined && item.weight !== null && !isNaN(item.weight) && (
                                          <div className="typo-body-dim !mb-0">
                                              {item.weight} {formatUnit(item.weightUnit)}
                                          </div>
                                      )}
                                      <div className="typo-body-dim text-[var(--text-tertiary)]">
                                          {item.category} / {item.subcategory}
                                      </div>
                                  </div>
                                  <div className="text-right flex-shrink-0 mx-4">
                                      <span className={`typo-value-normal ${item.quantity === 0 ? 'cg-master-muted' : ''}`}>{item.quantity}</span>
                                      <span className="typo-value-small ml-1">{formatUnit(item.unit)}</span>
                                  </div>
                                  <div className="flex justify-end items-center gap-3 no-print flex-shrink-0 w-16">
                                      {!item.sourceType && (
                                          <>
                                              <button onClick={() => { setActiveCategory(item.category); setItemForm({ name: item.name, quantity: item.quantity.toString(), unit: formatUnit(item.unit), weight: item.weight !== undefined && item.weight !== null && !isNaN(item.weight) ? item.weight.toString() : '', weightUnit: formatUnit(item.weightUnit || 'kg'), subcategory: item.subcategory }); setEditingItem(item); }} className="cg-master-button !p-2 !rounded flex-shrink-0"><Edit2 size={14} /></button>
                                              <button onClick={() => setDeletingItem(item)} className="cg-master-button-danger !p-2 !rounded flex-shrink-0"><Trash2 size={14} /></button>
                                          </>
                                      )}
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          </div>
      ) : (
          <div className="space-y-4 print-only print-table">
          {Array.from(new Set(state.subcategories[activeCategory] || [])).map((sub:any) => (
              <div key={sub} className="mb-4">
                  <div 
                      className="cg-master-card-small flex justify-between items-center cursor-pointer select-none"
                      onClick={() => setActiveAccordion(activeAccordion === sub ? null : sub)}
                  >
                      <div className="flex items-start gap-3 flex-1 min-w-0 pr-3">
                          <h3 className="typo-section-title min-w-0 flex-1 line-clamp-2" style={{ color: 'var(--accent)', marginBottom: 0, minHeight: '32px' }}>{sub}</h3>
                          <span className="typo-value-small whitespace-nowrap mt-0.5">
                              {(() => {
                                  const totalKg = (groupedBySub[sub] || []).reduce((acc: number, item: any) => {
                                      if (item.weight !== undefined && item.weight !== null && !isNaN(item.weight)) {
                                          const unit = (item.weightUnit || 'kg').toLowerCase();
                                          if (unit === 'gr' || unit === 'g') {
                                              return acc + (item.weight * (item.quantity || 0)) / 1000;
                                          }
                                          return acc + (item.weight * (item.quantity || 0));
                                      }
                                      return acc;
                                  }, 0);
                                  return `${Math.round(totalKg)} kg`;
                              })()}
                          </span>
                      </div>
                      <div className="flex items-center gap-2 no-print shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => setEditingSub({old: sub, new: sub})} className="cg-master-button !p-2 !rounded flex-shrink-0"><Edit2 size={14} /></button>
                          <button onClick={() => setDeletingSub(sub)} className="cg-master-button-danger !p-2 !rounded flex-shrink-0"><Trash2 size={14} /></button>
                      </div>
                  </div>
                  {activeAccordion === sub && (
                      <div className="w-full mb-4 space-y-3 mt-3">
                          {(groupedBySub[sub] || []).map((item:any) => (
                              <div key={item.id} className={`cg-master-card-small flex items-center justify-between ${item.quantity === 0 ? '!border-[var(--status-danger)]' : ''}`}>
                                  <div className="flex-1">
                                      <div className="typo-card-title">{item.name}</div>
                                      {item.weight !== undefined && item.weight !== null && !isNaN(item.weight) && (
                                          <div className="typo-body-dim !mb-0">
                                              {item.weight} {formatUnit(item.weightUnit)}
                                          </div>
                                      )}
                                  </div>
                                  <div className="text-right flex-shrink-0 mx-4">
                                      <span className={`typo-value-normal ${item.quantity === 0 ? 'cg-master-muted' : ''}`}>{item.quantity}</span>
                                      <span className="typo-value-small ml-1">{formatUnit(item.unit)}</span>
                                  </div>
                                  <div className="flex justify-end items-center gap-3 no-print flex-shrink-0 w-16">
                                      <button onClick={() => { setItemForm({ name: item.name, quantity: item.quantity.toString(), unit: formatUnit(item.unit), weight: item.weight !== undefined && item.weight !== null && !isNaN(item.weight) ? item.weight.toString() : '', weightUnit: formatUnit(item.weightUnit || 'kg'), subcategory: item.subcategory }); setEditingItem(item); }} className="cg-master-button !p-2 !rounded flex-shrink-0"><Edit2 size={14} /></button>
                                      <button onClick={() => setDeletingItem(item)} className="cg-master-button-danger !p-2 !rounded flex-shrink-0"><Trash2 size={14} /></button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          ))}
          </div>
      )}

      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md lg:max-w-none px-4 flex items-center justify-center gap-3 z-40 no-print">
          <button onClick={() => setIsAddingSub(true)} className="cg-master-button rounded-full shadow-2xl flex-1 h-9 flex flex-row items-center justify-center gap-1.5 typo-label"><Plus size={14} /> Lagerort</button>
          <button onClick={() => { setItemForm({ name: '', quantity: '1', unit: 'stk', weight: '', weightUnit: 'kg', subcategory: '' }); setIsAddingItem(true); }} className="cg-master-button rounded-full shadow-2xl flex-1 h-9 flex flex-row items-center justify-center gap-1.5 typo-label"><Plus size={14} /> Artikel</button>
      </div>

      <AnimatePresence>
        {isAddingItem && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm">
                    <h2 className="typo-section-title mb-4">Neuer Artikel</h2>
                    <form onSubmit={(e:any) => {
                        e.preventDefault();
                        const newItem = { 
                            id: Date.now().toString(), 
                            name: itemForm.name, 
                            quantity: parseFloat(itemForm.quantity) || 0, 
                            unit: itemForm.unit, 
                            category: activeCategory, 
                            subcategory: itemForm.subcategory,
                            weight: itemForm.weight ? parseFloat(itemForm.weight) : undefined,
                            weightUnit: itemForm.weightUnit
                        };
                        setState({...state, inventory: [...state.inventory, newItem]});
                        setIsAddingItem(false);
                    }}>
                        <div className="space-y-3">
                            <input required value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} placeholder="Name" className="cg-master-input w-full" />
                            <div className="flex gap-3">
                                <input required type="number" step={formatUnit(itemForm.unit) === 'stk' ? "1" : "0.01"} min={formatUnit(itemForm.unit) === 'stk' ? "1" : "0"} value={itemForm.quantity} onChange={e => setItemForm({...itemForm, quantity: e.target.value})} placeholder="Menge" className="cg-master-input w-24" />
                                <select value={itemForm.unit} onChange={e => setItemForm({...itemForm, unit: e.target.value})} className="cg-master-input w-24">
                                    <option value="stk">stk</option>
                                    <option value="kg">kg</option>
                                    <option value="g">g</option>
                                    <option value="l">l</option>
                                </select>
                            </div>
                            <div className="flex gap-3">
                                <input type="number" step="0.01" min="0" value={itemForm.weight} onChange={e => setItemForm({...itemForm, weight: e.target.value})} placeholder="Gewicht pro Stk/Einheit (opt)" className="cg-master-input w-24" />
                                <select value={itemForm.weightUnit} onChange={e => setItemForm({...itemForm, weightUnit: e.target.value})} className="cg-master-input w-24">
                                    <option value="kg">kg</option>
                                    <option value="g">g</option>
                                </select>
                            </div>
                            <select required value={itemForm.subcategory} onChange={e => setItemForm({...itemForm, subcategory: e.target.value})} className="cg-master-input w-full">
                                <option value="" disabled>Lagerort wählen...</option>
                                {Array.from(new Set(state.subcategories[activeCategory] || [])).map((s:any) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-3 mt-6"><button type="button" onClick={() => setIsAddingItem(false)} className="cg-master-button flex-1 !p-3">Abbrechen</button><button type="submit" className="cg-master-button flex-1 !p-3">Speichern</button></div>
                    </form>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingItem && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm">
                    <h2 className="typo-section-title mb-4">Artikel bearbeiten</h2>
                    <form onSubmit={(e:any) => {
                        e.preventDefault();
                        const updatedItem = {
                            ...editingItem,
                            name: itemForm.name, 
                            quantity: parseFloat(itemForm.quantity) || 0, 
                            unit: itemForm.unit, 
                            subcategory: itemForm.subcategory,
                            weight: itemForm.weight ? parseFloat(itemForm.weight) : undefined,
                            weightUnit: itemForm.weightUnit
                        };
                        const newInv = state.inventory.map((i:any) => i.id === editingItem.id ? updatedItem : i);
                        setState({...state, inventory: newInv});
                        setEditingItem(null);
                    }}>
                        <div className="space-y-3">
                            <input required value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} placeholder="Name" className="cg-master-input w-full" />
                            <div className="flex gap-3">
                                <input required type="number" step={formatUnit(itemForm.unit) === 'stk' ? "1" : "0.01"} min={formatUnit(itemForm.unit) === 'stk' ? "1" : "0"} value={itemForm.quantity} onChange={e => setItemForm({...itemForm, quantity: e.target.value})} placeholder="Menge" className="cg-master-input w-24" />
                                <select value={itemForm.unit} onChange={e => setItemForm({...itemForm, unit: e.target.value})} className="cg-master-input w-24">
                                    <option value="stk">stk</option>
                                    <option value="kg">kg</option>
                                    <option value="g">g</option>
                                    <option value="l">l</option>
                                </select>
                            </div>
                            <div className="flex gap-3">
                                <input type="number" step="0.01" min="0" value={itemForm.weight} onChange={e => setItemForm({...itemForm, weight: e.target.value})} placeholder="Gewicht pro Stk/Einheit (opt)" className="cg-master-input w-24" />
                                <select value={itemForm.weightUnit} onChange={e => setItemForm({...itemForm, weightUnit: e.target.value})} className="cg-master-input w-24">
                                    <option value="kg">kg</option>
                                    <option value="g">g</option>
                                </select>
                            </div>
                            <select required value={itemForm.subcategory} onChange={e => setItemForm({...itemForm, subcategory: e.target.value})} className="cg-master-input w-full">
                                <option value="" disabled>Lagerort wählen...</option>
                                {Array.from(new Set(state.subcategories[activeCategory] || [])).map((s:any) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button type="button" onClick={() => setEditingItem(null)} className="cg-master-button flex-1 !p-3">Abbrechen</button>
                            <button type="submit" className="cg-master-button flex-1 !p-3">Speichern</button>
                        </div>
                    </form>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingItem && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm">
                    <h2 className="typo-section-title mb-2 flex items-center gap-2" style={{ color: 'var(--status-danger)' }}><AlertTriangle size={18}/> Artikel löschen</h2>
                    <p className="typo-body">Willst du <strong>{deletingItem.name}</strong> wirklich aus dem Inhalt entfernen?</p>
                    <div className="flex gap-3 mt-6">
                        <button onClick={() => setDeletingItem(null)} className="cg-master-button flex-1 !p-3">Abbrechen</button>
                        <button onClick={() => {
                            const newInv = state.inventory.filter((i:any) => i.id !== deletingItem.id);
                            setState({...state, inventory: newInv});
                            setDeletingItem(null);
                        }} className="cg-master-button-danger flex-1 py-3">Löschen</button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddingSub && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm">
                    <h2 className="typo-section-title mb-4">Neuer Lagerort</h2>
                    <input value={newSubName} onChange={e => setNewSubName(e.target.value)} placeholder="Name" className="cg-master-input w-full" />
                    <div className="flex gap-3 mt-6"><button onClick={() => setIsAddingSub(false)} className="cg-master-button flex-1 !p-3">Abbrechen</button><button onClick={() => { if(newSubName){ setState({...state, subcategories: {...state.subcategories, [activeCategory]: Array.from(new Set([...(state.subcategories[activeCategory]||[]), newSubName]))}}); setNewSubName(""); setIsAddingSub(false); } }} className="cg-master-button flex-1 !p-3">Speichern</button></div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingSub && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm">
                    <h2 className="typo-section-title mb-4">Lagerort umbenennen</h2>
                    <input value={editingSub.new} onChange={e => setEditingSub({...editingSub, new: e.target.value})} placeholder="Neuer Name" className="cg-master-input w-full" />
                    <div className="flex gap-3 mt-6">
                        <button onClick={() => setEditingSub(null)} className="cg-master-button flex-1 !p-3">Abbrechen</button>
                        <button onClick={() => {
                            if(editingSub.new && editingSub.new !== editingSub.old) {
                                const newSubs = Array.from(new Set((state.subcategories[activeCategory]||[]).map((s:string) => s === editingSub.old ? editingSub.new : s)));
                                const newInv = state.inventory.map((i:any) => i.category === activeCategory && i.subcategory === editingSub.old ? { ...i, subcategory: editingSub.new } : i);
                                setState({...state, subcategories: {...state.subcategories, [activeCategory]: newSubs}, inventory: newInv});
                            }
                            setEditingSub(null);
                        }} className="cg-master-button flex-1 !p-3">Speichern</button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingSub && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm">
                    <h2 className="typo-section-title mb-2 flex items-center gap-2" style={{ color: 'var(--status-danger)' }}><AlertTriangle size={18}/> Lagerort löschen</h2>
                    <p className="typo-body">Willst du den Lagerort <strong>{deletingSub}</strong> wirklich löschen? Alle {(groupedBySub[deletingSub] || []).length} Artikel darin werden ebenfalls entfernt!</p>
                    <div className="flex gap-3 mt-6">
                        <button onClick={() => setDeletingSub(null)} className="cg-master-button flex-1 !p-3">Abbrechen</button>
                        <button onClick={() => {
                            const newSubs = (state.subcategories[activeCategory]||[]).filter((s:string) => s !== deletingSub);
                            const newInv = state.inventory.filter((i:any) => !(i.category === activeCategory && i.subcategory === deletingSub));
                            setState({...state, subcategories: {...state.subcategories, [activeCategory]: newSubs}, inventory: newInv});
                            setDeletingSub(null);
                        }} className="cg-master-button-danger flex-1 py-3">Löschen</button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddingMainCategory && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm">
                    <h2 className="typo-section-title mb-4">Neuer Hauptbereich</h2>
                    <input value={newMainCategoryName} onChange={e => setNewMainCategoryName(e.target.value)} placeholder="Name" className="cg-master-input w-full" />
                    <div className="flex gap-3 mt-6"><button onClick={() => setIsAddingMainCategory(false)} className="cg-master-button flex-1 !p-3">Abbrechen</button>
                    <button onClick={() => { 
                        if(newMainCategoryName && !categories.includes(newMainCategoryName)){ 
                            setState({...state, subcategories: {...state.subcategories, [newMainCategoryName]: []}}); 
                            setActiveCategory(newMainCategoryName);
                            setNewMainCategoryName(""); 
                            setIsAddingMainCategory(false); 
                        } 
                    }} className="cg-master-button flex-1 !p-3">Speichern</button></div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingMainCategory && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm">
                    <h2 className="typo-section-title mb-2 flex items-center gap-2" style={{ color: 'var(--status-danger)' }}><AlertTriangle size={18}/> Bereich löschen</h2>
                    <p className="typo-body">Willst du diesen Bereich wirklich löschen?</p>
                    <div className="flex gap-3 mt-6">
                        <button onClick={() => setDeletingMainCategory(null)} className="cg-master-button flex-1 !p-3">Abbrechen</button>
                        <button onClick={() => {
                            const newSubs = { ...state.subcategories };
                            delete newSubs[deletingMainCategory];
                            setState({...state, subcategories: newSubs});
                            setActiveCategory("Küche");
                            setDeletingMainCategory(null);
                        }} className="cg-master-button-danger flex-1 py-3">Löschen</button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingMainCategoryError && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm">
                    <h2 className="typo-section-title mb-2 flex items-center gap-2" style={{ color: 'var(--status-danger)' }}><AlertTriangle size={18}/> Fehler</h2>
                    <p className="typo-body">{deletingMainCategoryError}</p>
                    <div className="flex gap-3 mt-6">
                        <button onClick={() => setDeletingMainCategoryError(null)} className="cg-master-button flex-1 !p-3">OK</button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSortSubcategories && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm max-h-[80vh] flex flex-col">
                    <h2 className="typo-section-title mb-4">Lagerorte in „{activeCategory}“ sortieren</h2>
                    <div className="overflow-y-auto flex-1 space-y-2 mb-4 pr-1">
                        {(!state.subcategories[activeCategory] || state.subcategories[activeCategory].length === 0) ? (
                            <p className="typo-body">Keine Lagerorte vorhanden.</p>
                        ) : (
                            state.subcategories[activeCategory].map((sub: string, index: number, arr: string[]) => (
                                <div key={sub} className="cg-master-card-small !p-3 flex justify-between items-center bg-[var(--bg-card)]">
                                    <span className="typo-body font-medium truncate pr-2" title={sub}>{sub}</span>
                                    <div className="flex gap-1 shrink-0">
                                        <button 
                                            onClick={() => moveSubcategory(sub, "up")} 
                                            disabled={index === 0}
                                            className={`cg-master-button !p-2 !rounded bg-white/10 hover:bg-white/20 transition-colors border border-white/10 ${index === 0 ? 'opacity-25 cursor-not-allowed' : 'opacity-100'}`}
                                            title="nach oben"
                                        >
                                            <ChevronUp size={20} className="text-white drop-shadow-sm" strokeWidth={2.5} />
                                        </button>
                                        <button 
                                            onClick={() => moveSubcategory(sub, "down")} 
                                            disabled={index === arr.length - 1}
                                            className={`cg-master-button !p-2 !rounded bg-white/10 hover:bg-white/20 transition-colors border border-white/10 ${index === arr.length - 1 ? 'opacity-25 cursor-not-allowed' : 'opacity-100'}`}
                                            title="nach unten"
                                        >
                                            <ChevronDown size={20} className="text-white drop-shadow-sm" strokeWidth={2.5} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="flex gap-3 mt-auto shrink-0">
                        <button onClick={() => setShowSortSubcategories(false)} className="cg-master-button flex-1 !p-3">Fertig</button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- TAB: LOGBUCH ---

const CURRENCIES: Currency[] = ['EUR', 'CHF', 'TRY', 'DKK', 'SEK', 'NOK', 'PLN', 'GBP'];
const FUEL_TYPES: FuelType[] = ['Diesel', 'Benzin', 'Super E10', 'Super E5'];

export function calculateFuelConsumptionSegments(fuelEntries: FuelEntry[]) {
  // Sort entries chronologically (oldest first)
  const sortedEntries = [...fuelEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const segments = [];
  let lastFullTankKm = null;
  let accumulatedLiters = 0;
  let hasPartialFills = false;

  for (const entry of sortedEntries) {
    // We treat entries without vollgetankt as true according to previous rules, 
    // but the type says boolean. To be safe: entry.vollgetankt !== false
    const isFullTank = entry.vollgetankt !== false;

    if (lastFullTankKm === null) {
      if (isFullTank) {
        lastFullTankKm = entry.km;
        accumulatedLiters = 0; // Don't count liters of the very first full tank for consumption of the *next* segment
        hasPartialFills = false;
      }
    } else {
      accumulatedLiters += entry.liters;
      
      if (isFullTank) {
        const distance = entry.km - lastFullTankKm;
        
        if (distance > 0) {
          const consumption = (accumulatedLiters / distance) * 100;
          segments.push({
            startKm: lastFullTankKm,
            endKm: entry.km,
            totalLiters: accumulatedLiters,
            distance: distance,
            consumption: consumption,
            isApproximate: hasPartialFills
          });
        }
        
        lastFullTankKm = entry.km;
        accumulatedLiters = 0;
        hasPartialFills = false;
      } else {
        hasPartialFills = true;
      }
    }
  }

  return segments;
}

export function calculateAverageFuelConsumptionFromFuelLog(fuelEntries: FuelEntry[]) {
  const segments = calculateFuelConsumptionSegments(fuelEntries);
  
  if (segments.length === 0) {
    const fullTanksCount = fuelEntries.filter(e => e.vollgetankt !== false).length;
    if (fullTanksCount === 1) {
      return {
        consumption: null,
        isApproximate: false,
        message: "Erste Volltankung als Startpunkt erfasst"
      };
    }
    return {
      consumption: null,
      isApproximate: false,
      message: "Noch keine Verbrauchsberechnung möglich"
    };
  }

  let sumLiters = 0;
  let sumDistance = 0;
  let hasApproximate = false;

  for (const segment of segments) {
    sumLiters += segment.totalLiters;
    sumDistance += segment.distance;
    if (segment.isApproximate) {
      hasApproximate = true;
    }
  }

  const consumption = sumDistance > 0 ? (sumLiters / sumDistance) * 100 : null;

  return {
    consumption,
    isApproximate: hasApproximate,
    message: hasApproximate 
      ? "Verbrauch nur ca., da Teilbetankungen enthalten sind"
      : "Verbrauch aus Volltankungen berechnet"
  };
}

export function calculateFuelLogStats(fuelEntries: any[]) {
  const sorted = [...fuelEntries].sort((a: any, b: any) => {
    const timeDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (timeDiff !== 0) return timeDiff;
    return (a.km || 0) - (b.km || 0);
  });

  const totalLiters = sorted.reduce((acc: number, entry: any) => acc + (entry.liters || 0), 0);
  const totalCost = sorted.reduce((acc: number, entry: any) => {
    if (entry.total != null && entry.total !== '') {
      return acc + Number(entry.total) / (entry.exchangeRateToEur || 1);
    }
    return acc + ((entry.liters || 0) * (entry.price || 0)) / (entry.exchangeRateToEur || 1);
  }, 0);

  const kmValues = sorted.map(e => e.km).filter(km => typeof km === 'number' && !isNaN(km));
  let tankKm: number | null = null;
  if (kmValues.length >= 2) {
    tankKm = Math.max(...kmValues) - Math.min(...kmValues);
  }

  const avgData = calculateAverageFuelConsumptionFromFuelLog(fuelEntries);

  let message = avgData.message;
  if (avgData.consumption !== null) {
      if (avgData.isApproximate) {
          message = "Tankstatistik enthält Teilbetankungen";
      } else {
          message = "Tankstatistik aus Tankdaten berechnet";
      }
  }

  return {
    totalLiters,
    totalCost,
    tankKm,
    averageConsumption: avgData.consumption,
    isApproximate: avgData.isApproximate,
    message
  };
}

function LogbuchView({ state, setState }: any) {
  const [logType, setLogType] = useState<'tank' | 'fahrt' | 'spots' | 'archiv'>('tank');
  const [tripLogMode, setTripLogMode] = useState<'flex' | 'strict'>('flex');
  const [isAdding, setIsAdding] = useState(false);

  const currentYear = new Date().getFullYear();
  const currentFuelLog = useMemo(() => {
      const filtered = state.fuelLog.filter((f:any) => new Date(f.date).getFullYear() === currentYear);
      return filtered.sort((a:any, b:any) => {
          const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
          if (dateDiff === 0) return b.km - a.km;
          return dateDiff;
      });
  }, [state.fuelLog, currentYear]);
  const currentTripLog = useMemo(() => state.tripLog.filter((t:any) => new Date(t.date).getFullYear() === currentYear), [state.tripLog, currentYear]);
  const currentBusinessTripLog = useMemo(() => (state.businessTripLog || []).filter((t:any) => new Date(t.date).getFullYear() === currentYear).sort((a:any, b:any) => new Date(b.date).getTime() - new Date(a.date).getTime()), [state.businessTripLog, currentYear]);
  
  const totalLiters = currentFuelLog.reduce((acc:number, f:any) => acc + f.liters, 0);
  const totalEur = currentFuelLog.reduce((acc:number, f:any) => acc + (f.liters * f.price / (f.exchangeRateToEur || 1)), 0);
  const totalKm = currentTripLog.reduce((acc:number, t:any) => acc + (t.toKm - t.fromKm), 0);

  const result = calculateAverageFuelConsumptionFromFuelLog(currentFuelLog);

  const [tankForm, setTankForm] = useState({ date: new Date().toISOString().split('T')[0], km: '', liters: '', price: '', total: '' });
  const [tripForm, setTripForm] = useState({ date: new Date().toISOString().split('T')[0], fromKm: '', toKm: '', destination: '', purpose: '', category: 'Privat', note: '' });
  const [businessTripForm, setBusinessTripForm] = useState({ date: new Date().toISOString().split('T')[0], fromKm: '', toKm: '', driver: '', category: 'Dienstlich', street: '', houseNumber: '', zip: '', city: '', purpose: '', businessPartner: '', note: '' });
  const [spotForm, setSpotForm] = useState({ date: new Date().toISOString().split('T')[0], name: '', lat: '', lng: '', note: '', category: 'Stellplatz' });
  const [spotGpsError, setSpotGpsError] = useState(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [editingSpotId, setEditingSpotId] = useState<string | null>(null);
  
  const [focusedTankField, setFocusedTankField] = useState<string | null>(null);
  
  const [displayedTripsCount, setDisplayedTripsCount] = useState(5);
  const [displayedBusinessTripsCount, setDisplayedBusinessTripsCount] = useState(10);
  const [isConfirmingBusinessTrip, setIsConfirmingBusinessTrip] = useState(false);

  const getLastKnownKm = (): number => {
    let highestKm = 0;
    (state.fuelLog || []).forEach((e:any) => highestKm = Math.max(highestKm, Number(e.km) || 0));
    (state.tripLog || []).forEach((e:any) => highestKm = Math.max(highestKm, Number(e.toKm) || 0));
    (state.businessTripLog || []).forEach((e:any) => highestKm = Math.max(highestKm, Number(e.toKm) || 0));
    return highestKm;
  };

  const formDateMs = new Date(tankForm.date || new Date().toISOString().split('T')[0]).getTime();
  let minKm = 0;
  let maxKm = Infinity;
  
  useEffect(() => {
    if (isAdding && logType === 'spots') {
      getPosition().then(p => {
          setSpotForm(s => ({ ...s, lat: p.lat.toString(), lng: p.lng.toString() }));
          setSpotGpsError(false);
      }).catch(() => {
          setSpotGpsError(true);
      });
    }
  }, [isAdding, logType]);

  state.fuelLog.forEach((f: any) => {
      const fTime = new Date(f.date).getTime();
      if (fTime < formDateMs) {
          if (f.km > minKm) minKm = f.km;
      } else if (fTime > formDateMs) {
          if (f.km < maxKm) maxKm = f.km;
      }
  });

  const currentKm = parseFloat(tankForm.km);
  const isKmValid = tankForm.km === '' || isNaN(currentKm) || (currentKm >= minKm && currentKm <= maxKm);

  const parsedLiters = parseFloat(tankForm.liters);
  const isLitersValid = tankForm.liters === '' || (!isNaN(parsedLiters) && parsedLiters > 0 && parsedLiters <= 9999);

  const parsedPrice = parseFloat(tankForm.price);
  const isPriceValid = tankForm.price === '' || (!isNaN(parsedPrice) && parsedPrice > 0 && parsedPrice <= 999);

  const parsedTripKm = parseFloat(tripForm.fromKm);
  const isTripValid = tripForm.fromKm !== '' && !isNaN(parsedTripKm) && parsedTripKm >= getLastKnownKm();
  const isBusinessTripValid = businessTripForm.fromKm !== '' && businessTripForm.toKm !== '' && parseFloat(businessTripForm.toKm) >= parseFloat(businessTripForm.fromKm) && parseFloat(businessTripForm.fromKm) >= 0 && parseFloat(businessTripForm.toKm) <= 999999 && parseFloat(businessTripForm.fromKm) <= 999999;
  const isBusinessTripPurposeValid = businessTripForm.purpose.length <= 50;
  const isBusinessTripDriverValid = businessTripForm.driver.trim() !== '';
  const isBusinessTripCategoryValid = businessTripForm.category.trim() !== '';
  const isBusinessTripToday = businessTripForm.date === new Date().toISOString().split('T')[0];

  const handleTankChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let filteredValue = value;
    if (name === 'liters' || name === 'price' || name === 'total' || name === 'km') {
        filteredValue = filteredValue.replace(/-/g, '');
    }

    if (name === 'liters') {
        const parts = filteredValue.split('.');
        if (parts[0].length > 4) {
            parts[0] = parts[0].slice(0, 4);
            filteredValue = parts.join('.');
        }
    } else if (name === 'price') {
        const parts = filteredValue.split('.');
        if (parts[0].length > 3) {
            parts[0] = parts[0].slice(0, 3);
            filteredValue = parts.join('.');
        }
    }

    let newForm = { ...tankForm, [name]: filteredValue };
    const l = parseFloat(newForm.liters);
    const p = parseFloat(newForm.price);
    const t = parseFloat(newForm.total);

    if (name === 'liters') {
      if (!isNaN(l) && !isNaN(p)) newForm.total = (l * p).toFixed(2);
    } else if (name === 'price') {
      if (!isNaN(l) && !isNaN(p)) newForm.total = (l * p).toFixed(2);
    } else if (name === 'total') {
      if (!isNaN(t) && !isNaN(l) && l > 0) newForm.price = (t / l).toFixed(3);
    }
    setTankForm(newForm);
  };

  const downloadGPX = () => {
    let gpx = '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="CamperGuard Pro">\n';
    state.spots.forEach((s: any) => {
      gpx += `  <wpt lat="${s.lat}" lon="${s.lng}">\n`;
      gpx += `    <name>${s.category ? `[${s.category}] ` : ''}${s.name}</name>\n`;
      if (s.note || s.category) {
          gpx += `    <desc>${s.category ? `Kategorie: ${s.category}\n` : ''}${s.note || ''}</desc>\n`;
      }
      gpx += `  </wpt>\n`;
    });
    gpx += '</gpx>';
    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tour_${new Date().toISOString().split('T')[0]}_Spots.gpx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const closeYear = () => {
      if(!confirm(`Möchtest du das Jahr ${currentYear} abschließen und archivieren?`)) return;
      const archive = { year: currentYear, totalKm, totalLiters, totalEur, fuelLog: currentFuelLog, tripLog: currentTripLog };
      setState({
          ...state, 
          archives: [...state.archives, archive],
          fuelLog: state.fuelLog.filter((f:any) => new Date(f.date).getFullYear() !== currentYear),
          tripLog: state.tripLog.filter((t:any) => new Date(t.date).getFullYear() !== currentYear)
      });
  };

  const getPosition = () => {
    return new Promise<{lat: number, lng: number}>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            p => resolve({lat: p.coords.latitude, lng: p.coords.longitude}),
            e => reject(e)
        );
    });
  };

  const fuelStats = calculateFuelLogStats(state.fuelLog);

  return (
    <>
      <style>{`
        @media print {
            @page { size: A4 portrait; margin: 15mm; }
            body { background: white !important; }
            .logbuch-normal { display: none !important; }
            .logbuch-print-wrapper { display: block !important; width: 100%; color: black !important; }
            .print-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 10px; font-family: sans-serif; }
            .print-table th { border-bottom: 2px solid #000; padding: 6px; text-align: left; font-weight: bold; text-transform: uppercase; color: #000 !important; background: transparent !important; }
            .print-table td { border-bottom: 1px solid #ccc; padding: 6px; color: #000 !important; vertical-align: top; }
        }
      `}</style>
      <div className="space-y-6 logbuch-normal">
      <div className="flex justify-between items-end mb-4 px-2 no-print">
          <h1 className="cg-type-page-title">Logbuch {currentYear}</h1>
          <button onClick={() => window.print()} className="cg-master-button p-2"><Printer size={16}/></button>
      </div>

      <div className="cg-master-inset p-3 flex justify-between items-center sticky top-[-10px] z-20">
          <div className="text-center">
              <div className="cg-type-label">Jahres-KM</div>
              <div className="cg-type-value-large">{formatNumber(totalKm, 0)}</div>
          </div>
          <div className="text-center">
              <div className="cg-type-label">Gesamtkosten</div>
              <div className="cg-type-value-large text-[var(--status-danger)]">{formatNumber(totalEur, 2)} €</div>
          </div>
          <div className="text-center">
              <div className="cg-type-label">Verbrauch</div>
              <div className="cg-type-value-large">{formatNumber(result?.consumption || 0, 1)} L</div>
          </div>
      </div>

      <div className="cg-master-inset cg-master-tabs p-1 overflow-x-auto hide-scrollbar">
      {['tank', 'fahrt', 'spots', 'archiv'].map(t => (
        <button key={t} onClick={() => setLogType(t as any)} className={`cg-master-tab cg-type-tab ${logType === t ? 'cg-master-tab-active' : ''}`}>{t === 'tank' ? 'Tanken' : t === 'spots' ? "POI's" : t === 'fahrt' ? 'Fahrten' : t}</button>
      ))}
  </div>

      {logType === 'tank' && (
          <div className="space-y-3">
            {currentFuelLog.map((entry:any) => {
                const totalLocal = entry.price * entry.liters;
                const totalEur = totalLocal / (entry.exchangeRateToEur || 1);
                return (
                    <div key={entry.id} className="cg-master-card-small !p-3 flex justify-between items-center border-l-2 !border-l-[var(--accent)] !mb-0">
                        <div className="flex flex-col items-start gap-1">
                            <span className="cg-type-meta">{new Date(entry.date).toLocaleDateString('de-DE')}</span>
                            <span className="cg-type-value">{formatNumber(entry.km, 0)} <span className="cg-type-label ml-0.5">KM</span></span>
                            <span className="cg-type-label text-[var(--accent)]">{entry.fuelType}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right flex flex-col justify-end">
                                <div className="flex items-end justify-end gap-2 pb-[2px]">
                                    <span className="cg-type-value block text-[var(--accent)]">{formatNumber(entry.liters, 1)}<span className="cg-type-label ml-0.5">L</span></span>
                                    <span className="cg-type-value block">{formatNumber(totalLocal, 2)} {entry.currency}</span>
                                </div>
                                <div className="cg-type-meta mt-[2px]">
                                    {formatNumber(entry.price, 2)} {entry.currency}/L 
                                    {entry.currency !== 'EUR' && <span className="ml-1 text-[var(--text-tertiary)]">({formatNumber(totalEur, 2)} €)</span>}
                                </div>
                            </div>
                            <button 
                                onClick={() => {
                                    let proceed = true;
                                    try {
                                        if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
                                            proceed = window.confirm('Möchtest du diesen Tankeintrag wirklich löschen?');
                                        }
                                    } catch (e) {
                                        proceed = true;
                                    }
                                    if(proceed) {
                                        setState({
                                            ...state, 
                                            fuelLog: state.fuelLog.filter((f:any) => {
                                                if (entry.id) {
                                                    return f.id !== entry.id;
                                                }
                                                return !(f.km === entry.km && f.liters === entry.liters && f.date === entry.date);
                                            })
                                        });
                                    }
                                }} 
                                className="cg-master-button-danger !p-2 !rounded flex-shrink-0 -mr-2"
                            >
                                <Trash2 size={16}/>
                            </button>
                        </div>
                    </div>
                );
            })}
          </div>
      )}

      {logType === 'fahrt' && (
          <div className="space-y-4">
              <div className="cg-master-inset cg-master-tabs p-1">
      <button onClick={() => setTripLogMode('flex')} className={`cg-master-tab cg-type-tab ${tripLogMode === 'flex' ? 'cg-master-tab-active' : ''}`}>REISETAGEBUCH</button>
      <button onClick={() => setTripLogMode('strict')} className={`cg-master-tab cg-type-tab ${tripLogMode === 'strict' ? 'cg-master-tab-active' : ''}`}>FAHRTENBUCH §</button>
  </div>

              {tripLogMode === 'flex' && (
                  <div className="space-y-3">
                      {currentTripLog.slice(0, displayedTripsCount).map((entry:any) => (
                          <div key={entry.id} className="cg-master-card-small !p-3 space-y-3 border-l-2 !border-l-[var(--accent)] !mb-0">
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col gap-1 items-start w-2/3">
                                    <span className="cg-type-meta">{new Date(entry.date).toLocaleDateString('de-DE')}</span>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                        <h4 className="cg-type-card-title">{entry.destination}</h4>
                                        <span className="cg-type-label text-[var(--accent)] border px-1">{entry.category || 'Privat'}</span>
                                    </div>
                                    {entry.purpose && <p className="cg-type-meta mt-1 break-words line-clamp-2">{entry.purpose}</p>}
                                    {entry.note && <p className="cg-type-meta italic mt-0.5 break-words line-clamp-2">{entry.note}</p>}
                                </div>
                                <div className="flex flex-col items-end gap-2 w-1/3">
                                    <div className="cg-type-value text-[var(--accent)]">
                                        +{(entry.toKm != null && entry.fromKm != null && !isNaN(entry.toKm) && !isNaN(entry.fromKm)) ? Number(entry.toKm - entry.fromKm).toLocaleString('de-DE') : (entry.toKm - entry.fromKm)} <span className="cg-type-label ml-0.5">KM</span>
                                    </div>
                                    <div className="flex items-center gap-1 mt-1">
                                        <button onClick={() => {
                                            setEditingTripId(entry.id);
                                            setTripForm({
                                                date: entry.date,
                                                fromKm: entry.fromKm.toString(),
                                                toKm: entry.toKm.toString(),
                                                destination: entry.destination,
                                                purpose: entry.purpose || '',
                                                category: entry.category || 'Privat',
                                                note: entry.note || ''
                                            });
                                            setIsAdding(true);
                                        }} className="cg-master-button !p-1 !rounded flex-shrink-0"><Edit2 size={14}/></button>
                                        <button onClick={() => {
                                            if(confirm('Möchtest du diesen Fahrten-Eintrag wirklich löschen?')) {
                                                setState({...state, tripLog: state.tripLog.filter((t:any) => t.id !== entry.id)});
                                            }
                                        }} className="cg-master-button-danger !p-1 !rounded flex-shrink-0 -mr-2"><Trash2 size={14}/></button>
                                    </div>
                                </div>
                            </div>
                          </div>
                      ))}
                      {currentTripLog.length === 0 && <div className="text-center cg-type-meta mt-8">Keine Einträge</div>}
                      {currentTripLog.length > displayedTripsCount && (
                          <button onClick={() => setDisplayedTripsCount(c => c + 5)} className="cg-master-button w-full py-2 flex flex-row items-center justify-center gap-2">
                              Mehr anzeigen
                          </button>
                      )}
                  </div>
              )}

              {tripLogMode === 'strict' && (
                  <div className="space-y-3">
                      {currentBusinessTripLog.slice(0, displayedBusinessTripsCount).map((entry:any) => {
                          const isLocked = (Date.now() - parseInt(entry.id)) > 24 * 60 * 60 * 1000;
                          return (
                              <div key={entry.id} className={`cg-master-card-small !p-3 space-y-3 border-l-2 !mb-0 ${isLocked ? 'opacity-70' : ''}`}>
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col gap-1 items-start w-2/3">
                                        <span className="cg-type-meta">{new Date(entry.date).toLocaleDateString('de-DE')} {isLocked && <span className="ml-1 text-[8px] px-1 uppercase tracking-wider border">Gesperrt</span>}</span>
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                            <h4 className="cg-type-card-title">{entry.city ? `${entry.zip} ${entry.city}` : 'Unbekanntes Ziel'}</h4>
                                            <span className="cg-type-label border px-1">{entry.category || 'Dienstlich'}</span>
                                        </div>
                                        <p className="cg-type-meta mt-1">{entry.street} {entry.houseNumber}</p>
                                        <p className="cg-type-meta mt-1 break-words line-clamp-1">Fahrer: {entry.driver}</p>
                                        <p className="cg-type-meta mt-1 break-words line-clamp-2">Zweck: {entry.purpose || '-'}</p>
                                        {entry.businessPartner && <p className="cg-type-meta italic mt-0.5 break-words line-clamp-2">Partner: {entry.businessPartner}</p>}
                                    </div>
                                    <div className="flex flex-col items-end gap-2 w-1/3">
                                        <div className="cg-type-value whitespace-nowrap">
                                            +{(entry.toKm != null && entry.fromKm != null && !isNaN(entry.toKm) && !isNaN(entry.fromKm)) ? Number(entry.toKm - entry.fromKm).toLocaleString('de-DE') : (entry.toKm - entry.fromKm)} <span className="cg-type-label ml-0.5">KM</span>
                                        </div>
                                        {!isLocked && (
                                            <div className="flex items-center gap-1 mt-1">
                                                <button onClick={() => {
                                                    setEditingTripId(entry.id);
                                                    setBusinessTripForm({
                                                        date: entry.date,
                                                        fromKm: entry.fromKm.toString(),
                                                        toKm: entry.toKm.toString(),
                                                        category: entry.category,
                                                        driver: entry.driver || '',
                                                        street: entry.street || '',
                                                        houseNumber: entry.houseNumber || '',
                                                        zip: entry.zip || '',
                                                        city: entry.city || '',
                                                        purpose: entry.purpose || '',
                                                        businessPartner: entry.businessPartner || '',
                                                        note: entry.note || ''
                                                    });
                                                    setIsAdding(true);
                                                }} className="cg-master-button !p-1 !rounded flex-shrink-0"><Edit2 size={14}/></button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="cg-type-meta mt-2 pt-2 border-t border-[var(--border)] flex justify-between">
                                    <span>Start <span className="cg-type-value text-sm ml-1">{(entry.fromKm != null && !isNaN(entry.fromKm)) ? Number(entry.fromKm).toLocaleString('de-DE') : entry.fromKm}</span></span>
                                    <span>Ziel <span className="cg-type-value text-sm ml-1">{(entry.toKm != null && !isNaN(entry.toKm)) ? Number(entry.toKm).toLocaleString('de-DE') : entry.toKm}</span></span>
                                </div>
                              </div>
                          );
                      })}
                      {currentBusinessTripLog.length === 0 && <div className="text-center cg-type-meta mt-8">Keine Fahrtenbucheinträge</div>}
                      {currentBusinessTripLog.length > displayedBusinessTripsCount && (
                          <button onClick={() => setDisplayedBusinessTripsCount(c => c + 10)} className="cg-master-button w-full py-2 flex flex-row items-center justify-center gap-2">
                              Mehr anzeigen
                          </button>
                      )}
                  </div>
              )}
          </div>
      )}

      {logType === 'spots' && (
          <div className="space-y-3">
              <button onClick={downloadGPX} className="cg-master-button w-full py-2 mb-4 flex flex-row items-center justify-center gap-2"><FileDown size={14}/> GPX Export</button>
              {state.spots.map((spot:any) => (
                  <div key={spot.id} className="cg-master-card-small !p-3 relative border-l-2 !mb-0">
                      <div className="flex flex-col">
                         <div className="flex justify-between items-start">
                             <span className="cg-type-meta">{new Date(spot.date).toLocaleDateString('de-DE')}</span>
                             <div className="flex items-center gap-2">
                                <button onClick={() => { setSpotForm({ date: spot.date, name: spot.name, lat: spot.lat.toString(), lng: spot.lng.toString(), note: spot.note || '', category: spot.category || 'Stellplatz' }); setEditingSpotId(spot.id); setSpotGpsError(false); setIsAdding(true); }} className="cg-master-button !p-1 !rounded flex-shrink-0"><Edit2 size={12}/></button>
                                <button onClick={() => { if(confirm('Möchtest du diesen POI-Eintrag wirklich löschen?')) { setState({...state, spots: state.spots.filter((s:any) => s.id !== spot.id)}); } }} className="cg-master-button-danger !p-1 !rounded flex-shrink-0"><Trash2 size={12}/></button>
                             </div>
                         </div>
                         <div className="flex flex-wrap items-center gap-2 mt-1">
                            <h4 className="cg-type-card-title">{spot.name}</h4>
                            {spot.category && <span className="cg-type-label">{spot.category}</span>}
                         </div>
                         {spot.note && <p className="cg-type-meta mt-1 break-words line-clamp-2">{spot.note}</p>}
                         <a href={`geo:${spot.lat},${spot.lng}`} className="cg-master-button !py-1 !px-2 mt-2 inline-flex items-center gap-1 w-max"><MapPin size={12}/> {spot.lat.toFixed(4)} / {spot.lng.toFixed(4)}</a>
                      </div>
                  </div>
              ))}
          </div>
      )}

      {logType === 'archiv' && (
          <div className="space-y-4">
              {state.archives.map((a:any) => (
                  <div key={a.year} className="cg-master-card-small !p-4 !mb-0">
                      <h3 className="cg-type-value-large flex items-center gap-2 pb-2 mb-2 border-b border-[var(--border)]"><Archive size={14}/> {a.year}</h3>
                      <div className="grid grid-cols-3 gap-2 text-center mt-3">
                          <div>
                              <div className="cg-type-label text-[var(--text-muted)]">Distanz</div>
                              <div className="cg-type-value">{formatNumber(a.totalKm, 0)} <span className="cg-type-label ml-0.5">KM</span></div>
                          </div>
                          <div>
                              <div className="cg-type-label text-[var(--text-muted)]">Liter</div>
                              <div className="cg-type-value">{formatNumber(a.totalLiters, 1)} <span className="cg-type-label ml-0.5">L</span></div>
                          </div>
                          <div>
                              <div className="cg-type-label text-[var(--text-muted)]">Kosten</div>
                              <div className="cg-type-value text-[var(--accent)]">{formatNumber(a.totalEur, 2)} <span className="cg-type-label ml-0.5">€</span></div>
                          </div>
                      </div>
                  </div>
              ))}
              {state.archives.length === 0 && <div className="text-center cg-type-meta py-8">Keine Archive</div>}
          </div>
      )}

      {logType === 'tank' && (
         <div className="pt-4 flex w-full justify-center pb-24">
             <button onClick={closeYear} className="cg-master-button h-11 px-6 flex flex-row items-center justify-center gap-2 max-w-[240px] w-full"><Archive size={16}/> Jahr abschließen</button>
         </div>
      )}

      {(logType === 'tank' || logType === 'fahrt' || logType === 'spots') && (
          <button 
            onClick={() => { 
                const highestKm = getLastKnownKm();
                if (logType === 'tank') {
                    setTankForm(f => ({...f, date: new Date().toISOString().split('T')[0], km: highestKm > 0 ? highestKm.toString() : ''})); 
                } else if (logType === 'fahrt') {
                    setTripForm(f => ({...f, date: new Date().toISOString().split('T')[0], fromKm: highestKm > 0 ? highestKm.toString() : '', toKm: '', destination: '', purpose: '', category: 'Privat', note: ''}));
                    setBusinessTripForm(f => ({...f, date: new Date().toISOString().split('T')[0], fromKm: highestKm > 0 ? highestKm.toString() : '', toKm: '', driver: '', category: 'Dienstlich', street: '', houseNumber: '', zip: '', city: '', purpose: '', businessPartner: '', note: ''}));
                } else if (logType === 'spots') {
                    setSpotForm(f => ({...f, date: new Date().toISOString().split('T')[0], name: '', lat: '', lng: '', note: '', category: 'Stellplatz'}));
                    setSpotGpsError(false);
                }
                setEditingTripId(null);
                setEditingSpotId(null);
                setIsAdding(true); 
            }} 
            className="cg-master-button fixed bottom-24 right-4 h-9 px-5 rounded-full flex flex-row items-center justify-center shadow-2xl z-40 border border-[var(--accent-dark)]"
          >
            <Plus size={20} />
          </button>
      )}

      <AnimatePresence>
        {isAdding && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 overflow-y-auto">
                <div className="cg-master-card-small w-full max-w-sm my-8">
                    <h2 className="typo-section-title mb-4">{logType === 'tank' ? 'Tankbeleg' : logType === 'fahrt' ? (tripLogMode === 'strict' ? 'Fahrtenbuch' : 'Reise-Notiz') : "POI's Log"}</h2>
                    <form onSubmit={(e:any) => {
                        e.preventDefault();
                        const fd = new FormData(e.target);
                        if(logType === 'tank') {
                            const parsedLiters = parseFloat(tankForm.liters);
                            const parsedPrice = parseFloat(tankForm.price);
                            if (isNaN(parsedLiters) || parsedLiters <= 0) {
                                window.alert("Bitte einen gültigen Wert für Liter eingeben (größer als 0).");
                                return;
                            }
                            if (isNaN(parsedPrice) || parsedPrice <= 0) {
                                window.alert("Bitte einen gültigen Wert für Preis eingeben (größer als 0).");
                                return;
                            }
                            if (state.profile?.dieselCapacity && state.profile.dieselCapacity > 0) {
                                if (parsedLiters > state.profile.dieselCapacity) {
                                    window.alert("Die getankte Menge darf nicht größer sein als die Kraftstofftank-Kapazität im Profil.");
                                    return;
                                }
                            }
                            const cur = fd.get('currency') as Currency;
                            const rate = state.exchangeRates[cur] || 1;
                            const isVollgetankt = fd.get('vollgetankt') !== 'false';
                            const entry: FuelEntry = { id: Date.now().toString(), date: tankForm.date, km: parseFloat(tankForm.km), liters: parseFloat(tankForm.liters), price: parseFloat(tankForm.price), currency: cur, exchangeRateToEur: rate, fuelType: fd.get('fuelType') as FuelType, vollgetankt: isVollgetankt };
                            setState({...state, fuelLog: [entry, ...state.fuelLog]});
                            setIsAdding(false);
                        } else if(logType === 'fahrt') {
                            if (tripLogMode === 'strict') {
                                setIsConfirmingBusinessTrip(true);
                            } else {
                                const parsedToKm = parseFloat(tripForm.fromKm);
                                const entry: any = { 
                                    id: editingTripId || Date.now().toString(), 
                                    date: tripForm.date, 
                                    fromKm: editingTripId ? (state.tripLog.find((t:any) => t.id === editingTripId)?.fromKm ?? getLastKnownKm()) : getLastKnownKm(), 
                                    toKm: isNaN(parsedToKm) ? 0 : parsedToKm, 
                                    purpose: tripForm.purpose, 
                                    destination: tripForm.destination, 
                                    category: tripForm.category, 
                                    note: tripForm.note 
                                };
                                if (editingTripId) {
                                    setState({...state, tripLog: state.tripLog.map((t:any) => t.id === editingTripId ? entry : t)});
                                } else {
                                    setState({...state, tripLog: [entry, ...state.tripLog]});
                                }
                                setEditingTripId(null);
                                setIsAdding(false);
                            }
                        } else if(logType === 'spots') {
                            const entry: SpotEntry = { id: editingSpotId || Date.now().toString(), name: spotForm.name, date: spotForm.date, lat: parseFloat(spotForm.lat), lng: parseFloat(spotForm.lng), note: spotForm.note, category: spotForm.category };
                            if (editingSpotId) {
                                setState({...state, spots: state.spots.map((s:any) => s.id === editingSpotId ? entry : s)});
                            } else {
                                setState({...state, spots: [entry, ...state.spots]});
                            }
                            setEditingSpotId(null);
                            setIsAdding(false);
                        }
                    }}>
                        <div className="space-y-3">
                            <input name="date" required type="date" value={logType === 'fahrt' ? (tripLogMode === 'strict' ? businessTripForm.date : tripForm.date) : (logType === 'spots' ? spotForm.date : tankForm.date)} onChange={(e) => {
                                if (logType === 'fahrt') {
                                    if (tripLogMode === 'strict') setBusinessTripForm({...businessTripForm, date: e.target.value});
                                    else setTripForm({...tripForm, date: e.target.value});
                                } else if (logType === 'spots') {
                                    setSpotForm({...spotForm, date: e.target.value});
                                } else handleTankChange({ target: { name: 'date', value: e.target.value } } as any);
                            }} className="cg-master-input w-full" />
                            {logType === 'fahrt' && tripLogMode === 'strict' && !isBusinessTripToday && (
                                <span className="typo-tiny block mt-1 cg-master-muted">Fahrtenbuch-Einträge müssen am selben Tag erfasst werden.</span>
                            )}
                            
                            {logType === 'tank' ? (
                                <>
                                    <input name="km" required type={focusedTankField === 'km' ? "number" : "text"} min="0" placeholder="KM-Stand" value={focusedTankField === 'km' ? tankForm.km : (tankForm.km !== '' && !isNaN(parseFloat(tankForm.km)) ? parseFloat(tankForm.km).toLocaleString('de-DE', { maximumFractionDigits: 0 }) : tankForm.km)} onChange={handleTankChange} onFocus={() => setFocusedTankField('km')} onBlur={() => setFocusedTankField(null)} onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }} className={`cg-master-input w-full`} />
                                    {!isKmValid && tankForm.km !== '' && (
                                        <span className="typo-tiny block mt-1 cg-master-muted">
                                            {maxKm === Infinity 
                                                ? `Kilometerstand muss mindestens ${formatNumber(minKm, 0)} km betragen.` 
                                                : minKm === 0 
                                                    ? `Kilometerstand darf höchstens ${formatNumber(maxKm, 0)} km betragen.`
                                                    : `Kilometerstand muss zwischen ${formatNumber(minKm, 0)} und ${formatNumber(maxKm, 0)} km liegen.`}
                                        </span>
                                    )}
                                    {isKmValid && tankForm.km !== '' && parseFloat(tankForm.km) < getLastKnownKm() && (
                                        <span className="typo-tiny block mt-1" style={{ color: 'var(--status-warn)' }}>Warnung: Kleiner als letzter KM-Stand ({formatNumber(getLastKnownKm(), 0)}).</span>
                                    )}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="w-full">
                                            <input name="liters" required type={focusedTankField === 'liters' ? "number" : "text"} min="0.01" step="0.01" max="9999" placeholder="Liter" value={focusedTankField === 'liters' ? tankForm.liters : (tankForm.liters !== '' && !isNaN(parseFloat(tankForm.liters)) ? parseFloat(tankForm.liters).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : tankForm.liters)} onChange={handleTankChange} onFocus={() => setFocusedTankField('liters')} onBlur={() => setFocusedTankField(null)} onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }} className={`cg-master-input w-full`} />
                                            {!isLitersValid && tankForm.liters !== '' && <span className="typo-tiny block mt-1 cg-master-muted">Liter muss &gt; 0 und &lt;= 9999 sein.</span>}
                                        </div>
                                        <select name="fuelType" className="cg-master-select w-full">
                                            {FUEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="w-full">
                                            <input name="price" required type={focusedTankField === 'price' ? "number" : "text"} min="0.01" step="0.001" max="999" placeholder="Preis/Liter" value={focusedTankField === 'price' ? tankForm.price : (tankForm.price !== '' && !isNaN(parseFloat(tankForm.price)) ? parseFloat(tankForm.price).toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : tankForm.price)} onChange={handleTankChange} onFocus={() => setFocusedTankField('price')} onBlur={() => setFocusedTankField(null)} onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }} className={`cg-master-input w-full`} />
                                            {!isPriceValid && tankForm.price !== '' && <span className="typo-tiny block mt-1 cg-master-muted">Preis muss &gt; 0 und &lt;= 999 sein.</span>}
                                        </div>
                                        <div className="w-full">
                                            <input name="total" type={focusedTankField === 'total' ? "number" : "text"} min="0" step="0.01" placeholder="Gesamtbetrag" value={focusedTankField === 'total' ? tankForm.total : (tankForm.total !== '' && !isNaN(parseFloat(tankForm.total)) ? parseFloat(tankForm.total).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : tankForm.total)} onChange={handleTankChange} onFocus={() => setFocusedTankField('total')} onBlur={() => setFocusedTankField(null)} onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }} className="cg-master-input w-full" />
                                        </div>
                                    </div>
                                    <select name="currency" className="cg-master-select w-full mt-2">
                                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <div className="mt-4">
                                        <label className="typo-label mb-2 block">Vollgetankt</label>
                                        <select name="vollgetankt" className="cg-master-select w-full" defaultValue="true">
                                            <option value="true">Ja</option>
                                            <option value="false">Nein</option>
                                        </select>
                                    </div>
                                </>
                            ) : logType === 'fahrt' ? (
                                tripLogMode === 'strict' ? (
                                    <>
                                        <select name="category" value={businessTripForm.category} onChange={e => setBusinessTripForm({...businessTripForm, category: e.target.value})} className="cg-master-input w-full">
                                            <option value="Dienstlich">Dienstlich</option>
                                            <option value="Privat">Privat</option>
                                            <option value="Betriebsstätte">Betriebsstätte</option>
                                        </select>
                                        <input name="driver" required placeholder="Fahrer" value={businessTripForm.driver} onChange={e => setBusinessTripForm({...businessTripForm, driver: e.target.value})} className={`cg-master-input w-full`} />
                                        {!isBusinessTripDriverValid && businessTripForm.driver === '' && <span className="typo-tiny block mt-1 cg-master-muted">Fahrer ist ein Pflichtfeld.</span>}
                                        <div className="flex gap-2">
                                            <input name="fromKm" required type="number" inputMode="numeric" pattern="[0-9]*" placeholder="Start KM" value={businessTripForm.fromKm} onChange={e => { const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6); setBusinessTripForm({...businessTripForm, fromKm: digitsOnly}); }} className={`cg-master-input w-1/2`} />
                                            <input name="toKm" required type="number" inputMode="numeric" pattern="[0-9]*" placeholder="Ziel KM" value={businessTripForm.toKm} onChange={e => { const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6); setBusinessTripForm({...businessTripForm, toKm: digitsOnly}); }} className={`cg-master-input w-1/2`} />
                                        </div>
                                        {businessTripForm.fromKm === '' && <span className="typo-tiny block mt-1 cg-master-muted">Start KM ist ein Pflichtfeld.</span>}
                                        {businessTripForm.toKm === '' && <span className="typo-tiny block mt-1 cg-master-muted">Ziel KM ist ein Pflichtfeld.</span>}
                                        {businessTripForm.fromKm !== '' && parseFloat(businessTripForm.fromKm) < getLastKnownKm() && <span className="typo-tiny block mt-1 cg-master-muted">Warnung: Start-KM kleiner als letzter KM-Stand ({formatNumber(getLastKnownKm(), 0)}).</span>}
                                        {!isBusinessTripValid && businessTripForm.toKm !== '' && <span className="typo-tiny block mt-1 cg-master-muted">Ziel KM muss größer als Start KM sein.</span>}
                                        <div className="flex gap-2">
                                            <input name="street" required placeholder="Straße" value={businessTripForm.street} onChange={e => setBusinessTripForm({...businessTripForm, street: e.target.value})} className="cg-master-input w-3/4" />
                                            <input name="houseNumber" required placeholder="Nr." value={businessTripForm.houseNumber} onChange={e => setBusinessTripForm({...businessTripForm, houseNumber: e.target.value})} className="cg-master-input w-1/4" />
                                        </div>
                                        <div className="flex gap-2">
                                            <input name="zip" required placeholder="PLZ" value={businessTripForm.zip} onChange={e => setBusinessTripForm({...businessTripForm, zip: e.target.value})} className="cg-master-input w-1/3" />
                                            <input name="city" required placeholder="Ort" value={businessTripForm.city} onChange={e => setBusinessTripForm({...businessTripForm, city: e.target.value})} className="cg-master-input w-2/3" />
                                        </div>
                                        <input name="purpose" maxLength={50} placeholder="Zweck (optional)" value={businessTripForm.purpose} onChange={e => setBusinessTripForm({...businessTripForm, purpose: e.target.value})} className={`cg-master-input w-full`} />
                                        {businessTripForm.category === 'Dienstlich' && (
                                            <input name="businessPartner" placeholder="Geschäftspartner (optional)" value={businessTripForm.businessPartner} onChange={e => setBusinessTripForm({...businessTripForm, businessPartner: e.target.value})} className="cg-master-input w-full" />
                                        )}
                                        <textarea name="note" placeholder="Notiz / Routenhinweis (optional)" value={businessTripForm.note} onChange={e => setBusinessTripForm({...businessTripForm, note: e.target.value})} className="cg-master-input w-full h-16" />
                                    </>
                                ) : (
                                    <>
                                        <input name="fromKm" required type="number" inputMode="numeric" pattern="[0-9]*" placeholder="Aktueller Tacho-Stand" value={tripForm.fromKm} onChange={e => { const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6); setTripForm({...tripForm, fromKm: digitsOnly}); }} className="cg-master-input w-full" />
                                        {tripForm.fromKm !== '' && parseFloat(tripForm.fromKm) < getLastKnownKm() && <span className="typo-tiny block mt-1 cg-master-muted">Warnung: Tacho-Stand kleiner als letzter KM-Stand ({formatNumber(getLastKnownKm(), 0)}).</span>}
                                        <input name="destination" required placeholder="Zielort" value={tripForm.destination} onChange={e => setTripForm({...tripForm, destination: e.target.value})} className="cg-master-input w-full" />
                                        <textarea name="note" placeholder="Notizen" value={tripForm.note} onChange={e => setTripForm({...tripForm, note: e.target.value})} className="cg-master-input w-full h-20" />
                                    </>
                                )
                            ) : (
                                <>
                                    <input name="name" required placeholder="POI Name" value={spotForm.name} onChange={e => setSpotForm({...spotForm, name: e.target.value})} className="cg-master-input w-full" />
                                    <select name="category" value={spotForm.category} onChange={e => setSpotForm({...spotForm, category: e.target.value})} className="cg-master-input w-full">
                                        <option value="Stellplatz">Stellplatz</option>
                                        <option value="Freistehen">Freistehen</option>
                                        <option value="Campingplatz">Campingplatz</option>
                                        <option value="Entsorgung">Entsorgung</option>
                                        <option value="Versorgung">Versorgung</option>
                                        <option value="Einkauf">Einkauf</option>
                                        <option value="Aussicht">Aussicht</option>
                                        <option value="Sonstiges">Sonstiges</option>
                                    </select>
                                    {spotGpsError && <span className="typo-tiny block mt-1 cg-master-muted">GPS nicht verfügbar</span>}
                                    <div className="flex gap-2 items-center">
                                        <button type="button" onClick={async () => {
                                            try { 
                                                const p = await getPosition(); 
                                                setSpotForm(s => ({...s, lat: p.lat.toString(), lng: p.lng.toString()})); 
                                                setSpotGpsError(false);
                                            } catch(err){ 
                                                setSpotGpsError(true);
                                            }
                                        }} className="cg-master-inset cg-master-control w-12 flex items-center justify-center rounded"><MapPin size={18}/></button>
                                        <input name="lat" required type="number" step="any" placeholder="Lat" value={spotForm.lat} onChange={e => setSpotForm({...spotForm, lat: e.target.value})} className="cg-master-input w-1/2" />
                                        <input name="lng" required type="number" step="any" placeholder="Lng" value={spotForm.lng} onChange={e => setSpotForm({...spotForm, lng: e.target.value})} className="cg-master-input w-1/2" />
                                    </div>
                                    <textarea name="note" placeholder="Notiz" value={spotForm.note} onChange={e => setSpotForm({...spotForm, note: e.target.value})} className="cg-master-input w-full h-24" />
                                </>
                            )}
                        </div>
                        <div className="flex gap-3 mt-6"><button type="button" onClick={() => { setIsAdding(false); setEditingTripId(null); setEditingSpotId(null); setIsConfirmingBusinessTrip(false); }} className="cg-master-button flex-1 !p-3">Abbrechen</button><button type="submit" disabled={(logType === 'tank' && (!isKmValid || !isLitersValid || !isPriceValid)) || (logType === 'fahrt' && tripLogMode === 'flex' && !isTripValid) || (logType === 'fahrt' && tripLogMode === 'strict' && (!isBusinessTripValid || !isBusinessTripPurposeValid || !isBusinessTripDriverValid || !isBusinessTripCategoryValid || !isBusinessTripToday))} className="cg-master-button flex-1 py-3 disabled:opacity-50">Speichern</button></div>
                    </form>
                </div>
            </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isConfirmingBusinessTrip && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4">
                <div className="cg-master-card-small w-full max-w-sm" style={{ borderColor: 'var(--accent)' }}>
                    <h2 className="typo-section-title mb-2">Verbindlich Speichern?</h2>
                    <p className="typo-body mb-6">
                        Bitte prüfe alle Angaben sorgfältig.<br/><br/>Fahrtenbuch-Einträge sind nur am selben Tag änderbar und danach gesperrt.<br/><br/>Möchtest du diesen Eintrag verbindlich speichern?
                    </p>
                    <div className="flex flex-col gap-3">
                        <button onClick={() => {
                            const entry: any = { 
                                id: editingTripId || Date.now().toString(), 
                                date: businessTripForm.date, 
                                fromKm: parseFloat(businessTripForm.fromKm), 
                                toKm: parseFloat(businessTripForm.toKm), 
                                category: businessTripForm.category,
                                driver: businessTripForm.driver,
                                street: businessTripForm.street,
                                houseNumber: businessTripForm.houseNumber,
                                zip: businessTripForm.zip,
                                city: businessTripForm.city,
                                purpose: businessTripForm.purpose,
                                businessPartner: businessTripForm.businessPartner,
                                note: businessTripForm.note
                            };
                            const currentBusinessTrips = state.businessTripLog || [];
                            if (editingTripId) {
                                setState({...state, businessTripLog: currentBusinessTrips.map((t:any) => t.id === editingTripId ? entry : t)});
                            } else {
                                setState({...state, businessTripLog: [entry, ...currentBusinessTrips]});
                            }
                            setEditingTripId(null);
                            setIsConfirmingBusinessTrip(false);
                            setIsAdding(false);
                        }} className="cg-master-button w-full py-3">Verbindlich speichern</button>
                        <button onClick={() => setIsConfirmingBusinessTrip(false)} className="cg-master-button w-full py-3">Zurück zur Prüfung</button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>
      </div>

      <div className="hidden print-only logbuch-print-wrapper bg-white">
          <div className="flex justify-between items-end border-b-2 border-black pb-4 mb-6">
              <div>
                  <h1 className="text-xl font-black uppercase tracking-widest">{state.profile.vehicleName || "Camper"}</h1>
                  <p className="text-xs font-bold uppercase">{state.profile.plate || "Kennzeichen"}</p>
              </div>
              <h2 className="text-lg font-black uppercase">
                  Logbuch - {logType === 'tank' ? 'Tanken' : logType === 'fahrt' ? (tripLogMode === 'strict' ? 'Fahrtenbuch' : 'Fahrten') : logType === 'spots' ? "POI's" : 'Archiv'}
              </h2>
          </div>

          {logType === 'tank' && (
             currentFuelLog.length === 0 ? <p className="text-center italic mt-10">Keine Einträge vorhanden</p> :
             <table className="print-table">
                 <thead><tr><th>Datum</th><th>Kilometerstand</th><th>Kraftstoff</th><th>Liter</th><th>Preis/L</th><th>Gesamtpreis</th></tr></thead>
                 <tbody>
                     {currentFuelLog.map((f:any) => (
                         <tr key={f.id}>
                             <td>{new Date(f.date).toLocaleDateString('de-DE')}</td>
                             <td>{formatNumber(f.km, 0)} KM</td>
                             <td>{f.fuelType}</td>
                             <td>{formatNumber(f.liters, 2)} L</td>
                             <td>{formatNumber(f.price, 3)} €</td>
                             <td>{formatNumber((f.liters * f.price) / (f.exchangeRateToEur || 1), 2)} €</td>
                         </tr>
                     ))}
                 </tbody>
             </table>
          )}

          {logType === 'fahrt' && tripLogMode === 'flex' && (
             currentTripLog.length === 0 ? <p className="text-center italic mt-10">Keine Einträge vorhanden</p> :
             <table className="print-table">
                 <thead><tr><th>Datum</th><th>Kategorie</th><th>Zielort</th><th>Zweck</th><th>Start KM</th><th>Ziel KM</th><th>Strecke</th><th>Notiz</th></tr></thead>
                 <tbody>
                     {currentTripLog.map((t:any) => (
                         <tr key={t.id}>
                             <td>{new Date(t.date).toLocaleDateString('de-DE')}</td>
                             <td>{t.category || 'Privat'}</td>
                             <td>{t.destination}</td>
                             <td>{t.purpose}</td>
                             <td>{(t.fromKm != null && !isNaN(t.fromKm)) ? Number(t.fromKm).toLocaleString('de-DE') : t.fromKm}</td>
                             <td>{(t.toKm != null && !isNaN(t.toKm)) ? Number(t.toKm).toLocaleString('de-DE') : t.toKm}</td>
                             <td>{(t.toKm != null && t.fromKm != null && !isNaN(t.toKm - t.fromKm)) ? Number(t.toKm - t.fromKm).toLocaleString('de-DE') : (t.toKm - t.fromKm)} KM</td>
                             <td>{t.note}</td>
                         </tr>
                     ))}
                 </tbody>
             </table>
          )}

          {logType === 'fahrt' && tripLogMode === 'strict' && (
             currentBusinessTripLog.length === 0 ? <p className="text-center italic mt-10">Keine Einträge vorhanden</p> :
             <table className="print-table">
                 <thead><tr><th>Datum</th><th>Fahrer</th><th>Kategorie</th><th>Start KM</th><th>Ziel KM</th><th>Strecke</th><th>Straße</th><th>Hausnr.</th><th>PLZ</th><th>Ort</th><th>Zweck</th><th>Geschäftspartner</th><th>Notiz / Route</th></tr></thead>
                 <tbody>
                     {currentBusinessTripLog.map((t:any) => (
                         <tr key={t.id}>
                             <td>{new Date(t.date).toLocaleDateString('de-DE')}</td>
                             <td>{t.driver}</td>
                             <td>{t.category}</td>
                             <td>{(t.fromKm != null && !isNaN(t.fromKm)) ? Number(t.fromKm).toLocaleString('de-DE') : t.fromKm}</td>
                             <td>{(t.toKm != null && !isNaN(t.toKm)) ? Number(t.toKm).toLocaleString('de-DE') : t.toKm}</td>
                             <td>{(t.toKm != null && t.fromKm != null && !isNaN(t.toKm - t.fromKm)) ? Number(t.toKm - t.fromKm).toLocaleString('de-DE') : (t.toKm - t.fromKm)} KM</td>
                             <td>{t.street}</td>
                             <td>{t.houseNumber}</td>
                             <td>{t.zip}</td>
                             <td>{t.city}</td>
                             <td>{t.purpose}</td>
                             <td>{t.businessPartner}</td>
                             <td>{t.note}</td>
                         </tr>
                     ))}
                 </tbody>
             </table>
          )}

          {logType === 'spots' && (
             state.spots.length === 0 ? <p className="text-center italic mt-10">Keine Einträge vorhanden</p> :
             <table className="print-table">
                 <thead><tr><th>Datum</th><th>Name</th><th>Kategorie</th><th>Latitude</th><th>Longitude</th><th>Notiz</th></tr></thead>
                 <tbody>
                     {state.spots.map((s:any) => (
                         <tr key={s.id}>
                             <td>{new Date(s.date).toLocaleDateString('de-DE')}</td>
                             <td>{s.name}</td>
                             <td>{s.category || 'Stellplatz'}</td>
                             <td>{s.lat.toFixed(6)}</td>
                             <td>{s.lng.toFixed(6)}</td>
                             <td>{s.note}</td>
                         </tr>
                     ))}
                 </tbody>
             </table>
          )}

          <div className="mt-10 pt-4 border-t border-gray-300 flex justify-between typo-label">
              <span>CamperGuard Pro</span>
              <span>Gedruckt am: {new Date().toLocaleDateString('de-DE')}</span>
          </div>
      </div>
    </>
  );
}
// --- TAB: REISE ---

const MapHandlerComponent = ({ destination, setDestination, setDistance, range }: { destination: [number, number] | null, setDestination: (d: [number, number]) => void, setDistance: (d: number) => void, range: number }) => {
  useMapEvents({
    click(e) {
      setDestination([e.latlng.lat, e.latlng.lng]);
      setDistance(Math.floor(Math.random() * (range * 0.8)) + 50); // dummy dist
    },
  });
  return destination ? <Marker position={destination} /> : null;
};

const ResizeMapComponent = () => {
  const map = useMap();
  useEffect(() => {
    globalLeafletMap = map;
    return () => { globalLeafletMap = null; };
  }, [map]);
  return null;
};

function ReiseView({ state, setState, orientation }: any) {
  const [destination, setDestination] = useState<[number, number] | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isAudioAssistActive, setIsAudioAssistActive] = useState(false);
  const [soundTestIndex, setSoundTestIndex] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioTimerRef = useRef<any>(null);
  const latestDirectionRef = useRef<string>('level');
  const latestIntensityRef = useRef<number>(0);
  const wasLevelRef = useRef<boolean>(true);

  const calibratedPitch = (orientation?.pitch || 0) - (state.profile.pitchOffset || 0);
  const calibratedRoll = (orientation?.roll || 0) - (state.profile.rollOffset || 0);

  const pitchNormalized = Math.max(-20, Math.min(20, calibratedPitch));
  const rollNormalized = Math.max(-20, Math.min(20, calibratedRoll));
  const heading = orientation?.heading || 0;

  // Audio Level Assist - Internes Richtungsmodell (welche Seite muss angehoben werden)
  const deadzone = 0.5;
  let assistDirection = 'level';
  const needRaiseFront = calibratedPitch > deadzone;
  const needRaiseRear = calibratedPitch < -deadzone;
  const needRaiseRight = calibratedRoll > deadzone;
  const needRaiseLeft = calibratedRoll < -deadzone;

  if (needRaiseFront && needRaiseLeft) assistDirection = 'frontLeft';
  else if (needRaiseFront && needRaiseRight) assistDirection = 'frontRight';
  else if (needRaiseRear && needRaiseLeft) assistDirection = 'rearLeft';
  else if (needRaiseRear && needRaiseRight) assistDirection = 'rearRight';
  else if (needRaiseFront) assistDirection = 'front';
  else if (needRaiseRear) assistDirection = 'rear';
  else if (needRaiseLeft) assistDirection = 'left';
  else if (needRaiseRight) assistDirection = 'right';

  const tiltIntensity = Math.sqrt(calibratedPitch * calibratedPitch + calibratedRoll * calibratedRoll);

  latestDirectionRef.current = assistDirection;
  latestIntensityRef.current = tiltIntensity;

  const playLockTone = (ctx: AudioContext) => {
    try {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';

      // Ein wohlklingender, kurzer Doppel-Ton (z.B. A5 + C#6)
      osc1.frequency.setValueAtTime(880, ctx.currentTime);
      osc2.frequency.setValueAtTime(1108.73, ctx.currentTime);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(ctx.currentTime);
      osc2.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.3);
      osc2.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.warn("Lock-Sound Fehler:", e);
    }
  };

  const playDirectionTone = (ctx: AudioContext, direction: string) => {
    if (direction === 'level') return;

    const dirOsc = ctx.createOscillator();
    const dirGain = ctx.createGain();
    const dirPan = ctx.createStereoPanner();

    let panValue = 0;
    if (['left', 'frontLeft', 'rearLeft'].includes(direction)) panValue = -1;
    else if (['right', 'frontRight', 'rearRight'].includes(direction)) panValue = 1;

    let freqValue = 500;
    if (['front', 'frontLeft', 'frontRight'].includes(direction)) freqValue = 800;
    else if (['rear', 'rearLeft', 'rearRight'].includes(direction)) freqValue = 300;

    dirOsc.type = 'triangle';
    const startTime = ctx.currentTime + 0.6;
    dirOsc.frequency.setValueAtTime(freqValue, startTime);

    dirPan.pan.setValueAtTime(panValue, startTime);

    dirGain.gain.setValueAtTime(0, startTime);
    dirGain.gain.linearRampToValueAtTime(0.28, startTime + 0.02);
    dirGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);

    dirOsc.connect(dirGain);
    dirGain.connect(dirPan);
    dirPan.connect(ctx.destination);

    dirOsc.start(startTime);
    dirOsc.stop(startTime + 0.15);
  };

  const handleManualSoundTest = async () => {
    if (!isAudioAssistActive) return;
    try {
      if (!audioCtxRef.current) return;
      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
      }
      const testSequence = ['left', 'frontLeft', 'front', 'frontRight', 'right', 'rearRight', 'rear', 'rearLeft'];
      const dir = testSequence[soundTestIndex % testSequence.length];
      playDirectionTone(audioCtxRef.current, dir);
      setSoundTestIndex(prev => prev + 1);
    } catch (e) {
      console.warn("Manual sound test failed:", e);
    }
  };

  useEffect(() => {
    if (!isAudioAssistActive) {
      if (audioTimerRef.current) {
        clearTimeout(audioTimerRef.current);
        audioTimerRef.current = null;
      }
      return;
    }

    const scheduleNextPulse = () => {
      const dir = latestDirectionRef.current;
      const intensity = latestIntensityRef.current;

      if (dir === 'level') {
        if (wasLevelRef.current === false) {
          if (audioCtxRef.current && audioCtxRef.current.state !== 'suspended') {
            playLockTone(audioCtxRef.current);
          }
          wasLevelRef.current = true;
        }
      } else {
        wasLevelRef.current = false;
        if (audioCtxRef.current) {
          try {
            if (audioCtxRef.current.state !== 'suspended') {
              playDirectionTone(audioCtxRef.current, dir);
            }
          } catch (e) {
            console.warn("Audio pulse error:", e);
          }
        }
      }

      let delay = 120;
      if (intensity > 6) delay = 500;
      else if (intensity > 3) delay = 350;
      else if (intensity > 1) delay = 220;

      audioTimerRef.current = setTimeout(scheduleNextPulse, delay);
    };

    scheduleNextPulse();

    return () => {
      if (audioTimerRef.current) {
        clearTimeout(audioTimerRef.current);
        audioTimerRef.current = null;
      }
    };
  }, [isAudioAssistActive]);

  const handleAudioToggle = async () => {
    if (!isAudioAssistActive) {
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioCtxRef.current.state === 'suspended') {
          await audioCtxRef.current.resume();
        }
        setIsAudioAssistActive(true);

        const ctx = audioCtxRef.current;
        
        // --- 1. Ready-Testton ---
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);

        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);

        // --- 2. Richtungstestton ---
        playDirectionTone(ctx, assistDirection);

      } catch (e) {
        console.warn("AudioContext creation failed:", e);
      }
    } else {
      setIsAudioAssistActive(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      // @ts-ignore
      if(globalLeafletMap) globalLeafletMap.invalidateSize({debounce: false});
    }, 200);
    return () => clearTimeout(t);
  }, []);

  const avgConsumption = useMemo(() => {
    if (state.fuelLog.length < 2) return 11.5;
    const sorted = [...state.fuelLog].sort((a,b) => b.km - a.km);
    const totalDist = sorted[0].km - sorted[sorted.length - 1].km;
    const totalLiters = sorted.slice(0, -1).reduce((acc:number, curr:any) => acc + curr.liters, 0);
    return totalDist > 0 ? (totalLiters / totalDist) * 100 : 11.5;
  }, [state.fuelLog]);

  const range = ((state.profile.dieselCapacity || 80) / avgConsumption) * 100;

  const isCritical = distance ? distance > range : false;

  return (
    <div className="space-y-6 flex flex-col min-h-[calc(100vh-140px)]">
      
      <div className="relative overflow-hidden p-6 z-0 rounded-xl bg-gradient-to-b from-[#1c1e22] to-[#0e1013] shadow-[0_10px_30px_rgba(0,0,0,0.8),_inset_0_1px_1px_rgba(255,255,255,0.02)] border border-[#000]">
        {/* Deep Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.6)_100%)] pointer-events-none z-0" />

        {/* Subtle technical background structure */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.03),transparent_50%)] pointer-events-none" />
        
        {/* Premium Metallic Screws (Panel Corners) */}
        <div className="absolute top-3 left-3 w-[12px] h-[12px] rounded-full bg-gradient-to-br from-[#444] to-[#111] border border-[#000] flex items-center justify-center z-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(0,0,0,0.8)]">
            <div className="w-[6px] h-[6px] rounded-full bg-gradient-to-b from-[#111] to-[#2a2c30] shadow-[inset_0_2px_3px_rgba(0,0,0,1)] relative">
                <div className="absolute top-[1px] left-[1.5px] w-[2px] h-[2px] bg-white/40 rounded-full blur-[0.5px] pointer-events-none" />
            </div>
        </div>
        <div className="absolute top-3 right-3 w-[12px] h-[12px] rounded-full bg-gradient-to-br from-[#444] to-[#111] border border-[#000] flex items-center justify-center z-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(0,0,0,0.8)]">
            <div className="w-[6px] h-[6px] rounded-full bg-gradient-to-b from-[#111] to-[#2a2c30] shadow-[inset_0_2px_3px_rgba(0,0,0,1)] relative">
                <div className="absolute top-[1px] left-[1.5px] w-[2px] h-[2px] bg-white/40 rounded-full blur-[0.5px] pointer-events-none" />
            </div>
        </div>
        <div className="absolute bottom-3 left-3 w-[12px] h-[12px] rounded-full bg-gradient-to-br from-[#444] to-[#111] border border-[#000] flex items-center justify-center z-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(0,0,0,0.8)]">
            <div className="w-[6px] h-[6px] rounded-full bg-gradient-to-b from-[#111] to-[#2a2c30] shadow-[inset_0_2px_3px_rgba(0,0,0,1)] relative">
                <div className="absolute top-[1px] left-[1.5px] w-[2px] h-[2px] bg-white/40 rounded-full blur-[0.5px] pointer-events-none" />
            </div>
        </div>
        <div className="absolute bottom-3 right-3 w-[12px] h-[12px] rounded-full bg-gradient-to-br from-[#444] to-[#111] border border-[#000] flex items-center justify-center z-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(0,0,0,0.8)]">
            <div className="w-[6px] h-[6px] rounded-full bg-gradient-to-b from-[#111] to-[#2a2c30] shadow-[inset_0_2px_3px_rgba(0,0,0,1)] relative">
                <div className="absolute top-[1px] left-[1.5px] w-[2px] h-[2px] bg-white/40 rounded-full blur-[0.5px] pointer-events-none" />
            </div>
        </div>

        <div className="text-[13px] text-[#8a939c] font-bold tracking-[0.3em] mb-8 text-center relative z-10 uppercase" style={{ textShadow: '0 -2px 2px rgba(0,0,0,0.9), 0 1px 1px rgba(255,255,255,0.08), 0 0 4px rgba(0,0,0,0.6)' }}>LAGE & KOMPASS</div>
        
        <div className="flex flex-col items-center gap-6 relative z-10">

              {/* Instrument Recess (Mulde) */}
              <div className="relative w-[280px] h-[280px] flex items-center justify-center bg-gradient-to-b from-[#08090a] to-[#16181b] rounded-full shadow-[inset_0_12px_24px_rgba(0,0,0,1),_0_1px_1px_rgba(255,255,255,0.04)] border border-black/90 shrink-0">
              
              {/* Actual Compass Outer Ring */}
              <div className="absolute w-[260px] h-[260px] rounded-full bg-gradient-to-br from-[#383b42] via-[#1f2125] to-[#0a0a0c] shadow-[0_10px_30px_rgba(0,0,0,0.9),_inset_0_1px_2px_rgba(255,255,255,0.1),_inset_0_-2px_8px_rgba(0,0,0,0.8)] border border-[#000] z-0 pointer-events-none" />
              
              {/* Inner Bevel of the ring */}
              <div className="absolute w-[214px] h-[214px] rounded-full bg-gradient-to-b from-[#020304] to-[#121418] shadow-[inset_0_4px_10px_rgba(0,0,0,0.9)] z-0 pointer-events-none border border-black/80" />

              {/* Inner Compass Glass Face */}
              <div className="absolute w-[210px] h-[210px] flex items-center justify-center rounded-full bg-[radial-gradient(circle_at_center,_#0a1a10_0%,_#030805_50%,_#010101_100%)] shadow-[inset_0_15px_30px_rgba(0,0,0,0.95)] overflow-hidden z-10">
                  {/* Glass highlight top */}
                  <div className="absolute top-[-5%] left-[10%] w-[80%] h-[40%] bg-gradient-to-b from-white/5 to-transparent rounded-[100%] pointer-events-none" />
                  
                  {/* Grid lines */}
                  <div className="absolute w-[1px] h-full bg-gradient-to-b from-transparent via-[#10b981]/60 to-transparent left-1/2 -translate-x-1/2" />
                  <div className="absolute h-[1px] w-full bg-gradient-to-r from-transparent via-[#10b981]/60 to-transparent top-1/2 -translate-y-1/2" />
                  
                  {/* Inner technical rings */}
                  <div className="absolute w-[140px] h-[140px] rounded-full border border-[#10b981]/10 shadow-[inset_0_1px_4px_rgba(0,0,0,0.8)]" />
                  <div className="absolute w-[80px] h-[80px] rounded-full border border-[#10b981]/15 shadow-[inset_0_1px_4px_rgba(0,0,0,0.8)]" />
                  
                  {/* Center glowing radar circle */}
                  <div className="absolute w-[36px] h-[36px] rounded-full border border-[#10b981]/50 bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.35)_0%,_transparent_70%)] shadow-[0_0_30px_rgba(16,185,129,0.5),_inset_0_0_15px_rgba(16,185,129,0.3)]" />
                  
                  <div className="absolute z-10 text-white/20 drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">
                      <Truck size={30} style={{ transform: `rotate(${heading}deg)` }} />
                  </div>
              </div>

              {/* Compass marks mounted on the Ring (z-20 so it sits freely above the inner face but inside the 260 box) */}
              <div 
                className="absolute z-20 w-[254px] h-[254px] transition-transform duration-500 ease-out" 
                style={{ transform: `rotate(${-heading || 0}deg)` }}
              >
                {[...Array(72)].map((_, i) => {
                  const deg = i * 5;
                  const isCardinal = deg % 90 === 0;
                  const isOrdinal = deg % 45 === 0 && !isCardinal;
                  const isTen = deg % 10 === 0 && !isCardinal;
                  
                  return (
                    <div 
                      key={i} 
                      className="absolute inset-0 flex justify-center z-10 pointer-events-none"
                      style={{ transform: `rotate(${deg}deg)` }}
                    >
                      {deg === 0 && <div className="mt-[2px] font-black text-[16px] leading-none text-[#ff6600] drop-shadow-[0_0_8px_rgba(255,102,0,0.8)]">N</div>}
                      {deg === 90 && <div className="mt-[3px] font-black text-[13px] leading-none text-[#ccc] drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">E</div>}
                      {deg === 180 && <div className="mt-[3px] font-black text-[13px] leading-none text-[#ccc] drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">S</div>}
                      {deg === 270 && <div className="mt-[3px] font-black text-[13px] leading-none text-[#ccc] drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">W</div>}
                      
                      {!isCardinal && isOrdinal && <div className="mt-[4px] w-[2.5px] h-[8px] bg-[#ff6600] rounded-sm shadow-[0_0_6px_rgba(255,102,0,0.7)]" />}
                      {!isCardinal && !isOrdinal && isTen && <div className="mt-[5px] w-[2px] h-[6px] bg-[#888] rounded-sm shadow-[0_1px_1px_rgba(0,0,0,1)]" />}
                      {!isCardinal && !isOrdinal && !isTen && <div className="mt-[6px] w-[1px] h-[4px] bg-[#555] rounded-sm shadow-[0_1px_1px_rgba(0,0,0,1)]" />}
                    </div>
                  );
                })}
              </div>

              {/* The Bubble (LED Sphere) - Z-30 */}
              <div className="absolute w-[210px] h-[210px] flex items-center justify-center rounded-full overflow-hidden z-30 pointer-events-none">
                <motion.div 
                    className="absolute w-[36px] h-[36px] rounded-full overflow-hidden"
                    style={{
                      background: 'radial-gradient(circle at 35% 35%, #a7f3d0 0%, #34d399 25%, #059669 60%, #064e3b 100%)',
                      boxShadow: '0 10px 20px rgba(0,0,0,0.9), 0 0 25px rgba(16,185,129,0.7), inset 0 3px 6px rgba(255,255,255,0.9), inset 0 -6px 12px rgba(0,0,0,0.9), inset -2px -2px 8px rgba(110,231,183,0.6)',
                      border: '1px solid rgba(255,255,255,0.3)'
                    }}
                    animate={{ 
                      x: rollNormalized * 3.8,
                      y: pitchNormalized * 3.8 
                    }}
                    transition={{ type: 'spring', bounce: 0.25, stiffness: 100 }}
                >
                    <div className="absolute top-[3px] left-[6px] w-[16px] h-[8px] bg-white/60 rounded-full rotate-[-40deg] blur-[1px] pointer-events-none" />
                    <div className="absolute top-[5px] left-[8px] w-[6px] h-[3px] bg-white rounded-full rotate-[-40deg] blur-[0.5px] pointer-events-none" />
                </motion.div>
              </div>
            </div>

            <div className="flex flex-row items-center justify-center mt-2 gap-8 w-full">
              {/* Box X (Roll) */}
              {(() => {
                const abs = Math.abs(rollNormalized);
                const val = abs <= 0.5 ? 0 : Math.round(abs);
                const valStyle = val === 0 ? {
                  color: '#00ff9c',
                  textShadow: '0 0 2px rgba(0,255,156,0.3)'
                } : {
                  color: '#ff8a2a',
                  textShadow: '0 0 2px rgba(255,138,42,0.3)'
                };
                return (
                  <div className="relative aspect-square w-[120px] rounded-full bg-gradient-to-b from-[#08090a] to-[#16181b] shadow-[inset_0_8px_16px_rgba(0,0,0,1),_0_1px_1px_rgba(255,255,255,0.04)] border border-black/90">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#383b42] via-[#1f2125] to-[#0a0a0c] shadow-[0_4px_12px_rgba(0,0,0,0.8),_inset_0_1px_2px_rgba(255,255,255,0.1),_inset_0_-1px_4px_rgba(0,0,0,0.8)] border border-[#000]" />
                      <div className="absolute inset-[8%] rounded-full bg-gradient-to-b from-[#020304] to-[#121418] shadow-[inset_0_2px_6px_rgba(0,0,0,0.9)] border border-black/80" />
                      <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle_at_center,_#0a1a10_0%,_#030805_50%,_#010101_100%)] shadow-[inset_0_10px_20px_rgba(0,0,0,0.95)] overflow-hidden">
                          <div className="absolute top-[-5%] left-[10%] w-[80%] h-[40%] bg-gradient-to-b from-white/10 to-transparent rounded-[100%] pointer-events-none" />
                          <div className="absolute bottom-0 w-full h-[40%] opacity-40 blur-md pointer-events-none" style={{ background: `radial-gradient(ellipse at bottom, ${val === 0 ? '#00ff9c' : '#ff5a00'} 0%, transparent 70%)` }} />
                          <div className="absolute bottom-0 left-[20%] w-[60%] h-[3px] blur-[1px] pointer-events-none" style={{ background: val === 0 ? '#00ff9c' : '#ff5a00', boxShadow: `0 -2px 8px ${val === 0 ? '#00ff9c' : '#ff5a00'}` }} />
                      </div>
                      <div className="absolute -top-5 w-full text-center z-40">
                          <div className="text-[10px] text-[#555] font-bold tracking-[0.2em] uppercase">HORIZONTAL</div>
                      </div>
                      <div className="relative z-30 flex flex-col items-center justify-center w-full h-full pt-2">
                          <div className="flex items-baseline justify-center translate-x-[4px] mb-[2px]">
                              <span className="text-4xl leading-none font-mono font-bold" style={valStyle}>{val}</span>
                              <span className="text-[12px] text-[#444] ml-0.5">°</span>
                          </div>
                          <div style={{ color: val === 0 ? '#00ff9c' : '#ff5a00', filter: `drop-shadow(0 0 4px ${val === 0 ? '#00ff9c' : '#ff5a00'}80)` }}>
                              <ArrowLeftRight size={14} />
                          </div>
                      </div>
                  </div>
                );
              })()}

              {/* Box Y (Pitch) */}
              {(() => {
                const abs = Math.abs(pitchNormalized);
                const val = abs <= 0.5 ? 0 : Math.round(abs);
                const valStyle = val === 0 ? {
                  color: '#00ff9c',
                  textShadow: '0 0 2px rgba(0,255,156,0.3)'
                } : {
                  color: '#ff8a2a',
                  textShadow: '0 0 2px rgba(255,138,42,0.3)'
                };
                return (
                  <div className="relative aspect-square w-[120px] rounded-full bg-gradient-to-b from-[#08090a] to-[#16181b] shadow-[inset_0_8px_16px_rgba(0,0,0,1),_0_1px_1px_rgba(255,255,255,0.04)] border border-black/90">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#383b42] via-[#1f2125] to-[#0a0a0c] shadow-[0_4px_12px_rgba(0,0,0,0.8),_inset_0_1px_2px_rgba(255,255,255,0.1),_inset_0_-1px_4px_rgba(0,0,0,0.8)] border border-[#000]" />
                      <div className="absolute inset-[8%] rounded-full bg-gradient-to-b from-[#020304] to-[#121418] shadow-[inset_0_2px_6px_rgba(0,0,0,0.9)] border border-black/80" />
                      <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle_at_center,_#0a1a10_0%,_#030805_50%,_#010101_100%)] shadow-[inset_0_10px_20px_rgba(0,0,0,0.95)] overflow-hidden">
                          <div className="absolute top-[-5%] left-[10%] w-[80%] h-[40%] bg-gradient-to-b from-white/10 to-transparent rounded-[100%] pointer-events-none" />
                          <div className="absolute bottom-0 w-full h-[40%] opacity-40 blur-md pointer-events-none" style={{ background: `radial-gradient(ellipse at bottom, ${val === 0 ? '#00ff9c' : '#ff5a00'} 0%, transparent 70%)` }} />
                          <div className="absolute bottom-0 left-[20%] w-[60%] h-[3px] blur-[1px] pointer-events-none" style={{ background: val === 0 ? '#00ff9c' : '#ff5a00', boxShadow: `0 -2px 8px ${val === 0 ? '#00ff9c' : '#ff5a00'}` }} />
                      </div>
                      <div className="absolute -top-5 w-full text-center z-40">
                          <div className="text-[10px] text-[#555] font-bold tracking-[0.2em] uppercase">VERTIKAL</div>
                      </div>
                      <div className="relative z-30 flex flex-col items-center justify-center w-full h-full pt-2">
                          <div className="flex items-baseline justify-center translate-x-[4px] mb-[2px]">
                              <span className="text-4xl leading-none font-mono font-bold" style={valStyle}>{val}</span>
                              <span className="text-[12px] text-[#444] ml-0.5">°</span>
                          </div>
                          <div style={{ color: val === 0 ? '#00ff9c' : '#ff5a00', filter: `drop-shadow(0 0 4px ${val === 0 ? '#00ff9c' : '#ff5a00'}80)` }}>
                              <ArrowUpDown size={14} />
                          </div>
                      </div>
                  </div>
                );
              })()}
            </div>
            
            <div className="w-full flex justify-center gap-4 mt-6">
              <button
                onClick={() => setState({ ...state, profile: { ...state.profile, pitchOffset: orientation?.pitch || 0, rollOffset: orientation?.roll || 0 } })}
                className="cg-master-button"
                title="Aktuelle Position als waagerecht setzen"
              >
                TARA
              </button>
              <button
                onClick={handleAudioToggle}
                className="cg-master-button"
                title="Audio Level Assist aktivieren"
              >
                {isAudioAssistActive ? 'AUDIO AN' : 'AUDIO ASSIST'}
              </button>
              {isAudioAssistActive && (
                <button
                  onClick={handleManualSoundTest}
                  className="cg-master-button"
                  title="Manueller Sound-Test"
                >
                  SOUND TEST
                </button>
              )}
            </div>

            {/* HÖHENKORREKTUR */}
            <div className="w-full flex justify-center">
              <div 
                className="w-full max-w-[280px] rounded-xl flex flex-col items-center justify-center p-5 relative cg-panel"
              >
                 <div className="text-[11px] cg-master-muted font-bold tracking-[0.25em] uppercase mb-6" style={{ textShadow: '0 -1px 1px rgba(0,0,0,0.8), 0 1px 1px rgba(255,255,255,0.05)' }}>Höhenkorrektur</div>
                 
                 <div className="w-full flex items-center justify-between relative px-2">
                    {/* Outline Camper */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[42px] h-[90px] border-2 border-[#999] rounded-t-[14px] rounded-b-[8px] opacity-80" style={{ filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.05))' }}>
                         <div className="absolute top-[14px] left-[2px] right-[2px] h-[12px] border-2 border-[#999] rounded-[4px]" />
                    </div>

                    {(() => {
                      const getStyle = (val: number) => val === 0 ? {
                        background: 'linear-gradient(180deg, #00ff9c, #00cc7a)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        textShadow: '0 0 3px rgba(0,255,156,0.25)'
                      } : {
                        background: 'linear-gradient(180deg, #ff9a3c, #ff5a00)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        textShadow: '0 0 8px rgba(255,122,0,0.6), 0 0 16px rgba(255,122,0,0.3)'
                      };
                      const vFL = 0;
                      const vHL = 0;
                      const vFR = 0;
                      const vHR = 0;
                      return (
                        <>
                          <div className="flex flex-col gap-6 text-left z-10">
                             <div>
                               <div className="text-[8px] text-[#666] font-bold tracking-[1.5px] uppercase mb-0.5">Vorne Links</div>
                               <div className="flex items-baseline">
                                 <span className="text-[32px] leading-none font-mono font-bold" style={getStyle(vFL)}>{vFL}</span>
                                 <span className="text-[19px] cg-master-muted ml-1">cm</span>
                               </div>
                             </div>
                             <div>
                               <div className="text-[8px] text-[#666] font-bold tracking-[1.5px] uppercase mb-0.5">Hinten Links</div>
                               <div className="flex items-baseline">
                                 <span className="text-[32px] leading-none font-mono font-bold" style={getStyle(vHL)}>{vHL}</span>
                                 <span className="text-[19px] cg-master-muted ml-1">cm</span>
                               </div>
                             </div>
                          </div>
                          
                          <div className="flex flex-col gap-6 text-right z-10">
                             <div>
                               <div className="text-[8px] text-[#666] font-bold tracking-[1.5px] uppercase mb-0.5">Vorne Rechts</div>
                               <div className="flex items-baseline justify-end">
                                 <span className="text-[32px] leading-none font-mono font-bold" style={getStyle(vFR)}>{vFR}</span>
                                 <span className="text-[19px] cg-master-muted ml-1">cm</span>
                               </div>
                             </div>
                             <div>
                               <div className="text-[8px] text-[#666] font-bold tracking-[1.5px] uppercase mb-0.5">Hinten Rechts</div>
                               <div className="flex items-baseline justify-end">
                                 <span className="text-[32px] leading-none font-mono font-bold" style={getStyle(vHR)}>{vHR}</span>
                                 <span className="text-[19px] cg-master-muted ml-1">cm</span>
                               </div>
                             </div>
                          </div>
                        </>
                      );
                    })()}
                 </div>
              </div>
            </div>

        </div>
      </div>

      <div className="relative overflow-hidden p-1.5 z-0 cg-panel">
        
        <style>{`
          .leaflet-control-attribution {
            background-color: rgba(0, 0, 0, 0.4) !important;
            color: #777 !important;
            font-size: 8px !important;
            backdrop-filter: blur(4px);
            border-top-left-radius: 6px;
            padding: 2px 6px !important;
          }
          .leaflet-control-attribution a {
            color: #999 !important;
            text-decoration: none !important;
          }
          .leaflet-control-attribution a:hover {
            color: #bbb !important;
          }
        `}</style>
        <div className="relative overflow-hidden z-0 h-[400px] w-full cg-inset">
            <MapContainer id="map" center={[51.1657, 10.4515]} zoom={6} zoomControl={false} style={{ height: '100%', width: '100%', background: '#0a0b0c' }}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
              <MapHandlerComponent destination={destination} setDestination={setDestination} setDistance={setDistance} range={range} />
              <ResizeMapComponent />
            </MapContainer>
        </div>
      </div>

    </div>
  );
}

// --- TAB: PROFIL ---

const faqData = [
  {q: "Warum Medikationsdaten?", a: "Im Notfall zählen Sekunden. Rettungskräfte sehen sofort lebenswichtige Infos im Safety Hub."},
  {q: "Wo werden meine Daten gespeichert?", a: "Alle Daten bleiben lokal in deinem Browser (IndexedDB). Es findet kein Cloud-Upload statt."},
  {q: "Was ist der ICE 2 Kontakt?", a: "Ein zweiter Notfallkontakt für den Fall, dass die primäre Kontaktperson nicht erreichbar ist."},
  {q: "Wofür dienen die Fahrzeugdaten?", a: "Sie helfen bei der Berechnung von Verbräuchen und erinnern an wichtige Service-Intervalle."},
  {q: "Was bedeuten Heading und Elevation?", a: "Heading zeigt deine Kompassrichtung, Elevation deine aktuelle Höhe über dem Meeresspiegel."},
  {q: "Warum gibt es ein Audio-Feedback?", a: "Der Success-Chime signalisiert dir exakt 0.0° Neigung, ohne dass du aufs Display schauen musst."},
  {q: "Wie funktionieren die Lagerorte?", a: "Du kannst jedem Gegenstand bis zu zwei feste Plätze (z.B. Heckgarage, Schrank links) zuweisen."},
  {q: "Was bedeutet 'Bestand 0'?", a: "Gegenstände mit Bestand 0 werden markiert, damit du sie vor der nächsten Tour nachkaufst."},
  {q: "Warum wird das KM-Feld rot?", a: "Das ist ein Schutz vor Tippfehlern. Der KM-Stand muss immer höher sein als beim letzten Mal."},
  {q: "Wie funktioniert der Tank-Rechner?", a: "Gib zwei Werte ein (z.B. Liter und Preis), der dritte Wert wird automatisch ausgerechnet."},
  {q: "Was passiert bei der Archivierung?", a: "Alte Touren werden schreibgeschützt abgelegt, um die aktuelle Liste übersichtlich zu halten."},
  {q: "Wie nutze ich den GPS-Sync?", a: "Ein Klick übernimmt deine aktuellen Koordinaten direkt in einen neuen Point of Interest (POI)."},
  {q: "Was mache ich mit dem GPX-Export?", a: "Du kannst deine Touren exportieren und in Garmin, TomTom oder Google Earth importieren."},
  {q: "Die Karte lädt nicht richtig?", a: "Ein integrierter Fix (200ms Delay) sorgt beim Tab-Wechsel für das korrekte Nachladen der Kacheln."},
  {q: "Ist die App auf Tablets nutzbar?", a: "Ja, ab 10 Zoll schaltet die App automatisch in ein optimiertes Zwei-Spalten-Layout."},
  {q: "Funktioniert die App auch im Tunnel?", a: "Die App ist offline-fähig. Nur die Kartenkacheln benötigen eine aktive Internetverbindung."},
  {q: "Wo finde ich das Logo auf Ausdrucken?", a: "Das CamperGuard Pro Logo wird automatisch unten links auf jedem PDF/Druck platziert."},
  {q: "Kann ich Lagerorte umbenennen?", a: "Ja, die Bezeichnungen der Staufächer können in den Einstellungen individuell angepasst werden."},
  {q: "Warum sollte ich GPS deaktivieren?", a: "Im Safety Hub kannst du GPS manuell ausschalten, um Akku zu sparen oder deine Privatsphäre zu schützen."},
  {q: "Was schreibe ich in das Zweck-Feld?", a: "Hier ist Platz für Notizen zur Tour, wie z.B. 'Schönster Stellplatz' oder 'Werkstattbesuch'."}
];

function ProfilView({ state, setState, demoSeed }: any) {
  const [activeTireProfile, setActiveTireProfile] = useState<TireProfile>('Straße');
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [faqSearch, setFaqSearch] = useState("");
  const [focusedProfileField, setFocusedProfileField] = useState<string | null>(null);

  const hc = (path: string, val: any) => {
    setState((prev:any) => {
        const next = {...prev};
        const p = path.split('.');
        let c: any = next;
        for(let i=0; i<p.length-1; i++) {
          c[p[i]] = Array.isArray(c[p[i]]) ? [...c[p[i]]] : {...c[p[i]]};
          c = c[p[i]];
        }
        c[p[p.length-1]] = val;
        return next;
    });
  };

  const tp = state.profile.tires[activeTireProfile] || { frontLeft:0, frontRight:0, rearLeft:0, rearRight:0 };
  const TIRE_PROFILES: TireProfile[] = ['Straße', 'Sand/Dünen', 'Schlamm/Matsch', 'Felsgelände', 'Geröll/Schotter', 'Wasser/Furten', 'Schnee/Eis', 'Erde/Wiese'];

  const parsePlate = (plateStr: string) => {
      const s = plateStr || "";
      if (s.includes('-')) {
          const p = s.split('-');
          return [p[0] || '', p[1] || '', p.slice(2).join('-') || ''];
      }
      if (s.includes(' ')) {
          const p = s.split(' ');
          return [p[0] || '', p[1] || '', p.slice(2).join(' ') || ''];
      }
      return [s, "", ""];
  };
  const [p1, p2, p3] = parsePlate(state.profile.plate);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex justify-between items-end mb-4 px-2 no-print">
          <h1 className="cg-master-section-title mb-0">FAHRZEUG</h1>
          <button onClick={() => setShowFaqModal(true)} className="cg-master-button cg-master-label normal-case px-2 py-1 leading-none">FAQ</button>
      </div>
      
      <div className="cg-master-card-small space-y-4">
          <div><label className="cg-master-label">Camper Name</label><input value={state.profile.vehicleName} onChange={e => hc('profile.vehicleName', e.target.value)} placeholder="Spitzname..." className="cg-master-input w-full" /></div>
          <div>
            <label className="cg-master-label">Kennzeichen</label>
            <div className="flex gap-2 items-center">
                <input value={p1} maxLength={3} onChange={e => hc('profile.plate', [e.target.value.toUpperCase().trim(), p2, p3].join('-'))} placeholder="B" className="cg-master-input w-20 text-center uppercase" />
                <span className="cg-master-muted !mb-0">–</span>
                <input value={p2} maxLength={2} onChange={e => hc('profile.plate', [p1, e.target.value.toUpperCase().trim(), p3].join('-'))} placeholder="CG" className="cg-master-input w-16 text-center uppercase" />
                <span className="cg-master-muted !mb-0">–</span>
                <input value={p3} maxLength={4} onChange={e => hc('profile.plate', [p1, p2, e.target.value.toUpperCase().trim()].join('-'))} placeholder="1234" className="cg-master-input w-24 text-center uppercase font-mono" />
            </div>
          </div>
      </div>

      <div className="cg-master-card-small">
          <label className="cg-master-label">FAHRZEUGABMESSUNGEN IN CM</label>
          <div className="grid grid-cols-3 gap-3">
              {[ 
                  { l: 'HÖHE', k: 'height', min: 100, max: 500 }, 
                  { l: 'BREITE', k: 'width', min: 100, max: 300 }, 
                  { l: 'LÄNGE', k: 'length', min: 200, max: 1200 } 
              ].map(d => {
              const val = state.profile[d.k];
              const numVal = val !== '' && val !== undefined ? Number(val) : NaN;
              const isEmpty = val === '' || val === undefined;
              const isInvalid = !isEmpty && (isNaN(numVal) || numVal < d.min || numVal > d.max);

              return (
              <div key={d.k} className={`cg-master-card-small p-3 text-center ${isEmpty ? 'animate-pulse-border' : ''} ${isInvalid ? '!border-[var(--status-danger)]' : ''}`}>
                  <span className="typo-label mb-1 block">{d.l}</span>
                  <input 
                      type="text" 
                      inputMode="numeric"
                      value={!isEmpty && !isNaN(numVal) ? numVal.toLocaleString('de-DE') : ''} 
                      onChange={e => {
                          let rawVal = e.target.value.replace(/\D/g, '');
                          hc(`profile.${d.k}`, rawVal !== '' ? Number(rawVal) : '');
                      }} 
                      onKeyDown={e => {
                          if (e.key === '-' || e.key === 'e' || e.key === '+' || e.key === '.') e.preventDefault();
                      }}
                      className={`cg-master-input w-full text-center py-1 ${isEmpty ? 'text-[var(--text-muted)]' : 'text-white'} ${isInvalid ? 'text-[var(--status-danger)]' : ''}`} 
                      style={{ fontSize: '14px', fontWeight: 'normal', border: 'none', borderBottom: isInvalid ? '1px solid var(--status-danger)' : '1px solid var(--border)', borderRadius: 0, backgroundColor: 'transparent' }} 
                  />
                  {isInvalid && <span className="text-[var(--status-danger)] text-[10px] uppercase font-bold mt-1 block">Ungültiger Wert</span>}
              </div>
          )})}
      </div>
      </div>

      <div className="cg-master-card-small space-y-4">
          <div className="grid grid-cols-2 gap-3">
              <div className={`cg-master-card-small p-3 flex flex-col items-center justify-center ${!state.profile.emptyWeight ? 'animate-pulse-border' : ''}`}>
                  <span className="typo-label mb-1">Leergewicht</span>
                  <div className="flex items-baseline gap-1">
                    <input 
                       type="text" 
                       inputMode="numeric"
                       value={state.profile.emptyWeight ? Number(state.profile.emptyWeight).toLocaleString('de-DE') : ''} 
                       onChange={e => {
                           let rawVal = e.target.value.replace(/\D/g, '');
                           hc('profile.emptyWeight', rawVal !== '' ? Number(rawVal) : '');
                       }} 
                       onBlur={e => {
                           let val = state.profile.emptyWeight || 0;
                           if (val < 400) val = 400;
                           hc('profile.emptyWeight', val);
                       }}
                       className={`cg-master-input w-20 text-center ${!state.profile.emptyWeight ? 'text-[var(--text-muted)]' : 'text-white'}`} 
                       style={{ border: 'none', backgroundColor: 'transparent', padding: 0 }} 
                    />
                    <span className="typo-value-small">kg</span>
                  </div>
              </div>
              <div className={`cg-master-card-small p-3 flex flex-col items-center justify-center ${!state.profile.maxWeight ? 'animate-pulse-border' : ''}`}>
                  <span className="typo-label mb-1">ZGG</span>
                  <div className="flex items-baseline gap-1">
                    <input 
                       type="text" 
                       inputMode="numeric"
                       value={state.profile.maxWeight ? Number(state.profile.maxWeight).toLocaleString('de-DE') : ''} 
                       onChange={e => {
                           let rawVal = e.target.value.replace(/\D/g, '');
                           let num = rawVal !== '' ? Number(rawVal) : '';
                           if (typeof num === 'number' && num > 60000) num = 60000;
                           hc('profile.maxWeight', num);
                       }} 
                       className={`cg-master-input w-20 text-center ${!state.profile.maxWeight ? 'text-[var(--text-muted)]' : 'text-[var(--accent)]'}`} 
                       style={{ border: 'none', backgroundColor: 'transparent', padding: 0 }} 
                    />
                    <span className="typo-value-small">kg</span>
                  </div>
              </div>
          </div>

          <div className="cg-master-card-small p-4 flex flex-col gap-4 mt-2">
              {[ 
                  { l: 'Frischwasser', k: 'freshWaterCapacity' }, 
                  { l: 'Abwasser', k: 'wasteWaterCapacity' }, 
                  { l: 'Kraftstoff', k: 'dieselCapacity' } 
              ].map(d => (
                  <div key={d.k} className="flex justify-between items-center">
                      <span className="cg-master-label !mb-0">{d.l}</span>
                      <div className="flex items-baseline gap-2">
                        <input 
                            type="text" 
                            inputMode="numeric"
                            value={state.profile[d.k as keyof typeof state.profile] ? Number(state.profile[d.k as keyof typeof state.profile]).toLocaleString('de-DE') : ''} 
                            onChange={e => {
                                let rawVal = e.target.value.replace(/\D/g, '');
                                let num = rawVal !== '' ? Number(rawVal) : '';
                                if (typeof num === 'number' && num > 2000) num = 2000;
                                hc(`profile.${d.k}`, num);
                            }} 
                            className={`cg-master-input w-24 text-center ${!state.profile[d.k as keyof typeof state.profile] ? 'animate-pulse-border text-[var(--text-muted)]' : 'text-white'}`} 
                        />
                        <span className="cg-master-muted">L</span>
                      </div>
                  </div>
              ))}
          </div>

          <div className="cg-master-card-small space-y-4 pt-4 mt-3">
              <span className="typo-section-title mb-2 block">TANKSTÄNDE & FÜLLMENGEN</span>
              {[ 
                  { l: 'Frischwasser', k: 'freshWaterCapacity', levelKey: 'waterLevel', icon: <Droplet size={16} />, colorStart: '#2563eb', colorEnd: '#60a5fa', shadowColor: 'rgba(59, 130, 246, 0.4)' }, 
                  { l: 'Abwasser', k: 'wasteWaterCapacity', levelKey: 'wasteWaterLevel', icon: <Droplet size={16} />, colorStart: '#4b5563', colorEnd: '#9ca3af', shadowColor: 'rgba(107, 114, 128, 0.4)' }, 
                  { l: 'Kraftstoff', k: 'dieselCapacity', levelKey: 'dieselLevel', icon: <Fuel size={16} />, colorStart: '#ea580c', colorEnd: '#fb923c', shadowColor: 'rgba(234, 88, 12, 0.4)' } 
              ].map((d, index) => {
                  const capacity = state.profile[d.k as keyof typeof state.profile] || 0;
                  const level = state[d.levelKey as keyof typeof state] || 0;
                  const liters = (level / 100) * capacity;
                  
                  return (
                      <div key={d.k} className="cg-master-inset p-4 relative overflow-hidden flex flex-col gap-3">
                          <div className="flex justify-between items-center relative z-10">
                              <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 flex items-center justify-center rounded-full cg-master-inset" style={{ color: d.colorEnd }}>
                                      {d.icon}
                                  </div>
                                  <span className="cg-master-label !mb-0">{d.l}</span>
                              </div>
                              <div className="flex items-baseline gap-1.5">
                                  <span className="cg-master-value !text-2xl leading-none">{level}<span className="text-sm opacity-50 ml-[1px]">%</span></span>
                                  <span className="cg-master-label text-white/40 mb-0.5">({formatNumber(liters, 0)} L)</span>
                              </div>
                          </div>
                      
                          <div className="relative h-6 flex items-center mt-1 z-10 group">
                              {/* Background Track */}
                              <div className="absolute w-full h-3 cg-master-inset rounded-full" />
                              
                              {/* Filled Track with Gradient & Glow */}
                              <div 
                                className="absolute h-3 rounded-full shadow-[0_0_10px_var(--shadow-color)] overflow-hidden"
                                style={{ 
                                  width: `${level}%`, 
                                  background: `linear-gradient(90deg, ${d.colorStart}, ${d.colorEnd})`,
                                  '--shadow-color': d.shadowColor,
                                  transition: 'width 0.1s ease-out'
                                } as React.CSSProperties}
                              >
                                  <div className="absolute inset-0 bg-gradient-to-b from-[var(--text-secondary)] via-transparent to-transparent pointer-events-none" />
                              </div>
                              
                              {/* Range Input over top - fully transparent but functional */}
                              <input 
                                  type="range" 
                                  min="0" 
                                  max="100" 
                                  step="1"
                                  value={level} 
                                  onChange={(e) => setState({...state, [d.levelKey]: parseInt(e.target.value)})}
                                  className="absolute w-full h-full opacity-0 cursor-pointer z-20 m-0 p-0"
                              />

                              {/* Custom Thumb - positioned based on percentage */}
                              <div 
                                className="absolute h-5 w-5 cg-master-inset rounded-full border-2 pointer-events-none z-10 top-1/2 -translate-y-1/2 -ml-2.5 transition-transform"
                                style={{ 
                                  left: `${level}%`,
                                  borderColor: d.colorStart,
                                  transition: 'left 0.1s ease-out, transform 0.2s'
                                }}
                              />
                          </div>
                      </div>
                  );
              })}
          </div>
          
          <div className="space-y-3 pt-2">
            <span className="typo-section-title mb-2 block">Wartungs-Termine</span>
            {state.maintenance.map((m:any, idx:number) => (
                <div key={m.id} className="flex items-center gap-3">
                    <span className="typo-label w-24">{m.name}</span>
                    <input type="date" value={m.date} onChange={(e) => { const nm = [...state.maintenance]; nm[idx].date = e.target.value; setState({...state, maintenance: nm}); }} className={`cg-master-input flex-1 ${!m.date ? 'animate-pulse-border text-[var(--text-muted)]' : ''}`} />
                </div>
            ))}
          </div>
      </div>

      <div className="cg-master-card-small space-y-4 border-l-4" style={{ borderLeftColor: 'var(--accent)' }}>
          <div className="flex justify-between items-center">
             <span className="typo-section-title" style={{ color: 'white' }}>Reifendruck (bar)</span>
             <button onClick={() => hc('profile.isTwinTires', !state.profile.isTwinTires)} className="typo-label transition-colors" style={{ color: state.profile.isTwinTires ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 50%, transparent)' }}>+ ZWILLING</button>
          </div>
          
          <select value={activeTireProfile} onChange={e => setActiveTireProfile(e.target.value as any)} className="cg-master-input w-full">
              {TIRE_PROFILES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          
          <div className="grid grid-cols-2 gap-4 pt-2">
             {/* FRONT LEFT */}
             {(() => {
                 const isInv = (v: any) => v !== undefined && v !== '' && v !== null && !isNaN(Number(v)) && (Number(v) <= 0 || Number(v) > 10);
                 const iFL = isInv(tp.frontLeft);
                 const iFR = isInv(tp.frontRight);
                 const iRL = isInv(tp.rearLeft);
                 const iRLO = isInv(tp.rearLeftOuter ?? tp.rearLeft);
                 const iRR = isInv(tp.rearRight);
                 const iRRO = isInv(tp.rearRightOuter ?? tp.rearRight);

                 return (
                     <>
                         <div className="cg-master-inset p-3 flex flex-col items-center justify-center text-center">
                             <span className="cg-master-label text-center mb-1">VL {state.profile.isTwinTires ? '(Innen)' : ''}</span>
                             <input type="number" step="0.1" value={tp.frontLeft ?? ''} onChange={e => hc(`profile.tires.${activeTireProfile}.frontLeft`, e.target.value === '' ? '' : parseFloat(e.target.value))} onKeyDown={e => { if (e.key === '-' || e.key === 'e' || e.key === '+') e.preventDefault(); }} className={`cg-master-value w-16 text-center bg-transparent border-none outline-none ${!tp.frontLeft ? 'animate-pulse text-[var(--text-muted)]' : ''} ${iFL ? '!text-[var(--status-danger)]' : ''}`} />
                             {iFL && <span className="text-[var(--status-danger)] text-[9px] uppercase font-bold mt-1 block leading-tight">Ungültiger<br/>Reifendruck</span>}
                         </div>
                         {/* FRONT RIGHT */}
                         <div className="cg-master-inset p-3 flex flex-col items-center justify-center text-center">
                             <span className="cg-master-label text-center mb-1">VR {state.profile.isTwinTires ? '(Innen)' : ''}</span>
                             <input type="number" step="0.1" value={tp.frontRight ?? ''} onChange={e => hc(`profile.tires.${activeTireProfile}.frontRight`, e.target.value === '' ? '' : parseFloat(e.target.value))} onKeyDown={e => { if (e.key === '-' || e.key === 'e' || e.key === '+') e.preventDefault(); }} className={`cg-master-value w-16 text-center bg-transparent border-none outline-none ${!tp.frontRight ? 'animate-pulse text-[var(--text-muted)]' : ''} ${iFR ? '!text-[var(--status-danger)]' : ''}`} />
                             {iFR && <span className="text-[var(--status-danger)] text-[9px] uppercase font-bold mt-1 block leading-tight">Ungültiger<br/>Reifendruck</span>}
                         </div>
                         {/* REAR LEFT */}
                         <div className="cg-master-inset p-3 flex flex-col items-center justify-center text-center">
                             <span className="cg-master-label text-center mb-1">HL {state.profile.isTwinTires ? '(Innen)' : ''}</span>
                             <input type="number" step="0.1" value={tp.rearLeft ?? ''} onChange={e => hc(`profile.tires.${activeTireProfile}.rearLeft`, e.target.value === '' ? '' : parseFloat(e.target.value))} onKeyDown={e => { if (e.key === '-' || e.key === 'e' || e.key === '+') e.preventDefault(); }} className={`cg-master-value w-16 text-center bg-transparent border-none outline-none ${!tp.rearLeft ? 'animate-pulse text-[var(--text-muted)]' : ''} ${iRL ? '!text-[var(--status-danger)]' : ''}`} />
                             {iRL && <span className="text-[var(--status-danger)] text-[9px] uppercase font-bold mt-1 block leading-tight">Ungültiger<br/>Reifendruck</span>}
                             
                             {state.profile.isTwinTires && (
                                <>
                                    <span className="cg-master-label text-center mb-1 mt-3">HL (Außen)</span>
                                    <input type="number" step="0.1" value={tp.rearLeftOuter ?? tp.rearLeft ?? ''} onChange={e => hc(`profile.tires.${activeTireProfile}.rearLeftOuter`, e.target.value === '' ? '' : parseFloat(e.target.value))} onKeyDown={e => { if (e.key === '-' || e.key === 'e' || e.key === '+') e.preventDefault(); }} className={`cg-master-value w-16 text-center bg-transparent border-none outline-none ${!(tp.rearLeftOuter ?? tp.rearLeft) ? 'animate-pulse text-[var(--text-muted)]' : ''} ${iRLO ? '!text-[var(--status-danger)]' : ''}`} />
                                    {iRLO && <span className="text-[var(--status-danger)] text-[9px] uppercase font-bold mt-1 block leading-tight">Ungültiger<br/>Reifendruck</span>}
                                </>
                             )}
                         </div>
                         {/* REAR RIGHT */}
                         <div className="cg-master-inset p-3 flex flex-col items-center justify-center text-center">
                             <span className="cg-master-label text-center mb-1">HR {state.profile.isTwinTires ? '(Innen)' : ''}</span>
                             <input type="number" step="0.1" value={tp.rearRight ?? ''} onChange={e => hc(`profile.tires.${activeTireProfile}.rearRight`, e.target.value === '' ? '' : parseFloat(e.target.value))} onKeyDown={e => { if (e.key === '-' || e.key === 'e' || e.key === '+') e.preventDefault(); }} className={`cg-master-value w-16 text-center bg-transparent border-none outline-none ${!tp.rearRight ? 'animate-pulse text-[var(--text-muted)]' : ''} ${iRR ? '!text-[var(--status-danger)]' : ''}`} />
                             {iRR && <span className="text-[var(--status-danger)] text-[9px] uppercase font-bold mt-1 block leading-tight">Ungültiger<br/>Reifendruck</span>}
                             
                             {state.profile.isTwinTires && (
                                <>
                                    <span className="cg-master-label text-center mb-1 mt-3">HR (Außen)</span>
                                    <input type="number" step="0.1" value={tp.rearRightOuter ?? tp.rearRight ?? ''} onChange={e => hc(`profile.tires.${activeTireProfile}.rearRightOuter`, e.target.value === '' ? '' : parseFloat(e.target.value))} onKeyDown={e => { if (e.key === '-' || e.key === 'e' || e.key === '+') e.preventDefault(); }} className={`cg-master-value w-16 text-center bg-transparent border-none outline-none ${!(tp.rearRightOuter ?? tp.rearRight) ? 'animate-pulse text-[var(--text-muted)]' : ''} ${iRRO ? '!text-[var(--status-danger)]' : ''}`} />
                                    {iRRO && <span className="text-[var(--status-danger)] text-[9px] uppercase font-bold mt-1 block leading-tight">Ungültiger<br/>Reifendruck</span>}
                                </>
                             )}
                         </div>
                     </>
                 );
             })()}
          </div>
      </div>

      {/* 
      <div className="flex flex-col gap-3 pt-6">
        <button onClick={demoSeed} className="cg-master-button w-full">Demo Reset</button>
        <button onClick={() => { if(confirm("LÖSCHEN?")) { initDB().then(db=>db.clear('store')); window.location.reload(); } }} className="cg-master-button-danger w-full">Full Wipe</button>
      </div>
      */}

      <AnimatePresence>
          {showFaqModal && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex flex-col p-4">
                 <div className="flex justify-between items-center mb-6 pt-4"><h2 className="typo-section-title">FAQ</h2><button onClick={()=>setShowFaqModal(false)} className="cg-master-button px-3 py-1">X</button></div>
                 <div className="relative mb-4">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" size={14} />
                     <input type="text" placeholder="FAQ DURCHSUCHEN..." className="cg-master-input w-full pl-10 pr-4" value={faqSearch} onChange={(e) => setFaqSearch(e.target.value)} />
                 </div>
                 <div className="flex-1 overflow-y-auto space-y-4 pb-4">
                     {faqData.filter(f => f.q.toLowerCase().includes(faqSearch.toLowerCase()) || f.a.toLowerCase().includes(faqSearch.toLowerCase())).map((f:any, i:number) => (
                         <div key={i} className="cg-master-card-small space-y-3 relative">
                             <div className="w-full typo-card-title !mb-0">{f.q}</div>
                             <div className="w-full typo-body-dim">{f.a}</div>
                         </div>
                     ))}
                 </div>
             </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
}
