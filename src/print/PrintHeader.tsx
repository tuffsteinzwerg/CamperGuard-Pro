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
            <div className="cg-print-header-wrapper" style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: 'none', paddingBottom: '2px', marginBottom: '2px', minHeight: '13mm', width: '100%' }}>
                
                {/* Logo Area */}
                <div style={{ flex: '0 0 auto', display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
                    <img src="/CGProLogo.png" alt="CamperGuard Pro" style={{ height: '11mm', width: 'auto', display: 'block', objectFit: 'contain' }} />
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

            <style>{`
                @media print {
                    .cg-print-header-wrapper {
                        display: flex !important;
                        position: relative !important;
                        border-bottom: none !important;
                        width: 100% !important;
                        padding-bottom: 2px !important;
                        margin-bottom: 2px !important;
                        align-items: flex-start !important;
                        background: transparent !important;
                        min-height: 13mm !important;
                    }
                    .cg-print-header-center {
                        position: absolute !important;
                        left: 50% !important;
                        top: 50% !important;
                        transform: translate(-50%, -50%) !important;
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: center !important;
                        text-align: center !important;
                    }
                    .cg-print-header-title {
                        font-size: 18pt !important;
                        font-weight: 900 !important;
                        color: #111 !important;
                        text-transform: uppercase !important;
                        letter-spacing: 2px !important;
                        line-height: 1.1 !important;
                        font-family: sans-serif !important;
                        text-align: center !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .cg-print-header-vehicle {
                        font-size: 9pt !important;
                        color: #666 !important;
                        font-weight: 500 !important;
                        text-transform: uppercase !important;
                        letter-spacing: 0.5px !important;
                        line-height: 1.4 !important;
                        font-family: sans-serif !important;
                        text-align: center !important;
                        margin-top: 3px !important;
                        margin-bottom: 0 !important;
                        padding: 0 !important;
                    }
                    .cg-print-header-right {
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: flex-end !important;
                        text-align: right !important;
                    }
                    .cg-print-header-meta-label {
                        font-size: 7pt !important;
                        color: #999 !important;
                        font-family: sans-serif !important;
                        line-height: 1.3 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .cg-print-header-meta-value {
                        font-size: 9.5pt !important;
                        color: #111 !important;
                        font-weight: 700 !important;
                        font-family: sans-serif !important;
                        line-height: 1.3 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .cg-print-footer {
                        display: flex !important;
                        position: fixed !important;
                        bottom: 0 !important;
                        left: 0 !important;
                        right: 0 !important;
                        border-top: 1px solid #e0e0e0 !important;
                        padding: 4px 0 6px 0 !important;
                        justify-content: space-between !important;
                        background: white !important;
                        z-index: 100 !important;
                        margin: 0 !important;
                    }
                    .cg-print-footer-text {
                        font-size: 7pt !important;
                        color: #999 !important;
                        font-weight: normal !important;
                        line-height: 1.2 !important;
                        font-family: sans-serif !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        text-transform: none !important;
                        border: none !important;
                        background: transparent !important;
                    }
                    .cg-print-footer-page::after {
                        content: "Seite " counter(page) " von " counter(pages) !important;
                    }
                    body {
                        padding-bottom: 25px !important;
                    }
                }
            `}</style>
        </>
    );
}
