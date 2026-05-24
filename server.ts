import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pre-packaged game design GDD document structure
import { GddDocument } from './src/types';

let gddState: GddDocument = {
  title: "Astra Wasteland: Neon Rust",
  vibeStyle: "Neon Rust",
  baseType: "Sanctuary Bus",
  controlType: "One-Tap Joystick",
  coreGameplay: {
    description: "A 3-minute high-octane auto-shooter combat loop. The player directs the survivor with a simple one-tap virtual joystick. Firing is automatic, prioritizing the closest mutant threat. Enemies drop XP shards and 'Rusted Alloys'. Collecting XP fills the rogue-lite level bar, giving choice of three random active modifiers (e.g. Fire Bullets, Chain Lightning, Toxic Spikes) to create an unstoppable power fantasy before the boss spawns at 2:30.",
    powerups: [
      { name: "Fire Bullets", desc: "Ignites enemies on impact, dealing 15% damage/sec for 3 seconds.", icon: "Flame" },
      { name: "Chain Lightning", desc: "Energy arcs out, hitting up to 4 nearby mutants with 40% damage.", icon: "Zap" },
      { name: "Frozen Shell", desc: "Emits a pulse every 4 seconds, freezing nearby threats for 1.5s.", icon: "Snowflake" },
      { name: "Toxic Spikes", desc: "Drops poison caltrops in the player's path, slowing threats by 40%.", icon: "Skull" },
      { name: "Shield Dome", desc: "Generates a transient blue shield absorbing 3 incoming mutant hits.", icon: "Shield" }
    ]
  },
  hybridMonetization: {
    battlePassName: "Wasteland Scavenger Pass",
    rewardedAds: [
      { id: "ad_revive", title: "Defibrillate Once", benefit: "Instantly revive after fatal damage in combat with a brief 3s invulnerability shield.", adScenario: "Shows player failing at 2:50, clicking 'Watch Defibrillator Trigger', coming back to vaporize the giant mutant boss." },
      { id: "ad_scavenge_double", title: "Double Scavenged Loot", benefit: "Double all Rusted Alloys and Tech Parts collected during a 3-minute run.", adScenario: "Presents a chest opening with 100 Rusted Alloys. A bright prompt asks: 'Scavenge Double?' Player secures 200 Alloys." },
      { id: "ad_air_drop", title: "Rogue-lite Air Drop", benefit: "Guarantees a Level 5 maximum tier power-up select at the start of a run.", adScenario: "Wasteland drone flies in saying 'Sponsor Drop Detected'. Player clicks, watches ad in under-screen preview, drops the Plasma Cannon." }
    ],
    cosmetics: [
      { id: "cos_gas_shakti", name: "Shaktimaan Gas Mask", tier: "Epic", type: "GasMask", equipped: true, cost: 200, indianThemed: true, statBonus: "+15% Toxin Resistance & Gold Trim" },
      { id: "cos_tuk_shield", name: "Auto-Rickshaw Scrap Shield", tier: "Legendary", type: "BodyArmor", equipped: false, cost: 450, indianThemed: true, statBonus: "+20% Kinetic Defense & Meter Horn Sound effect" },
      { id: "cos_neon_gun", name: "Bandra Neon Repeater", tier: "Rare", type: "WeaponSkin", equipped: false, cost: 120, indianThemed: true, statBonus: "Cyan tracer bullets with aesthetic muzzle flashes" },
      { id: "cos_desert_duster", name: "Rajput Wastelander Hood", tier: "Epic", type: "GasMask", equipped: false, cost: 180, indianThemed: true, statBonus: "+12% Max HP, royal saffron desert cowl" }
    ]
  },
  localizationPack: {
    region: "India Regional Localizer",
    events: [
      { id: "ev_monsoon", name: "Monsoon Scavenge Season", season: "Summer / Rains", description: "Heavy rains flood the map. Electric/lighting weapons do double damage. Special 'Aqua-Mutant' enemies crawl out from storm drains.", mechanicOverride: "+100% Chain Lightning Shock Damage, water puddle hazards.", multiplier: 1.5 },
      { id: "ev_diwali", name: "Diwali reclamation event", season: "Winter", description: "Reclaim the ruins! Firecracker traps and fireworks defense towers turn the night sky green and orange. Players light up neon lanterns to keep toxic fog away.", mechanicOverride: "Barricades blast like Sutli Bombs, neon lighting filters.", multiplier: 2.0 },
      { id: "ev_highway", name: " Bengaluru Highway Lockdown", season: "All year", description: "Fight off scavengers blocking important truck supply lines. Secure cargo containers filled with tech chips.", mechanicOverride: "Heavy cargo roadblocks, high density crawler mutants.", multiplier: 1.3 }
    ],
    culturalSkins: ["Tuk-Tuk Armor", "Sherpa Goggles", "Desi Masala Medic Pack"],
    chaiRestStops: true
  },
  viralAdConcepts: [
    { id: "ad_fail_win", title: "Only 1% Can Settle Bandra Link Outpost (Meme Layout)", hook: "Shows a player with level 1 handgun panicking and instantly getting eaten by crawler mutants.", action: "Then cuts to a professional player showing off complete base defenses, 'Sutli firecracker traps', and auto-turrets vaporizing screen-full waves of mutants.", estimatedCTR: 6.8, mockComments: ["Bro didn't know about Diwali fireworks!", "The tuk-tuk armor looks so funny", "This music is an absolute banger"], conceptType: "Fail vs Win" },
    { id: "ad_choices", title: "Survival Decision: Build Barricades vs Sip Chai", hook: "Faced with 100 approaching mutants, a mock interface presents options: [Chai Break] or [Deploy Sandbags].", action: "Player chooses Chai Break first, gets buffered by a glowing local Chai Wallah who buff-boosts movement, allowing player to loop circles and auto-zap the horde.", estimatedCTR: 7.2, mockComments: ["Average day on Bengaluru bypass 😂", "Always secure the Chai", "Is this a real game? Looks dope"], conceptType: "Choice Narrative" },
    { id: "ad_sat_upgrade", title: "Wasteland Bus Restoration ASMR", hook: "Satisfying cleanup audio: scrubbing rust, welding steel plates, and upgrading turrets.", action: "Starts with a rusted junk bus being overrun. In fast motion with satisfying pop sounds, the armor is welded, neon sirens illuminate, and scrap-cannons align onto barricades.", estimatedCTR: 5.4, mockComments: ["Restoration videos are so satisfying", "The Neon Rust style is actually clean", "Can I paint the bus yellow? Like school bus?"], conceptType: "Satisfying Upgrades" }
  ]
};

// System activities tracker for Game GDD customization
interface AdminLog {
  id: string;
  timestamp: string;
  action: string;
  category: "GDD" | "Localization" | "Simulator" | "Monetization";
  details: string;
}

let adminLogs: AdminLog[] = [
  { id: "log_1", timestamp: "2026-05-23T12:00:00Z", action: "GDD Blueprint Initialized", category: "GDD", details: "Established Hybridcasual Survivor layout optimized for 10M downloads." },
  { id: "log_2", timestamp: "2026-05-23T12:15:00Z", action: "Ad Concept Set", category: "Monetization", details: "Generated 3 TikTok/Shorts high-traction concepts centering base restoration and high rewards." },
  { id: "log_3", timestamp: "2026-05-23T12:30:00Z", action: "India Localization Applied", category: "Localization", details: "Activated Desi Masala items, Chai Stops, and collapsing Bandra-Worli outpost events." }
];

async function startServer() {
  const app = express();
  app.use(express.json());

  // Initialize Gemini standard client
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = apiKey ? new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  }) : null;

  // GET: Current GDD State
  app.get('/api/gdd', (req, res) => {
    res.json({ gdd: gddState, logs: adminLogs });
  });

  // POST: Update & Save GDD State
  app.post('/api/gdd/save', (req, res) => {
    const { gdd } = req.body;
    if (gdd) {
      gddState = { ...gddState, ...gdd };
      const newLog: AdminLog = {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: "GDD Modified Manually",
        category: "GDD",
        details: `Saved adjusted structure for: ${gddState.title} (${gddState.vibeStyle}).`
      };
      adminLogs.unshift(newLog);
      res.json({ success: true, gdd: gddState, logs: adminLogs });
    } else {
      res.status(400).json({ error: "Missing GDD document body." });
    }
  });

  // POST: Generate Custom Indian Localization suggest or fully rewritten events using Gemini
  app.post('/api/gdd/localize', async (req, res) => {
    try {
      const { userRequest } = req.body;
      const context = JSON.stringify(gddState);

      if (!ai) {
        // Mock fallback rewrite
        const newLocalEvent = {
          id: `ev_local_${Date.now()}`,
          name: "Monsoon Metro Leak",
          season: "Monsoon Weather",
          description: "Water floods Mumbai's flooded metro lines. Silt mutants attack player's tech lab.",
          mechanicOverride: "Mud slow traps, shock attacks deal 3x damage.",
          multiplier: 1.8
        };
        gddState.localizationPack.events.push(newLocalEvent);
        
        const newLog: AdminLog = {
          id: `log_${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: "Localizer Rule-Event Injected",
          category: "Localization",
          details: "Injected Fallback Monsoon Event because Gemini API is offline."
        };
        adminLogs.unshift(newLog);

        return res.json({
          gdd: gddState,
          logs: adminLogs,
          advisorFeedback: `**Central Producer Advice:** (Offline Fallback Simulator Mode activated)\n\nWe have successfully created a local event: **"${newLocalEvent.name}"**. \nTo make this game massive in the Indian region:\n1. Ensure the download file size is capped at 52MB to match low-end reliance on Jio grids in outskirts.\n2. Localized events like Diwali & Holi make outstanding retention peaks. \n3. (Tip: Supply a real **GEMINI_API_KEY** in Settings > Secrets for customized interactive, fully contextual game advice!).`
        });
      }

      const prompt = `You are a Veteran Mobile Game Producer and Data Analyst specializing in bringing games to a 10M+ audience in India and Southeast Asia.
      The current mobile game design document (GDD) configuration is:
      ${context}

      The user has asked:
      "${userRequest || "Suggest dynamic Indian elements and a live-ops style calendar for the game"}"

      Analyze how this fits the Hybridcasual model (3-minute auto-shooter loops + Sanctuary restoration) and output a response divided cleanly into three sections:
      1. "LOCALIZATION RECOMMENDATIONS" - 3 high-impact features (like specific Desi items, localized hazards, local voiceovers/music style).
      2. "LIVE-OPS EVENT CALENDAR" - Suggested seasonal calendar for Indian major festivities (such as Diwali, Monsoon rains, Cricket world cup apocalypse, Holi etc.).
      3. "MOCK EVENT OBJECT" - Provide a VALID JSON codeblock at the very end containing exactly one new event configuration structured like:
      \`\`\`json
      {
        "name": "Local Event Name",
        "season": "Season Type",
        "description": "Short description of gameplay",
        "mechanicOverride": "How weapon damage or speeds alter",
        "multiplier": 1.7
      }
      \`\`\`
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      const responseText = response.text || "";
      
      // Pull and extract JSON from model response if possible
      let adviserFeedback = responseText;
      let parsedJson: any = null;

      try {
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/(\{[\s\S]*?\})/);
        if (jsonMatch) {
          const rawJson = jsonMatch[1].trim();
          parsedJson = JSON.parse(rawJson);
          adviserFeedback = responseText.replace(/```json[\s\S]*?```/g, "").trim();
        }
      } catch (err) {
        console.warn("Failed parsing Gemini event JSON returned:", err);
      }

      if (parsedJson && parsedJson.name) {
        const newEvent = {
          id: `ev_gen_${Date.now()}`,
          name: parsedJson.name,
          season: parsedJson.season || "Festive Season",
          description: parsedJson.description || "Survivor fight-backs in local landmarks.",
          mechanicOverride: parsedJson.mechanicOverride || "+50% gold rate.",
          multiplier: parsedJson.multiplier || 1.5
        };
        gddState.localizationPack.events.push(newEvent);

        const newLog: AdminLog = {
          id: `log_${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: "AI localized event created",
          category: "Localization",
          details: `Gemini generated event: "${parsedJson.name}"`
        };
        adminLogs.unshift(newLog);
      } else {
        // Fallback event if structure was wrong
        const fallbackName = "Holi Splat Warfare";
        const newEvent = {
          id: `ev_gen_${Date.now()}`,
          name: fallbackName,
          season: "Spring Phase",
          description: "Splat colorful chemical colors to blind mutant eyes and double combat rewards.",
          mechanicOverride: "Toxic colors increase mutation speed but multiply drops.",
          multiplier: 1.8
        };
        gddState.localizationPack.events.push(newEvent);

        const newLog: AdminLog = {
          id: `log_${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: "AI Holi event created",
          category: "Localization",
          details: `Generated festive Splat Event.`
        };
        adminLogs.unshift(newLog);
      }

      res.json({
        success: true,
        gdd: gddState,
        logs: adminLogs,
        advisorFeedback: adviserFeedback
      });

    } catch (e: any) {
      console.error("Localizer AI error:", e);
      res.status(500).json({ error: e.message || 'Error executing AI Localization advisory request.' });
    }
  });

  // POST: AI Producer chat endpoint to review GDD and offer telemetry / analytics advices
  app.post('/api/assistant/chat', async (req, res) => {
    try {
      const { message, history = [] } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Missing message text" });
      }

      if (!ai) {
        // Fallback rule analyst
        let reply = "";
        const norm = message.toLowerCase();
        if (norm.includes("ad") || norm.includes("monetiz") || norm.includes("ctr")) {
          reply = `### 📊 Analytics Advisory (Rule Fallback)

To hit **10 Million downloads** with this hybridcasual layout:
- **Rewarded Ad frequency**: Limit to 2 per session to keep Play Store reviews above **4.5**.
- **Ad Revive limit**: Lock to max 1 per run to preserve combat loop high-stakes.
- **Battle Pass**: survivor cosmetics (e.g., customized Gas Masks) usually command a **34% higher average transaction value** than basic weapon skins.

*Tip: Add GEMINI_API_KEY in Secrets parameter to query the production Gemini model on any specific hybrid monetization inquiries!*`;
        } else if (norm.includes("bus") || norm.includes("bunker") || norm.includes("sanctuary")) {
          reply = `### 🏗️ Base Metagame Advisor (Rule Fallback)

Upgrading the **${gddState.baseType}** provides the player with robust meta goals:
- **Auto-Turrets** provide secondary projectile cover in the survival simulator. Upgraders will see increased damage rates and special rockets.
- **Defensive Walls** slow down enemy mutant approach speed.
- **Tech Lab** upgrades grant a flat damage boost on rogue-lite powerups.

Ensure base upgrades require 'Alloys' found strictly in runs to tie the gameplay loop tightly.`;
        } else {
          reply = `### ☣️ Producer co-pilot response (Rule Fallback)

Welcome, Game Designer! I am here to evaluate your **${gddState.title}** GDD.
- **Art Direction**: ${gddState.vibeStyle}
- **Controls**: Simple virtual ${gddState.controlType} layout
- **Metagame Hub**: ${gddState.baseType}

Ask me about:
1. *"How to localize cosmetics for the Indian audience?"*
2. *"Suggest a viral tik-tok hook centering raw gameplay"*
3. *"Evaluate the core loops and rewarded metrics"*
4. *"Can we add a cricket bat melee powerup?"*
5. *"Generate a localized event"*`;
        }

        return res.json({ text: reply });
      }

      const systemInstruction = `You are a world-class Game Producer for mobile games (specializing in Hybridcasual GDD layout, 3-minute survival combat, and rewarded ad strategy).
      You are evaluating the game "${gddState.title}" with style "${gddState.vibeStyle}".
      Current complete Game configuration GDD: ${JSON.stringify(gddState)}
      Current logs: ${JSON.stringify(adminLogs)}

      Help the developer build, critique, or polish their game design GDD blueprint, localization methods, and simulated stats. 
      Use sharp, professional, realistic, data-driven words. Cite specific Android metric constraints (like keeping file size under 60MB, Jio 4G connection speeds, organic CTR rates, and rewarded player conversion curves). 
      Format with beautiful, clean markdown headers, bold keywords, and occasional metric lists. Clean, professional and respectful.`;

      // Build context payload
      const contentsPayload: any[] = [];
      if (Array.isArray(history)) {
        history.slice(-10).forEach((item: any) => {
          if (item.role === 'user' || item.role === 'model') {
            contentsPayload.push({
              role: item.role,
              parts: [{ text: item.content }]
            });
          }
        });
      }
      
      contentsPayload.push({
        role: 'user',
        parts: [{ text: message }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contentsPayload,
        config: {
          systemInstruction,
          temperature: 0.75,
        }
      });

      res.json({ text: response.text || "Analyzed GDD parameters successfully." });

    } catch (e: any) {
      console.error("AI chat assistant error:", e);
      res.status(500).json({ error: e.message || 'Error occurred querying your AI Game Assistant.' });
    }
  });

  // Serve static UI assets or run dev middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log("Neon Rust Game GDD server starting in DEVELOPMENT mode with dynamic Vite middleware.");
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
    console.log("Neon Rust Game GDD server starting in PRODUCTION mode with compiled assets.");
  }

  const port = 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Neon Rust GDD Simulator running on port ${port}`);
  });
}

startServer();
