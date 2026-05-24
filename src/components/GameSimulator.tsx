import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, RotateCcw, Volume2, VolumeX, Flame, Zap, Shield, Sparkles, 
  Skull, AlertTriangle, ShieldCheck, Trophy, Compass, Swords,
  Award, CheckCircle2, Radio, BookOpen, Clock, Heart, FastForward
} from 'lucide-react';
import { SanctuaryUpgrade } from '../types';

interface GameSimulatorProps {
  upgrades: SanctuaryUpgrade[];
  vibeStyle: string;
  activePowerupsList: string[];
  onMaterialsGathered: (amount: number) => void;
  onEnemyKilled: () => void;
}

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  size: number;
}

interface Enemy {
  id: string;
  x: number; // Virtual coordinate [0 .. 800]
  y: number; // Virtual coordinate [140 .. 450]
  z: number; // Height off ground
  hp: number;
  maxHp: number;
  speed: number;
  size: number;
  type: 'crawler' | 'spitter' | 'brute' | 'boss';
  color: string;
  swingCycle: number;
  targetJumpX?: number;
  targetJumpY?: number;
  jumpCooldown: number;
}

interface Bullet {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
  damage: number;
  life: number;
  isRockets?: boolean;
}

interface SpitProjectile {
  id: string;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  x: number;
  y: number;
  z: number;
  progress: number;
  speed: number;
}

interface Gem {
  x: number;
  y: number;
  z: number;
  xp: number;
  size: number;
  bobOffset: number;
}

interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  z: number;
  color: string;
  life: number; // frames
}

export default function GameSimulator({
  upgrades,
  vibeStyle,
  activePowerupsList,
  onMaterialsGathered,
  onEnemyKilled
}: GameSimulatorProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [materials, setMaterials] = useState(0);
  const [survivorHp, setSurvivorHp] = useState(100);
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [xpNeeded, setXpNeeded] = useState(50);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Time & Danger Tracker
  const [elapsedTime, setElapsedTime] = useState(0);
  const [dangerLevelText, setDangerLevelText] = useState('CHILL SCAVENGE');
  const [dangerMult, setDangerMult] = useState(1.0);

  // Rogue-lite level-up modal
  const [showLevelUpUpgrade, setShowLevelUpUpgrade] = useState(false);
  const [choices, setChoices] = useState<string[]>([]);
  const [activePowerups, setActivePowerups] = useState<string[]>(activePowerupsList);

  // --- PERSISTENT INDIE SIDE MISSIONS MECHANICS & PLAYER AGENCY SYNTESIZER ---
  const [completedMissions, setCompletedMissions] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('astra_completed_missions');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const [musicBpm, setMusicBpm] = useState(160);
  const [musicWave, setMusicWave] = useState<'sawtooth' | 'triangle'>('triangle');

  const runGemsCollected = useRef(0);
  const bossSpotted = useRef(0);

  const STAGES_MISSIONS = [
    { id: 'time_45', label: '⏱️ Sector Survivor', desc: 'Survive the wasteland waves for 45s', countGoal: 45, currentString: `Surv: ${elapsedTime}s / 45s`, progress: Math.min(100, (elapsedTime / 45) * 100), reward: 50 },
    { id: 'kills_30', label: '💥 Pest Eradicator', desc: 'Secure 30 mutant kills in the action arena', countGoal: 30, currentString: `Kills: ${score} / 30`, progress: Math.min(100, (score / 30) * 100), reward: 40 },
    { id: 'gems_15', label: '💎 Core Collector', desc: 'Collect 15 glowing XP gems in a single run', countGoal: 15, currentString: `Cores: ${runGemsCollected.current} / 15`, progress: Math.min(100, (runGemsCollected.current / 15) * 100), reward: 45 },
    { id: 'boss_face', label: '👑 Titan Challenger', desc: 'Face the radioactive Overlord at 105s', countGoal: 1, currentString: bossSpotted.current > 0 ? "Boss Spotted! (1/1)" : "Boss Not Found (0/1)", progress: bossSpotted.current > 0 ? 100 : 0, reward: 100 },
    { id: 'fort_build', label: '🏛️ Heavy Architect', desc: 'Raise Barricade Metagame Level to 2+', countGoal: 2, currentString: `Bunker Level: Lv.${upgrades.find(u => u.id === 'up_wall')?.level || 1} / 2`, progress: ((upgrades.find(u => u.id === 'up_wall')?.level || 1) >= 2) ? 100 : 50, reward: 60 }
  ];

  // Save completed missions automatically
  useEffect(() => {
    try {
      localStorage.setItem('astra_completed_missions', JSON.stringify(completedMissions));
    } catch (e) {
      // safe fallback
    }
  }, [completedMissions]);

  // Real-time Objective Checker & Reward dispatcher
  useEffect(() => {
    if (!isPlaying) return;
    
    const checkObjective = (id: string, isMet: boolean, reward: number) => {
      setCompletedMissions(prev => {
        if (isMet && !prev[id]) {
          // Play chiptune reward sound
          playSound('levelup');
          setTimeout(() => {
            addFloatText(`🏆 LOCKED COMPLETED! +${reward} ALLOYS 🔩`, 400, 180, 24, '#eab308');
          }, 150);
          onMaterialsGathered(reward);
          return { ...prev, [id]: true };
        }
        return prev;
      });
    };

    // 1. Time Survivor: survive 45 seconds
    checkObjective('time_45', elapsedTime >= 45, 50);

    // 2. Pest Eradicator: score 30 mutant kills
    checkObjective('kills_30', score >= 30, 40);

    // 3. Core Collector: collect 15 gems in a single run
    checkObjective('gems_15', runGemsCollected.current >= 15, 45);

    // 4. Titan Challenger: spawn & face Overlord
    checkObjective('boss_face', bossSpotted.current > 0, 100);

    // 5. Heavy Architect: level 2 barricade
    const wallLv = upgrades.find(u => u.id === 'up_wall')?.level || 1;
    checkObjective('fort_build', wallLv >= 2, 60);

  }, [elapsedTime, score, upgrades, isPlaying]);

  // Sequencer bassline & snare drum synthesizer
  const musicStepRef = useRef(0);
  const synthPattern = [110, 110, 147, 110, 165, 110, 147, 130]; 

  useEffect(() => {
    let interval: any;
    if (isPlaying && soundEnabled) {
      const stepIntervalMs = Math.max(150, Math.min(800, Math.floor(60000 / musicBpm / 2)));
      interval = setInterval(() => {
        try {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (!AudioCtx) return;
          const ctx = new AudioCtx();
          
          // Bassline Synthesizer Voice
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();
          
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(380, ctx.currentTime);
          
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          
          osc.type = musicWave;
          
          const step = musicStepRef.current;
          const baseFreq = synthPattern[step % synthPattern.length];
          
          osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.85, ctx.currentTime + 0.16);
          
          // Ultra-quiet mix level so it rests gently in background
          gain.gain.setValueAtTime(0.012, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
          
          osc.start();
          osc.stop(ctx.currentTime + 0.18);
          
          // Snare sound synthesizer on step 4 to keep rhythm
          if (step % 4 === 2) {
            const snareOsc = ctx.createOscillator();
            const snareGain = ctx.createGain();
            snareOsc.type = 'sawtooth';
            snareOsc.frequency.setValueAtTime(320, ctx.currentTime);
            snareOsc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.07);
            
            snareGain.gain.setValueAtTime(0.006, ctx.currentTime);
            snareGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.07);
            
            snareOsc.connect(snareGain);
            snareGain.connect(ctx.destination);
            snareOsc.start();
            snareOsc.stop(ctx.currentTime + 0.07);
          }
          
          musicStepRef.current = (step + 1) % synthPattern.length;
        } catch (err) {
          // Silent fallback if AudioContext is blocked
        }
      }, stepIntervalMs);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isPlaying, soundEnabled, musicBpm, musicWave]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Visual Camera Shake Tracker
  const cameraShake = useRef({ x: 0, y: 0, intensity: 0 });

  // Draggable Virtual Coordinates
  // Center of screen represents play zone: X ranges from 50 to 750, Y ranges from 150 to 440
  const playerPos = useRef({ x: 400, y: 300, z: 0 });
  const isDragging = useRef(false);
  
  // Game entities stored in refs for direct rendering thread
  const enemiesRef = useRef<Enemy[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const spitProjectilesRef = useRef<SpitProjectile[]>([]);
  const gemsRef = useRef<Gem[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);

  const groundParticlesRef = useRef<{
    x: number;
    y: number;
    color: string;
    size: number;
    opacity: number;
    speed: number;
    oscOffset?: number;
  }[]>([]);

  // Initialize ground grit particles once for high-density wasteland textures
  if (groundParticlesRef.current.length === 0) {
    const colors = [
      '#a855f7', // Neon purple
      '#f97316', // Rust orange
      '#94a3b8', // Slate dust
      '#eab308', // Acid gold
      '#ef4444', // Red ember
    ];
    for (let i = 0; i < 400; i++) {
      groundParticlesRef.current.push({
        x: Math.random() * 800,
        y: 100 + Math.random() * 350,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 0.8 + Math.random() * 2.8,
        opacity: 0.15 + Math.random() * 0.55,
        speed: 0.1 + Math.random() * 0.45,
        oscOffset: Math.random() * Math.PI * 2
      });
    }
  }

  // Landmark types definition representing the virtual world features
  const landmarksRef = useRef<{
    x: number;
    y: number;
    type: 'spire' | 'hologram' | 'billboard' | 'crater' | 'wreck' | 'windmill' | 'crystal';
    size: number;
    color: string;
    pulseRate: number;
    rotation: number;
    label?: string;
  }[]>([]);

  // Initialize interactive cyber oasis landmarks once to anchor the virtual biome
  if (landmarksRef.current.length === 0) {
    const types: ('spire' | 'hologram' | 'billboard' | 'crater' | 'wreck' | 'windmill' | 'crystal')[] = [
      'spire', 'hologram', 'billboard', 'crater', 'wreck', 'windmill', 'crystal'
    ];
    const labels = ["NEON OASIS", "CHAI CARAVAN", "ASTRA NETWORK", "RECLAIM-9", "DESI GIGA", "PORTAL GRID"];
    const colors = ['#06b6d4', '#d946ef', '#f43f5e', '#10b981', '#eab308', '#a855f7'];

    for (let i = 0; i < 20; i++) {
      let lx = 50 + Math.random() * 700;
      let ly = 120 + Math.random() * 320;
      // Keep away from player starting center position
      if (Math.abs(lx - 400) < 80 && Math.abs(ly - 300) < 60) {
        lx += 120 * (Math.random() > 0.5 ? 1 : -1);
      }
      landmarksRef.current.push({
        x: lx,
        y: ly,
        type: types[i % types.length],
        size: 14 + Math.random() * 12,
        color: colors[i % colors.length],
        pulseRate: 0.02 + Math.random() * 0.03,
        rotation: Math.random() * Math.PI * 2,
        label: i % 3 === 0 ? labels[Math.floor(Math.random() * labels.length)] : undefined
      });
    }
  }

  const lastSpawnTime = useRef(0);
  const lastShootTime = useRef(0);

  // Retrieve base upgrade values
  const wallLevel = upgrades.find(u => u.id === 'up_wall')?.level || 1;
  const turretLevel = upgrades.find(u => u.id === 'up_turret')?.level || 1;
  const labLevel = upgrades.find(u => u.id === 'up_lab')?.level || 1;

  // Visual Palette - Upgraded matching the Vibe choice
  const themeColors = {
    'Neon Rust': { 
      player: '#c084fc', 
      enemy: '#10b981', 
      bg: '#040713', 
      accent: '#f97316', 
      grid: '#a855f720', 
      ambient: '#3b0764' 
    },
    'Cell-shaded Fallout': { 
      player: '#eab308', 
      enemy: '#ef4444', 
      bg: '#0f172a', 
      accent: '#14b8a6', 
      grid: '#fbbf2415', 
      ambient: '#1e293b' 
    },
    'Dust-covered Industrial': { 
      player: '#fdba74', 
      enemy: '#94a3b8', 
      bg: '#1c1917', 
      accent: '#f43f5e', 
      grid: '#7c2d1222', 
      ambient: '#292524' 
    },
    'Indian Cyber-Scavenger': { 
      player: '#22d3ee', 
      enemy: '#ec4899', 
      bg: '#020617', 
      accent: '#eab308', 
      grid: '#06b6d425', 
      ambient: '#0f172a' 
    }
  }[vibeStyle as 'Neon Rust' | 'Cell-shaded Fallout' | 'Dust-covered Industrial' | 'Indian Cyber-Scavenger'] || { 
    player: '#c084fc', 
    enemy: '#10b981', 
    bg: '#040713', 
    accent: '#f97316', 
    grid: '#a855f720', 
    ambient: '#3b0764' 
  };

  // Sound Synth using Web Audio API
  const playSound = (type: 'shoot' | 'kill' | 'gem' | 'hit' | 'levelup' | 'lightning' | 'spit' | 'explosion' | 'jump') => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'shoot') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(450, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === 'spit') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } else if (type === 'hit') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(120, ctx.currentTime);
        osc.frequency.setValueAtTime(40, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === 'gem') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(750, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1500, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
        osc.start();
        osc.stop(ctx.currentTime + 0.09);
      } else if (type === 'kill') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
        osc.start();
        osc.stop(ctx.currentTime + 0.18);
      } else if (type === 'levelup') {
        // Arpeggio
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(554, ctx.currentTime + 0.08);
        osc.frequency.setValueAtTime(659, ctx.currentTime + 0.16);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.24);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.002, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'lightning') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(1200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else if (type === 'explosion') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(90, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(5, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } else if (type === 'jump') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(450, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch (e) {
      // Ignored if browser sandbox blocks Web Audio
    }
  };

  // Live Timer & Danger Multiplier tick
  useEffect(() => {
    let timerInterval: any;
    if (isPlaying) {
      timerInterval = setInterval(() => {
        setElapsedTime(prev => {
          const nextTime = prev + 1;
          
          // Compute threat phases
          let txt = 'CHILL SCAVENGE';
          let multiplier = 1.0;
          if (nextTime >= 105) {
            txt = '🚨 INFINITE APOCALYPSE STORM 🚨';
            multiplier = 4.5;
          } else if (nextTime >= 75) {
            txt = '💀 ARMORED BRUTE SIEGE';
            multiplier = 3.0;
          } else if (nextTime >= 45) {
            txt = '🤢 MUTATING BIO-SPIT CARNAGE';
            multiplier = 2.0;
          } else if (nextTime >= 20) {
            txt = '🦗 FAST SWARM INVASION';
            multiplier = 1.4;
          }
          
          setDangerLevelText(txt);
          setDangerMult(multiplier);
          return nextTime;
        });
      }, 1000);
    } else {
      clearInterval(timerInterval);
    }
    return () => clearInterval(timerInterval);
  }, [isPlaying]);

  // Project 3D coordinate (x,y,z) to 2D Canvas screen
  // Virtual space: x [0..800], y [120..450], z represents altitude [0..150]
  const toScreen = (x: number, y: number, z: number) => {
    const horizon = 100;
    const centerY = horizon;
    const centerX = 400; // Horizon centers in midpoint of our standard 800 width

    // Compute progress ratio along depth coordinates
    const progress = (y - horizon) / (450 - horizon); // Ranges 0 to 1
    // Scale objects: small in background, grand in foreground. Guard against negative scales when entities move above horizon
    const scale = Math.max(0.01, 0.22 + progress * 0.95);

    // Apply squashed geometric projection grid to create high tilt depth
    const screenX = centerX + (x - centerX) * scale;
    const screenY = horizon + (progress * 260) - z * scale;

    return { x: screenX, y: screenY, scale };
  };

  // Sparkle generator in 3D
  const spawnExplosion3D = (x: number, y: number, z: number, color: string, count = 10, speedMult = 1) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const rSpeed = (0.6 + Math.random() * 2.2) * speedMult;
      const vZ = (Math.random() * 2.5) * speedMult;
      
      particlesRef.current.push({
        x,
        y,
        z,
        vx: Math.cos(angle) * rSpeed,
        vy: Math.sin(angle) * rSpeed * 0.5, // flat visual circular dispersal
        vz: vZ,
        color,
        alpha: 1.0,
        life: 25 + Math.random() * 25,
        maxLife: 50,
        size: 1.5 + Math.random() * 3
      });
    }
  };

  // Ingame float text popup
  const addFloatText = (text: string, x: number, y: number, z: number, color = '#ffffff') => {
    floatingTextsRef.current.push({
      id: `fl_${Date.now()}_${Math.random()}`,
      text,
      x,
      y,
      z,
      color,
      life: 45 // frames count
    });
  };

  const handleRestart = () => {
    playerPos.current = { x: 400, y: 300, z: 0 };
    enemiesRef.current = [];
    bulletsRef.current = [];
    spitProjectilesRef.current = [];
    gemsRef.current = [];
    particlesRef.current = [];
    floatingTextsRef.current = [];
    landmarksRef.current = [];
    
    runGemsCollected.current = 0;
    bossSpotted.current = 0;
    
    // HP scaled by the persistent metagame Bunker Wall level!
    setSurvivorHp(100 + (wallLevel - 1) * 20); 
    setScore(0);
    setMaterials(0);
    setLevel(1);
    setXp(0);
    setXpNeeded(50);
    setElapsedTime(0);
    setDangerLevelText('CHILL SCAVENGE');
    setDangerMult(1.0);
    setShowLevelUpUpgrade(false);
    setIsPlaying(true);
    
    lastSpawnTime.current = Date.now();
    lastShootTime.current = Date.now();

    playSound('levelup');
    addFloatText("DEPLOYS!", 400, 300, 40, '#a855f7');
  };

  // Mouse / Touch Virtual Coordinate binding
  const handlePointerMove = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !isPlaying) return;
    const rect = canvas.getBoundingClientRect();
    
    // Convert client coordinates directly to our 800x450 coordinate spectrum
    const screenX = ((clientX - rect.left) / rect.width) * 800;
    const screenY = ((clientY - rect.top) / rect.height) * 450;

    // Direct inverse estimation of screen coordinates back into virtual plane [50..750, 140..430]
    // Since projection formula: screenX = centerX + (vX - centerX) * scale
    // Let's solve coordinate target smoothly
    const horizon = 100;
    const progress = (screenY - horizon) / 260; // Approximate
    const scale = 0.22 + progress * 0.95;
    const virtualY = Math.max(140, Math.min(430, horizon + progress * (450 - horizon)));
    const virtualX = Math.max(50, Math.min(750, 400 + (screenX - 400) / (scale || 0.1)));

    playerPos.current.x = virtualX;
    playerPos.current.y = virtualY;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDragging.current = true;
    handlePointerMove(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging.current) {
      handlePointerMove(e.clientX, e.clientY);
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    isDragging.current = true;
    if (e.touches.length > 0) {
      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (isDragging.current && e.touches.length > 0) {
      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleMouseUpOrLeave = () => {
    isDragging.current = false;
  };

  // Rogue-lite Upgrade Selection Trigger
  const triggerLevelUp = () => {
    setIsPlaying(false);
    playSound('levelup');
    
    // Beautiful random choices
    const rawChoices = [
      "Fire Bullets 🔥", "Chain Lightning ⚡", "Frozen Shell ❄️", 
      "Toxic Spikes 💀", "Shield Dome 🛡️", "Spicy Samosa Heal 🥟", "Tuk-Tuk Turbo 🛺"
    ];
    const shuffled = [...rawChoices].sort(() => 0.5 - Math.random());
    setChoices(shuffled.slice(0, 3));
    setShowLevelUpUpgrade(true);
  };

  const handleChooseUpgrade = (choice: string) => {
    const power = choice.split(" ")[0];
    if (power === "Spicy") {
      const maxH = 100 + (wallLevel - 1) * 20;
      setSurvivorHp(prev => Math.min(maxH, prev + 35));
      addFloatText("+35 HEALED 🥟", playerPos.current.x, playerPos.current.y, 40, '#22c55e');
    } else {
      if (!activePowerups.includes(power)) {
        setActivePowerups(prev => [...prev, power]);
      }
      addFloatText(`MODIFIER ADDED: ${power}!`, playerPos.current.x, playerPos.current.y, 42, '#a855f7');
    }
    setShowLevelUpUpgrade(false);
    setIsPlaying(true);
  };

  // Core Game Loop Effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Pre-render a tiny repeating gritty noise pattern canvas
    const noisePatCanvas = document.createElement('canvas');
    noisePatCanvas.width = 128;
    noisePatCanvas.height = 128;
    const nCtx = noisePatCanvas.getContext('2d');
    if (nCtx) {
      const nData = nCtx.createImageData(128, 128);
      const data = nData.data;
      for (let i = 0; i < data.length; i += 4) {
        const val = Math.floor(Math.random() * 45) + 105; // soft gritty spectrum
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
        data[i + 3] = 14; // subtle alpha
      }
      nCtx.putImageData(nData, 0, 0);
    }
    const noisePattern = ctx.createPattern(noisePatCanvas, 'repeat');

    let localAnimationId: number;

    const gameLoop = () => {
      // If paused or modal open, still render scene (idle rotation animations etc)
      let shakeOffsetX = 0;
      let shakeOffsetY = 0;
      let shakeAngle = 0;

      // Handle Camera Decay with organic damping
      if (cameraShake.current.intensity > 0.1) {
        cameraShake.current.intensity *= 0.88;
        shakeOffsetX = (Math.random() - 0.5) * cameraShake.current.intensity;
        shakeOffsetY = (Math.random() - 0.5) * cameraShake.current.intensity;
        // Rotational shake angle is proportional to intensity (capped safely for high impact visual clarity)
        shakeAngle = (Math.random() - 0.5) * (cameraShake.current.intensity * 0.0035);
      }

      ctx.save();
      // Apply Visceral Camera Shake: Translate & Center-based (800x450 midpoint) rotation
      ctx.translate(400 + shakeOffsetX, 225 + shakeOffsetY);
      if (Math.abs(shakeAngle) > 0.0001) {
        ctx.rotate(shakeAngle);
      }
      ctx.translate(-400, -225);

      // Clean Canvas with Deep Atmospheric Ambient gradient
      ctx.fillStyle = themeColors.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Highlight horizon background atmospheric color glow
      const skylineGrad = ctx.createLinearGradient(0, 0, 0, 110);
      skylineGrad.addColorStop(0, themeColors.ambient);
      skylineGrad.addColorStop(1, themeColors.bg);
      ctx.fillStyle = skylineGrad;
      ctx.fillRect(0, 0, canvas.width, 100);

      // Draw beautiful stylized 3D perspective mountains in distance
      ctx.fillStyle = 'rgba(5, 8, 22, 0.7)';
      ctx.beginPath();
      ctx.moveTo(0, 100);
      ctx.lineTo(150, 45);
      ctx.lineTo(320, 100);
      ctx.lineTo(550, 50);
      ctx.lineTo(690, 85);
      ctx.lineTo(800, 100);
      ctx.closePath();
      ctx.fill();

      // Draw active Bunker Fortification Barrier Wall boundaries in 3D perspective!
      if (wallLevel > 1) {
        ctx.strokeStyle = 'rgba(74, 85, 104, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 12]);
        
        ctx.beginPath();
        // Project outer wall boundaries
        const pTL = toScreen(40, 140, 0);
        const pTR = toScreen(760, 140, 0);
        const pBL = toScreen(40, 440, 0);
        const pBR = toScreen(760, 440, 0);
        ctx.moveTo(pTL.x, pTL.y);
        ctx.lineTo(pTR.x, pTR.y);
        ctx.lineTo(pBR.x, pBR.y);
        ctx.lineTo(pBL.x, pBL.y);
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw 3D Radial Grid receding to horizon
      ctx.strokeStyle = themeColors.grid;
      ctx.lineWidth = 1;

      // Draw Grid ground lines extending outwards
      for (let vx = 0; vx <= 800; vx += 80) {
        const horizonPt = toScreen(vx, 100, 0);
        const foregroundPt = toScreen(vx, 450, 0);
        ctx.beginPath();
        ctx.moveTo(horizonPt.x, horizonPt.y);
        ctx.lineTo(foregroundPt.x, foregroundPt.y);
        ctx.stroke();
      }
      // Horizontal perspective rings
      for (let vy = 100; vy <= 450; vy += 35) {
        const leftPt = toScreen(0, vy, 0);
        const rightPt = toScreen(800, vy, 0);
        ctx.beginPath();
        ctx.moveTo(leftPt.x, leftPt.y);
        ctx.lineTo(rightPt.x, rightPt.y);
        ctx.stroke();
      }

      // Draw high-density responsive ground grit particles in 3D projection
      groundParticlesRef.current.forEach((gp) => {
        // Slowly drift them windward to emulate ambient wasteland gusts
        if (isPlaying) {
          gp.x -= gp.speed;
          if (gp.x < 0) {
            gp.x = 800;
            gp.y = 100 + Math.random() * 350;
          }
          if (gp.oscOffset !== undefined) {
            gp.oscOffset += 0.01;
          }
        }
        
        // Project to 3D perspective space (with minor floating for embers under 1.8px)
        const zFloat = (gp.oscOffset !== undefined && gp.size < 1.8) ? Math.max(0, Math.sin(gp.oscOffset) * 6) : 0;
        const ptScr = toScreen(gp.x, gp.y, zFloat);
        
        ctx.save();
        ctx.globalAlpha = gp.opacity;
        
        // Dynamically shift color matching current theme's visual style
        let finalColor = gp.color;
        if (vibeStyle === 'Neon Rust') {
          finalColor = gp.size > 2 ? '#c084fc' : gp.size > 1.2 ? '#f97316' : '#a855f7';
        } else if (vibeStyle === 'Cell-shaded Fallout') {
          finalColor = gp.size > 2 ? '#eab308' : gp.size > 1.2 ? '#14b8a6' : '#ef4444';
        } else if (vibeStyle === 'Dust-covered Industrial') {
          finalColor = gp.size > 2 ? '#fdba74' : gp.size > 1.2 ? '#f43f5e' : '#94a3b8';
        } else if (vibeStyle === 'Indian Cyber-Scavenger') {
          finalColor = gp.size > 2 ? '#22d3ee' : gp.size > 1.2 ? '#eab308' : '#ec4899';
        }

        ctx.fillStyle = finalColor;
        ctx.beginPath();
        
        if (gp.size > 2) {
          // Rubble / pebbles
          const sz = Math.max(0.1, gp.size * ptScr.scale * 1.5);
          ctx.rect(ptScr.x - sz / 2, ptScr.y - sz / 2, sz, sz);
        } else {
          // Dust grit specks
          ctx.arc(ptScr.x, ptScr.y, Math.max(0.1, gp.size * ptScr.scale * 1.4), 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.restore();
      });

      const pX = playerPos.current.x;
      const pY = playerPos.current.y;
      const pZ = playerPos.current.z;

      // Draw the core live elements if playing
      if (isPlaying) {

        // Player bobbing in 3D hover flight
        playerPos.current.z = 8 + Math.sin(Date.now() / 200) * 4;

        // --- Active spawning cycle ---
        const now = Date.now();
        // Rapidly accelerates spawns as threat level / time mounts!
        const spawnDelay = Math.max(300, 2100 - (elapsedTime * 14) - score * 1.5);
        if (now - lastSpawnTime.current > spawnDelay) {
          lastSpawnTime.current = now;

          // Spawn from randomized coordinates of horizon / sides
          const edge = Math.floor(Math.random() * 3);
          let ex = Math.random() * 800;
          let ey = 140; // close to horizon
          if (edge === 0) { ex = -20; ey = 150 + Math.random() * 250; }
          if (edge === 1) { ex = 820; ey = 150 + Math.random() * 250; }

          let type: 'crawler' | 'spitter' | 'brute' | 'boss' = 'crawler';
          let ehp = 10 + Math.floor(score * 0.4);
          let speed = 0.5 + Math.random() * 0.4;
          let size = 6;
          let eColor = themeColors.enemy;

          // Introduce custom mutant waves depending on survival time!
          const rChance = Math.random();
          if (elapsedTime > 75 && rChance > 0.7) {
            // High Threat Heavy Armored Brutes
            type = 'brute';
            ehp = 45 + Math.floor(elapsedTime * 0.8);
            speed = 0.35 + Math.random() * 0.15;
            size = 14;
            eColor = vibeStyle.includes('Fallout') ? '#dc2626' : '#ec4899';
          } else if (elapsedTime > 40 && rChance > 0.4) {
            // Long Range Spitters
            type = 'spitter';
            ehp = 14 + Math.floor(elapsedTime * 0.3);
            speed = 0.65;
            size = 8;
            eColor = '#fb923c'; // radioactive orange
          } else if (elapsedTime > 15 && rChance > 0.85) {
            // Rapid Swarm Insects
            type = 'crawler';
            ehp = 6 + Math.floor(elapsedTime * 0.1);
            speed = 1.2 + Math.random() * 0.5;
            size = 4.5;
            eColor = '#fbbf24';
          }

          // Special Titan boss trigger at exactly 110s if not spawned
          if (elapsedTime >= 105 && enemiesRef.current.filter(e => e.type === 'boss').length === 0) {
            type = 'boss';
            bossSpotted.current = 1;
            ehp = 400 + score * 4;
            speed = 0.28;
            size = 28;
            eColor = '#a855f7';
            addFloatText("☣️ DOOMSDAY OVERLORD SPAWNED! ☣️", 400, 160, 40, '#f43f5e');
            cameraShake.current.intensity = 35; // Maximum rotational shockwave
            playSound('explosion');
          }

          // Scale enemy base health and size dynamically by danger level multiplier to escalate difficulty
          const finalHp = Math.floor(ehp * dangerMult * (1.0 + (dangerMult - 1.0) * 0.5));
          const finalSize = size * (1.0 + (dangerMult - 1.0) * 0.35);

          enemiesRef.current.push({
            id: `enemy_${Math.random()}_${Date.now()}`,
            x: ex,
            y: ey,
            z: 0,
            hp: finalHp,
            maxHp: finalHp,
            speed,
            size: finalSize,
            type,
            color: eColor,
            swingCycle: Math.random() * 10,
            jumpCooldown: 120 + Math.random() * 200
          });
        }

        // --- UPDATE ENEMIES ---
        enemiesRef.current.forEach((enemy) => {
          enemy.swingCycle += 0.08;
          const dx = pX - enemy.x;
          const dy = pY - enemy.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Walls sluggishness modifier (metagame balance buffs player!)
          const approachReduction = wallLevel > 1 ? 0.82 : 1.0;

          // AI Pathfinding depending on Mutant Type
          if (enemy.type === 'boss') {
            // Giant crawls slowly straight forward
            enemy.x += (dx / dist) * enemy.speed * approachReduction;
            enemy.y += (dy / dist) * enemy.speed * approachReduction;
          }
          else if (enemy.type === 'brute') {
            // Leaps in high 3D vector towards the player
            enemy.jumpCooldown--;
            if (enemy.jumpCooldown <= 0 && enemy.z === 0) {
              // Initiate jump action
              enemy.targetJumpX = pX + (Math.random() - 0.5) * 40;
              enemy.targetJumpY = pY + (Math.random() - 0.5) * 40;
              enemy.z = 1.0; // flag active jump
              enemy.jumpCooldown = 200 + Math.random() * 150;
              playSound('jump');
            }

            if (enemy.z > 0) {
              // Gravity parabola arc Simulation
              enemy.z += 1.8;
              if (enemy.z >= 24) {
                // Slam down
                enemy.z = 0;
                // Deal shock damage if player close
                if (dist < 80) {
                  setSurvivorHp(prev => Math.max(0, prev - 3));
                  cameraShake.current.intensity = 10;
                  playSound('hit');
                  addFloatText("-3 HP GROUND SLAM!", pX, pY, 20, '#f87171');
                }
                // visual land puff dust
                spawnExplosion3D(enemy.x, enemy.y, 0, '#475569', 12, 0.5);
              } else {
                // Drift to target spot
                enemy.x += (dx / dist) * enemy.speed * 2.8;
                enemy.y += (dy / dist) * enemy.speed * 2.8;
              }
            } else {
              enemy.x += (dx / dist) * enemy.speed * approachReduction;
              enemy.y += (dy / dist) * enemy.speed * approachReduction;
            }
          }
          else if (enemy.type === 'spitter') {
            // Stays back and spit mortar acid bombs in dynamic Z-arcs
            if (dist > 180) {
              enemy.x += (dx / dist) * enemy.speed * approachReduction;
              enemy.y += (dy / dist) * enemy.speed * approachReduction;
            } else {
              // Drift radially around the player
              enemy.x += (-dy / dist) * enemy.speed * 0.4;
              enemy.y += (dx / dist) * enemy.speed * 0.4;
            }

            // Launch acid saliva
            if (Math.random() < 0.007) {
              playSound('spit');
              spitProjectilesRef.current.push({
                id: `spit_${Math.random()}`,
                startX: enemy.x,
                startY: enemy.y,
                targetX: pX + (Math.random() - 0.5) * 50,
                targetY: pY + (Math.random() - 0.5) * 50,
                x: enemy.x,
                y: enemy.y,
                z: 0,
                progress: 0,
                speed: 0.016 + Math.random() * 0.01
              });
            }
          }
          else {
            // Crawler / normal swarmer behaviors
            enemy.x += (dx / dist) * enemy.speed * approachReduction;
            enemy.y += (dy / dist) * enemy.speed * approachReduction;
          }

          // --- DRAW ENEMY IN 3D (DELEGATED TO DEPTH-SORTED QUEUE) ---
          const drawEnemyInline = false;
          if (drawEnemyInline) {
            const eScr = toScreen(enemy.x, enemy.y, enemy.z);
            
            // 1. Perspective Shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.beginPath();
          ctx.ellipse(eScr.x, toScreen(enemy.x, enemy.y, 0).y, Math.max(0.1, enemy.size * eScr.scale * 1.5), Math.max(0.1, enemy.size * eScr.scale * 0.6), 0, 0, Math.PI * 2);
          ctx.fill();

          // 2. Continuous trail embers
          if (Math.random() < 0.15) {
            particlesRef.current.push({
              x: enemy.x,
              y: enemy.y,
              z: enemy.z,
              vx: (Math.random() - 0.5) * 0.5,
              vy: Math.random() * 0.3,
              vz: 0,
              color: enemy.color,
              alpha: 0.8,
              life: 15,
              maxLife: 15,
              size: 2
            });
          }

          // 3. Volumetric low-poly 3D Box/Prism mesh structure
          const sideW = enemy.size * eScr.scale;
          const prismH = enemy.size * 1.8 * eScr.scale;

          if (enemy.type === 'crawler') {
            const hPrism = enemy.size * 1.3 * eScr.scale;
            // Draw a multi-segment glowing insect body
            const segments = 3;
            for (let i = segments - 1; i >= 0; i--) {
              const segScale = 1 - i * 0.22;
              const segX = eScr.x - (i * sideW * 0.5);
              const segY = eScr.y - (i * sideW * 0.15);
              
              const grad = ctx.createRadialGradient(segX, segY - hPrism * segScale, 1, segX, segY - hPrism * segScale, sideW * segScale * 1.5);
              grad.addColorStop(0, enemy.color);
              grad.addColorStop(1, shadeColor(enemy.color, -50));
              ctx.save();
              ctx.fillStyle = grad;
              ctx.beginPath();
              ctx.ellipse(segX, segY - hPrism * segScale, sideW * segScale * 1.3, sideW * segScale * 0.8, 0.08, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
            
            // Glowing radioactive compound eyes
            ctx.fillStyle = '#fef08a'; // Bright gold
            ctx.beginPath();
            ctx.arc(eScr.x + sideW * 0.3, eScr.y - hPrism * 1.25, Math.max(0.2, 2 * eScr.scale), 0, Math.PI * 2);
            ctx.arc(eScr.x - sideW * 0.2, eScr.y - hPrism * 1.3, Math.max(0.2, 2 * eScr.scale), 0, Math.PI * 2);
            ctx.fill();

            // Procedural insect legs scurrying
            ctx.strokeStyle = shadeColor(enemy.color, -30);
            ctx.lineWidth = Math.max(0.5, 1.5 * eScr.scale);
            ctx.beginPath();
            for (let l = 0; l < 3; l++) {
              const offsetAngle = (l - 1) * 0.4;
              const dXLeft = -Math.cos(offsetAngle) * sideW * 1.8;
              const dXRight = Math.cos(offsetAngle) * sideW * 1.8;
              const dYLeg = sideW * (0.8 + Math.sin(enemy.swingCycle * 2.5 + l) * 0.35);
              
              // Left leg
              ctx.moveTo(eScr.x - sideW * 0.4, eScr.y - hPrism * 0.4);
              ctx.lineTo(eScr.x + dXLeft, eScr.y + dYLeg);
              
              // Right leg
              ctx.moveTo(eScr.x + sideW * 0.4, eScr.y - hPrism * 0.4);
              ctx.lineTo(eScr.x + dXRight, eScr.y + dYLeg);
            }
            ctx.stroke();
          }
          else if (enemy.type === 'spitter') {
            const hPrism = enemy.size * 2.6 * eScr.scale; // Tall, spiked
            
            // Radioactive pulsating spore sac on the back
            const pulse = Math.sin(Date.now() / 100) * 0.15;
            const sacSize = Math.max(0.1, sideW * (1.1 + pulse));
            
            const sacGrad = ctx.createRadialGradient(eScr.x - sideW * 0.5, eScr.y - hPrism * 0.82, 1, eScr.x - sideW * 0.5, eScr.y - hPrism * 0.82, Math.max(1, sacSize * 1.6));
            sacGrad.addColorStop(0, '#fb923c'); // Radioactive orange core
            sacGrad.addColorStop(0.6, '#ea580c');
            sacGrad.addColorStop(1, '#7c2d12');
            ctx.fillStyle = sacGrad;
            ctx.beginPath();
            ctx.arc(eScr.x - sideW * 0.4, eScr.y - hPrism * 0.8, sacSize, 0, Math.PI * 2);
            ctx.fill();
            
            // Tall primary vertical neck structure
            ctx.fillStyle = shadeColor(enemy.color, -15);
            ctx.beginPath();
            ctx.moveTo(eScr.x - sideW * 0.4, eScr.y);
            ctx.lineTo(eScr.x + sideW * 0.4, eScr.y);
            ctx.lineTo(eScr.x + sideW * 0.15, eScr.y - hPrism);
            ctx.lineTo(eScr.x - sideW * 0.25, eScr.y - hPrism);
            ctx.closePath();
            ctx.fill();
            
            // Curved mouth piece / cannon nozzle pointing forward
            ctx.fillStyle = '#1e293b';
            ctx.strokeStyle = '#ea580c';
            ctx.lineWidth = Math.max(0.5, 1 * eScr.scale);
            ctx.beginPath();
            ctx.arc(eScr.x + sideW * 0.5, eScr.y - hPrism * 0.95, Math.max(0.1, 3.5 * eScr.scale), 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Tripod skeletal spidery legs
            ctx.strokeStyle = shadeColor(enemy.color, -40);
            ctx.lineWidth = Math.max(0.5, 2 * eScr.scale);
            const legPhase = Math.sin(enemy.swingCycle);
            ctx.beginPath();
            // Front leg
            ctx.moveTo(eScr.x + sideW * 0.2, eScr.y - hPrism * 0.25);
            ctx.lineTo(eScr.x + sideW * 1.7, eScr.y + sideW * (1.2 + legPhase * 0.35));
            // Back left leg
            ctx.moveTo(eScr.x - sideW * 0.4, eScr.y - hPrism * 0.25);
            ctx.lineTo(eScr.x - sideW * 1.6, eScr.y + sideW * (1.1 - legPhase * 0.3));
            // Central stabilizer leg
            ctx.moveTo(eScr.x, eScr.y - hPrism * 0.25);
            ctx.lineTo(eScr.x, eScr.y + sideW * 1.4);
            ctx.stroke();
          }
          else if (enemy.type === 'brute') {
            const hPrism = enemy.size * 1.9 * eScr.scale;
            
            // Double-facetted volumetric heavy armor block
            // Right Side
            ctx.fillStyle = shadeColor(enemy.color, -30);
            ctx.beginPath();
            ctx.moveTo(eScr.x, eScr.y);
            ctx.lineTo(eScr.x + sideW, eScr.y - sideW * 0.5);
            ctx.lineTo(eScr.x + sideW, eScr.y - sideW * 0.5 - hPrism);
            ctx.lineTo(eScr.x, eScr.y - hPrism);
            ctx.closePath();
            ctx.fill();
            
            // Left Side
            ctx.fillStyle = shadeColor(enemy.color, -10);
            ctx.beginPath();
            ctx.moveTo(eScr.x, eScr.y);
            ctx.lineTo(eScr.x - sideW, eScr.y - sideW * 0.5);
            ctx.lineTo(eScr.x - sideW, eScr.y - sideW * 0.5 - hPrism);
            ctx.lineTo(eScr.x, eScr.y - hPrism);
            ctx.closePath();
            ctx.fill();

            // Heavy mineral spikes protruding on top lid
            ctx.fillStyle = '#dc2626'; // Molten red obsidian shards
            ctx.beginPath();
            ctx.moveTo(eScr.x - sideW * 0.5, eScr.y - hPrism - sideW * 0.25);
            ctx.lineTo(eScr.x - sideW * 0.3, eScr.y - hPrism - sideW * 1.1); // tall spike 1
            ctx.lineTo(eScr.x - sideW * 0.1, eScr.y - hPrism - sideW * 0.1);
            
            ctx.lineTo(eScr.x + sideW * 0.3, eScr.y - hPrism - sideW * 1.3); // tall spike 2
            ctx.lineTo(eScr.x + sideW * 0.6, eScr.y - hPrism - sideW * 0.2);
            ctx.closePath();
            ctx.fill();

            // Armored glow channels
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = Math.max(0.5, 1.8 * eScr.scale);
            ctx.beginPath();
            ctx.moveTo(eScr.x, eScr.y - hPrism * 0.2);
            ctx.lineTo(eScr.x - sideW * 0.7, eScr.y - hPrism * 0.5);
            ctx.moveTo(eScr.x, eScr.y - hPrism * 0.2);
            ctx.lineTo(eScr.x + sideW * 0.7, eScr.y - hPrism * 0.5);
            ctx.stroke();

            // Broad-spaced heavy walker stompers
            ctx.strokeStyle = shadeColor(enemy.color, -40);
            ctx.lineWidth = Math.max(0.5, 3.5 * eScr.scale);
            const legPhase = Math.sin(enemy.swingCycle);
            ctx.beginPath();
            ctx.moveTo(eScr.x - sideW * 0.4, eScr.y - hPrism * 0.2);
            ctx.lineTo(eScr.x - sideW * 1.4, eScr.y + sideW * (0.3 + legPhase * 0.3));
            
            ctx.moveTo(eScr.x + sideW * 0.4, eScr.y - hPrism * 0.2);
            ctx.lineTo(eScr.x + sideW * 1.4, eScr.y + sideW * (0.3 - legPhase * 0.3));
            ctx.stroke();
          }
          else {
            // Giant MUTANT OVERLORD (Boss) visual composition
            const hPrism = enemy.size * 2.2 * eScr.scale;
            
            // Dark obsidian plating base structure
            ctx.fillStyle = '#1e1b4b'; // deep indigo slate base
            ctx.beginPath();
            ctx.moveTo(eScr.x, eScr.y);
            ctx.lineTo(eScr.x + sideW, eScr.y - sideW * 0.5);
            ctx.lineTo(eScr.x + sideW, eScr.y - sideW * 0.5 - hPrism);
            ctx.lineTo(eScr.x, eScr.y - hPrism);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#312e81'; // slightly brighter left side
            ctx.beginPath();
            ctx.moveTo(eScr.x, eScr.y);
            ctx.lineTo(eScr.x - sideW, eScr.y - sideW * 0.5);
            ctx.lineTo(eScr.x - sideW, eScr.y - sideW * 0.5 - hPrism);
            ctx.lineTo(eScr.x, eScr.y - hPrism);
            ctx.closePath();
            ctx.fill();

            // Neon reactor core pulsating in the chest center
            const pulse = 1 + Math.sin(Date.now() / 80) * 0.25;
            const coreRad = Math.max(0.1, 6 * eScr.scale * pulse);
            const coreGrad = ctx.createRadialGradient(eScr.x, eScr.y - hPrism * 0.5, 1, eScr.x, eScr.y - hPrism * 0.5, Math.max(1, coreRad * 1.8));
            coreGrad.addColorStop(0, '#f472b6'); // Radiant hot pink
            coreGrad.addColorStop(0.4, '#c084fc'); // Purple
            coreGrad.addColorStop(1, 'rgba(168, 85, 247, 0)');
            ctx.fillStyle = coreGrad;
            ctx.beginPath();
            ctx.arc(eScr.x, eScr.y - hPrism * 0.5, coreRad * 2, 0, Math.PI * 2);
            ctx.fill();

            // Titan twin shoulder shield generators
            const rotAngle = Date.now() * 0.004;
            ctx.strokeStyle = '#a855f7';
            ctx.lineWidth = Math.max(0.5, 1.5 * eScr.scale);
            // Left shoulder pad & generator ring
            ctx.fillStyle = '#1e1b4b';
            ctx.beginPath();
            ctx.arc(eScr.x - sideW * 0.8, eScr.y - hPrism * 0.8, Math.max(0.1, 5 * eScr.scale), 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            ctx.beginPath();
            ctx.ellipse(eScr.x - sideW * 0.8, eScr.y - hPrism * 0.8, Math.max(0.1, 10 * eScr.scale), Math.max(0.1, 4 * eScr.scale), rotAngle, 0, Math.PI * 2);
            ctx.stroke();

            // Right shoulder pad & generator ring
            ctx.beginPath();
            ctx.arc(eScr.x + sideW * 0.8, eScr.y - hPrism * 0.8, Math.max(0.1, 5 * eScr.scale), 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            ctx.beginPath();
            ctx.ellipse(eScr.x + sideW * 0.8, eScr.y - hPrism * 0.8, Math.max(0.1, 10 * eScr.scale), Math.max(0.1, 4 * eScr.scale), -rotAngle, 0, Math.PI * 2);
            ctx.stroke();

            // Giant Overlord horns
            ctx.fillStyle = '#ec4899';
            ctx.beginPath();
            // Left Horn
            ctx.moveTo(eScr.x - sideW * 0.3, eScr.y - hPrism);
            ctx.quadraticCurveTo(eScr.x - sideW * 0.9, eScr.y - hPrism - sideW * 0.6, eScr.x - sideW * 0.7, eScr.y - hPrism - sideW * 1.55);
            ctx.lineTo(eScr.x - sideW * 0.15, eScr.y - hPrism - sideW * 0.4);
            // Right Horn
            ctx.moveTo(eScr.x + sideW * 0.3, eScr.y - hPrism);
            ctx.quadraticCurveTo(eScr.x + sideW * 0.9, eScr.y - hPrism - sideW * 0.6, eScr.x + sideW * 0.7, eScr.y - hPrism - sideW * 1.55);
            ctx.lineTo(eScr.x + sideW * 0.15, eScr.y - hPrism - sideW * 0.4);
            ctx.closePath();
            ctx.fill();

            // Giant heavy walker multiple legs
            ctx.strokeStyle = '#c084fc';
            ctx.lineWidth = Math.max(0.5, 4.5 * eScr.scale);
            ctx.beginPath();
            const phase = Math.sin(enemy.swingCycle);
            // Outer left heavy leg
            ctx.moveTo(eScr.x - sideW * 0.6, eScr.y - hPrism * 0.1);
            ctx.lineTo(eScr.x - sideW * 1.6, eScr.y + sideW * (0.8 + phase * 0.25));
            // Inner left stabilizer
            ctx.moveTo(eScr.x - sideW * 0.2, eScr.y - hPrism * 0.1);
            ctx.lineTo(eScr.x - sideW * 0.9, eScr.y + sideW * 0.9);
            // Outer right heavy leg
            ctx.moveTo(eScr.x + sideW * 0.6, eScr.y - hPrism * 0.1);
            ctx.lineTo(eScr.x + sideW * 1.6, eScr.y + sideW * (0.8 - phase * 0.25));
            // Inner right stabilizer
            ctx.moveTo(eScr.x + sideW * 0.2, eScr.y - hPrism * 0.1);
            ctx.lineTo(eScr.x + sideW * 0.9, eScr.y + sideW * 0.9);
            ctx.stroke();
          }

          // 4. Draw Mini HP bar formatted in 3D depth space!
          if (enemy.hp < enemy.maxHp) {
            const hBarW = sideW * 2.2;
            const barPct = Math.max(0, enemy.hp / enemy.maxHp);
            ctx.fillStyle = 'rgba(239, 68, 68, 0.75)';
            ctx.fillRect(eScr.x - hBarW / 2, eScr.y - prismH - 6, hBarW, 2.5);
            ctx.fillStyle = '#10b981';
            ctx.fillRect(eScr.x - hBarW / 2, eScr.y - prismH - 6, hBarW * barPct, 2.5);
          }
          }

          // --- PLAYER DAMAGE COLLISION OVERLAPS ---
          if (dist < enemy.size + 15) {
            // Apply damage
            setSurvivorHp(prev => {
              const baseDmg = enemy.type === 'boss' ? 15 : enemy.type === 'brute' ? 8 : 4;
              let finalDmg = Math.ceil(baseDmg * (1 + elapsedTime * 0.005));
              
              // Shield absorber checks
              if (activePowerups.includes('Shield')) {
                finalDmg = Math.ceil(finalDmg * 0.3); // absorbing 70% damage
              }
              
              const postHp = prev - finalDmg;
              
              addFloatText(`-${finalDmg} HP`, pX, pY, 30, '#ef4444');
              // Scale shake intensity dynamically based on damage taken for more visceral heavy hits
              const shakeAmt = Math.min(30, 8 + finalDmg * 1.5);
              cameraShake.current.intensity = shakeAmt;
              playSound('hit');

              if (postHp <= 0) {
                setIsPlaying(false);
                spawnExplosion3D(pX, pY, pZ, '#ef4444', 35, 1.8);
                playSound('explosion');
                return 0;
              }
              return postHp;
            });

            // Push mutant backward with recoil physics
            enemy.x -= (dx / dist) * 22;
            enemy.y -= (dy / dist) * 22;
            spawnExplosion3D(enemy.x, enemy.y, enemy.z, '#ef4444', 6, 0.8);
          }
        });

        // --- UPDATE SPITTER PROJECTS BOMB LINES ---
        spitProjectilesRef.current.forEach((proj) => {
          proj.progress += proj.speed;
          
          // Trajectory Interpolations
          proj.x = proj.startX + (proj.targetX - proj.startX) * proj.progress;
          proj.y = proj.startY + (proj.targetY - proj.startY) * proj.progress;
          
          // Parabolic Z Elevation (peaks in middle)
          proj.z = Math.sin(proj.progress * Math.PI) * 55;

          const sScr = toScreen(proj.x, proj.y, proj.z);

          // Render projected shadow on floor
          ctx.fillStyle = 'rgba(22, 163, 74, 0.22)';
          ctx.beginPath();
          const shadowSize = Math.max(0.1, 8 * (0.3 + proj.progress * 0.7));
          ctx.ellipse(toScreen(proj.x, proj.y, 0).x, toScreen(proj.x, proj.y, 0).y, shadowSize, Math.max(0.1, shadowSize * 0.4), 0, 0, Math.PI * 2);
          ctx.fill();

          // Render glowing toxic saliva ball
          ctx.fillStyle = '#4ade80';
          ctx.beginPath();
          ctx.arc(sScr.x, sScr.y, 5, 0, Math.PI * 2);
          ctx.fill();
          
          // Outer flare ring
          ctx.fillStyle = 'rgba(74, 222, 128, 0.4)';
          ctx.beginPath();
          ctx.arc(sScr.x, sScr.y, 8, 0, Math.PI * 2);
          ctx.fill();

          // Hit ground trigger checks
          if (proj.progress >= 1.0) {
            proj.progress = 2.0; // flag active blast
            playSound('hit');
            spawnExplosion3D(proj.x, proj.y, 0, '#22c55e', 8, 0.6);

            // Compute blast zone overlap with player
            const bdx = playerPos.current.x - proj.x;
            const bdy = playerPos.current.y - proj.y;
            const bdist = Math.sqrt(bdx * bdx + bdy * bdy);
            if (bdist < 38) {
              setSurvivorHp(prev => {
                const finalDmg = 8;
                addFloatText(`-${finalDmg} TOXIC DAMAGE`, playerPos.current.x, playerPos.current.y, 30, '#ef4444');
                cameraShake.current.intensity = 18; // Heavy splat impact shake
                return Math.max(0, prev - finalDmg);
              });
            }
          }
        });
        spitProjectilesRef.current = spitProjectilesRef.current.filter(p => p.progress < 1.5);

        // --- AUTOMATED PLAYER MELEE & RANGE AUTO SHOOTING ---
        if (enemiesRef.current.length > 0) {
          // Identify nearest threatened target in perspective list
          let closestEnemy: Enemy | null = null;
          let minDist = 99999;
          enemiesRef.current.forEach((e) => {
            const dx = e.x - pX;
            const dy = e.y - pY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) {
              minDist = dist;
              closestEnemy = e;
            }
          });

          // Weapon range speed scales up with persistent Laboratory base level!
          const attackRateDelay = Math.max(160, 420 - labLevel * 30);
          if (closestEnemy && now - lastShootTime.current > attackRateDelay) {
            lastShootTime.current = now;
            const target: Enemy = closestEnemy;
            const tdx = target.x - pX;
            const tdy = target.y - pY;
            const tdist = Math.sqrt(tdx * tdx + tdy * tdy);

            // Fire Bullet vectors
            playSound('shoot');
            const dmgBase = 8 + labLevel * 3;

            bulletsRef.current.push({
              x: pX,
              y: pY,
              z: pZ + 5,
              vx: (tdx / tdist) * 8.5,
              vy: (tdy / tdist) * 8.5,
              vz: (target.z - pZ) / 20, // targeted altitude adjustments
              color: themeColors.accent,
              damage: dmgBase,
              life: 60
            });

            // Base Upgraded Support Auto-Turrets rocket triggers!
            if (turretLevel > 1) {
              // Timeout delays secondary rocket arcing for extreme action feedback
              setTimeout(() => {
                if (enemiesRef.current.length > 0) {
                  // Fire automatic laser heavy bolts
                  const secondaryTarget = enemiesRef.current[Math.floor(Math.random() * enemiesRef.current.length)];
                  const sTdx = secondaryTarget.x - pX;
                  const sTdy = secondaryTarget.y - pY;
                  const sTdist = Math.sqrt(sTdx * sTdx + sTdy * sTdy);
                  
                  bulletsRef.current.push({
                    x: pX - 15,
                    y: pY + 10,
                    z: 16,
                    vx: (sTdx / sTdist) * 11,
                    vy: (sTdy / sTdist) * 11,
                    vz: 1.5,
                    color: '#06b6d4',
                    damage: 5 + turretLevel * 2,
                    life: 50,
                    isRockets: true
                  });
                  playSound('shoot');
                }
              }, 70);
            }
          }
        }

        // --- UPDATE PLAYER BULLETS ---
        bulletsRef.current.forEach((b) => {
          b.x += b.vx;
          b.y += b.vy;
          b.z += b.vz;
          b.life -= 1;

          // Trail sparks arcing down
          if (Math.random() < 0.3) {
            particlesRef.current.push({
              x: b.x,
              y: b.y,
              z: b.z,
              vx: (Math.random() - 0.5) * 0.4,
              vy: (Math.random() - 0.5) * 0.4,
              vz: -0.2,
              color: b.color,
              alpha: 0.7,
              life: 10,
              maxLife: 10,
              size: 1.2
            });
          }

          const bScr = toScreen(b.x, b.y, b.z);

          // Render glowing projectile circles
          ctx.fillStyle = b.color;
          ctx.beginPath();
          const rSize = b.isRockets ? 5 : 3;
          ctx.arc(bScr.x, bScr.y, Math.max(0.1, rSize * bScr.scale), 0, Math.PI * 2);
          ctx.fill();

          // Dual fire core halos
          if (activePowerups.includes('Fire')) {
            ctx.fillStyle = 'rgba(244, 63, 94, 0.35)';
            ctx.beginPath();
            ctx.arc(bScr.x, bScr.y, Math.max(0.1, (rSize + 4) * bScr.scale), 0, Math.PI * 2);
            ctx.fill();
          }

          // Bullet overlaps enemy hit boxes checks
          enemiesRef.current.forEach((enemy) => {
            const dx = enemy.x - b.x;
            const dy = enemy.y - b.y;
            const dz = enemy.z - b.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (dist < enemy.size + 10) {
              b.life = 0; // kill bullet

              let finalDmg = b.damage;
              
              // Applied powerup modifications inside loops!
              if (activePowerups.includes('Fire')) {
                finalDmg = Math.ceil(finalDmg * 1.3); // Core fire multipliers!
                spawnExplosion3D(enemy.x, enemy.y, enemy.z, '#ef4444', 5, 0.6);
                addFloatText(`-${finalDmg} BURN! 🔥`, enemy.x, enemy.y, enemy.z + 15, '#f43f5e');
              } else {
                addFloatText(`-${finalDmg}`, enemy.x, enemy.y, enemy.z + 15, '#e2e8f0');
              }

              enemy.hp -= finalDmg;
              playSound('kill');

              // --- Lightning Chain arcing triggers! ---
              if (activePowerups.includes('Chain') && Math.random() < 0.55) {
                const peers = enemiesRef.current.filter(peer => peer.id !== enemy.id);
                if (peers.length > 0) {
                  // Arc to secondary target
                  const nextTarget = peers[0];
                  nextTarget.hp -= Math.ceil(finalDmg * 0.65);
                  addFloatText(`-${Math.ceil(finalDmg * 0.65)} ZAP! ⚡`, nextTarget.x, nextTarget.y, nextTarget.z + 15, '#06b6d4');
                  
                  // Render jagged lightning lines in perspective!
                  const startProj = toScreen(enemy.x, enemy.y, enemy.z + 10);
                  const endProj = toScreen(nextTarget.x, nextTarget.y, nextTarget.z + 10);
                  ctx.strokeStyle = '#22d3ee';
                  ctx.lineWidth = 3;
                  ctx.beginPath();
                  ctx.moveTo(startProj.x, startProj.y);
                  // jag midpoints
                  const midX = (startProj.x + endProj.x) / 2 + (Math.random() - 0.5) * 20;
                  const midY = (startProj.y + endProj.y) / 2 + (Math.random() - 0.5) * 20;
                  ctx.lineTo(midX, midY);
                  ctx.lineTo(endProj.x, endProj.y);
                  ctx.stroke();

                  playSound('lightning');
                  spawnExplosion3D(nextTarget.x, nextTarget.y, nextTarget.z, '#22d3ee', 4, 0.4);
                }
              }

              // --- Freeze slows triggers! ---
              if (activePowerups.includes('Frozen')) {
                enemy.speed = Math.max(0.12, enemy.speed * 0.45);
                spawnExplosion3D(enemy.x, enemy.y, enemy.z, '#38bdf8', 4, 0.3);
              }

              if (enemy.hp <= 0) {
                // mutant dead
                setScore(p => p + 1);
                onEnemyKilled();

                // Alloys drops index based on type
                const alloyReward = enemy.type === 'boss' ? 50 : enemy.type === 'brute' ? 3 : 1;
                setMaterials(m => m + alloyReward);
                onMaterialsGathered(alloyReward);
                addFloatText(`+${alloyReward} Alloy 🔩`, enemy.x, enemy.y, 10, '#38bdf8');

                // Crystals XP level gems drops
                gemsRef.current.push({
                  x: enemy.x,
                  y: enemy.y,
                  z: 0,
                  xp: enemy.type === 'boss' ? 150 : enemy.type === 'brute' ? 30 : 10,
                  size: enemy.type === 'boss' ? 12 : enemy.type === 'brute' ? 6 : 4,
                  bobOffset: Math.random() * 10
                });

                spawnExplosion3D(enemy.x, enemy.y, enemy.z, enemy.color, 16, 1.2);
              } else {
                spawnExplosion3D(enemy.x, enemy.y, enemy.z, '#94a3b8', 4, 0.4);
              }
            }
          });
        });
        bulletsRef.current = bulletsRef.current.filter(b => b.life > 0);

        // --- FILTER DEAD ENEMIES ---
        enemiesRef.current = enemiesRef.current.filter(e => e.hp > 0);

        // --- UPDATE XP CRYSTALS / GEMS ---
        gemsRef.current.forEach((gem) => {
          gem.bobOffset += 0.08;
          gem.z = 4 + Math.sin(gem.bobOffset) * 3;

          const hdx = pX - gem.x;
          const hdy = pY - gem.y;
          const hdist = Math.sqrt(hdx * hdx + hdy * hdy);

          // Tuk-Tuk Powerup grants colossal magnetic traction!
          const magnetPullDist = activePowerups.includes('Tuk-Tuk') ? 140 : 65;
          if (hdist < magnetPullDist) {
            gem.x += (hdx / hdist) * 5;
            gem.y += (hdy / hdist) * 5;
          }

          const drawGemInline = false;
          if (drawGemInline) {
            const gScr = toScreen(gem.x, gem.y, gem.z);

            // Floor Shadow
            ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
            ctx.beginPath();
            ctx.ellipse(toScreen(gem.x, gem.y, 0).x, toScreen(gem.x, gem.y, 0).y, Math.max(0.1, gem.size * gScr.scale * 1.5), Math.max(0.1, gem.size * gScr.scale * 0.6), 0, 0, Math.PI * 2);
            ctx.fill();

            // 3D Gem diamond prism representation
            ctx.fillStyle = '#10b981';
            ctx.beginPath();
            ctx.moveTo(gScr.x, gScr.y - gem.size * gScr.scale * 1.8);
            ctx.lineTo(gScr.x + gem.size * gScr.scale, gScr.y);
            ctx.lineTo(gScr.x, gScr.y + gem.size * gScr.scale * 1.8);
            ctx.lineTo(gScr.x - gem.size * gScr.scale, gScr.y);
            ctx.closePath();
            ctx.fill();

            // White reflect shine sparkles
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(gScr.x, gScr.y - gem.size * gScr.scale * 1.8);
            ctx.lineTo(gScr.x + gem.size * gScr.scale * 0.4, gScr.y);
            ctx.lineTo(gScr.x, gScr.y + gem.size * gScr.scale * 1.8);
            ctx.closePath();
            ctx.fill();
          }

          // Collection checkpoint trigger
          if (hdist < gem.size + 15) {
            gem.x = -9999; // trigger deletion sequence
            playSound('gem');
            runGemsCollected.current += 1;

            setXp(gp => {
              const currentXp = gp + gem.xp;
              addFloatText(`+${gem.xp} XP 💎`, pX, pY, 35, '#10b981');
              if (currentXp >= xpNeeded) {
                // Raise survivor level!
                setTimeout(() => { triggerLevelUp(); }, 50);
                setLevel(l => l + 1);
                setXpNeeded(req => Math.floor(req * 1.45));
                return currentXp - xpNeeded;
              }
              return currentXp;
            });
          }
        });
        gemsRef.current = gemsRef.current.filter(g => g.x > -1000);

        // --- DRAW BARRICADES & CALTROPS AND PLAYER (DELEGATED TO DEPTH-SORTED QUEUE) ---
        const drawPlayerInline = false;
        if (drawPlayerInline) {
        if (activePowerups.includes('Toxic')) {
          // Draw poison caltrops on flat surface
          for (let sp = 150; sp <= 750; sp += 150) {
            const spScr = toScreen(sp, 360, 0);
            ctx.fillStyle = '#10b981';
            ctx.beginPath();
            ctx.arc(spScr.x, spScr.y, Math.max(0.1, 4 * spScr.scale), 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = '#059669';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(spScr.x, spScr.y - 6);
            ctx.lineTo(spScr.x, spScr.y + 6);
            ctx.moveTo(spScr.x - 6, spScr.y);
            ctx.lineTo(spScr.x + 6, spScr.y);
            ctx.stroke();
          }
        }

        // --- DRAW THE ADVANCED 3D HOVER-BUS PLAYER ---
        const pScr = toScreen(pX, pY, pZ);

        // 1. Perspective Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        // larger shadow width when close to ground, smaller when high
        const shadRadius = Math.max(0.1, 18 * pScr.scale);
        ctx.ellipse(toScreen(pX, pY, 0).x, toScreen(pX, pY, 0).y, shadRadius, Math.max(0.1, shadRadius * 0.45), 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. Translucent wireframe Shield Dome
        if (activePowerups.includes('Shield')) {
          ctx.strokeStyle = 'cyan';
          ctx.lineWidth = 1.2;
          ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
          ctx.beginPath();
          ctx.arc(pScr.x, pScr.y, Math.max(0.1, 25 * pScr.scale), 0, Math.PI * 2);
          ctx.stroke();
          ctx.fill();
          
          // rotating shield orbit nodes
          const nodeAngle = Date.now() * 0.003;
          ctx.fillStyle = '#22d3ee';
          ctx.beginPath();
          ctx.arc(pScr.x + Math.cos(nodeAngle) * 25 * pScr.scale, pScr.y + Math.sin(nodeAngle) * 10 * pScr.scale, 4, 0, Math.PI * 2);
          ctx.fill();
        }

        // 3. Draw 3D Bus Facade (Multiple connected polygons)
        const busW = 16 * pScr.scale;
        const busL = 26 * pScr.scale;
        const busH = 15 * pScr.scale;

        // Dynamic cyber hover engine landing pods drawing (3D ellipse spinning)
        const hoverAngle = (Date.now() / 140) % (Math.PI * 2);
        const engineRadius = 4.5 * pScr.scale;
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = Math.max(0.6, 2 * pScr.scale);
        
        // Rear Hover engine ring
        ctx.beginPath();
        ctx.ellipse(pScr.x - busL * 0.4, pScr.y + 3, Math.max(0.1, engineRadius * 1.5), Math.max(0.1, engineRadius * 0.6), hoverAngle, 0, Math.PI * 2);
        ctx.stroke();
        
        // Front Hover engine ring 
        ctx.beginPath();
        ctx.ellipse(pScr.x + busL * 0.4, pScr.y + busW * 0.4, Math.max(0.1, engineRadius * 1.5), Math.max(0.1, engineRadius * 0.6), hoverAngle, 0, Math.PI * 2);
        ctx.stroke();

        // High fidelity twin plasma flame trailing from the hover engines
        const flamePulse = Math.sin(Date.now() / 50) * 5;
        const pThrusterGrad = ctx.createLinearGradient(pScr.x - busL * 0.5, pScr.y, pScr.x - busL * 1.4, pScr.y);
        pThrusterGrad.addColorStop(0, '#06b6d4'); // Bright Cyan
        pThrusterGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.7)'); // Neon Purple
        pThrusterGrad.addColorStop(1, 'rgba(236, 72, 153, 0)'); // Fade to transparent
        ctx.fillStyle = pThrusterGrad;
        ctx.beginPath();
        ctx.moveTo(pScr.x - busL * 0.4, pScr.y - busH * 0.2);
        ctx.lineTo(pScr.x - busL * 1.3 - flamePulse, pScr.y);
        ctx.lineTo(pScr.x - busL * 0.4, pScr.y - busH * 0.7);
        ctx.closePath();
        ctx.fill();

        // Visual headlight cones projected into forward grid
        const headlightGrad = ctx.createLinearGradient(pScr.x, pScr.y, pScr.x + 130 * pScr.scale, pScr.y + 35 * pScr.scale);
        headlightGrad.addColorStop(0, 'rgba(253, 224, 71, 0.45)');
        headlightGrad.addColorStop(1, 'rgba(253, 224, 71, 0.0)');
        ctx.fillStyle = headlightGrad;
        ctx.beginPath();
        ctx.moveTo(pScr.x + 5, pScr.y);
        ctx.lineTo(pScr.x + 140 * pScr.scale, pScr.y - 25 * pScr.scale);
        ctx.lineTo(pScr.x + 140 * pScr.scale, pScr.y + 55 * pScr.scale);
        ctx.closePath();
        ctx.fill();

        // Draw Bus Right/Side Facade
        ctx.fillStyle = shadeColor(themeColors.player, -35); // shaded dark side
        ctx.beginPath();
        ctx.moveTo(pScr.x - busL / 2, pScr.y);
        ctx.lineTo(pScr.x + busL / 2, pScr.y + busW / 2);
        ctx.lineTo(pScr.x + busL / 2, pScr.y + busW / 2 - busH);
        ctx.lineTo(pScr.x - busL / 2, pScr.y - busH);
        ctx.closePath();
        ctx.fill();

        // Draw Bus Left/Bottom Angle Facade
        ctx.fillStyle = shadeColor(themeColors.player, -20);
        ctx.beginPath();
        ctx.moveTo(pScr.x - busL / 2, pScr.y);
        ctx.lineTo(pScr.x - busL / 2 - busW, pScr.y - busW * 0.4);
        ctx.lineTo(pScr.x - busL / 2 - busW, pScr.y - busW * 0.4 - busH);
        ctx.lineTo(pScr.x - busL / 2, pScr.y - busH);
        ctx.closePath();
        ctx.fill();

        // Draw Bus flat Top Roof
        ctx.fillStyle = themeColors.player;
        ctx.beginPath();
        ctx.moveTo(pScr.x - busL / 2, pScr.y - busH);
        ctx.lineTo(pScr.x + busL / 2, pScr.y + busW / 2 - busH);
        ctx.lineTo(pScr.x + busL / 2 - busW, pScr.y - busW * 0.45 - busH);
        ctx.lineTo(pScr.x - busL / 2 - busW, pScr.y - busW * 0.4 - busH);
        ctx.closePath();
        ctx.fill();

        // Draw bright Cyan Neon Glass Windshield block
        ctx.fillStyle = '#06b6d4';
        ctx.beginPath();
        ctx.moveTo(pScr.x + busL / 2, pScr.y + busW / 2 - busH);
        ctx.lineTo(pScr.x + busL / 2, pScr.y + busW / 2 - busH * 0.5);
        ctx.lineTo(pScr.x + busL / 2 - 8, pScr.y + busW / 2 * 0.4);
        ctx.lineTo(pScr.x + busL / 2 - 8, pScr.y - busH + 5);
        ctx.closePath();
        ctx.fill();

        // Draw bright glowing headlight bulb nodes at the front face
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(pScr.x + busL / 2 - 2, pScr.y + busW / 3 - busH * 0.35, Math.max(0.1, 2.5 * pScr.scale), 0, Math.PI * 2);
        ctx.arc(pScr.x + busL / 2 - 5, pScr.y + busW / 2 - busH * 0.25, Math.max(0.1, 2.5 * pScr.scale), 0, Math.PI * 2);
        ctx.fill();

        // Glowing Neon hazard siren on roof
        const sirenColor = Date.now() % 300 < 150 ? '#ef4444' : '#3b82f6';
        ctx.fillStyle = sirenColor;
        ctx.beginPath();
        ctx.arc(pScr.x - 5, pScr.y - busH - 2, Math.max(0.1, 2.8 * pScr.scale), 0, Math.PI * 2);
        ctx.fill();

        // Dual kinetic rocket weapon rails pointing at nearest threat
        if (enemiesRef.current.length > 0) {
          const closest = enemiesRef.current[0];
          const ang = Math.atan2(closest.y - pY, closest.x - pX);
          ctx.strokeStyle = '#f8fafc';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(pScr.x, pScr.y - busH);
          ctx.lineTo(pScr.x + Math.cos(ang) * 16 * pScr.scale, pScr.y - busH + Math.sin(ang) * 10 * pScr.scale);
          ctx.stroke();
        }

        // Thruster sparks trailing from vehicles back bumper!
        if (Math.random() < 0.4) {
          particlesRef.current.push({
            x: pX - 25,
            y: pY + (Math.random() - 0.5) * 15,
            z: pZ,
            vx: -3.5 - Math.random() * 2,
            vy: (Math.random() - 0.5) * 1,
            vz: Math.random() * 0.8,
            color: '#fbbf24',
            alpha: 1.0,
            life: 14,
            maxLife: 14,
            size: 2.2
          });
        }
      }
      }

      // ==========================================
      // VIRTUAL WORLD UNIFIED DEPTH-SORTED RENDERER
      // ==========================================
      const sortedDrawables: { y: number; draw: () => void }[] = [];

      // Draw Ground Cyber-Road markers on flat grid plane for world cohesion
      ctx.save();
      ctx.strokeStyle = vibeStyle === 'Neon Rust' ? 'rgba(168, 85, 247, 0.18)' : 'rgba(6, 182, 212, 0.15)';
      ctx.lineWidth = 1.5;
      for (let cr = 110; cr <= 450; cr += 45) {
        const arrowL = toScreen(350, cr, 0);
        const arrowR = toScreen(450, cr, 0);
        ctx.beginPath();
        ctx.moveTo(arrowL.x, arrowL.y);
        ctx.lineTo((arrowL.x + arrowR.x) / 2, arrowL.y - 4 * arrowL.scale);
        ctx.lineTo(arrowR.x, arrowR.y);
        ctx.stroke();
      }
      ctx.restore();

      // Helper function to draw custom 3D simulated landmarks
      const drawLandmark = (l: typeof landmarksRef.current[0]) => {
        const sScr = toScreen(l.x, l.y, 0);
        const lScale = sScr.scale;
        
        ctx.save();
        const tPulse = Math.sin(Date.now() * l.pulseRate) * 0.14;
        const finalSize = l.size * (1 + tPulse);
        
        if (l.type === 'spire') {
          // Perspective circular shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
          ctx.beginPath();
          ctx.ellipse(sScr.x, sScr.y, finalSize * 1.2 * lScale, finalSize * 0.4 * lScale, 0, 0, Math.PI * 2);
          ctx.fill();
          
          const towerH = finalSize * 3.8 * lScale;
          const towerW = finalSize * 0.8 * lScale;
          const g = ctx.createLinearGradient(sScr.x - towerW, sScr.y, sScr.x + towerW, sScr.y);
          g.addColorStop(0, shadeColor(l.color, -50));
          g.addColorStop(0.5, l.color);
          g.addColorStop(1, shadeColor(l.color, -70));
          
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(sScr.x - towerW, sScr.y);
          ctx.lineTo(sScr.x + towerW, sScr.y);
          ctx.lineTo(sScr.x + towerW * 0.3, sScr.y - towerH);
          ctx.lineTo(sScr.x - towerW * 0.3, sScr.y - towerH);
          ctx.closePath();
          ctx.fill();
          
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = Math.max(0.5, 1.2 * lScale);
          ctx.beginPath();
          ctx.moveTo(sScr.x, sScr.y);
          ctx.lineTo(sScr.x, sScr.y - towerH);
          ctx.stroke();
          
          ctx.strokeStyle = l.color;
          ctx.lineWidth = Math.max(0.5, 1.5 * lScale);
          ctx.beginPath();
          ctx.ellipse(sScr.x, sScr.y - towerH, finalSize * 1.5 * lScale, finalSize * 0.5 * lScale, Date.now() * 0.002, 0, Math.PI * 2);
          ctx.stroke();
          
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(sScr.x, sScr.y - towerH, Math.max(1, 3.5 * lScale), 0, Math.PI * 2);
          ctx.fill();
          
          const flareG = ctx.createLinearGradient(sScr.x, sScr.y - towerH, sScr.x, sScr.y - towerH - 80);
          flareG.addColorStop(0, l.color);
          flareG.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.strokeStyle = flareG;
          ctx.lineWidth = Math.max(1, 4 * lScale);
          ctx.beginPath();
          ctx.moveTo(sScr.x, sScr.y - towerH);
          ctx.lineTo(sScr.x, sScr.y - towerH - 80);
          ctx.stroke();
        }
        else if (l.type === 'hologram') {
          ctx.fillStyle = '#1e293b';
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = Math.max(0.5, 1 * lScale);
          const podW = finalSize * 0.9 * lScale;
          ctx.beginPath();
          ctx.moveTo(sScr.x - podW, sScr.y);
          ctx.lineTo(sScr.x + podW, sScr.y);
          ctx.lineTo(sScr.x + podW * 0.4, sScr.y - 8 * lScale);
          ctx.lineTo(sScr.x - podW * 0.4, sScr.y - 8 * lScale);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          
          const coneG = ctx.createLinearGradient(sScr.x, sScr.y, sScr.x, sScr.y - 25 * lScale);
          coneG.addColorStop(0, 'rgba(6, 182, 212, 0.45)');
          coneG.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
          ctx.fillStyle = coneG;
          ctx.beginPath();
          ctx.moveTo(sScr.x - podW * 0.3, sScr.y - 8 * lScale);
          ctx.lineTo(sScr.x + podW * 0.3, sScr.y - 8 * lScale);
          ctx.lineTo(sScr.x + finalSize * 1.5 * lScale, sScr.y - 45 * lScale);
          ctx.lineTo(sScr.x - finalSize * 1.5 * lScale, sScr.y - 45 * lScale);
          ctx.closePath();
          ctx.fill();
          
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = Math.max(0.6, 1.8 * lScale);
          const rot = Date.now() * 0.003;
          ctx.beginPath();
          ctx.ellipse(sScr.x, sScr.y - 24 * lScale, finalSize * 1.2 * lScale, finalSize * 0.4 * lScale, rot, 0, Math.PI * 2);
          ctx.stroke();
          
          ctx.beginPath();
          ctx.ellipse(sScr.x, sScr.y - 36 * lScale, finalSize * 0.9 * lScale, finalSize * 0.3 * lScale, -rot * 1.4, 0, Math.PI * 2);
          ctx.stroke();
          
          ctx.fillStyle = '#06b6d4';
          ctx.beginPath();
          ctx.arc(sScr.x, sScr.y - 18 * lScale, Math.max(1, 4 * lScale), 0, Math.PI * 2);
          ctx.fill();
        }
        else if (l.type === 'billboard') {
          const pW = finalSize * 1.9 * lScale;
          const pH = finalSize * 1.0 * lScale;
          const elevationY = sScr.y - 20 * lScale;
          
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = Math.max(0.5, 2.5 * lScale);
          ctx.beginPath();
          ctx.moveTo(sScr.x - pW * 0.6, sScr.y);
          ctx.lineTo(sScr.x - pW * 0.6, elevationY);
          ctx.moveTo(sScr.x + pW * 0.6, sScr.y);
          ctx.lineTo(sScr.x + pW * 0.6, elevationY);
          ctx.stroke();
          
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.strokeStyle = l.color;
          ctx.lineWidth = Math.max(0.5, 1.5 * lScale);
          ctx.beginPath();
          ctx.rect(sScr.x - pW, elevationY - pH, pW * 2, pH);
          ctx.fill();
          ctx.stroke();
          
          const flicker = Math.random() > 0.06 ? 1.0 : 0.35;
          ctx.fillStyle = l.color;
          ctx.font = `bold ${Math.floor(finalSize * 0.45 * lScale)}px JetBrains Mono`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.globalAlpha = flicker * 0.85;
          ctx.fillText(l.label || "ASTRA CORP", sScr.x, elevationY - pH / 2);
        }
        else if (l.type === 'crater') {
          const rw = finalSize * 1.8 * lScale;
          const rh = finalSize * 0.7 * lScale;
          
          ctx.fillStyle = '#1c1917';
          ctx.beginPath();
          ctx.ellipse(sScr.x, sScr.y, rw * 1.25, rh * 1.25, 0, 0, Math.PI * 2);
          ctx.fill();
          
          const fluidG = ctx.createRadialGradient(sScr.x, sScr.y, 1, sScr.x, sScr.y, rw);
          fluidG.addColorStop(0, '#22c55e');
          fluidG.addColorStop(0.7, '#15803d');
          fluidG.addColorStop(1, '#14532d');
          
          ctx.fillStyle = fluidG;
          ctx.beginPath();
          ctx.ellipse(sScr.x, sScr.y, rw * 0.95, rh * 0.95, 0, 0, Math.PI * 2);
          ctx.fill();
          
          const ripSize = (Date.now() / 400) % 1.0;
          ctx.strokeStyle = 'rgba(74, 222, 128, ' + (1 - ripSize) + ')';
          ctx.lineWidth = Math.max(0.5, 1.2 * lScale);
          ctx.beginPath();
          ctx.ellipse(sScr.x, sScr.y, rw * ripSize, rh * ripSize, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        else if (l.type === 'wreck') {
          const wrSize = finalSize * 1.2 * lScale;
          
          ctx.fillStyle = shadeColor('#475569', -20);
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = Math.max(0.5, 1.5 * lScale);
          
          ctx.beginPath();
          ctx.moveTo(sScr.x - wrSize * 0.5, sScr.y);
          ctx.lineTo(sScr.x + wrSize * 0.7, sScr.y + wrSize * 0.2);
          ctx.lineTo(sScr.x + wrSize * 0.4, sScr.y - wrSize * 0.6);
          ctx.lineTo(sScr.x - wrSize * 0.3, sScr.y - wrSize * 0.8);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          
          const bStatus = Date.now() % 600 < 300;
          ctx.fillStyle = bStatus ? '#ef4444' : '#450a0a';
          ctx.beginPath();
          ctx.arc(sScr.x, sScr.y - wrSize * 0.4, Math.max(0.8, 3.5 * lScale), 0, Math.PI * 2);
          ctx.fill();
          
          if (Math.random() < 0.08) {
            particlesRef.current.push({
              x: l.x + (Math.random() - 0.5) * 15,
              y: l.y + (Math.random() - 0.5) * 10,
              z: 5,
              vx: (Math.random() - 0.5) * 1.1,
              vy: -0.5 - Math.random() * 1.2,
              vz: 2 + Math.random() * 2,
              color: '#fbbf24',
              alpha: 0.9,
              life: 15,
              maxLife: 15,
              size: 1.5
            });
          }
        }
        else if (l.type === 'windmill') {
          const baseW = finalSize * 0.3 * lScale;
          const poleH = finalSize * 4.2 * lScale;
          
          ctx.fillStyle = '#64748b';
          ctx.beginPath();
          ctx.moveTo(sScr.x - baseW, sScr.y);
          ctx.lineTo(sScr.x + baseW, sScr.y);
          ctx.lineTo(sScr.x + baseW * 0.4, sScr.y - poleH);
          ctx.lineTo(sScr.x - baseW * 0.4, sScr.y - poleH);
          ctx.closePath();
          ctx.fill();
          
          const rSpeed = Date.now() * 0.0018;
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = Math.max(0.6, 2.5 * lScale);
          
          for (let b = 0; b < 3; b++) {
            const blAngle = rSpeed + (b * Math.PI * 2 / 3);
            ctx.beginPath();
            ctx.moveTo(sScr.x, sScr.y - poleH);
            ctx.lineTo(sScr.x + Math.cos(blAngle) * finalSize * 2.2 * lScale, sScr.y - poleH + Math.sin(blAngle) * finalSize * 1.0 * lScale);
            ctx.stroke();
          }
          
          ctx.fillStyle = '#f43f5e';
          ctx.beginPath();
          ctx.arc(sScr.x, sScr.y - poleH, Math.max(0.5, 2.8 * lScale), 0, Math.PI * 2);
          ctx.fill();
        }
        else if (l.type === 'crystal') {
          const hPrism = finalSize * 1.5 * lScale;
          const wPrism = finalSize * 0.7 * lScale;
          
          ctx.fillStyle = l.color;
          ctx.beginPath();
          ctx.moveTo(sScr.x, sScr.y);
          ctx.lineTo(sScr.x + wPrism, sScr.y - hPrism * 0.3);
          ctx.lineTo(sScr.x, sScr.y - hPrism);
          ctx.lineTo(sScr.x - wPrism, sScr.y - hPrism * 0.3);
          ctx.closePath();
          ctx.fill();
          
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.beginPath();
          ctx.moveTo(sScr.x, sScr.y);
          ctx.lineTo(sScr.x + wPrism * 0.4, sScr.y - hPrism * 0.2);
          ctx.lineTo(sScr.x, sScr.y - hPrism);
          ctx.closePath();
          ctx.fill();
          
          ctx.fillStyle = shadeColor(l.color, -30);
          ctx.beginPath();
          ctx.moveTo(sScr.x - wPrism * 0.4, sScr.y);
          ctx.lineTo(sScr.x - wPrism * 1.2, sScr.y - hPrism * 0.1);
          ctx.lineTo(sScr.x - wPrism * 0.8, sScr.y - hPrism * 0.65);
          ctx.lineTo(sScr.x - wPrism * 0.2, sScr.y - hPrism * 0.1);
          ctx.closePath();
          ctx.fill();
        }
        
        ctx.restore();
      };

      // ADD BIOME LANDMARKS TO SORTED QUEUE
      landmarksRef.current.forEach((l) => {
        sortedDrawables.push({
          y: l.y,
          draw: () => drawLandmark(l)
        });
      });

      // ADD TOXIC CALTROPS TO SORTED QUEUE
      if (activePowerups.includes('Toxic')) {
        sortedDrawables.push({
          y: 360,
          draw: () => {
            for (let sp = 150; sp <= 750; sp += 150) {
              const spScr = toScreen(sp, 360, 0);
              
              ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
              ctx.beginPath();
              ctx.ellipse(spScr.x, spScr.y, Math.max(0.1, 14 * spScr.scale), Math.max(0.1, 6 * spScr.scale), 0, 0, Math.PI * 2);
              ctx.fill();

              ctx.fillStyle = '#10b981';
              ctx.beginPath();
              ctx.arc(spScr.x, spScr.y, Math.max(0.1, 4 * spScr.scale), 0, Math.PI * 2);
              ctx.fill();
              
              ctx.strokeStyle = '#059669';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(spScr.x, spScr.y - 6);
              ctx.lineTo(spScr.x, spScr.y + 6);
              ctx.moveTo(spScr.x - 6, spScr.y);
              ctx.lineTo(spScr.x + 6, spScr.y);
              ctx.stroke();
            }
          }
        });
      }

      // ADD XP CRYSTALS TO SORTED QUEUE
      gemsRef.current.forEach((gem) => {
        sortedDrawables.push({
          y: gem.y,
          draw: () => {
            const gScr = toScreen(gem.x, gem.y, gem.z);
            
            ctx.fillStyle = 'rgba(16, 185, 129, 0.16)';
            ctx.beginPath();
            ctx.ellipse(toScreen(gem.x, gem.y, 0).x, toScreen(gem.x, gem.y, 0).y, Math.max(0.1, gem.size * gScr.scale * 1.5), Math.max(0.1, gem.size * gScr.scale * 0.6), 0, 0, Math.PI * 2);
            ctx.fill();

            const pulse = Math.sin(Date.now() / 150 + gem.bobOffset) * 0.12;
            const sizeVal = gem.size * (1 + pulse) * gScr.scale;
            
            const gemColor = gem.xp > 5 ? '#f43f5e' : '#10b981';
            ctx.fillStyle = gemColor;
            ctx.beginPath();
            ctx.moveTo(gScr.x, gScr.y - sizeVal * 1.8);
            ctx.lineTo(gScr.x + sizeVal, gScr.y);
            ctx.lineTo(gScr.x, gScr.y + sizeVal * 1.8);
            ctx.lineTo(gScr.x - sizeVal, gScr.y);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(gScr.x, gScr.y - sizeVal * 1.8);
            ctx.lineTo(gScr.x + sizeVal * 0.35, gScr.y);
            ctx.lineTo(gScr.x, gScr.y + sizeVal * 1.8);
            ctx.closePath();
            ctx.fill();
          }
        });
      });

      // ADD WASTELAND ENEMIES WITH UNIFIED HIGH-GRADE DESIGNS
      enemiesRef.current.forEach((enemy) => {
        sortedDrawables.push({
          y: enemy.y,
          draw: () => {
            const eScr = toScreen(enemy.x, enemy.y, enemy.z);
            const sideW = enemy.size * eScr.scale;
            const prismH = enemy.size * 1.8 * eScr.scale;

            // Perspective shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.beginPath();
            ctx.ellipse(eScr.x, toScreen(enemy.x, enemy.y, 0).y, Math.max(0.1, enemy.size * eScr.scale * 1.5), Math.max(0.1, enemy.size * eScr.scale * 0.6), 0, 0, Math.PI * 2);
            ctx.fill();

            if (enemy.type === 'crawler') {
              // "Radioactive Mecha-Byte"
              const hPrism = enemy.size * 1.4 * eScr.scale;
              
              const segments = 4;
              for (let i = segments - 1; i >= 0; i--) {
                const segScale = 1 - i * 0.22;
                const segX = eScr.x - (i * sideW * 0.45);
                const segY = eScr.y - (i * sideW * 0.12);
                
                const grad = ctx.createRadialGradient(segX, segY - hPrism * segScale, 1, segX, segY - hPrism * segScale, sideW * segScale * 1.5);
                grad.addColorStop(0, enemy.color);
                grad.addColorStop(1, shadeColor(enemy.color, -50));
                
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.ellipse(segX, segY - hPrism * segScale, sideW * segScale * 1.35, sideW * segScale * 0.85, 0.08, 0, Math.PI * 2);
                ctx.fill();
              }

              ctx.fillStyle = '#fef08a';
              ctx.beginPath();
              ctx.arc(eScr.x + sideW * 0.4, eScr.y - hPrism * 1.25, Math.max(0.2, 2.5 * eScr.scale), 0, Math.PI * 2);
              ctx.arc(eScr.x - sideW * 0.1, eScr.y - hPrism * 1.3, Math.max(0.2, 2.5 * eScr.scale), 0, Math.PI * 2);
              ctx.fill();

              ctx.strokeStyle = 'rgba(239, 68, 68, 0.18)';
              ctx.fillStyle = 'rgba(239, 68, 68, 0.06)';
              ctx.beginPath();
              ctx.moveTo(eScr.x + sideW * 0.2, eScr.y - hPrism * 1.25);
              ctx.lineTo(eScr.x + sideW * 1.8, eScr.y - hPrism * 1.0);
              ctx.lineTo(eScr.x + sideW * 1.5, eScr.y - hPrism * 1.8);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();

              ctx.strokeStyle = shadeColor(enemy.color, -40);
              ctx.lineWidth = Math.max(0.6, 2.0 * eScr.scale);
              ctx.beginPath();
              for (let l = 0; l < 3; l++) {
                const offsetAngle = (l - 1) * 0.45;
                const dXLeft = -Math.cos(offsetAngle) * sideW * 1.95;
                const dXRight = Math.cos(offsetAngle) * sideW * 1.95;
                const dYLeg = sideW * (0.85 + Math.sin(enemy.swingCycle * 2.8 + l) * 0.38);

                ctx.moveTo(eScr.x - sideW * 0.4, eScr.y - hPrism * 0.35);
                ctx.lineTo(eScr.x + dXLeft, eScr.y + dYLeg);

                ctx.moveTo(eScr.x + sideW * 0.4, eScr.y - hPrism * 0.35);
                ctx.lineTo(eScr.x + dXRight, eScr.y + dYLeg);
              }
              ctx.stroke();
            }
            else if (enemy.type === 'spitter') {
              // "Neon Poison Parasol Jelly"
              const hPrism = enemy.size * 2.6 * eScr.scale;
              const pulse = Math.sin(Date.now() / 110 + enemy.swingCycle) * 0.12;
              const sacW = sideW * (1.1 + pulse);
              const sacH = sideW * (1.3 + pulse);
              
              const jellyGrad = ctx.createRadialGradient(eScr.x, eScr.y - hPrism * 0.8, 1, eScr.x, eScr.y - hPrism * 0.8, sacW * 1.5);
              jellyGrad.addColorStop(0, '#fb923c');
              jellyGrad.addColorStop(0.5, 'rgba(234, 88, 12, 0.75)');
              jellyGrad.addColorStop(1, 'rgba(124, 45, 18, 0.2)');
              
              ctx.fillStyle = jellyGrad;
              ctx.beginPath();
              ctx.ellipse(eScr.x, eScr.y - hPrism * 0.75, sacW, sacH * 0.8, 0, 0, Math.PI * 2);
              ctx.fill();
              
              ctx.fillStyle = '#fff';
              for (let k = 0; k < 4; k++) {
                const sx = eScr.x + Math.sin(Date.now() / 80 + k) * sacW * 0.5;
                const sy = (eScr.y - hPrism * 0.75) + Math.cos(Date.now() / 70 + k) * sacH * 0.3;
                ctx.beginPath();
                ctx.arc(sx, sy, Math.max(0.3, 1.8 * eScr.scale), 0, Math.PI * 2);
                ctx.fill();
              }

              ctx.fillStyle = shadeColor(enemy.color, -5);
              ctx.beginPath();
              ctx.moveTo(eScr.x - sideW * 0.35, eScr.y);
              ctx.lineTo(eScr.x + sideW * 0.35, eScr.y);
              ctx.lineTo(eScr.x + sideW * 0.12, eScr.y - hPrism * 0.6);
              ctx.lineTo(eScr.x - sideW * 0.12, eScr.y - hPrism * 0.6);
              ctx.closePath();
              ctx.fill();

              ctx.fillStyle = '#1e293b';
              ctx.strokeStyle = '#f97316';
              ctx.lineWidth = Math.max(0.5, 1.5 * eScr.scale);
              ctx.beginPath();
              ctx.arc(eScr.x + sideW * 0.45, eScr.y - hPrism * 0.9, Math.max(0.1, 4 * eScr.scale), 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();

              ctx.strokeStyle = '#f97316';
              ctx.lineWidth = Math.max(0.5, 2 * eScr.scale);
              ctx.beginPath();
              for (let t = 0; t < 3; t++) {
                const tXStart = eScr.x + (t - 1) * sideW * 0.5;
                const tYStart = eScr.y;
                
                ctx.moveTo(tXStart, tYStart);
                const cpt1X = tXStart + Math.sin(enemy.swingCycle * 1.5 + t) * sideW * 0.5;
                const cpt1Y = tYStart + sideW * 0.6;
                const endPtX = tXStart + Math.sin(enemy.swingCycle * 2.1 + t) * sideW * 1.1;
                const endPtY = tYStart + sideW * 1.6;
                
                ctx.quadraticCurveTo(cpt1X, cpt1Y, endPtX, endPtY);
              }
              ctx.stroke();
            }
            else if (enemy.type === 'brute') {
              // "Titanium Cyber-Gargoyle"
              const hPrism = enemy.size * 2.0 * eScr.scale;

              ctx.fillStyle = shadeColor(enemy.color, -25);
              ctx.beginPath();
              ctx.moveTo(eScr.x, eScr.y);
              ctx.lineTo(eScr.x - sideW, eScr.y - sideW * 0.4);
              ctx.lineTo(eScr.x - sideW, eScr.y - sideW * 0.4 - hPrism);
              ctx.lineTo(eScr.x, eScr.y - hPrism);
              ctx.closePath();
              ctx.fill();

              ctx.fillStyle = shadeColor(enemy.color, -5);
              ctx.beginPath();
              ctx.moveTo(eScr.x, eScr.y);
              ctx.lineTo(eScr.x + sideW, eScr.y - sideW * 0.4);
              ctx.lineTo(eScr.x + sideW, eScr.y - sideW * 0.4 - hPrism);
              ctx.lineTo(eScr.x, eScr.y - hPrism);
              ctx.closePath();
              ctx.fill();

              const fAngle = Math.sin(enemy.swingCycle * 2.5) * 0.6;
              ctx.fillStyle = shadeColor(enemy.color, -45);
              ctx.strokeStyle = '#ec4899';
              ctx.lineWidth = Math.max(0.5, 1 * eScr.scale);
              
              ctx.beginPath();
              ctx.moveTo(eScr.x - sideW * 0.6, eScr.y - hPrism * 0.7);
              ctx.lineTo(eScr.x - sideW * 2.5, eScr.y - hPrism * (0.8 + fAngle));
              ctx.lineTo(eScr.x - sideW * 1.8, eScr.y - hPrism * (0.1 + fAngle));
              ctx.closePath();
              ctx.fill();
              ctx.stroke();

              ctx.beginPath();
              ctx.moveTo(eScr.x + sideW * 0.6, eScr.y - hPrism * 0.7);
              ctx.lineTo(eScr.x + sideW * 2.5, eScr.y - hPrism * (0.8 - fAngle));
              ctx.lineTo(eScr.x + sideW * 1.8, eScr.y - hPrism * (0.1 - fAngle));
              ctx.closePath();
              ctx.fill();
              ctx.stroke();

              ctx.fillStyle = '#f43f5e';
              ctx.beginPath();
              ctx.moveTo(eScr.x - sideW * 0.4, eScr.y - hPrism);
              ctx.quadraticCurveTo(eScr.x - sideW * 1.1, eScr.y - hPrism - sideW * 0.5, eScr.x - sideW * 0.8, eScr.y - hPrism - sideW * 1.25);
              ctx.lineTo(eScr.x - sideW * 0.1, eScr.y - hPrism - sideW * 0.2);
              ctx.moveTo(eScr.x + sideW * 0.4, eScr.y - hPrism);
              ctx.quadraticCurveTo(eScr.x + sideW * 1.1, eScr.y - hPrism - sideW * 0.5, eScr.x + sideW * 0.8, eScr.y - hPrism - sideW * 1.25);
              ctx.lineTo(eScr.x + sideW * 0.1, eScr.y - hPrism - sideW * 0.2);
              ctx.closePath();
              ctx.fill();

              ctx.strokeStyle = shadeColor(enemy.color, -50);
              ctx.lineWidth = Math.max(0.5, 4 * eScr.scale);
              const legPhase = Math.sin(enemy.swingCycle * 1.6);
              ctx.beginPath();
              ctx.moveTo(eScr.x - sideW * 0.4, eScr.y - hPrism * 0.25);
              ctx.lineTo(eScr.x - sideW * 1.35, eScr.y + sideW * (0.3 + legPhase * 0.35));
              
              ctx.moveTo(eScr.x + sideW * 0.4, eScr.y - hPrism * 0.25);
              ctx.lineTo(eScr.x + sideW * 1.35, eScr.y + sideW * (0.3 - legPhase * 0.35));
              ctx.stroke();
            }
            else {
              // "Overlord Devastator Mecha-Phoenix"
              const hPrism = enemy.size * 2.3 * eScr.scale;

              ctx.fillStyle = '#0f172a';
              ctx.beginPath();
              ctx.moveTo(eScr.x, eScr.y);
              ctx.lineTo(eScr.x + sideW, eScr.y - sideW * 0.45);
              ctx.lineTo(eScr.x + sideW, eScr.y - sideW * 0.45 - hPrism);
              ctx.lineTo(eScr.x, eScr.y - hPrism);
              ctx.closePath();
              ctx.fill();

              ctx.fillStyle = '#1e293b';
              ctx.beginPath();
              ctx.moveTo(eScr.x, eScr.y);
              ctx.lineTo(eScr.x - sideW, eScr.y - sideW * 0.45);
              ctx.lineTo(eScr.x - sideW, eScr.y - sideW * 0.45 - hPrism);
              ctx.lineTo(eScr.x, eScr.y - hPrism);
              ctx.closePath();
              ctx.fill();

              const bWingFlap = Math.sin(Date.now() / 140) * 0.4;
              ctx.fillStyle = '#10b981';
              ctx.strokeStyle = '#a855f7';
              ctx.lineWidth = Math.max(1.0, 2.5 * eScr.scale);
              
              ctx.beginPath();
              ctx.moveTo(eScr.x - sideW * 0.8, eScr.y - hPrism * 0.6);
              ctx.quadraticCurveTo(eScr.x - sideW * 3.4, eScr.y - hPrism * (0.9 + bWingFlap), eScr.x - sideW * 3.1, eScr.y - hPrism * (0.3 + bWingFlap));
              ctx.lineTo(eScr.x - sideW * 1.5, eScr.y - hPrism * (0.1 + bWingFlap));
              ctx.closePath();
              ctx.fill();
              ctx.stroke();

              ctx.beginPath();
              ctx.moveTo(eScr.x + sideW * 0.8, eScr.y - hPrism * 0.6);
              ctx.quadraticCurveTo(eScr.x + sideW * 3.4, eScr.y - hPrism * (0.9 - bWingFlap), eScr.x + sideW * 3.1, eScr.y - hPrism * (0.3 - bWingFlap));
              ctx.lineTo(eScr.x + sideW * 1.5, eScr.y - hPrism * (0.1 - bWingFlap));
              ctx.closePath();
              ctx.fill();
              ctx.stroke();

              const rot1 = Date.now() * 0.003;
              const rot2 = -Date.now() * 0.002;
              ctx.strokeStyle = 'cyan';
              ctx.lineWidth = Math.max(0.6, 1.8 * eScr.scale);
              
              ctx.beginPath();
              ctx.ellipse(eScr.x, eScr.y - hPrism * 0.5, sideW * 1.9, sideW * 0.75, rot1, 0, Math.PI * 2);
              ctx.stroke();

              ctx.strokeStyle = '#ec4899';
              ctx.beginPath();
              ctx.ellipse(eScr.x, eScr.y - hPrism * 0.5, sideW * 1.4, sideW * 0.55, rot2, 0, Math.PI * 2);
              ctx.stroke();

              const pPulse = 1 + Math.sin(Date.now() / 60) * 0.25;
              const rG = ctx.createRadialGradient(eScr.x, eScr.y - hPrism * 0.5, 1, eScr.x, eScr.y - hPrism * 0.5, sideW * 0.6 * pPulse);
              rG.addColorStop(0, '#f43f5e');
              rG.addColorStop(0.5, '#a855f7');
              rG.addColorStop(1, 'rgba(0,0,0,0)');
              ctx.fillStyle = rG;
              ctx.beginPath();
              ctx.arc(eScr.x, eScr.y - hPrism * 0.5, sideW * 1.2 * pPulse, 0, Math.PI * 2);
              ctx.fill();

              ctx.fillStyle = '#ec4899';
              ctx.beginPath();
              ctx.moveTo(eScr.x - sideW * 0.25, eScr.y - hPrism);
              ctx.quadraticCurveTo(eScr.x - sideW * 0.75, eScr.y - hPrism - sideW * 1.4, eScr.x - sideW * 0.15, eScr.y - hPrism - sideW * 0.35);
              ctx.moveTo(eScr.x + sideW * 0.25, eScr.y - hPrism);
              ctx.quadraticCurveTo(eScr.x + sideW * 0.75, eScr.y - hPrism - sideW * 1.4, eScr.x + sideW * 0.15, eScr.y - hPrism - sideW * 0.35);
              ctx.closePath();
              ctx.fill();

              ctx.strokeStyle = '#c084fc';
              ctx.lineWidth = Math.max(0.6, 5 * eScr.scale);
              ctx.beginPath();
              const legPhase = Math.sin(enemy.swingCycle * 1.1);
              ctx.moveTo(eScr.x - sideW * 0.5, eScr.y - hPrism * 0.1);
              ctx.lineTo(eScr.x - sideW * 1.6, eScr.y + sideW * (0.8 + legPhase * 0.25));
              ctx.moveTo(eScr.x - sideW * 0.2, eScr.y - hPrism * 0.1);
              ctx.lineTo(eScr.x - sideW * 0.8, eScr.y + sideW * 0.85);
              ctx.moveTo(eScr.x + sideW * 0.5, eScr.y - hPrism * 0.1);
              ctx.lineTo(eScr.x + sideW * 1.6, eScr.y + sideW * (0.8 - legPhase * 0.25));
              ctx.moveTo(eScr.x + sideW * 0.2, eScr.y - hPrism * 0.1);
              ctx.lineTo(eScr.x + sideW * 0.8, eScr.y + sideW * 0.85);
              ctx.stroke();

              const progressRad = sideW * 1.6;
              const hpPct = Math.max(0, enemy.hp / enemy.maxHp);
              ctx.strokeStyle = '#ef4444';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.arc(eScr.x, eScr.y - hPrism - 14, progressRad, 0, Math.PI * 2);
              ctx.stroke();

              ctx.strokeStyle = '#10b981';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.arc(eScr.x, eScr.y - hPrism - 14, progressRad, -Math.PI / 2, -Math.PI / 2 + (hpPct * Math.PI * 2));
              ctx.stroke();
            }

            if (enemy.hp < enemy.maxHp && enemy.type !== 'boss') {
              const hBarW = sideW * 2.2;
              const barPct = Math.max(0, enemy.hp / enemy.maxHp);
              ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
              ctx.fillRect(eScr.x - hBarW / 2, eScr.y - prismH - 6, hBarW, 2.5);
              ctx.fillStyle = '#10b981';
              ctx.fillRect(eScr.x - hBarW / 2, eScr.y - prismH - 6, hBarW * barPct, 2.5);
            }
          }
        });
      });

      // ADD PLAYER TO SORTED QUEUE (Equipped with Solar panels and kinetic guns)
      sortedDrawables.push({
        y: pY,
        draw: () => {
          const pScr = toScreen(pX, pY, pZ);
          const busW = 16 * pScr.scale;
          const busL = 26 * pScr.scale;
          const busH = 15 * pScr.scale;

          ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
          ctx.beginPath();
          const shadRadius = Math.max(0.1, 18 * pScr.scale);
          ctx.ellipse(toScreen(pX, pY, 0).x, toScreen(pX, pY, 0).y, shadRadius, Math.max(0.1, shadRadius * 0.45), 0, 0, Math.PI * 2);
          ctx.fill();

          const headlightGrad = ctx.createLinearGradient(pScr.x, pScr.y, pScr.x + 130 * pScr.scale, pScr.y + 35 * pScr.scale);
          headlightGrad.addColorStop(0, vibeStyle === 'Neon Rust' ? 'rgba(168, 85, 247, 0.6)' : 'rgba(22, 211, 238, 0.55)');
          headlightGrad.addColorStop(1, 'rgba(22, 211, 238, 0.0)');
          ctx.fillStyle = headlightGrad;
          ctx.beginPath();
          ctx.moveTo(pScr.x + 5, pScr.y);
          ctx.lineTo(pScr.x + 140 * pScr.scale, pScr.y - 25 * pScr.scale);
          ctx.lineTo(pScr.x + 140 * pScr.scale, pScr.y + 55 * pScr.scale);
          ctx.closePath();
          ctx.fill();

          if (activePowerups.includes('Shield')) {
            ctx.strokeStyle = 'cyan';
            ctx.lineWidth = 1.2;
            ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
            ctx.beginPath();
            ctx.arc(pScr.x, pScr.y, Math.max(0.1, 25 * pScr.scale), 0, Math.PI * 2);
            ctx.stroke();
            ctx.fill();

            const nodeAngle = Date.now() * 0.003;
            ctx.fillStyle = '#22d3ee';
            ctx.beginPath();
            ctx.arc(pScr.x + Math.cos(nodeAngle) * 25 * pScr.scale, pScr.y + Math.sin(nodeAngle) * 10 * pScr.scale, 4, 0, Math.PI * 2);
            ctx.fill();
          }

          const hoverAngle = (Date.now() / 140) % (Math.PI * 2);
          const engineRadius = 4.5 * pScr.scale;
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = Math.max(0.6, 2 * pScr.scale);
          
          ctx.beginPath();
          ctx.ellipse(pScr.x - busL * 0.4, pScr.y + 3, Math.max(0.1, engineRadius * 1.5), Math.max(0.1, engineRadius * 0.6), hoverAngle, 0, Math.PI * 2);
          ctx.stroke();
          
          ctx.beginPath();
          ctx.ellipse(pScr.x + busL * 0.4, pScr.y + busW * 0.4, Math.max(0.1, engineRadius * 1.5), Math.max(0.1, engineRadius * 0.6), hoverAngle, 0, Math.PI * 2);
          ctx.stroke();

          const flamePulse = Math.sin(Date.now() / 50) * 5;
          const pThrusterGrad = ctx.createLinearGradient(pScr.x - busL * 0.4, pScr.y, pScr.x - busL * 1.4, pScr.y);
          pThrusterGrad.addColorStop(0, '#06b6d4');
          pThrusterGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.7)');
          pThrusterGrad.addColorStop(1, 'rgba(236, 72, 153, 0)');
          
          ctx.fillStyle = pThrusterGrad;
          ctx.beginPath();
          ctx.moveTo(pScr.x - busL * 0.4, pScr.y - busH * 0.2);
          ctx.lineTo(pScr.x - busL * 1.3 - flamePulse, pScr.y);
          ctx.lineTo(pScr.x - busL * 0.4, pScr.y - busH * 0.7);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = shadeColor(themeColors.player, -35);
          ctx.beginPath();
          ctx.moveTo(pScr.x - busL / 2, pScr.y);
          ctx.lineTo(pScr.x + busL / 2, pScr.y + busW / 2);
          ctx.lineTo(pScr.x + busL / 2, pScr.y + busW / 2 - busH);
          ctx.lineTo(pScr.x - busL / 2, pScr.y - busH);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = shadeColor(themeColors.player, -20);
          ctx.beginPath();
          ctx.moveTo(pScr.x - busL / 2, pScr.y);
          ctx.lineTo(pScr.x - busL / 2 - busW, pScr.y - busW * 0.4);
          ctx.lineTo(pScr.x - busL / 2 - busW, pScr.y - busW * 0.4 - busH);
          ctx.lineTo(pScr.x - busL / 2, pScr.y - busH);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = themeColors.player;
          ctx.beginPath();
          ctx.moveTo(pScr.x - busL / 2, pScr.y - busH);
          ctx.lineTo(pScr.x + busL / 2, pScr.y + busW / 2 - busH);
          ctx.lineTo(pScr.x + busL / 2 - busW, pScr.y - busW * 0.45 - busH);
          ctx.lineTo(pScr.x - busL / 2 - busW, pScr.y - busW * 0.4 - busH);
          ctx.closePath();
          ctx.fill();

          const solarAngle = Math.sin(Date.now() / 450) * 0.15;
          ctx.fillStyle = '#1e3a8a';
          ctx.strokeStyle = '#60a5fa';
          ctx.lineWidth = Math.max(0.5, 1.2 * pScr.scale);
          
          ctx.beginPath();
          ctx.moveTo(pScr.x - busL * 0.1, pScr.y - busH - 2);
          ctx.lineTo(pScr.x - busL * 0.7, pScr.y - busH - busW * 0.6 + solarAngle * 20);
          ctx.lineTo(pScr.x - busL * 0.9, pScr.y - busH - busW * 0.5 + solarAngle * 20);
          ctx.lineTo(pScr.x - busL * 0.4, pScr.y - busH - 2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#06b6d4';
          ctx.beginPath();
          ctx.moveTo(pScr.x + busL / 2, pScr.y + busW / 2 - busH);
          ctx.lineTo(pScr.x + busL / 2, pScr.y + busW / 2 - busH * 0.5);
          ctx.lineTo(pScr.x + busL / 2 - 8, pScr.y + busW / 2 * 0.4);
          ctx.lineTo(pScr.x + busL / 2 - 8, pScr.y - busH + 5);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(pScr.x + busL / 2 - 2, pScr.y + busW / 3 - busH * 0.35, Math.max(0.1, 2.5 * pScr.scale), 0, Math.PI * 2);
          ctx.arc(pScr.x + busL / 2 - 5, pScr.y + busW / 2 - busH * 0.25, Math.max(0.1, 2.5 * pScr.scale), 0, Math.PI * 2);
          ctx.fill();

          const sirenColor = Date.now() % 300 < 150 ? '#ef4444' : '#3b82f6';
          ctx.fillStyle = sirenColor;
          ctx.beginPath();
          ctx.arc(pScr.x - 5, pScr.y - busH - 2, Math.max(0.1, 2.8 * pScr.scale), 0, Math.PI * 2);
          ctx.fill();

          if (turretLevel > 1) {
            ctx.fillStyle = '#334155';
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = Math.max(0.5, 1 * pScr.scale);
            
            ctx.beginPath();
            ctx.rect(pScr.x - busL * 0.1, pScr.y - busH - 5 * pScr.scale, 6 * pScr.scale, 3 * pScr.scale);
            ctx.fill();
            ctx.stroke();
          }

          if (enemiesRef.current.length > 0) {
            const closest = enemiesRef.current[0];
            const ang = Math.atan2(closest.y - pY, closest.x - pX);
            ctx.strokeStyle = '#f8fafc';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.moveTo(pScr.x, pScr.y - busH);
            ctx.lineTo(pScr.x + Math.cos(ang) * 16 * pScr.scale, pScr.y - busH + Math.sin(ang) * 10 * pScr.scale);
            ctx.stroke();
          }

          if (Math.random() < 0.4) {
            particlesRef.current.push({
              x: pX - 25,
              y: pY + (Math.random() - 0.5) * 15,
              z: pZ,
              vx: -3.5 - Math.random() * 2,
              vy: (Math.random() - 0.5) * 1,
              vz: Math.random() * 0.8,
              color: '#22d3ee',
              alpha: 1.0,
              life: 14,
              maxLife: 14,
              size: 2.2
            });
          }
        }
      });

      // SORT RENDERABLE OBJECTS BY DEPTH ASCENDING AND DRUAW
      sortedDrawables.sort((a, b) => a.y - b.y);
      sortedDrawables.forEach((item) => {
        item.draw();
      });
      floatingTextsRef.current.forEach((ft) => {
        ft.z += 1.8; // Float upwards
        ft.life--;

        const tScr = toScreen(ft.x, ft.y, ft.z);
        ctx.save();
        ctx.fillStyle = ft.color;
        
        // Dynamic pop sizing
        const scaleVal = ft.life > 38 ? 1.4 : ft.life < 10 ? 0.7 : 1.0;
        ctx.font = `bold ${Math.floor(10.5 * scaleVal)}px JetBrains Mono`;
        ctx.textAlign = 'center';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.fillText(ft.text, tScr.x, tScr.y);
        ctx.restore();
      });
      floatingTextsRef.current = floatingTextsRef.current.filter(t => t.life > 0);

      // --- UPDATE GENERATED PARTICLE SPARK CLOUDS ---
      particlesRef.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;
        p.vz -= 0.12; // Gravity simulation
        p.alpha = Math.max(0, p.life / p.maxLife);
        p.life--;

        const ptScr = toScreen(p.x, p.y, Math.max(0, p.z));

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(ptScr.x, ptScr.y, Math.max(0.1, p.size * ptScr.scale), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);

      // Cover canvas context with a subtle noise overlay pattern (shakes with the camera for grittier feel!)
      if (noisePattern) {
        ctx.save();
        ctx.fillStyle = noisePattern;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      ctx.restore(); // camera shakes reverse

      // --- DRAW BOSS HUD HEALTH BAR (AT TOP OF CANVAS BUT STATIC) ---
      const boss = enemiesRef.current.find(e => e.type === 'boss');
      if (boss) {
        const barWidth = 460;
        const barHeight = 12;
        const barX = (canvas.width - barWidth) / 2;
        const barY = 48; // Positioned perfectly below the HTML state banner

        // Bar background track with dark red glow translucent
        ctx.save();
        ctx.shadowColor = 'rgba(239, 68, 68, 0.4)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.7)'; // Neon purple border matching vibe
        ctx.lineWidth = 1.5;

        // Rounded box path
        ctx.beginPath();
        ctx.rect(barX, barY, barWidth, barHeight);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // HP fill fraction
        const hpPct = Math.max(0, boss.hp / boss.maxHp);
        if (hpPct > 0) {
          ctx.save();
          // Create gradient for health bar (glowing red to orange)
          const hpGrad = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
          hpGrad.addColorStop(0, '#f43f5e'); // Rose red
          hpGrad.addColorStop(1, '#ef4444'); // Red

          // Add pulsing glow effect
          const pulse = 4 + Math.sin(Date.now() / 150) * 3;
          ctx.shadowColor = '#f43f5e';
          ctx.shadowBlur = pulse;

          ctx.fillStyle = hpGrad;
          ctx.beginPath();
          ctx.rect(barX + 2, barY + 2, (barWidth - 4) * hpPct, barHeight - 4);
          ctx.fill();
          ctx.restore();
        }

        // Animated neon core highlights
        if (hpPct > 0 && Math.random() < 0.2) {
          ctx.save();
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = 0.35;
          ctx.fillRect(barX + 2 + Math.random() * (barWidth - 10) * hpPct, barY + 2, 4, barHeight - 4);
          ctx.restore();
        }

        // Draw Boss text labels with beautiful shadow & spacing
        ctx.save();
        ctx.font = 'bold 9px JetBrains Mono';
        ctx.fillStyle = '#fca5a5'; // Light red
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 3;
        ctx.textAlign = 'left';
        ctx.fillText('⚡ TITAN MUTANT OVERLORD', barX, barY - 6);

        ctx.textAlign = 'right';
        ctx.font = '500 9px JetBrains Mono';
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(`${boss.hp} / ${boss.maxHp} HP`, barX + barWidth, barY - 6);
        ctx.restore();
      }

      localAnimationId = requestAnimationFrame(gameLoop);
    };

    localAnimationId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(localAnimationId);
    };
  }, [isPlaying, wallLevel, turretLevel, labLevel, vibeStyle, activePowerups, soundEnabled, elapsedTime, dangerLevelText, dangerMult]);

  // Utility to slightly shade values to create volumetric depth illusions
  function shadeColor(color: string, percent: number) {
    let R = parseInt(color.substring(1, 3), 16);
    let G = parseInt(color.substring(3, 5), 16);
    let B = parseInt(color.substring(5, 7), 16);

    R = Math.max(0, Math.min(255, R + percent));
    G = Math.max(0, Math.min(255, G + percent));
    B = Math.max(0, Math.min(255, B + percent));

    const rHex = R.toString(16).padStart(2, '0');
    const gHex = G.toString(16).padStart(2, '0');
    const bHex = B.toString(16).padStart(2, '0');

    return `#${rHex}${gHex}${bHex}`;
  }

  // Handle Resize layout
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (canvas && container) {
        canvas.width = 800; // Standard stable logic dimensions
        canvas.height = 450; // Widescreen 16:9 3D layout bounds
      }
    };
    handleResize();
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div id="combat-simulator-card" className="border border-slate-800/80 bg-slate-900 rounded-xl overflow-hidden shadow-2xl relative flex flex-col h-full">
      {/* Simulation Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/80">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-[#ef4444] animate-ping shrink-0" />
          <h3 className="font-sans font-bold text-sm text-slate-100 tracking-tight flex items-center gap-1.5 uppercase font-mono">
            <Swords className="h-4 w-4 text-purple-400" /> Action arena: 3D auto-shooter
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="toggle-simulator-synth"
            onClick={() => setSoundEnabled(prev => !prev)}
            title={soundEnabled ? "Mute synth" : "Enable 8-bit battle synth"}
            className={`p-1.5 rounded-lg transition-colors border ${soundEnabled ? 'border-purple-500/30 bg-purple-500/10 text-purple-400' : 'border-slate-800 bg-slate-900 text-slate-400'}`}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4 animate-bounce" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <div className="bg-purple-950/50 border border-purple-500/20 rounded-lg px-2 py-0.5 text-[10px] font-mono font-bold text-purple-400 uppercase tracking-widest">
            3D Perspective Active
          </div>
        </div>
      </div>

      {/* Danger Phase Flashing Alert Banner */}
      <div className="p-2.5 bg-red-950/20 border-b border-slate-800 flex items-center justify-between px-4">
        <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5 font-bold uppercase tracking-wider">
          <AlertTriangle className="h-4 w-4 text-amber-500 animate-bounce" /> Survival Time Clock: 
          <span className="text-white text-xs bg-slate-950 border border-slate-800 px-2 py-0.5 rounded font-black">
            {Math.floor(elapsedTime / 60).toString().padStart(2, '0')}:{(elapsedTime % 60).toString().padStart(2, '0')}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-slate-450 uppercase">Escalation Mult:</span>
          <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 font-mono text-xs font-bold rounded">
            Danger {dangerMult.toFixed(1)}x
          </span>
        </span>
      </div>

      {/* Simulator Stats HUD */}
      <div className="grid grid-cols-4 gap-1 p-2.5 bg-slate-950/40 border-b border-slate-800/50 text-center font-mono text-[9px]">
        <div className="border-r border-slate-800/60">
          <div className="text-slate-500 uppercase">HP CORE BOUND</div>
          <div className={`text-base font-black ${survivorHp < 35 ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>
            {survivorHp} hp
          </div>
        </div>
        <div className="border-r border-slate-800/60">
          <div className="text-slate-500 uppercase">SCYTHE KILLS</div>
          <div className="text-base font-black text-amber-500 font-sans">{score}</div>
        </div>
        <div className="border-r border-slate-800/60">
          <div className="text-slate-550 uppercase">ALLOYS EXCAVATED</div>
          <div className="text-base font-black text-teal-400">+{materials} pb</div>
        </div>
        <div>
          <div className="text-slate-550 uppercase">REINFORCED LV</div>
          <div className="text-base font-black text-purple-400 flex items-center justify-center gap-1">
            Lv.{level} <span className="text-[9px] text-slate-500 font-normal">({Math.round((xp / xpNeeded) * 100)}%)</span>
          </div>
        </div>
      </div>

      {/* Dynamic 3D Combat Simulator & Tactical Control Columns */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-slate-950 border-t border-slate-800">
        
        {/* LEFT COLUMN: 4/12 width - Cyber Control Deck, Objectives & Chiptune Synth Radio */}
        <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-800 bg-[#090d16] flex flex-col overflow-y-auto max-h-[380px] lg:max-h-none p-4 space-y-4">
          
          {/* Section A: Objectives Checklists */}
          <div className="space-y-2">
            <h4 className="text-[10px] uppercase font-mono font-black text-purple-400 tracking-wider flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-amber-400" /> Scavenger Objectives
            </h4>
            <div className="space-y-3 bg-slate-950/70 border border-slate-850 p-3 rounded-xl">
              {STAGES_MISSIONS.map(m => {
                const isComplete = !!completedMissions[m.id];
                return (
                  <div key={m.id} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className={`font-bold flex items-center gap-1.5 ${isComplete ? 'text-amber-400' : 'text-slate-200'}`}>
                        {isComplete ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-slate-700 animate-pulse shrink-0" />
                        )}
                        {m.label}
                      </span>
                      <span className={`text-[10px] font-semibold ${isComplete ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {isComplete ? "✓ CAPTURED" : `+${m.reward} 🔩`}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight font-medium pl-3.5">
                      {m.desc}
                    </p>
                    <div className="pl-3.5 space-y-1">
                      <div className="w-full bg-slate-900 rounded-full h-1 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-amber-400' : 'bg-purple-500/60'}`}
                          style={{ width: `${m.progress}%` }}
                        />
                      </div>
                      <div className="text-[9px] font-mono text-slate-500 text-right">
                        {m.currentString}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section B: Ambient Chiptune Synth Radio */}
          <div className="space-y-2">
            <h4 className="text-[10px] uppercase font-mono font-black text-purple-400 tracking-wider flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5 text-cyan-400" /> Cyber-Desi Synth Sequencer
            </h4>
            <div className="bg-slate-950/70 border border-slate-850 p-3 rounded-xl space-y-3 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400">Rhythm Engine Status:</span>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase border ${isPlaying && soundEnabled ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 animate-pulse' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                  {isPlaying && soundEnabled ? "● BROADCASTING" : "■ STANDBY"}
                </span>
              </div>

              {/* Rhythmic equalizer simulator visualizer */}
              {isPlaying && soundEnabled && (
                <div className="flex items-end justify-center gap-1 h-6 bg-slate-900/60 border border-slate-850 rounded-lg p-1.5">
                  <div className="w-1.5 bg-cyan-400 rounded-t animate-bounce" style={{ height: '80%', animationDelay: '0.1s', animationDuration: '0.6s' }} />
                  <div className="w-1.5 bg-purple-400 rounded-t animate-bounce" style={{ height: '40%', animationDelay: '0.3s', animationDuration: '0.4s' }} />
                  <div className="w-1.5 bg-pink-400 rounded-t animate-bounce" style={{ height: '95%', animationDelay: '0.2s', animationDuration: '0.8s' }} />
                  <div className="w-1.5 bg-amber-400 rounded-t animate-bounce" style={{ height: '60%', animationDelay: '0s', animationDuration: '0.5s' }} />
                  <div className="w-1.5 bg-cyan-400 rounded-t animate-bounce" style={{ height: '30%', animationDelay: '0.4s', animationDuration: '0.7s' }} />
                </div>
              )}

              {/* Player Agency Controls */}
              <div className="space-y-3 text-[10px]">
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>Synthesizer Tempo:</span>
                    <span className="text-cyan-400 font-bold">{musicBpm} BPM</span>
                  </div>
                  <input 
                    type="range" 
                    min="90" 
                    max="220" 
                    value={musicBpm}
                    onChange={(e) => setMusicBpm(Number(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>Acoustic Wave Mode:</span>
                    <span className="text-purple-400 font-bold capitalize">{musicWave}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button 
                      onClick={() => setMusicWave('triangle')}
                      className={`py-1 text-[9px] rounded font-mono uppercase bg-slate-900 border transition-colors cursor-pointer ${musicWave === 'triangle' ? 'border-purple-500 text-purple-300 font-black' : 'border-slate-800 text-slate-500 hover:text-slate-300'}`}
                    >
                      ▲ Warm Triangle
                    </button>
                    <button 
                      onClick={() => setMusicWave('sawtooth')}
                      className={`py-1 text-[9px] rounded font-mono uppercase bg-slate-900 border transition-colors cursor-pointer ${musicWave === 'sawtooth' ? 'border-purple-500 text-purple-300 font-black' : 'border-slate-800 text-slate-500 hover:text-slate-300'}`}
                    >
                      █ Heavy Saw
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section C: Scavenger Tactical Manual */}
          <div className="space-y-2">
            <h4 className="text-[10px] uppercase font-mono font-black text-purple-400 tracking-wider flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-emerald-400" /> Scavenger Tactical Handbook
            </h4>
            <div className="bg-slate-950/70 border border-slate-850 p-3 rounded-xl space-y-2.5 text-[10.5px] leading-relaxed text-slate-400">
              <div className="flex items-start gap-2">
                <span className="text-purple-400 select-none">🕹️</span>
                <p>
                  <strong className="text-white">Steer Method</strong>: Tap or drag client coordinates inside the combat grids. Responsive hover-bus centers instantly to pointer vector.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-purple-400 select-none">🚀</span>
                <p>
                  <strong className="text-white">Auto Fire-Rates</strong>: Lasers, caliber rounds, caltrops, chain shocks automatically charge and target wasteland hostiles.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-purple-400 select-none">💎</span>
                <p>
                  <strong className="text-white">Rogue Levels</strong>: Consume green crystals to trigger customizable battle modification overrides mid-combat.
                </p>
              </div>
            </div>
          </div>

          {/* Section D: Clear Achievements Reset Button */}
          <button 
            onClick={() => {
              if (confirm("Reset current persistent scavenger objectives progress? This wipes alloy records.")) {
                setCompletedMissions({});
              }
            }}
            className="w-full py-1.5 border border-slate-800 hover:border-red-500/30 bg-slate-950 hover:bg-red-500/10 text-[9px] text-slate-500 hover:text-red-400 rounded-lg transition-colors font-mono uppercase cursor-pointer"
          >
            ☣️ Reset Scavenger Records
          </button>
        </div>

        {/* RIGHT COLUMN: 8/12 width - The 3D Perspective Screen */}
        <div ref={containerRef} className="lg:col-span-8 relative bg-slate-950 min-h-[350px] flex flex-col justify-center">
          {/* Dynamic Threat Category Alert */}
          {isPlaying && (
            <div className="absolute top-2.5 left-1/2 transform -translate-x-1/2 z-10 text-[10.5px] font-mono font-extrabold text-slate-100 flex items-center gap-2 bg-slate-950/85 backdrop-blur-md px-3 py-1 border border-slate-800 rounded-full shadow-lg">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
              CURRENT STATE: <span className="text-amber-400">{dangerLevelText}</span>
            </div>
          )}

          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUpOrLeave}
            className="absolute inset-0 cursor-crosshair w-full h-full block"
          />

          {/* Subtle cinematic noise overlay texture web-optimized */}
          <div 
            id="canvas-noise-overlay" 
            className="absolute inset-0 pointer-events-none opacity-[0.05] bg-repeat mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
            }}
          />

          {/* Start / Inactive state overlay */}
          {!isPlaying && !showLevelUpUpgrade && survivorHp > 0 && (
            <div className="absolute inset-5 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center text-center p-4 border border-purple-500/20 rounded-lg">
              <div className="h-10 w-10 rounded-full bg-purple-500/10 border border-purple-505/20 text-purple-400 flex items-center justify-center mb-3">
                <Sparkles className="h-6 w-6 animate-pulse" />
              </div>
              <h4 className="font-mono text-purple-300 text-xs tracking-widest uppercase mb-1 font-bold flex items-center gap-1.5">
                 EMULATOR 3D POST-APOC ARENA
              </h4>
              <p className="text-[11.5px] text-slate-400 max-w-sm mb-4 leading-relaxed">
                Experience the upgraded mobile hybridcasual combat simulation! Firing and driving are auto-targeted. Mutants grow stronger, faster, and gain ranged spit attacks as survival time escalates.
              </p>
              <button
                id="start-simulator-run"
                onClick={handleRestart}
                className="flex items-center gap-2 px-5 py-3 bg-purple-650 hover:bg-purple-500 text-white font-bold font-sans rounded-xl shadow-lg hover:shadow-purple-500/20 transition-all font-mono text-xs uppercase cursor-pointer"
              >
                <Play className="h-3.5 w-3.5 fill-current" /> Deploy to 3D Wasteland Grid
              </button>
              <div className="mt-3 text-[10px] text-slate-500">
                High definition 3D physics rendering loaded under <span className="text-slate-300">2 GB budget</span> for high-end mobile graphics
              </div>
            </div>
          )}

          {/* Game Over overlay */}
          {survivorHp <= 0 && !showLevelUpUpgrade && (
            <div className="absolute inset-5 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center text-center p-4 border border-red-500/25 rounded-lg">
              <Skull className="h-10 w-10 text-red-500 mb-2 animate-bounce" />
              <h4 className="font-mono text-red-400 text-xs tracking-widest uppercase mb-1 font-black">
                SURVIVOR PERIMETER COLLAPSED
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mb-4 leading-relaxed">
                Survived <span className="text-white font-bold">{elapsedTime}s</span> • Smashed <span className="text-amber-400 font-black">{score} mutants</span> • Found <span className="text-teal-400 font-semibold">{score + 4} alloy parts</span>.
              </p>
              <div className="flex gap-2">
                <button
                  id="retry-simulator-run"
                  onClick={handleRestart}
                  className="flex items-center gap-2 px-4.5 py-2.5 bg-slate-850 hover:bg-slate-800 text-slate-250 border border-slate-700 rounded-xl transition-all font-mono text-xs uppercase cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Redeploy survivors
                </button>
              </div>
            </div>
          )}

          {/* Level Up choice Modal embedded directly in simulator body */}
          {showLevelUpUpgrade && (
            <div className="absolute inset-4 bg-purple-950/95 backdrop-blur-md flex flex-col items-center justify-center p-4 rounded-xl border border-purple-500/40 z-10">
              <div className="text-center mb-3">
                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-[9px] font-mono uppercase tracking-widest rounded-full border border-purple-500/30">
                  APAC REGIONAL CONFIGS UPGRADE
                </span>
                <h4 className="text-sm font-bold text-white mt-1 uppercase font-mono tracking-tight text-purple-100 flex items-center justify-center gap-1.5">
                  <Sparkles className="h-4.5 w-4.5 text-amber-400" /> Rogue-lite modification select
                </h4>
              </div>

              <div className="grid grid-cols-1 gap-2 w-full max-w-xs">
                {choices.map((choice, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleChooseUpgrade(choice)}
                    className="p-2.5 bg-slate-950 hover:bg-purple-900/60 border border-purple-500/30 text-left text-xs text-slate-200 font-medium rounded-xl transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-6 flex items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono text-[10.5px] font-bold">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-bold text-white text-xs">{choice}</div>
                        <div className="text-[9.5px] text-slate-400 mt-0.5 leading-none">Apply tactical booster modifications</div>
                      </div>
                    </div>
                    <Sparkles className="h-4 w-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Simulator footer active modifiers */}
      <div className="p-2.5 bg-slate-950/80 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono text-slate-550 mr-1">ACTIVE MODIFIERS IN BATTLE:</span>
          <div className="flex flex-wrap gap-1">
            <span className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-[9px] font-mono text-red-400">
              Barricade V.{wallLevel}
            </span>
            <span className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-[9px] font-mono text-teal-300">
              Turrets V.{turretLevel}
            </span>
            <span className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-[9px] font-mono text-amber-400 animate-pulse">
              Lab damage V.{labLevel}
            </span>
          </div>
        </div>
        <div className="flex gap-1">
          {activePowerups.map((p, i) => (
            <span key={i} className="px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[9px] font-mono rounded">
              {p}
            </span>
          ))}
          {activePowerups.length === 0 && (
            <span className="text-[10px] font-mono text-slate-550 italic">Unlocking rogue levels in combat drops modifiers</span>
          )}
        </div>
      </div>
    </div>
  );
}
