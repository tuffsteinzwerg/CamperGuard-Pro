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
            <div className="cg-print-header-wrapper" style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ccc', paddingBottom: '8px', marginBottom: '15px', minHeight: '20mm', width: '100%' }}>
                
                {/* Logo Area */}
                <div style={{ flex: '1', display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
                    <img src="/CGProLogo.png" alt="CamperGuard Pro" style={{ height: '16mm', width: 'auto', display: 'block', objectFit: 'contain' }} />
                </div>
                
                {/* Center Title and Vehicle Area */}
                <div className="cg-print-header-center" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    <div className="cg-print-header-title">{title}</div>
                    <div className="cg-print-header-vehicle">{formattedVehicle}</div>
                </div>

                {/* Right Area (empty) */}
                <div style={{ flex: '1' }}></div>
            </div>

            <div className="cg-print-footer hidden print-only">
                <span className="cg-print-footer-text">CamperGuard Pro</span>
                <span className="cg-print-footer-text">gedruckt am {new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
            </div>

            <style>{`
                @media print {
                    .cg-print-header-wrapper {
                        display: flex !important;
                        position: relative !important;
                        border-bottom: 1px solid #ccc !important;
                        width: 100% !important;
                        padding-bottom: 8px !important;
                        margin-bottom: 15px !important;
                        align-items: center !important;
                        background: transparent !important;
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
                        font-size: 19pt !important;
                        font-weight: 700 !important;
                        color: #222 !important;
                        text-transform: uppercase !important;
                        letter-spacing: 1px !important;
                        line-height: 1.2 !important;
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
                        margin-top: 2px !important;
                        margin-bottom: 0 !important;
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
                        background: transparent !important;
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
                    /* Ensure content doesn't collide with fixed footer */
                    body {
                        padding-bottom: 25px !important;
                    }
                }
            `}</style>
        </>
    );
}

