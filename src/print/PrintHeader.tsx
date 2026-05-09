import React from 'react';

interface PrintHeaderProps {
    title: string;
    vehicleName?: string;
    plate?: string;
}

export function PrintHeader({ title, vehicleName = "Camper", plate }: PrintHeaderProps) {
    const formattedVehicle = [
        vehicleName?.toUpperCase(),
        plate?.toUpperCase()
    ].filter(Boolean).join(' ');

    return (
        <>
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'nowrap', borderBottom: '1px solid #000', paddingBottom: '4px', marginBottom: '8px', minHeight: '22mm' }}>
                <div style={{ flex: '0 0 auto' }}>
                    <img src="/CGProLogo.png" alt="CamperGuard Pro" style={{ height: '20mm', width: 'auto', display: 'block', objectFit: 'contain' }} />
                </div>
                
                <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: '4px' }}>
                    <span className="cg-print-header-title" style={{ fontSize: '13pt', fontWeight: '500', letterSpacing: '1px', textTransform: 'uppercase', color: '#333', fontFamily: 'sans-serif' }}>{title}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', paddingBottom: '2px', flex: '0 0 auto' }}>
                    <span className="cg-print-header-vehicle" style={{ fontWeight: 'normal', fontSize: '8pt', color: '#666', fontFamily: 'sans-serif' }}>
                        {formattedVehicle}
                    </span>
                </div>
            </div>

            <div className="cg-print-footer hidden print-only" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', fontSize: '7pt', paddingTop: '4px', borderTop: '1px solid #ccc', backgroundColor: 'transparent', zIndex: 100, color: '#888' }}>
                <span className="cg-print-footer-text" style={{ fontSize: '7pt', color: '#888', fontWeight: 'normal', fontFamily: 'sans-serif' }}>CamperGuard Pro</span>
                <span className="cg-print-footer-text" style={{ fontSize: '7pt', color: '#888', fontWeight: 'normal', fontFamily: 'sans-serif' }}>gedruckt am {new Date().toLocaleDateString('de-DE')}</span>
            </div>

            <style>{`
                @media print {
                    .cg-print-header-title {
                        font-size: 13pt !important;
                        font-weight: 500 !important;
                        color: #333 !important;
                        text-transform: uppercase !important;
                        letter-spacing: 1px !important;
                        line-height: 1.2 !important;
                    }
                    .cg-print-header-vehicle {
                        font-size: 8pt !important;
                        color: #666 !important;
                        font-weight: normal !important;
                        line-height: 1.2 !important;
                    }
                    .cg-print-footer-text {
                        font-size: 7pt !important;
                        color: #888 !important;
                        font-weight: normal !important;
                        line-height: 1.2 !important;
                    }
                    .cg-print-footer {
                        display: flex !important;
                        position: fixed !important;
                        bottom: 0 !important;
                        left: 0 !important;
                        right: 0 !important;
                        border-top: 1px solid #e5e5e5 !important;
                        padding-top: 4px !important;
                    }
                    /* Ensure content doesn't collide with fixed footer */
                    body {
                        padding-bottom: 25px !important;
                    }
                }
            `}</style>
        </>
    );
}

