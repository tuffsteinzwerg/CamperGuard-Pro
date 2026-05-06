import React from 'react';

interface PrintHeaderProps {
    title: string;
    vehicleName?: string;
}

export function PrintHeader({ title, vehicleName = "Camper" }: PrintHeaderProps) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'nowrap', gap: '5mm', borderBottom: '1px solid #000', paddingBottom: '2px', marginBottom: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', flex: '0 0 auto' }}>
                <img src="/CGProLogo.png" alt="CamperGuard Pro" style={{ height: '20mm', width: 'auto', display: 'block', objectFit: 'contain' }} />
            </div>
            <div style={{ flex: '1 1 auto', textAlign: 'center', paddingBottom: '2px' }}>
                <span style={{ fontSize: '14pt', fontWeight: 'bold', letterSpacing: '0.5px' }}>{title}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', whiteSpace: 'nowrap', fontSize: '8pt', paddingBottom: '2px', flex: '0 0 auto', lineHeight: '1.4' }}>
                <span style={{ fontWeight: 'bold' }}>{vehicleName}</span>
                <span>{new Date().toLocaleDateString('de-DE')}</span>
            </div>
        </div>
    );
}
