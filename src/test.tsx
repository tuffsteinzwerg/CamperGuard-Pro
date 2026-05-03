import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

const App = () => {
    const [tankForm, setTankForm] = useState({ km: '' });
    return (
        <div>
           <input 
              name="km"
              type="number"
              value={tankForm.km}
              onChange={(e) => setTankForm({ km: e.target.value })}
              onBlur={(e) => {
                  if (e.target.value) {
                      e.target.type = 'text';
                      e.target.value = parseFloat(tankForm.km).toLocaleString('de-DE');
                  }
              }}
              onFocus={(e) => {
                  e.target.type = 'number';
                  e.target.value = tankForm.km;
              }}
           />
           <button onClick={() => setTankForm(f => ({...f}))}>Force Update</button>
        </div>
    );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
