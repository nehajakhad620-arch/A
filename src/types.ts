// Shared TypeScript interfaces for the Post-Apocalyptic GDD & Game Simulator

export interface SanctuaryUpgrade {
  id: string;
  name: string;
  level: number;
  maxLevel: number;
  effect: string;
  baseCost: number;
  cost: number;
  currentValue: string;
  nextValue: string;
}

export interface RewardedAdConcept {
  id: string;
  title: string;
  benefit: string;
  adScenario: string;
}

export interface CosmeticItem {
  id: string;
  name: string;
  tier: 'Common' | 'Rare' | 'Epic' | 'Legendary';
  type: 'GasMask' | 'BodyArmor' | 'WeaponSkin' | 'Vehicle';
  equipped: boolean;
  cost: number;
  indianThemed: boolean;
  statBonus: string;
}

export interface LocalizedEvent {
  id: string;
  name: string;
  season: string;
  description: string;
  mechanicOverride: string;
  multiplier: number;
}

export interface ViralAdConcept {
  id: string;
  title: string;
  hook: string;
  action: string;
  estimatedCTR: number;
  mockComments: string[];
  conceptType: 'Fail vs Win' | 'Choice Narrative' | 'Satisfying Upgrades' | 'Indian Meme';
}

export interface GddDocument {
  title: string;
  vibeStyle: 'Neon Rust' | 'Cell-shaded Fallout' | 'Dust-covered Industrial' | 'Indian Cyber-Scavenger';
  baseType: 'Sanctuary Bus' | 'Underground Vault' | 'Ruined City Block';
  controlType: 'One-Tap Joystick' | 'Swipe Evade';
  coreGameplay: {
    description: string;
    powerups: { name: string; desc: string; icon: string }[];
  };
  hybridMonetization: {
    battlePassName: string;
    rewardedAds: RewardedAdConcept[];
    cosmetics: CosmeticItem[];
  };
  localizationPack: {
    region: string;
    events: LocalizedEvent[];
    culturalSkins: string[];
    chaiRestStops: boolean;
  };
  viralAdConcepts: ViralAdConcept[];
}

export interface SimulationState {
  isPlaying: boolean;
  score: number;
  maxScore: number;
  materialsGathered: number;
  dangerLevel: number;
  survivorHp: number;
  survivorMaxHp: number;
  activePowerups: string[];
  enemiesKilled: number;
  monetizationEventCount: number;
}
