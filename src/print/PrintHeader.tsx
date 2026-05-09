import React from 'react';

interface PrintHeaderProps {
    title: string;
    vehicleName?: string;
    plate?: string;
}

export function PrintHeader({ title, vehicleName = "Camper", plate }: PrintHeaderProps) {
    return (
        <>
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'nowrap', borderBottom: '1px solid #000', paddingBottom: '4px', marginBottom: '8px', minHeight: '22mm' }}>
                <div style={{ flex: '0 0 auto' }}>
                    <img src="/CGProLogo.png" alt="CamperGuard Pro" style={{ height: '20mm', width: 'auto', display: 'block', objectFit: 'contain' }} />
                </div>
                
                <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: '4px' }}>
                    <span style={{ fontSize: '22pt', fontWeight: 'bold', letterSpacing: '0.5px', textTransform: 'uppercase', color: '#000' }}>{title}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', paddingBottom: '2px', flex: '0 0 auto' }}>
                    <span style={{ fontWeight: 'normal', fontSize: '8pt', color: '#666' }}>
                        {vehicleName}{plate ? ` ${plate}` : ''}
                    </span>
                </div>
            </div>

            <div className="cg-print-footer hidden print-only" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', fontSize: '8pt', paddingTop: '4px', borderTop: '1px solid #ccc', backgroundColor: 'transparent', zIndex: 100, color: '#666' }}>
                <span>CamperGuard Pro</span>
                <span style={{ fontSize: '6pt', color: '#999' }}>gedruckt am {new Date().toLocaleDateString('de-DE')}</span>
            </div>

            <style>{`
                @media print {
                    .cg-print-footer {
                        display: flex !important;
                        position: fixed !important;
                        bottom: 0 !important;
                    }
                    /* Ensure content doesn't collide with fixed footer */
                    body {
                        padding-bottom: 30px !important;
                    }
                }
            `}</style>
        </>
    );
}
