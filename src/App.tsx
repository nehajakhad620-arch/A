import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Trophy, 
  Sparkles, 
  Timer, 
  Volume2, 
  VolumeX, 
  Keyboard, 
  Zap, 
  RotateCcw, 
  Play, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Skull,
  Flame,
  Activity,
  Award,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Color name constants
type ColorKey = 'RED' | 'BLUE' | 'GREEN';
const COLOR_KEYS: ColorKey[] = ['RED', 'BLUE', 'GREEN'];

// Vibrant, highly distinct color definitions with specific UI themes
interface ColorTheme {
  name: string;
  hex: string;
  bgClass: string;
  textClass: string;
  glowClass: string;
  badgeClass: string;
}

const COLOR_THEMES: Record<ColorKey, ColorTheme> = {
  RED: {
    name: 'Red',
    hex: '#EF4444', // Tailwind Red 500
    bgClass: 'bg-red-500 hover:bg-red-650 active:bg-red-700 shadow-red-500/20',
    textClass: 'text-red-500',
    glowClass: 'shadow-[0_0_30px_rgba(239,68,68,0.35)]',
    badgeClass: 'bg-red-50 text-red-600 border border-red-200'
  },
  BLUE: {
    name: 'Blue',
    hex: '#3B82F6', // Tailwind Blue 500
    bgClass: 'bg-blue-500 hover:bg-blue-650 active:bg-blue-700 shadow-blue-500/20',
    textClass: 'text-blue-500',
    glowClass: 'shadow-[0_0_30px_rgba(59,130,246,0.35)]',
    badgeClass: 'bg-blue-50 text-blue-600 border border-blue-200'
  },
  GREEN: {
    name: 'Green',
    hex: '#22C55E', // Tailwind Emerald 500
    bgClass: 'bg-emerald-500 hover:bg-emerald-650 active:bg-emerald-700 shadow-emerald-500/20',
    textClass: 'text-emerald-500',
    glowClass: 'shadow-[0_0_30px_rgba(34,197,94,0.35)]',
    badgeClass: 'bg-emerald-50 text-emerald-600 border border-emerald-200'
  }
};

// Shuffling helper for randomizing button order
const shuffleArray = <T,>(arr: T[]): T[] => {
  const newArr = [...arr];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

export default function App() {
  // Game state
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'GAMEOVER'>('IDLE');
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  
  // Game configuration
  const [difficulty, setDifficulty] = useState<'Chill' | 'Normal' | 'ReflexMaster'>('Normal');
  const [stroopMode, setStroopMode] = useState<boolean>(true); // Stroop effect toggle (illusion of mismatched colors)
  const [acceleration, setAcceleration] = useState<boolean>(true); // decrease time limit as score grows
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  
  // Active round state
  const [targetWord, setTargetWord] = useState<ColorKey>('RED');
  const [textStyleColor, setTextStyleColor] = useState<ColorKey>('RED');
  const [buttons, setButtons] = useState<ColorKey[]>(['RED', 'BLUE', 'GREEN']);
  const [timeLeft, setTimeLeft] = useState<number>(1500); // current remaining time in ms
  const [activeLimit, setActiveLimit] = useState<number>(1500); // original round limit in ms
  const [gameOverReason, setGameOverReason] = useState<'WRONG' | 'TIMEOUT' | null>(null);
  const [wrongClickDetails, setWrongClickDetails] = useState<{ clicked: string, target: string } | null>(null);
  
  // Sparkle/hit visual feedback states
  const [successAnimation, setSuccessAnimation] = useState<boolean>(false);
  const [shakeAnimation, setShakeAnimation] = useState<boolean>(false);
  const [floatingPoints, setFloatingPoints] = useState<{ id: number; x: number; y: number }[]>([]);

  // Reaction time recording for session metrics
  const [currentReactionTimes, setCurrentReactionTimes] = useState<number[]>([]);

  // Refs for tracking real-time timestamps accurately on the animation frame
  const animationFrameRef = useRef<number | null>(null);
  const roundStartTimeRef = useRef<number>(0);
  const activeLimitRef = useRef<number>(1500);
  const gameStateRef = useRef<'IDLE' | 'PLAYING' | 'GAMEOVER'>('IDLE');
  
  // Sync state refs to avoid closure stale state in the frame loop
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    activeLimitRef.current = activeLimit;
  }, [activeLimit]);

  // Load High Score initially from Local Storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('color_reflex_highscore');
      if (saved) {
        setHighScore(parseInt(saved, 10));
      }
    } catch (e) {
      console.warn('Local storage high score could not be accessed.');
    }
  }, []);

  // Web Audio synth player for latency-free, installation-free retro SFX
  const playSynthesizerTone = useCallback((type: 'success' | 'fail' | 'tick') => {
    if (isAudioMuted) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      const now = ctx.currentTime;
      
      if (type === 'success') {
        osc.type = 'triangle';
        // Fast ascending cute retro-arcade double beep
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(783.99, now + 0.08); // G5
        gainNode.gain.setValueAtTime(0.08, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.26);
      } else if (type === 'fail') {
        osc.type = 'sawtooth';
        // Dramatic low falling buzzer tone
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.linearRampToValueAtTime(50, now + 0.5);
        gainNode.gain.setValueAtTime(0.12, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
        osc.start(now);
        osc.stop(now + 0.53);
      } else if (type === 'tick') {
        osc.type = 'sine';
        // Ultra-short dynamic high block wood tap
        osc.frequency.setValueAtTime(1200, now);
        gainNode.gain.setValueAtTime(0.02, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.start(now);
        osc.stop(now + 0.05);
      }
    } catch (err) {
      console.warn('Synthesizer tone generation blocked or unsupported by browser sandbox.', err);
    }
  }, [isAudioMuted]);

  // Base timer calculation according to difficulty scale
  const getBaseTimerLimit = useCallback(() => {
    switch (difficulty) {
      case 'Chill': return 2500;
      case 'ReflexMaster': return 1000;
      case 'Normal':
      default:
        return 1500;
    }
  }, [difficulty]);

  // Generate target and buttons for the next round
  const generateNewRound = useCallback((currentScore: number) => {
    // Determine active name target color
    const nextTargetIdx = Math.floor(Math.random() * COLOR_KEYS.length);
    const nextTargetName = COLOR_KEYS[nextTargetIdx];
    
    // Choose font rendering style color (Stroop effect)
    let nextTextStyle: ColorKey = nextTargetName;
    if (stroopMode) {
      // 70% chance to mismatched text styling color, introducing stroop test confusion
      if (Math.random() < 0.7) {
        const structuralAlternatives = COLOR_KEYS.filter(k => k !== nextTargetName);
        nextTextStyle = structuralAlternatives[Math.floor(Math.random() * structuralAlternatives.length)];
      }
    }
    
    // Shuffle the interaction layouts
    const randomizedButtons = shuffleArray(COLOR_KEYS);
    
    // Compute remaining duration cap with speed scaling
    const baseLimit = getBaseTimerLimit();
    let calculatedLimit = baseLimit;
    if (acceleration && currentScore > 0) {
      // Gradually shrink timer limit by 3% per score, capping at a extreme floor of 450ms for hyper gameplay
      const reduction = Math.min(baseLimit - 450, currentScore * (difficulty === 'ReflexMaster' ? 25 : 35));
      calculatedLimit = Math.max(450, baseLimit - reduction);
    }

    setTargetWord(nextTargetName);
    setTextStyleColor(nextTextStyle);
    setButtons(randomizedButtons);
    setActiveLimit(calculatedLimit);
    setTimeLeft(calculatedLimit);
    
    // Set timestamp reference for animation frame countdown
    roundStartTimeRef.current = Date.now();
  }, [stroopMode, acceleration, difficulty, getBaseTimerLimit]);

  // Handle Game Over triggers
  const triggerGameOver = useCallback((reason: 'WRONG' | 'TIMEOUT', details?: { clicked: string, target: string }) => {
    // Cancel the frame cycle immediately
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    setGameState('GAMEOVER');
    setGameOverReason(reason);
    playSynthesizerTone('fail');
    
    if (details) {
      setWrongClickDetails(details);
    } else {
      setWrongClickDetails(null);
    }

    // Sync metrics and persist high score
    setHighScore(prev => {
      if (score > prev) {
        try {
          localStorage.setItem('color_reflex_highscore', score.toString());
        } catch (e) {
          console.warn('Could not save high score.');
        }
        return score;
      }
      return prev;
    });
  }, [score, playSynthesizerTone]);

  // Precise continuous animation loop tracker using elapsed timestamps
  useEffect(() => {
    const tick = () => {
      if (gameStateRef.current !== 'PLAYING') return;
      
      const elapsed = Date.now() - roundStartTimeRef.current;
      const currentLimit = activeLimitRef.current;
      const remaining = Math.max(0, currentLimit - elapsed);
      
      setTimeLeft(remaining);

      // Warning Tick audio if visual timer slips below final 30% of countdown limit
      if (remaining > 0 && Math.abs((remaining % 250) - 16) < 16 && remaining < currentLimit * 0.3) {
        playSynthesizerTone('tick');
      }

      if (remaining <= 0) {
        triggerGameOver('TIMEOUT');
      } else {
        animationFrameRef.current = requestAnimationFrame(tick);
      }
    };

    if (gameState === 'PLAYING') {
      roundStartTimeRef.current = Date.now();
      animationFrameRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState, triggerGameOver, playSynthesizerTone]);

  // Start a fresh, clean gameplay attempt
  const startNewGame = () => {
    setScore(0);
    setGameOverReason(null);
    setWrongClickDetails(null);
    setSuccessAnimation(false);
    setShakeAnimation(false);
    setFloatingPoints([]);
    setCurrentReactionTimes([]);
    
    setGameState('PLAYING');
    generateNewRound(0);
  };

  // Evaluate the player press reflex choice
  const handleReflexChoice = (selectedColor: ColorKey, event?: React.MouseEvent) => {
    if (gameState !== 'PLAYING') return;

    // Check if clicked matches the written color WORD (Target name Objective)
    if (selectedColor === targetWord) {
      // Sound feedback
      playSynthesizerTone('success');
      
      // Calculate correct choice reaction time
      const elapsedResponseTime = Date.now() - roundStartTimeRef.current;
      setCurrentReactionTimes(prev => [...prev, elapsedResponseTime]);
      
      // Calculate float starting dimensions for UI success bursts
      const clickX = event ? event.clientX : window.innerWidth / 2;
      const clickY = event ? event.clientY : window.innerHeight / 2;
      const newFloatId = Date.now();
      
      setFloatingPoints(prev => [...prev, { id: newFloatId, x: clickX, y: clickY }]);
      setSuccessAnimation(true);
      setTimeout(() => setSuccessAnimation(false), 200);

      // Advance rating metrics
      const nextScore = score + 1;
      setScore(nextScore);
      
      // Seed randomized items for the immediate next tick
      generateNewRound(nextScore);
    } else {
      // Wrong selection trigger!
      setShakeAnimation(true);
      setTimeout(() => setShakeAnimation(false), 400);
      triggerGameOver('WRONG', {
        clicked: selectedColor,
        target: targetWord
      });
    }
  };

  // Handle Keyboard reflex shortcuts for power players
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'PLAYING') return;
      
      const key = e.key.toLowerCase();
      
      // Position base bindings: 1, 2, 3 mapped from Left to Right button positions
      if (key === '1') {
        handleReflexChoice(buttons[0]);
      } else if (key === '2') {
        handleReflexChoice(buttons[1]);
      } else if (key === '3') {
        handleReflexChoice(buttons[2]);
      }
      // Direct color character bindings: r -> RED, g -> GREEN, b -> BLUE
      else if (key === 'r') {
        handleReflexChoice('RED');
      } else if (key === 'b') {
        handleReflexChoice('BLUE');
      } else if (key === 'g') {
        handleReflexChoice('GREEN');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, buttons, targetWord]);

  // Clean obsolete floating point overlays
  useEffect(() => {
    if (floatingPoints.length > 0) {
      const timer = setTimeout(() => {
        setFloatingPoints(prev => prev.slice(1));
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [floatingPoints]);

  // Color specific background styles
  const getThemeHex = (colorKey: ColorKey) => COLOR_THEMES[colorKey]?.hex || '#1E293B';
  const getTimerPercentage = () => Math.min(100, (timeLeft / activeLimit) * 100);

  // Return standard visual styling of the countdown meter depending on tension status
  const getTimerColorClass = () => {
    const pct = getTimerPercentage();
    if (pct < 30) return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]';
    if (pct < 60) return 'bg-amber-400';
    return 'bg-emerald-500';
  };

  // Calculate session analysis metrics for current attempt
  const sessionTotalCorrectClicks = score;
  const sessionLongestStreak = score;
  const avgReactionTimeMs = currentReactionTimes.length > 0
    ? Math.round(currentReactionTimes.reduce((sum, val) => sum + val, 0) / currentReactionTimes.length)
    : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans tracking-tight antialiased">
      
      {/* Visual background atmospheric circles */}
      <div className="absolute top-0 left-0 w-full h-[320px] bg-gradient-to-b from-blue-50/50 to-transparent -z-10 pointer-events-none" />
      
      {/* Floating score indicator particles */}
      <AnimatePresence>
        {floatingPoints.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 1, scale: 0.8, y: 0 }}
            animate={{ opacity: 0, scale: 1.5, y: -80 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="absolute z-50 text-emerald-600 font-extrabold text-2xl font-mono pointer-events-none"
            style={{ left: p.x - 10, top: p.y - 30 }}
          >
            +1!
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Top Header Navigation Strip */}
      <header className="border-b border-slate-200/80 bg-white/70 backdrop-blur-md px-4 py-3.5 sticky top-0 z-40 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 bg-slate-900 text-white rounded-lg flex items-center justify-center font-mono font-bold text-sm tracking-wider shadow-md">
              🎯
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-none flex items-center gap-1.5">
                Color Reflex Elimination
              </h1>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Shed illusions. Speed train your sensory reaction.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Toggle button */}
            <button
              onClick={() => setIsAudioMuted(p => !p)}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-600 transition-all active:scale-95"
              id="audio-toggle-btn"
              title={isAudioMuted ? "Unmute Audio Setup" : "Mute Sound Synthesis"}
            >
              {isAudioMuted ? <VolumeX className="h-4 w-4 text-slate-400" /> : <Volume2 className="h-4 w-4 text-slate-700" />}
            </button>
            
            {/* High-Contrast Info Indicator */}
            <div className="hidden sm:flex items-center gap-1.5 bg-amber-50 border border-amber-200/75 rounded-xl px-3 py-1.5 text-xs text-amber-800 font-medium">
              <Sparkles className="h-3.5 w-3.5 text-amber-600 animate-spin" />
              <span>Speed scaling decreases limit dynamically!</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Core Viewport */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 md:py-10 flex flex-col justify-center items-center">
        
        {/* State 1: IDLE START GAME PLAYGROUND SCREEN */}
        {gameState === 'IDLE' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden"
            id="idle-start-card"
          >
            {/* Header branding badge */}
            <div className="flex items-center justify-center mb-6">
              <span className="bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-mono font-extrabold tracking-widest uppercase px-3.5 py-1 rounded-full flex items-center gap-1.5">
                <Activity className="h-3 w-3 text-blue-500 animate-ping" />
                COGNITIVE DISSONANCE CHALLENGE
              </span>
            </div>

            <div className="text-center mb-8">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                Train Your Color Reflex
              </h2>
              <p className="text-sm text-slate-500 mt-2 px-4 leading-relaxed">
                Objective is simple: Click the button that matches the <strong className="text-slate-800 font-bold">WRITTEN COLOR NAME STRING</strong>. 
                Dodge the styling illusions and race the countdown.
              </p>
            </div>

            {/* Play Settings control deck */}
            <div className="bg-slate-50/70 border border-slate-200/60 rounded-2xl p-4 mb-8 space-y-4">
              <h3 className="text-xs font-mono font-extrabold text-slate-400 tracking-wider uppercase mb-1">
                EXPERT CONFIGURATION DECK
              </h3>
              
              {/* Target 1: Difficulties option */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">
                  TIMER DIFFICULTY
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'Chill', label: 'Chill (2.5s)', border: 'hover:border-slate-300' },
                    { key: 'Normal', label: 'Normal (1.5s)', border: 'hover:border-slate-300' },
                    { key: 'ReflexMaster', label: 'Master (1.0s)', border: 'hover:border-orange-200' }
                  ].map((d) => (
                    <button
                      key={d.key}
                      onClick={() => setDifficulty(d.key as any)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold tracking-tight border transition-all ${
                        difficulty === d.key 
                          ? 'bg-slate-900 border-slate-900 text-white shadow-md' 
                          : `bg-white border-slate-200 text-slate-700 ${d.border}`
                      }`}
                      id={`difficulty-btn-${d.key}`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target 2: Toggles config */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setStroopMode(p => !p)}
                  className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all bg-white hover:border-slate-350 cursor-pointer ${
                    stroopMode ? 'border-indigo-200 bg-indigo-50/10' : 'border-slate-200'
                  }`}
                  id="toggle-stroop-mode"
                >
                  <div>
                    <span className="block text-xs font-bold text-slate-800 leading-none">
                      Stroop Illusion Test
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Text is mismatted colored
                    </span>
                  </div>
                  <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${
                    stroopMode ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                  }`}>
                    {stroopMode && <div className="w-1 h-1 bg-white rounded-full" />}
                  </div>
                </button>

                <button
                  onClick={() => setAcceleration(p => !p)}
                  className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all bg-white hover:border-slate-350 cursor-pointer ${
                    acceleration ? 'border-indigo-200 bg-indigo-50/10' : 'border-slate-200'
                  }`}
                  id="toggle-acceleration"
                >
                  <div>
                    <span className="block text-xs font-bold text-slate-800 leading-none">
                      Dynamic Speeding
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Timer gets shorter per point
                    </span>
                  </div>
                  <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${
                    acceleration ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                  }`}>
                    {acceleration && <div className="w-1 h-1 bg-white rounded-full" />}
                  </div>
                </button>
              </div>
            </div>

            {/* Quick hotkeys cheat box info panel */}
            <div className="flex gap-2.5 items-start text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-2xl p-4.5 mb-8">
              <Keyboard className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-slate-800 leading-none mb-1">POWER USER KEYBOARD INPUTS AVAILABLE</h4>
                <p className="leading-relaxed">
                  Press keys <strong className="text-slate-700 select-all">[1]</strong>, <strong className="text-slate-700 select-all">[2]</strong>, or <strong className="text-slate-700 select-all">[3]</strong> to click from left to right. Or press <strong className="text-slate-700 select-all">[R]</strong>, <strong className="text-slate-700 select-all">[G]</strong>, <strong className="text-slate-700 select-all">[B]</strong> directly!
                </p>
              </div>
            </div>

            {/* CTA action trigger button */}
            <button
              onClick={startNewGame}
              className="w-full bg-slate-900 text-white py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 hover:-translate-y-0.5 active:translate-y-0 transition-all shadow-lg active:scale-98 cursor-pointer"
              id="start-game-btn"
            >
              <Play className="h-5 w-5 fill-white text-white" />
              <span>LAUNCH REFLEX SIMULATOR</span>
            </button>

            {highScore > 0 && (
              <div className="mt-5 text-center flex items-center justify-center gap-1.5 text-xs text-slate-500">
                <Trophy className="h-3.5 w-3.5 text-amber-500 fill-amber-500/20" />
                <span>SAVED HIGH SCORE STREAK:</span>
                <span className="font-mono font-bold text-slate-700">{highScore}</span>
              </div>
            )}
          </motion.div>
        )}

        {/* State 2: IN GAME ACTIVE STROOP REFLEX PLAYING SCREEN */}
        {gameState === 'PLAYING' && (
          <div className="w-full max-w-xl flex flex-col items-center">
            
            {/* Top Score banner stats row */}
            <div className="w-full flex items-center justify-between mb-4 px-1 text-slate-600">
              <div className="flex items-center gap-1.5 bg-white border border-slate-200/95 py-1.5 px-3 rounded-full shadow-sm text-xs font-semibold">
                <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                <span>CURRENT SCORE:</span>
                <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-sm min-w-8 text-center">
                  {score}
                </span>
              </div>

              {acceleration && (
                <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-100 py-1.5 px-3 rounded-full text-[11px] font-bold text-indigo-700">
                  <Zap className="h-3 w-3 text-indigo-500 animate-pulse" />
                  <span>SPEED SCALE LIMIT: <span className="font-mono leading-none">{(activeLimit / 1000).toFixed(2)}s</span></span>
                </div>
              )}

              <div className="flex items-center gap-1.5 bg-white border border-slate-200/95 py-1.5 px-3 rounded-full shadow-sm text-xs font-semibold">
                <Trophy className="h-3.5 w-3.5 text-amber-500 fill-amber-500/10" />
                <span>PEAK STREAK:</span>
                <span className="font-mono font-bold text-slate-700">
                  {Math.max(highScore, score)}
                </span>
              </div>
            </div>

            {/* Primary Center Game Card Container */}
            <div 
              className={`w-full bg-white border border-slate-250 rounded-3xl p-6 md:p-8 shadow-xl transition-all relative overflow-hidden flex flex-col items-center justify-center ${
                successAnimation ? 'bg-emerald-50/10 ring-4 ring-emerald-400/20' : ''
              } ${shakeAnimation ? 'animate-bounce border-red-500 duration-150 shadow-red-500/10 shadow-xl ring-4 ring-red-400/30' : ''}`}
              id="active-game-board"
            >
              
              {/* Top smooth Progress countdown bar */}
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-8 border border-slate-200/40 relative">
                <div 
                  className={`h-full transition-all duration-75 origin-left ${getTimerColorClass()}`}
                  style={{ width: `${getTimerPercentage()}%` }}
                />
              </div>

              {/* Status Header text telling player what objective to match */}
              <div className="text-center mb-4">
                <span className="bg-slate-100 border border-slate-250 text-slate-600 text-[10px] font-mono font-extrabold tracking-widest uppercase px-3.5 py-1 rounded-full flex items-center gap-1.5 leading-none">
                  🎯 OBJECTIVE: SELECT THE WORD TITLE NAME BELOW
                </span>
              </div>

              {/* Targeted Word Center Area */}
              <div className="h-44 flex items-center justify-center w-full relative">
                
                {/* Visual dotted focusing radar */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-36 h-36 rounded-full border border-dashed border-slate-200 animate-spin-slow pointer-events-none" />
                  <div className="w-24 h-24 rounded-full border border-slate-100 pointer-events-none absolute" />
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${targetWord}-${textStyleColor}`}
                    initial={{ scale: 0.82, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ duration: 0.12, ease: 'easeOut' }}
                    className="z-10 text-center"
                  >
                    {/* The main Stroop visual word element */}
                    <span 
                      className="text-6xl md:text-7xl font-black tracking-widest uppercase font-sans drop-shadow-[0_2px_4px_rgba(0,0,0,0.03)]"
                      style={{ color: getThemeHex(textStyleColor) }}
                    >
                      {targetWord}
                    </span>
                    
                    {stroopMode && (
                      <span className="block text-[10px] text-slate-400 font-mono font-bold mt-2 uppercase tracking-wide">
                        Ignore visual color style. Click button spelling &quot;{targetWord}&quot;
                      </span>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* High tension timer clock display warning in central view */}
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono font-medium mb-12">
                <Clock className={`h-4.5 w-4.5 ${timeLeft < activeLimit * 0.3 ? 'text-red-500 animate-pulse' : 'text-slate-400'}`} />
                <span>REACTION WINDOW: <strong className="font-mono text-slate-800">{(timeLeft / 1000).toFixed(2)}s</strong></span>
              </div>

              {/* Dynamic Responsive Randomized Interaction Row */}
              <div className="w-full">
                
                <div className="text-center mb-3">
                  <span className="text-[10px] font-extrabold text-slate-450 tracking-wider font-mono">
                    BUTTON DISPLAY ORDER RANDOMIZED INSTANTLY:
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 md:gap-4">
                  {buttons.map((colKey, index) => {
                    const theme = COLOR_THEMES[colKey];
                    return (
                      <motion.button
                        key={colKey}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={(e) => handleReflexChoice(colKey, e)}
                        className={`text-white font-black rounded-2xl py-5 px-3 md:py-6 text-sm md:text-base flex flex-col items-center justify-center cursor-pointer transition-all shadow-md hover:shadow-lg ${theme.bgClass}`}
                        style={{ outline: 'none' }}
                        id={`reflex-choice-${colKey}`}
                        type="button"
                      >
                        {/* Word label inside button */}
                        <span className="tracking-widest uppercase text-white font-extrabold drop-shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
                          {colKey}
                        </span>
                        
                        {/* Keyboard direct mapped cues */}
                        <span className="mt-2 text-[9px] font-bold py-0.5 px-2 bg-black/15 text-white/90 rounded font-mono leading-none">
                          KEY {index + 1} / {colKey[0]}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Quick Helper Tips inside Gameplay */}
            <div className="w-full max-w-md text-center mt-5 p-3 rounded-2xl bg-white/50 border border-slate-200/80 text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-slate-400" />
              <span>Target: click matches color spelling NAME. Click correct = shuffles buttons.</span>
            </div>
          </div>
        )}

        {/* State 3: GAME OVER STATS SCREEN */}
        {gameState === 'GAMEOVER' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white border border-rose-100 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden"
            id="gameover-stats-card"
          >
            {/* Visual Red Alert Border Header */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-500 to-rose-600" />

            <div className="flex items-center justify-center pt-2 mb-4">
              <span className="bg-rose-50 border border-rose-250 text-rose-700 text-[10px] font-mono font-extrabold tracking-widest uppercase px-3 py-1 rounded-full flex items-center gap-1">
                <Skull className="h-3 w-3 text-rose-500" />
                REFLEX ELIMINATION TERMINATED
              </span>
            </div>

            <div className="text-center mb-6">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                Simulation Finished
              </h2>
              
              {/* Dynamic summary phrase */}
              <p className="text-sm text-slate-500 mt-1 px-2 leading-relaxed">
                {gameOverReason === 'TIMEOUT' ? (
                  <span className="text-amber-800 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100 inline-block font-medium">
                    ⏱️ Reaction Limit Exceeded! You ran out of time.
                  </span>
                ) : (
                  <span className="text-rose-800 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100 inline-block font-medium">
                    ❌ Incorrect Reflex Choice! You pressed the wrong key.
                  </span>
                )}
              </p>
            </div>

            {/* In-depth mistake explanation box */}
            {gameOverReason === 'WRONG' && wrongClickDetails && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6 text-xs text-slate-650 text-center">
                <div className="font-bold text-slate-800 uppercase tracking-widest font-mono text-[10px] mb-2 text-slate-500">
                  REFLEX RETROSPECTIVE ERROR
                </div>
                <div className="flex items-center justify-around">
                  <div>
                    <span className="block text-[10px] text-slate-450 uppercase font-bold">WANTED OBJECTIVE</span>
                    <span 
                      className="text-sm font-black uppercase tracking-wider"
                      style={{ color: getThemeHex(wrongClickDetails.target as ColorKey) }}
                    >
                      {wrongClickDetails.target}
                    </span>
                  </div>
                  <div className="text-slate-300 font-bold">&#10142;</div>
                  <div>
                    <span className="block text-[10px] text-slate-455 uppercase font-bold">YOU SELECTED</span>
                    <span 
                      className="text-sm font-black uppercase tracking-wider"
                      style={{ color: getThemeHex(wrongClickDetails.clicked as ColorKey) }}
                    >
                      {wrongClickDetails.clicked}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Scoreboard highlights block */}
            <div className="grid grid-cols-2 gap-4 mb-5">
              
              <div className="bg-slate-50 border border-slate-200/85 rounded-2xl p-4 text-center">
                <span className="block text-[10px] text-slate-400 font-mono font-extrabold uppercase">
                  SCORE SECURED
                </span>
                <span className="text-3xl font-black text-slate-900 font-mono block mt-1">
                  {score}
                </span>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  {score === 0 ? 'No hits recorded' : score < 5 ? 'Steady pace' : score < 15 ? 'Reflex Master!' : 'Absolute Elite Flow!'}
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200/85 rounded-2xl p-4 text-center relative overflow-hidden">
                {score >= highScore && score > 0 && (
                  <div className="absolute -top-1 -right-4 bg-amber-500 text-white text-[8px] font-mono font-bold rotate-12 px-3 py-0.5">
                    NEW RECORD
                  </div>
                )}
                <span className="block text-[10px] text-slate-400 font-mono font-extrabold uppercase">
                  HIGH RECORD streak
                </span>
                <span className="text-3xl font-black text-amber-600 font-mono block mt-1 flex items-center justify-center gap-1">
                  <Trophy className="h-5 w-5 fill-amber-500/10 text-amber-500" />
                  {Math.max(highScore, score)}
                </span>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Local device best
                </span>
              </div>

            </div>

            {/* Session Analysis Block */}
            <div className="bg-slate-50/50 border border-slate-200/90 rounded-2xl p-4.5 mb-5 text-left">
              <div className="flex items-center gap-1.5 mb-3">
                <Activity className="h-4 w-4 text-indigo-600 animate-pulse" />
                <span className="text-xs font-black text-slate-700 tracking-wider uppercase font-mono">
                  🚨 SESSION ANALYSIS
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-2.5">
                {/* Metric 1: Total Correct Clicks */}
                <div className="bg-white border border-slate-150 rounded-xl p-3 flex flex-col justify-between shadow-sm">
                  <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider leading-tight">
                    Total Clicks
                  </span>
                  <div className="mt-2 flex items-baseline gap-0.5">
                    <span className="text-lg font-black text-slate-900 font-mono leading-none">
                      {sessionTotalCorrectClicks}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono font-bold">hits</span>
                  </div>
                </div>

                {/* Metric 2: Longest Streak */}
                <div className="bg-white border border-slate-150 rounded-xl p-3 flex flex-col justify-between shadow-sm">
                  <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider leading-tight">
                    Longest Streak
                  </span>
                  <div className="mt-2 flex items-baseline gap-0.5">
                    <span className="text-lg font-black text-indigo-600 font-mono leading-none">
                      {sessionLongestStreak}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono font-bold">streak</span>
                  </div>
                </div>

                {/* Metric 3: Average Reaction Time */}
                <div className="bg-white border border-slate-150 rounded-xl p-3 flex flex-col justify-between shadow-sm">
                  <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider leading-tight">
                    Avg. Response
                  </span>
                  <div className="mt-2">
                    {avgReactionTimeMs > 0 ? (
                      <div className="flex flex-col">
                        <span className="text-lg font-black text-emerald-600 font-mono leading-none">
                          {avgReactionTimeMs}
                          <span className="text-[8px] font-bold text-slate-400 ml-0.5">ms</span>
                        </span>
                        <span className="text-[8px] text-slate-500 mt-1 font-extrabold leading-none uppercase">
                          {avgReactionTimeMs < 450 ? '⚡ Ultra' : avgReactionTimeMs < 750 ? '🚀 Fast' : '🐢 Steady'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-lg font-black text-slate-300 font-mono leading-none">
                        —
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Dynamic Sensory Rank Rating tag */}
              {avgReactionTimeMs > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-150 flex flex-col sm:flex-row items-start sm:items-center justify-between text-[11px] gap-1 select-none">
                  <div className="flex items-center gap-1">
                    <Award className="h-3.5 w-3.5 text-amber-500" />
                    <span className="font-bold text-slate-500 uppercase tracking-wide">Reflex Rating:</span>
                  </div>
                  <span className="font-black text-indigo-600 font-mono text-[10px] uppercase bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    {avgReactionTimeMs < 450 
                      ? '⚡ Godlike Reflex Speed' 
                      : avgReactionTimeMs < 655 
                      ? '🚀 Supreme Tension Mastery' 
                      : avgReactionTimeMs < 875 
                      ? '🎯 Elite Cognitive Flow' 
                      : avgReactionTimeMs < 1150 
                      ? '🧠 Focused Sensory Match' 
                      : '🧘 Calm Measured Response'}
                  </span>
                </div>
              )}
            </div>

            {/* Settings review info details tag (Difficulty configured for this score run) */}
            <div className="bg-slate-50 border border-slate-200/70 p-3 rounded-2xl text-[11px] text-slate-500 flex flex-wrap gap-2 items-center justify-center.5 mb-6">
              <span className="bg-slate-200 text-slate-700 font-bold font-mono px-2 py-0.5 rounded uppercase">
                DIFFICULTY: {difficulty}
              </span>
              <span className={`px-2 py-0.5 rounded font-mono font-bold uppercase ${stroopMode ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                STROOP: {stroopMode ? 'ILLUSION ON' : 'ILLUSION OFF'}
              </span>
              <span className={`px-2 py-0.5 rounded font-mono font-bold uppercase ${acceleration ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'}`}>
                SPEEDING: {acceleration ? 'ACTIVE' : 'STATIC'}
              </span>
            </div>

            {/* Restart Trigger Action */}
            <button
              onClick={startNewGame}
              className="w-full bg-slate-900 text-white py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 hover:-translate-y-0.5 active:translate-y-0 transition-all shadow-lg active:scale-98 cursor-pointer"
              id="replay-game-btn"
            >
              <RotateCcw className="h-4 w-4" />
              <span>LAUNCH SIMULATOR AGAIN</span>
            </button>

            {/* Back to Home Menu option */}
            <button
              onClick={() => setGameState('IDLE')}
              className="w-full text-slate-500 text-xs py-2 mt-3 block hover:text-slate-800 transition-colors text-center font-semibold"
              id="back-to-menu-btn"
            >
              Adjust difficulty settings & keys cheat sheet
            </button>
          </motion.div>
        )}

      </main>

      {/* Persistent status info bar footer */}
      <footer className="border-t border-slate-200 bg-white/50 px-4 py-3 text-[11px] font-mono text-slate-500">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 font-medium">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Browser-Synthesized Frequency Audio Active</span>
          </div>
          <span className="text-[10px] text-slate-450 text-center sm:text-right font-bold">
            Keyboard Layout: Left-to-Right Buttons map to key [1], [2], [3] | Color matching [R], [G], [B]
          </span>
        </div>
      </footer>

    </div>
  );
}
