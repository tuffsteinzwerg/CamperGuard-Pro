import React from 'react';

interface PrintHeaderProps {
    title: string;
    vehicleName?: string;
    plate?: string;
    dateRange?: string;
    createdDate?: string;
}

export function PrintHeader({ title, vehicleName = "Camper", plate, dateRange, createdDate }: PrintHeaderProps) {
    const formattedVehicle = [
        vehicleName?.toUpperCase(),
        plate?.toUpperCase()
    ].filter(Boolean).join(' ');

    const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    return (
        <>
            <div className="cg-print-header-wrapper" style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: 'none', paddingBottom: '4px', marginBottom: '4px', minHeight: '18mm', width: '100%' }}>
                
                {/* Logo Area */}
                <div style={{ flex: '0 0 auto', display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
                    <img src="/CGProLogo.png" alt="CamperGuard Pro" className="cg-print-logo" style={{ height: '16mm', width: 'auto', display: 'block', objectFit: 'contain' }} />
                </div>
                
                {/* Center Title and Vehicle Area */}
                <div className="cg-print-header-center" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    <div className="cg-print-header-title">{title}</div>
                    <div className="cg-print-header-vehicle">{formattedVehicle}</div>
                </div>

                {/* Right Area — Zeitraum + Erstellt am */}
                <div className="cg-print-header-right" style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right', gap: '1px' }}>
                    {dateRange && (
                        <>
                            <div className="cg-print-header-meta-label">Zeitraum:</div>
                            <div className="cg-print-header-meta-value">{dateRange}</div>
                        </>
                    )}
                    <div className="cg-print-header-meta-label" style={{ marginTop: dateRange ? '3px' : '0' }}>Erstellt am:</div>
                    <div className="cg-print-header-meta-value">{createdDate || today}</div>
                </div>
            </div>

            <div className="cg-print-footer hidden print-only">
                <span className="cg-print-footer-text">CamperGuard Pro – Smart, sicher, unterwegs.</span>
                <span className="cg-print-footer-text cg-print-footer-page"></span>
            </div>
        </>
    );
}
