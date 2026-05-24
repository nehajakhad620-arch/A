import React from 'react';
import { Shield, Hammer, Zap, Key, ArrowUp, RefreshCw, Trophy } from 'lucide-react';
import { SanctuaryUpgrade } from '../types';

interface SanctuaryBuilderProps {
  upgrades: SanctuaryUpgrade[];
  baseType: 'Sanctuary Bus' | 'Underground Vault' | 'Ruined City Block';
  materials: number;
  onUpgrade: (upgradeId: string) => void;
  onBaseTypeChange: (type: 'Sanctuary Bus' | 'Underground Vault' | 'Ruined City Block') => void;
  onAddMaterials: (amount: number) => void;
}

export default function SanctuaryBuilder({
  upgrades,
  baseType,
  materials,
  onUpgrade,
  onBaseTypeChange,
  onAddMaterials
}: SanctuaryBuilderProps) {

  // Get current values
  const wall = upgrades.find(u => u.id === 'up_wall')!;
  const turret = upgrades.find(u => u.id === 'up_turret')!;
  const lab = upgrades.find(u => u.id === 'up_lab')!;

  const baseDetails = {
    'Sanctuary Bus': {
      desc: "A reinforced mobile steel 'Battle Bus' that roams the radioactive highway routes. Enables fast exploration and easily localized scavenge maneuvers.",
      efficiency: "High Mobility (+15% speed in monsoon hazards)",
      icon: "🚌"
    },
    'Underground Vault': {
      desc: "A secure radioactive-sheltered nuclear bunker buried under 20 meters of packed granite. Ultimate defensive perimeter from heavy fire mutations.",
      efficiency: "High Defense (+30% flat starter HP bounds)",
      icon: "🛡️"
    },
    'Ruined City Block': {
      desc: "A decaying high-neon commercial district guarded by makeshift scrap barricades. Perfect central marketplace node for trading alloy parts.",
      efficiency: "High Resource rate (+25% alloys collected)",
      icon: "🏢"
    }
  }[baseType];

  return (
    <div id="sanctuary-builder-card" className="border border-slate-800/80 bg-slate-900 rounded-xl overflow-hidden shadow-xl flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950/80 border-b border-slate-800">
        <h3 className="font-sans font-bold text-sm text-slate-100 uppercase font-mono tracking-tight flex items-center gap-2">
          <Hammer className="h-4 w-4 text-amber-500" /> Sanctuary Restorer metagame
        </h3>
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono text-slate-400">RUSTED ALLOYS:</span>
          <span className="px-2 py-0.5 bg-teal-500/10 border border-teal-500/20 text-teal-400 font-mono text-xs font-bold rounded">
            {materials} 🔩
          </span>
        </div>
      </div>

      {/* Main Base Hub */}
      <div className="p-4 bg-slate-950/20 border-b border-slate-800/50 flex-1 flex flex-col">
        <div className="mb-4">
          <label className="text-[10px] font-mono text-purple-400 block mb-1.5 uppercase tracking-wider">
            Select Metagame Base layout
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {(['Sanctuary Bus', 'Underground Vault', 'Ruined City Block'] as const).map((type) => (
              <button
                key={type}
                id={`base-type-select-${type.replace(/\s+/g, '-').toLowerCase()}`}
                onClick={() => onBaseTypeChange(type)}
                className={`py-2 p-1 rounded-xl border text-center transition-all cursor-pointer ${baseType === type ? 'border-purple-500/60 bg-purple-500/10 text-white shadow-md' : 'border-slate-800 hover:border-slate-700 bg-slate-900/60 text-slate-400'}`}
              >
                <div className="text-xl mb-0.5">{type === 'Sanctuary Bus' ? '🚌' : type === 'Underground Vault' ? '🚪' : '🏙️'}</div>
                <div className="text-[10px] font-semibold tracking-tight">{type}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Base Info Display */}
        <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-start gap-3 mb-4">
          <div className="text-3xl p-1 bg-slate-900 border border-slate-800 rounded-lg shrink-0">
            {baseDetails.icon}
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-tight flex items-center gap-1.5">
              Current Shelter: {baseType}
            </h4>
            <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
              {baseDetails.desc}
            </p>
            <div className="mt-1.5 inline-block text-[9px] font-mono text-purple-400 bg-purple-500/5 px-2 py-0.5 border border-purple-500/10 rounded-md">
              Special Advantage: <span className="text-purple-300 font-bold">{baseDetails.efficiency}</span>
            </div>
          </div>
        </div>

        {/* Level Up Progress List */}
        <div className="flex-1 space-y-2">
          <label className="text-[10px] font-mono text-slate-400 block mb-1 uppercase tracking-wider">
            Infrastructure Systems Upgrades
          </label>

          {/* Upgrade Wall */}
          <div className="p-3 bg-slate-900/80 hover:bg-slate-900 border border-slate-800/70 rounded-xl transition-all flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
                <Shield className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-100 uppercase tracking-tight flex items-center gap-1.5">
                  {wall.name} <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full font-mono border border-red-500/15">Lv.{wall.level}</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Effect: <span className="text-slate-300">{wall.effect} ({wall.currentValue})</span>
                </p>
              </div>
            </div>
            <button
              id={`upgrade-${wall.id}`}
              onClick={() => onUpgrade(wall.id)}
              disabled={materials < wall.cost || wall.level >= wall.maxLevel}
              className={`p-2 px-3 rounded-lg flex items-center gap-1 transition-all ${wall.level >= wall.maxLevel ? 'bg-slate-950 border border-slate-850 text-slate-600' : materials >= wall.cost ? 'bg-red-600 hover:bg-red-500 hover:shadow-md text-white cursor-pointer' : 'bg-slate-900 border border-slate-850 text-slate-500'}`}
            >
              {wall.level >= wall.maxLevel ? (
                <span className="text-[10.5px] font-mono font-bold uppercase">MAXED</span>
              ) : (
                <div className="flex flex-col items-end">
                  <span className="text-[10.5px] font-mono font-bold flex items-center gap-0.5"><ArrowUp className="h-3 w-3" /> UPGRADE</span>
                  <span className="text-[8px] font-mono text-slate-400 font-medium">{wall.cost} Alloys</span>
                </div>
              )}
            </button>
          </div>

          {/* Upgrade Turret */}
          <div className="p-3 bg-slate-900/80 hover:bg-slate-900 border border-slate-800/70 rounded-xl transition-all flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center">
                <Zap className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-100 uppercase tracking-tight flex items-center gap-1.5">
                  {turret.name} <span className="text-[10px] text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded-full font-mono border border-teal-500/15">Lv.{turret.level}</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Effect: <span className="text-slate-300">{turret.effect} ({turret.currentValue})</span>
                </p>
              </div>
            </div>
            <button
              id={`upgrade-${turret.id}`}
              onClick={() => onUpgrade(turret.id)}
              disabled={materials < turret.cost || turret.level >= turret.maxLevel}
              className={`p-2 px-3 rounded-lg flex items-center gap-1 transition-all ${turret.level >= turret.maxLevel ? 'bg-slate-950 border border-slate-850 text-slate-600' : materials >= turret.cost ? 'bg-teal-600 hover:bg-teal-550 hover:shadow-md text-white cursor-pointer' : 'bg-slate-900 border border-slate-850 text-slate-500'}`}
            >
              {turret.level >= turret.maxLevel ? (
                <span className="text-[10.5px] font-mono font-bold uppercase">MAXED</span>
              ) : (
                <div className="flex flex-col items-end">
                  <span className="text-[10.5px] font-mono font-bold flex items-center gap-0.5"><ArrowUp className="h-3 w-3" /> UPGRADE</span>
                  <span className="text-[8px] font-mono text-slate-400 font-medium">{turret.cost} Alloys</span>
                </div>
              )}
            </button>
          </div>

          {/* Upgrade Tech Lab */}
          <div className="p-3 bg-slate-900/80 hover:bg-slate-900 border border-slate-800/70 rounded-xl transition-all flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <Key className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-100 uppercase tracking-tight flex items-center gap-1.5">
                  {lab.name} <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded-full font-mono border border-purple-500/15">Lv.{lab.level}</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Effect: <span className="text-slate-300">{lab.effect} ({lab.currentValue})</span>
                </p>
              </div>
            </div>
            <button
              id={`upgrade-${lab.id}`}
              onClick={() => onUpgrade(lab.id)}
              disabled={materials < lab.cost || lab.level >= lab.maxLevel}
              className={`p-2 px-3 rounded-lg flex items-center gap-1 transition-all ${lab.level >= lab.maxLevel ? 'bg-slate-950 border border-slate-850 text-slate-600' : materials >= lab.cost ? 'bg-purple-600 hover:bg-purple-550 hover:shadow-md text-white cursor-pointer' : 'bg-slate-900 border border-slate-850 text-slate-500'}`}
            >
              {lab.level >= lab.maxLevel ? (
                <span className="text-[10.5px] font-mono font-bold uppercase">MAXED</span>
              ) : (
                <div className="flex flex-col items-end">
                  <span className="text-[10.5px] font-mono font-bold flex items-center gap-0.5"><ArrowUp className="h-3 w-3" /> UPGRADE</span>
                  <span className="text-[8px] font-mono text-slate-400 font-medium">{lab.cost} Alloys</span>
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Simulator materials injector (to let users test the upgrading progression seamlessly!) */}
      <div className="p-3 bg-slate-950/70 border-t border-slate-850 flex items-center justify-between text-xs font-mono">
        <span className="text-slate-400 flex items-center gap-1">
          <Trophy className="h-3.5 w-3.5 text-amber-400" /> Metagame Core Loop Target
        </span>
        <button
          id="cheat-alloys-multiplier"
          onClick={() => onAddMaterials(150)}
          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-teal-400 border border-slate-700 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
        >
          🚨 Dev Cheat: Scavenge +150 Alloys
        </button>
      </div>
    </div>
  );
}
