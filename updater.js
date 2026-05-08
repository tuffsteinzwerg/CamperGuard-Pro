const fs = require('fs');

let text = fs.readFileSync('/src/App.tsx', 'utf8');

text = text.replace('CamperGuard Pro v0.1.3-dev\n        </div>', 'CamperGuard Pro v0.1.4-dev\n        </div>');
text = text.replace('>CamperGuard Pro v0.1.3-dev</h2>', '>CamperGuard Pro v0.1.4-dev</h2>');
text = text.replace('Stand: 05.05.2026</p>', 'Stand: 08.05.2026</p>');

const newBlock = `                 <h3 className="font-bold mb-2 text-[var(--accent)]">Änderungen v0.1.4-dev:</h3>
                 <ul className="space-y-1 text-gray-300 mb-6">
                    <li>470. Leerer Apotheken-Entwurf wird beim Klick auf „Fertig" verworfen und der Editor geschlossen.</li>
                    <li>469. Apotheken-Entwürfe mit fehlendem Medikament oder Verfallsdatum bleiben beim Klick auf „Fertig" geöffnet.</li>
                    <li>468. Apotheken-Warnhinweis wird nur noch bei teilweise ausgefüllten ungültigen Einträgen angezeigt.</li>
                    <li>467. Mehrfaches Plus bei komplett leerem Apotheken-Entwurf öffnet den vorhandenen Entwurf statt neue leere Medikamente zu erzeugen.</li>
                    <li>466. Leerer SOS-Ausrüstungs-Entwurf wird beim Klick auf „Fertig" verworfen und der Editor geschlossen.</li>
                    <li>465. SOS-Ausrüstungs-Entwürfe ohne Namen bleiben beim Klick auf „Fertig" geöffnet.</li>
                    <li>464. Warnhinweis „Name der Ausrüstung ausfüllen." im SOS-Ausrüstungseditor ergänzt.</li>
                    <li>463. Namensfeld für eigene SOS-Ausrüstung im Bearbeitungsbereich ergänzt.</li>
                    <li>462. Mehrfaches Plus bei komplett leerem SOS-Ausrüstungs-Entwurf öffnet den vorhandenen Entwurf statt neue leere Ausrüstung zu erzeugen.</li>
                    <li>461. StatusView als erste große View aus src/App.tsx nach src/views/StatusView.tsx ausgelagert.</li>
                    <li>460. StatusView wird in src/App.tsx nun importiert statt lokal definiert.</li>
                    <li>459. StatusView-Aufruf im Main-Render unverändert beibehalten.</li>
                    <li>458. navigator.geolocation-Logik der StatusView unverändert in die neue View-Datei übernommen.</li>
                    <li>457. window.confirm-Logik der StatusView unverändert in die neue View-Datei übernommen.</li>
                    <li>456. Hooks, State-Namen, Handler und JSX-Struktur der StatusView unverändert übernommen.</li>
                    <li>455. src/App.tsx durch StatusView-Auslagerung um ca. 1000 Zeilen reduziert.</li>
                    <li>454. Leaflet-Icon-Setup nach src/lib/setupLeafletIcons.ts ausgelagert.</li>
                    <li>453. Leaflet-Icon-Workaround aus src/App.tsx entfernt.</li>
                    <li>452. Side-Effect-Import für setupLeafletIcons in src/App.tsx ergänzt.</li>
                    <li>451. Leaflet-CSS-Import unverändert in src/App.tsx belassen.</li>
                    <li>450. globalLeafletMap-Typisierung über import L from 'leaflet' unverändert beibehalten.</li>
                    <li>449. Ungenutzte lokale Komponente ViewTitle aus src/App.tsx entfernt.</li>
                    <li>448. Ungenutzte lokale Komponente Card aus src/App.tsx entfernt.</li>
                    <li>447. NavButton nach src/components/NavButton.tsx ausgelagert.</li>
                    <li>446. Lokale NavButton-Definition aus src/App.tsx entfernt.</li>
                    <li>445. NavButton-Aufrufe im unteren Hauptmenü unverändert beibehalten.</li>
                    <li>444. motion/react als korrekter Import für ausgelagerten NavButton bestätigt.</li>
                    <li>443. formatNumber nach src/lib/formatters.ts ausgelagert.</li>
                    <li>442. formatWeight nach src/lib/formatters.ts ausgelagert.</li>
                    <li>441. normalizeGearName nach src/lib/formatters.ts ausgelagert.</li>
                    <li>440. Lokale Formatter-Definitionen aus src/App.tsx entfernt.</li>
                    <li>439. Tank- und Verbrauchsberechnung nach src/lib/fuelCalculator.ts ausgelagert.</li>
                    <li>438. calculateFuelConsumptionSegments ausgelagert.</li>
                    <li>437. calculateAverageFuelConsumptionFromFuelLog ausgelagert.</li>
                    <li>436. calculateFuelLogStats ausgelagert.</li>
                    <li>435. Lokale Fuel-Calculator-Funktionen aus src/App.tsx entfernt.</li>
                    <li>434. Höhenkorrektur auf praxisnahe Unterlegwerte je Rad umgestellt.</li>
                    <li>433. Höchste berechnete Fahrzeugecke als Referenz für Unterlegwerte verwendet.</li>
                    <li>432. Höhenkorrekturwerte auf ganze Zentimeter gerundet.</li>
                    <li>431. Nachkommastellen in der Höhenkorrektur entfernt.</li>
                    <li>430. Höhenkorrektur-Anzeige bei fehlender Spurbreite oder fehlendem Achsabstand deaktiviert.</li>
                    <li>429. Hinweistext für fehlende Fahrwerksmaße im Reise-Tab ergänzt.</li>
                    <li>428. Falsche 0-cm-Anzeige bei unvollständigen Fahrwerksdaten vermieden.</li>
                    <li>427. Höhenkorrektur-Zahlenanzeige lesbarer gemacht.</li>
                    <li>426. Transparenter Gradient-Text der Höhenkorrekturwerte entfernt.</li>
                    <li>425. Textshadow der Höhenkorrekturwerte reduziert.</li>
                    <li>424. Schriftgröße und cm-Label der Höhenkorrektur kompakter dargestellt.</li>
                    <li>423. Tabular-Nums für Höhenkorrekturwerte ergänzt.</li>
                    <li>422. Profil-Hilfstext für Spurbreite auf „links ↔ rechts" gekürzt.</li>
                    <li>421. Profil-Hilfstext für Achsabstand auf „vorne ↔ hinten" gekürzt.</li>
                    <li>420. Fahrwerksfelder im Profil optisch beruhigt.</li>
                    <li>419. CSS-Import-Reihenfolge in src/index.css korrigiert.</li>
                    <li>418. Google-Fonts-Import vor Tailwind-Import verschoben.</li>
                    <li>417. Leaflet-CSS-Import vor Tailwind-Import verschoben.</li>
                    <li>416. @import-Build-Warnungen vollständig behoben.</li>
                    <li>415. public/CGProLogo.png als festes Projekt-Asset ergänzt.</li>
                    <li>414. Drucklogo über den bestehenden Vite-Public-Pfad /CGProLogo.png verfügbar gemacht.</li>
                    <li>413. Kein zusätzlicher Logo-Import im App-Code notwendig gemacht.</li>
                    <li>412. Alte Root-Patch-, Analyse- und Hilfsdateien in _archive-root-cleanup archiviert.</li>
                    <li>411. Archivordner _archive-root-cleanup als Projekt-Hygiene-Maßnahme eingeführt.</li>
                    <li>410. tsconfig.json um Ausschluss von _archive-root-cleanup ergänzt.</li>
                    <li>409. dist und node_modules weiterhin vom TypeScript-Check ausgeschlossen.</li>
                    <li>408. CSS-Import-Warnungen nach Build-Korrektur erfolgreich geprüft.</li>
                    <li>407. Fuel-Calculator-Auslagerung erfolgreich mit npm run lint geprüft.</li>
                    <li>406. Fuel-Calculator-Auslagerung erfolgreich mit npm run build geprüft.</li>
                    <li>405. Formatter-Auslagerung erfolgreich mit npm run lint geprüft.</li>
                    <li>404. Formatter-Auslagerung erfolgreich mit npm run build geprüft.</li>
                    <li>403. NavButton-Auslagerung erfolgreich mit npm run lint und npm run build geprüft.</li>
                    <li>402. Leaflet-Icon-Setup-Auslagerung erfolgreich mit npm run lint und npm run build geprüft.</li>
                    <li>401. StatusView-Auslagerung und Safety-Hub-Fix erfolgreich mit npm run lint und npm run build geprüft.</li>
                 </ul>\n`;

text = text.replace('<h3 className="font-bold mb-2 text-[var(--accent)]">Änderungen v0.1.3-dev:</h3>', newBlock + '                 <h3 className="font-bold mb-2 text-[var(--accent)]">Änderungen v0.1.3-dev:</h3>');

const blockMatch = text.match(/<h3 className="font-bold mb-2">Änderungen v0\.1\.0-dev:<\/h3>\n                 <ul className="space-y-1 text-gray-300">\n(?:.*?\n)+\s*<\/ul>/);

if (blockMatch) {
    const oldChunk = blockMatch[0];
    const lines = oldChunk.split('\n');
    const lis = [];
    for (const l of lines) {
        if (l.trim().startsWith('<li>')) {
            lis.push(l);
        }
    }
    lis.reverse();
    // find index where lis started
    let resultLines = [];
    let liIndex = 0;
    for (const l of lines) {
        if (l.trim().startsWith('<li>')) {
            resultLines.push(lis[liIndex]);
            liIndex++;
        } else {
            resultLines.push(l);
        }
    }
    
    const newChunk = resultLines.join('\n');
    text = text.replace(oldChunk, newChunk);
} else {
    console.error("v0.1.0-dev block not found");
}

fs.writeFileSync('/src/App.tsx', text, 'utf8');
