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
            <div className="cg-print-header-wrapper">
                
                {/* Logo Area */}
                <div className="cg-print-header-logo-area">
                    <img src="/g4c-druck-bunt-tp.png" alt="Guard4Campers" className="cg-print-logo" />
                </div>
                
                {/* Center Title and Vehicle Area */}
                <div className="cg-print-header-center">
                    <div className="cg-print-header-title">{title}</div>
                    <div className="cg-print-header-vehicle">{formattedVehicle}</div>
                </div>

                {/* Right Area — Zeitraum + Erstellt am */}
                <div className="cg-print-header-right">
                    {dateRange && (
                        <>
                            <div className="cg-print-header-meta-label">Zeitraum:</div>
                            <div className="cg-print-header-meta-value">{dateRange}</div>
                        </>
                    )}
                    <div className={`cg-print-header-meta-label${dateRange ? ' cg-print-header-meta-label-spaced' : ''}`}>Erstellt am:</div>
                    <div className="cg-print-header-meta-value">{createdDate || today}</div>
                </div>
            </div>

            <div className="cg-print-footer hidden print-only">
                <span className="cg-print-footer-text">Guard4Campers – Smart, sicher, unterwegs.</span>
                <span className="cg-print-footer-text cg-print-footer-page"></span>
            </div>
        </>
    );
}
