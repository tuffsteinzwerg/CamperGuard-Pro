import type { ReactNode } from 'react';
import { motion } from 'motion/react';

type NavButtonProps = {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
};

export function NavButton({ active, onClick, icon, label }: NavButtonProps) {
  return (
    <button onClick={onClick} className={`flex-1 flex flex-col items-center gap-1 transition-all ${active ? 'text-[var(--accent)]' : 'text-white/60 hover:text-white'}`}>
      <motion.div animate={active ? { scale: 1.1 } : { scale: 1 }}>{icon}</motion.div>
      <span className="typo-label" style={{ fontSize: '9px', color: 'inherit' }}>{label}</span>
      {active && <motion.div layoutId="nav-indicator" className="w-4 h-0.5 bg-[var(--accent)] mt-1" />}
    </button>
  );
}
