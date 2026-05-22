const fs = require('fs');

const file = fs.readFileSync('src/views/LogbuchView.tsx', 'utf8');

const tAddStart = "        {isAdding && (\n            <motion.div";
const idxAddStart = file.indexOf(tAddStart);
console.log("Add block start:", idxAddStart);

const idxAddEnd = file.indexOf("            </motion.div>\n        )}\n      </AnimatePresence>", idxAddStart);
console.log("Add block end:", idxAddEnd);

const tConfirmStart = "        {isConfirmingBusinessTrip && (\n            <motion.div";
const idxConfirmStart = file.indexOf(tConfirmStart, idxAddEnd);
console.log("Confirm block start:", idxConfirmStart);

const idxConfirmEnd = file.indexOf("            </motion.div>\n        )}\n      </AnimatePresence>", idxConfirmStart);
console.log("Confirm block end:", idxConfirmEnd);

if (idxAddStart > 0 && idxAddEnd > 0 && idxConfirmStart > 0 && idxConfirmEnd > 0) {
    let extraction1 = file.substring(idxAddStart, idxAddEnd + "            </motion.div>\n        )}".length);
    let extraction2 = file.substring(idxConfirmStart, idxConfirmEnd + "            </motion.div>\n        )}".length);

    let newComponent = `import React from 'react';
import { Trash2, MapPin, ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';
import { formatNumber } from '../../lib/formatters';
import type { Currency, FuelType, FuelEntry, SpotEntry } from '../../types';

const CURRENCIES: Currency[] = ['EUR', 'CHF', 'TRY', 'DKK', 'SEK', 'NOK', 'PLN', 'GBP'];
const FUEL_TYPES: FuelType[] = ['Diesel', 'Benzin', 'Super E10', 'Super E5'];

const SPOT_COLORS: Record<string, string> = {
  'Stellplatz': '#3B82F6',
  'Freistehen': '#22C55E',
  'Campingplatz': '#FBBF24',
  'Entsorgung': '#EF4444',
  'Versorgung': '#EC4899',
  'Einkauf': '#06B6D4',
  'Aussicht': '#A855F7',
  'Sonstiges': '#9CA3AF',
};

const SPOT_CATEGORIES = ['Stellplatz', 'Freistehen', 'Campingplatz', 'Entsorgung', 'Versorgung', 'Einkauf', 'Aussicht', 'Sonstiges'];

interface LogbuchAddModalProps {
  isAdding: boolean;
  setIsAdding: (v: boolean) => void;
  isConfirmingBusinessTrip: boolean;
  setIsConfirmingBusinessTrip: (v: boolean) => void;
  logType: 'tank' | 'fahrt' | 'spots' | 'archiv';
  tripLogMode: 'flex' | 'strict';
  // Tank
  tankForm: any;
  setTankForm: (f: any) => void;
  handleTankChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  focusedTankField: string | null;
  setFocusedTankField: (f: string | null) => void;
  isKmValid: boolean;
  isLitersValid: boolean;
  isPriceValid: boolean;
  minKm: number;
  maxKm: number;
  // Trip
  tripForm: any;
  setTripForm: (f: any) => void;
  businessTripForm: any;
  setBusinessTripForm: (f: any) => void;
  isTripValid: boolean;
  isBusinessTripValid: boolean;
  isBusinessTripPurposeValid: boolean;
  isBusinessTripDriverValid: boolean;
  isBusinessTripCategoryValid: boolean;
  isBusinessTripToday: boolean;
  tripGpsCoords: { lat: number; lng: number } | null;
  tripGpsStatus: 'offline' | 'loading' | 'active';
  // Spot
  spotForm: any;
  setSpotForm: (f: any) => void;
  spotCategoryOpen: boolean;
  setSpotCategoryOpen: (v: boolean) => void;
  spotGpsError: boolean;
  setSpotGpsError: (v: boolean) => void;
  getPosition: () => Promise<{ lat: number; lng: number }>;
  // Shared
  editingTripId: string | null;
  setEditingTripId: (id: string | null) => void;
  editingSpotId: string | null;
  setEditingSpotId: (id: string | null) => void;
  getLastKnownKm: () => number;
  state: any;
  setState: (s: any) => void;
}

export function LogbuchAddModal(props: LogbuchAddModalProps) {
  const {
    isAdding, setIsAdding, isConfirmingBusinessTrip, setIsConfirmingBusinessTrip,
    logType, tripLogMode,
    tankForm, setTankForm, handleTankChange, focusedTankField, setFocusedTankField,
    isKmValid, isLitersValid, isPriceValid, minKm, maxKm,
    tripForm, setTripForm, businessTripForm, setBusinessTripForm,
    isTripValid, isBusinessTripValid, isBusinessTripPurposeValid,
    isBusinessTripDriverValid, isBusinessTripCategoryValid, isBusinessTripToday,
    tripGpsCoords, tripGpsStatus,
    spotForm, setSpotForm, spotCategoryOpen, setSpotCategoryOpen,
    spotGpsError, setSpotGpsError, getPosition,
    editingTripId, setEditingTripId, editingSpotId, setEditingSpotId,
    getLastKnownKm, state, setState
  } = props;

  return (
    <>
` + extraction1 + "\n" + extraction2 + `
    </>
  );
}
`;
    fs.writeFileSync('src/views/logbuch/LogbuchAddModal.tsx', newComponent);
    console.log("Created src/views/logbuch/LogbuchAddModal.tsx");

    // Let's create the replacement array
    let replacement = `      <AnimatePresence>
        <LogbuchAddModal
          isAdding={isAdding}
          setIsAdding={setIsAdding}
          isConfirmingBusinessTrip={isConfirmingBusinessTrip}
          setIsConfirmingBusinessTrip={setIsConfirmingBusinessTrip}
          logType={logType}
          tripLogMode={tripLogMode}
          tankForm={tankForm}
          setTankForm={setTankForm}
          handleTankChange={handleTankChange}
          focusedTankField={focusedTankField}
          setFocusedTankField={setFocusedTankField}
          isKmValid={isKmValid}
          isLitersValid={isLitersValid}
          isPriceValid={isPriceValid}
          minKm={minKm}
          maxKm={maxKm}
          tripForm={tripForm}
          setTripForm={setTripForm}
          businessTripForm={businessTripForm}
          setBusinessTripForm={setBusinessTripForm}
          isTripValid={isTripValid}
          isBusinessTripValid={isBusinessTripValid}
          isBusinessTripPurposeValid={isBusinessTripPurposeValid}
          isBusinessTripDriverValid={isBusinessTripDriverValid}
          isBusinessTripCategoryValid={isBusinessTripCategoryValid}
          isBusinessTripToday={isBusinessTripToday}
          tripGpsCoords={tripGpsCoords}
          tripGpsStatus={tripGpsStatus}
          spotForm={spotForm}
          setSpotForm={setSpotForm}
          spotCategoryOpen={spotCategoryOpen}
          setSpotCategoryOpen={setSpotCategoryOpen}
          spotGpsError={spotGpsError}
          setSpotGpsError={setSpotGpsError}
          getPosition={getPosition}
          editingTripId={editingTripId}
          setEditingTripId={setEditingTripId}
          editingSpotId={editingSpotId}
          setEditingSpotId={setEditingSpotId}
          getLastKnownKm={getLastKnownKm}
          state={state}
          setState={setState}
        />
      </AnimatePresence>`;

    let newFileStr = file.substring(0, file.lastIndexOf("<AnimatePresence>", idxAddStart)) + replacement + file.substring(idxConfirmEnd + "            </motion.div>\n        )}\n      </AnimatePresence>".length);
    
    fs.writeFileSync('src/views/LogbuchView.tsx', newFileStr);
    console.log("Updated src/views/LogbuchView.tsx successfully.");
} else {
    console.log("Could not find blocks.");
}
