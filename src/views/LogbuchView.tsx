import React from 'react';
import type { AppState, FuelEntry, Archive } from '../../types';
import { Plus, Printer } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { formatNumber } from '../lib/formatters';
import { LogbuchPrintViews } from '../print/LogbuchPrintViews';
import { LogbuchArchiveDetail } from './logbuch/LogbuchArchiveDetail';
import { LogbuchArchiveCreate } from './logbuch/LogbuchArchiveCreate';
import { LogbuchTankList } from './logbuch/LogbuchTankList';
import { LogbuchTripList } from './logbuch/LogbuchTripList';
import { LogbuchSpotList } from './logbuch/LogbuchSpotList';
import { LogbuchAddModal } from './logbuch/LogbuchAddModal';
import { useLogbuch } from './logbuch/useLogbuch';
import { SPOT_COLORS } from '../data/constants';

interface LogbuchViewProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

export function LogbuchView({ state, setState }: LogbuchViewProps) {
  const lb = useLogbuch(state, setState);

  return (
    <>
      <style>{`
        @media print {
            @page { size: A4 ${lb.logType === 'tank' || (lb.logType === 'fahrt' && lb.tripLogMode === 'strict') ? 'landscape' : 'portrait'}; margin: ${lb.logType === 'tank' ? '15mm' : '10mm 15mm'}; }
            .logbuch-normal { display: none !important; }
        }
      `}</style>
      <div className="space-y-6 logbuch-normal">
      <div className="flex justify-between items-center mb-4 px-2 no-print">
          <h1 className="typo-section-title">Logbuch {lb.currentYear}</h1>
          <button
              onClick={() => setState({...state, sos: {...state.sos, gpsEnabled: state.sos?.gpsEnabled === false ? true : false}})}
              className="flex items-center gap-1.5"
          >
              <div className={`w-[7px] h-[7px] rounded-full ${state.sos?.gpsEnabled !== false ? 'bg-[#00ff9c] shadow-[0_0_6px_rgba(0,255,156,0.5)]' : 'bg-[var(--accent)] shadow-[0_0_6px_rgba(255,102,0,0.4)]'}`} />
              <span className={`text-[12px] font-bold tracking-[0.1em] uppercase ${state.sos?.gpsEnabled !== false ? 'text-[#00ff9c]/80' : 'text-[var(--accent)]/80'}`}>GPS</span>
          </button>
          <button onClick={() => window.print()} className="cg-master-button !py-1.5 !px-3"><Printer size={14}/></button>
      </div>

      <div className="cg-master-inset p-3 flex justify-between items-center sticky top-[-10px] z-20">
          <div className="text-center">
              <div className="typo-label">Jahres-KM</div>
              <div className="typo-value-normal">{formatNumber(lb.totalKm, 0)}</div>
          </div>
          <div className="text-center">
              <div className="typo-label">Gesamtkosten</div>
              <div className="typo-value-normal">{formatNumber(lb.totalEur, 2)} €</div>
          </div>
          <div className="text-center">
              <div className="typo-label">Verbrauch</div>
              <div className="typo-value-normal">{formatNumber(lb.result?.consumption || 0, 1)} L</div>
          </div>
      </div>

      <div className="cg-master-inset cg-master-tabs p-1 overflow-x-auto hide-scrollbar">
      {['tank', 'fahrt', 'spots', 'archiv'].map(t => (
        <button key={t} onClick={() => lb.setLogType(t as any)} className={`cg-master-tab typo-label ${lb.logType === t ? 'cg-master-tab-active' : ''}`}>{t === 'tank' ? 'Tanken' : t === 'spots' ? "POIs" : t === 'fahrt' ? 'Fahrten' : t}</button>
      ))}
      </div>

      {lb.logType === 'tank' && lb.currentFuelLog.length >= 2 && lb.fuelStats.tankKm != null && lb.fuelStats.tankKm > 0 && (
        <div className="cg-master-inset p-2.5 mb-3 flex justify-between items-center text-center">
          <div>
            <div className="typo-label text-[var(--text-muted)]">Ø VERBRAUCH</div>
            <div className="typo-value-normal">{lb.fuelStats.averageConsumption != null ? `${formatNumber(lb.fuelStats.averageConsumption, 1)} L/100` : '—'}</div>
          </div>
          <div>
            <div className="typo-label text-[var(--text-muted)]">Ø PREIS/L</div>
            <div className="typo-value-normal">{lb.fuelStats.totalLiters > 0 ? `${formatNumber(lb.fuelStats.totalCost / lb.fuelStats.totalLiters, 2)} €` : '—'}</div>
          </div>
          <div>
            <div className="typo-label text-[var(--text-muted)]">KOSTEN/KM</div>
            <div className="typo-value-normal">{lb.fuelStats.tankKm > 0 ? `${formatNumber(lb.fuelStats.totalCost / lb.fuelStats.tankKm, 2)} €` : '—'}</div>
          </div>
        </div>
      )}

      {lb.logType === 'tank' && (
        <LogbuchTankList
          currentFuelLog={lb.currentFuelLog}
          setTankForm={lb.setTankForm}
          setEditingTripId={lb.setEditingTripId}
          setIsAdding={lb.setIsAdding}
        />
      )}

      {lb.logType === 'fahrt' && (
        <LogbuchTripList
          state={state}
          setState={setState}
          tripLogMode={lb.tripLogMode}
          setTripLogMode={lb.setTripLogMode}
          currentTripLog={lb.currentTripLog}
          currentBusinessTripLog={lb.currentBusinessTripLog}
          displayedTripsCount={lb.displayedTripsCount}
          setDisplayedTripsCount={lb.setDisplayedTripsCount}
          displayedBusinessTripsCount={lb.displayedBusinessTripsCount}
          setDisplayedBusinessTripsCount={lb.setDisplayedBusinessTripsCount}
          setTripForm={lb.setTripForm}
          setBusinessTripForm={lb.setBusinessTripForm}
          setEditingTripId={lb.setEditingTripId}
          setIsAdding={lb.setIsAdding}
        />
      )}

      {lb.logType === 'spots' && (
        <LogbuchSpotList
          state={state}
          setState={setState}
          spots={state.spots}
          SPOT_COLORS={SPOT_COLORS}
          downloadGPX={lb.downloadGPX}
          setSpotForm={lb.setSpotForm}
          setEditingSpotId={lb.setEditingSpotId}
          setSpotGpsError={lb.setSpotGpsError}
          setIsAdding={lb.setIsAdding}
        />
      )}

      {lb.logType === 'archiv' && (
        <LogbuchArchiveCreate
          state={state}
          archiveSelection={lb.archiveSelection}
          setArchiveSelection={lb.setArchiveSelection}
          tripArchiveName={lb.tripArchiveName}
          setTripArchiveName={lb.setTripArchiveName}
          tripArchiveFrom={lb.tripArchiveFrom}
          setTripArchiveFrom={lb.setTripArchiveFrom}
          tripArchiveTo={lb.tripArchiveTo}
          setTripArchiveTo={lb.setTripArchiveTo}
          createTripArchive={lb.createTripArchive}
          fuelArchiveMode={lb.fuelArchiveMode}
          setFuelArchiveMode={lb.setFuelArchiveMode}
          fuelArchiveRange={lb.fuelArchiveRange}
          setFuelArchiveRange={lb.setFuelArchiveRange}
          createFuelArchive={lb.createFuelArchive}
          tripArchiveMode={lb.tripArchiveMode}
          setTripArchiveMode={lb.setTripArchiveMode}
          tripArchiveRange={lb.tripArchiveRange}
          setTripArchiveRange={lb.setTripArchiveRange}
          createTripLogArchive={lb.createTripLogArchive}
          businessArchiveMode={lb.businessArchiveMode}
          setBusinessArchiveMode={lb.setBusinessArchiveMode}
          businessArchiveRange={lb.businessArchiveRange}
          setBusinessArchiveRange={lb.setBusinessArchiveRange}
          createBusinessTripArchive={lb.createBusinessTripArchive}
          spotsArchiveMode={lb.spotsArchiveMode}
          setSpotsArchiveMode={lb.setSpotsArchiveMode}
          spotsArchiveRange={lb.spotsArchiveRange}
          setSpotsArchiveRange={lb.setSpotsArchiveRange}
          createSpotsArchive={lb.createSpotsArchive}
          setSelectedArchive={lb.setSelectedArchive}
          setArchiveViewTab={lb.setArchiveViewTab}
        />
      )}

      {(lb.logType === 'tank' || lb.logType === 'fahrt' || lb.logType === 'spots') && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md h-9 z-40 pointer-events-none flex items-center justify-center">
              <div className="pointer-events-auto absolute right-4 bottom-0">
                  <button 
                    onClick={() => { 
                        const highestKm = lb.getLastKnownKm();
                        if (lb.logType === 'tank') {
                            lb.setTankForm((f: FuelEntry) => ({...f, date: new Date().toISOString().split('T')[0], km: highestKm > 0 ? highestKm.toString() : ''})); 
                        } else if (lb.logType === 'fahrt') {
                            lb.setTripForm((f: FuelEntry) => ({...f, date: new Date().toISOString().split('T')[0], fromKm: highestKm > 0 ? highestKm.toString() : '', toKm: '', destination: '', purpose: '', category: '', note: ''}));
                            lb.setBusinessTripForm((f: FuelEntry) => ({...f, date: new Date().toISOString().split('T')[0], departureTime: '', arrivalTime: '', fromKm: highestKm > 0 ? highestKm.toString() : '', toKm: '', driver: '', category: 'Dienstlich', street: '', houseNumber: '', zip: '', city: '', purpose: '', businessPartner: '', note: ''}));
                        } else if (lb.logType === 'spots') {
                            lb.setSpotForm((f: FuelEntry) => ({...f, date: new Date().toISOString().split('T')[0], name: '', lat: '', lng: '', note: '', category: 'Stellplatz'}));
                            lb.setSpotGpsError(false);
                        }
                        lb.setEditingTripId(null);
                        lb.setEditingSpotId(null);
                        lb.setIsAdding(true); 
                    }} 
                    className="cg-master-button h-9 px-5 rounded-full flex flex-row items-center justify-center shadow-2xl border border-[var(--accent-dark)]"
                  >
                    <Plus size={20} strokeWidth={3} className="text-[var(--accent)]" />
                  </button>
              </div>
          </div>
      )}

      <AnimatePresence>
        <LogbuchArchiveDetail
          selectedArchive={lb.selectedArchive}
          setSelectedArchive={lb.setSelectedArchive}
          archiveViewTab={lb.archiveViewTab}
          setArchiveViewTab={lb.setArchiveViewTab}
          deleteArchive={lb.deleteArchive}
        />
      </AnimatePresence>

      <AnimatePresence>
        <LogbuchAddModal
          isAdding={lb.isAdding}
          setIsAdding={lb.setIsAdding}
          isConfirmingBusinessTrip={lb.isConfirmingBusinessTrip}
          setIsConfirmingBusinessTrip={lb.setIsConfirmingBusinessTrip}
          logType={lb.logType}
          tripLogMode={lb.tripLogMode}
          tankForm={lb.tankForm}
          setTankForm={lb.setTankForm}
          handleTankChange={lb.handleTankChange}
          focusedTankField={lb.focusedTankField}
          setFocusedTankField={lb.setFocusedTankField}
          isKmValid={lb.isKmValid}
          isLitersValid={lb.isLitersValid}
          isPriceValid={lb.isPriceValid}
          minKm={lb.minKm}
          maxKm={lb.maxKm}
          tripForm={lb.tripForm}
          setTripForm={lb.setTripForm}
          businessTripForm={lb.businessTripForm}
          setBusinessTripForm={lb.setBusinessTripForm}
          isTripValid={lb.isTripValid}
          isBusinessTripValid={lb.isBusinessTripValid}
          isBusinessTripPurposeValid={lb.isBusinessTripPurposeValid}
          isBusinessTripDriverValid={lb.isBusinessTripDriverValid}
          isBusinessTripCategoryValid={lb.isBusinessTripCategoryValid}
          isBusinessTripToday={lb.isBusinessTripToday}
          tripGpsCoords={lb.tripGpsCoords}
          tripGpsStatus={lb.tripGpsStatus}
          spotForm={lb.spotForm}
          setSpotForm={lb.setSpotForm}
          spotCategoryOpen={lb.spotCategoryOpen}
          setSpotCategoryOpen={lb.setSpotCategoryOpen}
          spotGpsError={lb.spotGpsError}
          setSpotGpsError={lb.setSpotGpsError}
          getPosition={lb.getPosition}
          editingTripId={lb.editingTripId}
          setEditingTripId={lb.setEditingTripId}
          editingSpotId={lb.editingSpotId}
          setEditingSpotId={lb.setEditingSpotId}
          getLastKnownKm={lb.getLastKnownKm}
          state={state}
          setState={setState}
        />
      </AnimatePresence>
      </div>

      <LogbuchPrintViews
        logType={lb.logType}
        tripLogMode={lb.tripLogMode}
        selectedArchive={lb.selectedArchive}
        archiveViewTab={lb.archiveViewTab}
        printFuelLog={lb.printFuelLog}
        printTripLog={lb.printTripLog}
        printBusinessTripLog={lb.printBusinessTripLog}
        printSpots={lb.printSpots}
        printTitle={lb.printTitle}
        printDateRange={lb.printDateRange}
        currentFuelLog={lb.currentFuelLog}
        currentTripLog={lb.currentTripLog}
        currentBusinessTripLog={lb.currentBusinessTripLog}
        totalLiters={lb.totalLiters}
        totalEur={lb.totalEur}
        totalKm={lb.totalKm}
        result={lb.result}
        currentYear={lb.currentYear}
        state={state}
      />
    </>
  );
}
