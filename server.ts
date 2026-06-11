/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { AppState, Match, Prediction, User } from "./src/types";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
const PORT = 3000;
const DB_PATH = path.join(process.cwd(), "data", "db.json");

// In-memory OTP storage for secure user PIN recovery
const otpStorage = new Map<string, { otp: string; expiresAt: number; userId: string }>();

// Ensure data folder exists
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

// Generate default matches (Group Stage World Cup schedule aligned to 2026)
function seedMatches(): Match[] {
  const groups: { [key: string]: string[] } = {
    "Group A": ["Mexico", "Colombia", "Sweden", "Uzbekistan"],
    "Group B": ["Canada", "Denmark", "Nigeria", "South Korea"],
    "Group C": ["USA", "Morocco", "Poland", "Australia"],
    "Group D": ["Argentina", "Ecuador", "Egypt", "Czechia"],
    "Group E": ["France", "Venezuela", "Mali", "Scotland"],
    "Group F": ["Germany", "Uruguay", "Algeria", "Japan"],
    "Group G": ["England", "Croatia", "Ghana", "Iraq"],
    "Group H": ["Brazil", "Switzerland", "Cameroon", "New Zealand"],
    "Group I": ["Portugal", "Peru", "Tunisia", "Saudi Arabia"],
    "Group J": ["Spain", "Belgium", "Ivory Coast", "Qatar"],
    "Group K": ["Italy", "Ukraine", "South Africa", "Panama"],
    "Group L": ["Netherlands", "Chile", "Senegal", "Jamaica"],
  };

  const matches: Match[] = [];
  let matchIdCounter = 1;

  // Let's seed 72 group stage matches (3 rounds for each of the 12 groups)
  const groupNames = Object.keys(groups);
  
  groupNames.forEach((groupName, gIdx) => {
    const teams = groups[groupName];
    // Programmatic round-robin pairings for 4 teams in each group
    const rounds = [
      [[0, 1], [2, 3]],
      [[0, 2], [1, 3]],
      [[0, 3], [1, 2]],
    ];

    rounds.forEach((round, rIdx) => {
      // Offset dates dynamically to distribute over June 11 to June 27
      let roundDay = 0;
      if (rIdx === 0) {
        roundDay = Math.floor(gIdx / 2); // Days 0 to 5 (June 11 - 16)
      } else if (rIdx === 1) {
        roundDay = 6 + Math.floor(gIdx / 2); // Days 6 to 11 (June 17 - 22)
      } else {
        if (gIdx >= 8) {
          roundDay = 16; // Day 16 (June 27)
        } else {
          roundDay = 12 + Math.floor(gIdx / 2); // Days 12 to 15 (June 23 - 26)
        }
      }
      
      round.forEach((pair, pIdx) => {
        const home = teams[pair[0]];
        const away = teams[pair[1]];
        const matchHour = pIdx === 0 ? "15:00" : "19:00";
        
        // Aligned strictly to World Cup 2026 opening date: June 11, 2026
        const baseDate = new Date("2026-06-11T12:00:00Z");
        baseDate.setDate(baseDate.getDate() + roundDay);
        const dateStr = `${baseDate.toISOString().split('T')[0]} ${matchHour}`;

        matches.push({
          id: `m-${matchIdCounter++}`,
          homeTeam: home,
          awayTeam: away,
          group: groupName,
          stage: "Group Stage",
          date: dateStr,
          status: "scheduled",
        });
      });
    });
  });

  // Knockout placeholders matching expanded 48-team knockouts (Round of 32 onwards)
  const knockouts: { stage: Match["stage"]; home: string; away: string }[] = [
    // Round of 32
    { stage: "Round of 32", home: "Winner Group A", away: "3rd Place C/D/E" },
    { stage: "Round of 32", home: "Runner-up Group A", away: "Runner-up Group B" },
    { stage: "Round of 32", home: "Winner Group C", away: "3rd Place B/F/G" },
    { stage: "Round of 32", home: "Winner Group D", away: "3rd Place I/J/K" },
    { stage: "Round of 32", home: "Winner Group E", away: "Runner-up Group D" },
    { stage: "Round of 32", home: "Winner Group F", away: "Runner-up Group C" },
    { stage: "Round of 32", home: "Winner Group G", away: "3rd Place A/E/L" },
    { stage: "Round of 32", home: "Winner Group H", away: "Runner-up Group I" },
    { stage: "Round of 32", home: "Winner Group I", away: "3rd Place D/E/J" },
    { stage: "Round of 32", home: "Winner Group J", away: "Runner-up Group H" },
    { stage: "Round of 32", home: "Winner Group K", away: "Runner-up Group G" },
    { stage: "Round of 32", home: "Winner Group L", away: "Runner-up Group F" },
    { stage: "Round of 32", home: "Runner-up Group E", away: "Runner-up Group J" },
    { stage: "Round of 32", home: "Runner-up Group F", away: "Runner-up Group K" },
    { stage: "Round of 32", home: "Runner-up Group G", away: "Runner-up Group L" },
    { stage: "Round of 32", home: "Runner-up Group H", away: "Runner-up Group A" },

    // Round of 16
    { stage: "Round of 16", home: "Winner R32 #1", away: "Winner R32 #2" },
    { stage: "Round of 16", home: "Winner R32 #3", away: "Winner R32 #4" },
    { stage: "Round of 16", home: "Winner R32 #5", away: "Winner R32 #6" },
    { stage: "Round of 16", home: "Winner R32 #7", away: "Winner R32 #8" },
    { stage: "Round of 16", home: "Winner R32 #9", away: "Winner R32 #10" },
    { stage: "Round of 16", home: "Winner R32 #11", away: "Winner R32 #12" },
    { stage: "Round of 16", home: "Winner R32 #13", away: "Winner R32 #14" },
    { stage: "Round of 16", home: "Winner R32 #15", away: "Winner R32 #16" },

    // Quarterfinal
    { stage: "Quarterfinal", home: "Winner R16 #1", away: "Winner R16 #2" },
    { stage: "Quarterfinal", home: "Winner R16 #3", away: "Winner R16 #4" },
    { stage: "Quarterfinal", home: "Winner R16 #5", away: "Winner R16 #6" },
    { stage: "Quarterfinal", home: "Winner R16 #7", away: "Winner R16 #8" },

    // Semifinal
    { stage: "Semifinal", home: "Winner QF #1", away: "Winner QF #2" },
    { stage: "Semifinal", home: "Winner QF #3", away: "Winner QF #4" },

    // Third Place
    { stage: "Third Place", home: "Loser SF #1", away: "Loser SF #2" },

    // Final
    { stage: "Final", home: "Winner SF #1", away: "Winner SF #2" },
  ];

  knockouts.forEach((k, idx) => {
    let dateStr = "";
    if (k.stage === "Round of 32") {
      // 16 matches. June 28 - July 3
      const dayOffset = Math.floor(idx / 3); // Spans 6 days -> June 28 to July 3
      const baseKoDate = new Date("2026-06-28T12:00:00Z");
      baseKoDate.setDate(baseKoDate.getDate() + dayOffset);
      const hour = idx % 3 === 0 ? "13:00" : idx % 3 === 1 ? "17:00" : "21:00";
      dateStr = `${baseKoDate.toISOString().split('T')[0]} ${hour}`;
    } else if (k.stage === "Round of 16") {
      // 8 matches. July 4 – July 7 (4 days, 2 matches per day)
      const r16Idx = idx - 16;
      const dayOffset = Math.floor(r16Idx / 2);
      const baseKoDate = new Date("2026-07-04T12:00:00Z");
      baseKoDate.setDate(baseKoDate.getDate() + dayOffset);
      const hour = r16Idx % 2 === 0 ? "16:00" : "20:00";
      dateStr = `${baseKoDate.toISOString().split('T')[0]} ${hour}`;
    } else if (k.stage === "Quarterfinal") {
      // 4 matches. July 9 – July 11 (3 days)
      const qfIdx = idx - 24;
      const dayOffset = Math.floor(qfIdx / 1.5); // Spans days 0 to 2 -> July 9 to July 11
      const baseKoDate = new Date("2026-07-09T12:00:00Z");
      baseKoDate.setDate(baseKoDate.getDate() + dayOffset);
      const hour = qfIdx % 2 === 0 ? "15:00" : "19:00";
      dateStr = `${baseKoDate.toISOString().split('T')[0]} ${hour}`;
    } else if (k.stage === "Semifinal") {
      // 2 matches. July 14 and July 15 (1 match per day)
      const sfIdx = idx - 28;
      const baseKoDate = new Date("2026-07-14T12:00:00Z");
      baseKoDate.setDate(baseKoDate.getDate() + sfIdx);
      dateStr = `${baseKoDate.toISOString().split('T')[0]} 19:00`;
    } else if (k.stage === "Third Place") {
      dateStr = "2026-07-18 15:00";
    } else if (k.stage === "Final") {
      dateStr = "2026-07-19 19:00";
    }

    matches.push({
      id: `m-ko-${idx + 1}`,
      homeTeam: k.home,
      awayTeam: k.away,
      group: "Knockout",
      stage: k.stage,
      date: dateStr,
      status: "scheduled",
    });
  });

  return matches;
}

// Read database
function readDB(): AppState {
  let db: AppState;

  if (!fs.existsSync(DB_PATH)) {
    const initialState: AppState = {
      users: [
        {
          id: "u-nidal",
          name: "nidal",
          phoneNumber: "nidal",
          pin: "2009",
          role: "admin",
          score: 0,
          exactScoresCount: 0,
          correctDiffsCount: 0,
          correctOutcomesCount: 0,
        }
      ],
      matches: seedMatches(),
      predictions: [],
      settings: {
        adminPin: "2009",
        hideLeaderboard: false,
        rules: {
          exactScorePoints: 1, // 1 point for predicting
          correctDiffPoints: 0,
          correctOutcomePoints: 4, // 4 points for correct outcome prediction
          knockoutAdvancePoints: 1,
        },
      },
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialState, null, 2), "utf8");
    db = initialState;
  } else {
    try {
      const raw = fs.readFileSync(DB_PATH, "utf8");
      db = JSON.parse(raw);
      // Migration: automatically update to World Cup 2026 if empty or not containing 104 matches (skip if manualMode is true)
      const isManual = db.settings?.manualMode === true;
      const isOld = !isManual && (!db.matches || db.matches.length !== 104 || db.matches.some((m: any) => m.homeTeam === "Qatar" || m.awayTeam === "Qatar"));
      if (isOld) {
        console.log("Migrating database config to FIFA World Cup 2026 matches format (104 matches, 12 groups, Round of 32 offsets)...");
        db.matches = seedMatches();
        db.predictions = []; // Clear outdated predictions
      }
    } catch (err) {
      console.error("Error reading database file, returning fresh state", err);
      db = {
        users: [],
        matches: [],
        predictions: [],
        settings: {
          adminPin: "2009",
          rules: {
            exactScorePoints: 1,
            correctDiffPoints: 0,
            correctOutcomePoints: 4,
            knockoutAdvancePoints: 1,
          },
        },
      };
    }
  }

  // Self-healing migration to enforce user nidal as admin and adminPin as 2009
  if (db) {
    if (!db.settings) {
      db.settings = {
        adminPin: "2009",
        hideLeaderboard: false,
        rules: {
          exactScorePoints: 1,
          correctDiffPoints: 0,
          correctOutcomePoints: 4,
          knockoutAdvancePoints: 1,
        }
      };
    }
    db.settings.adminPin = "2009";
    if (db.settings.hideLeaderboard === undefined) {
      db.settings.hideLeaderboard = false;
    }
    if (!db.settings.rules) {
      db.settings.rules = {
        exactScorePoints: 1,
        correctDiffPoints: 0,
        correctOutcomePoints: 4,
        knockoutAdvancePoints: 1,
      };
    }

    if (!Array.isArray(db.users)) {
      db.users = [];
    }

    // Migrate standard phoneNumbers if missing
    db.users = db.users.map((u: any) => ({
      ...u,
      phoneNumber: u.phoneNumber || "0000000000"
    }));

    // Ensure user nidal exists with pin 2009 and is admin
    const hasNidal = db.users.some(u => u.name.trim().toLowerCase() === "nidal");
    if (!hasNidal) {
      db.users.push({
        id: "u-nidal",
        name: "nidal",
        phoneNumber: "nidal",
        pin: "2009",
        role: "admin",
        score: 0,
        exactScoresCount: 0,
        correctDiffsCount: 0,
        correctOutcomesCount: 0,
      });
    } else {
      db.users = db.users.map(u => {
        if (u.name.trim().toLowerCase() === "nidal") {
          return {
            ...u,
            role: "admin",
            pin: "2009",
            phoneNumber: u.phoneNumber === "0000000000" ? "nidal" : u.phoneNumber
          };
        }
        return u;
      });
    }

    // Ensure any user with PIN 2009 gets labeled as admin for convenience, and vice-versa
    db.users = db.users.map(u => {
      if (u.pin === "2009" || u.name.trim().toLowerCase() === "nidal") {
        return { ...u, role: "admin" as const };
      }
      return u;
    });
  }

  return db;
}

// Write database
function writeDB(state: AppState) {
  fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2), "utf8");
}

// Recalculates points for all predictions and updates user aggregates
function recalculateScores(state: AppState): AppState {
  const { matches, predictions } = state;

  // Track user stats accumulation
  const userStatsMap: { [userId: string]: {
    score: number;
    exact: number; // Storing Correct Outcome count
    diff: number;  // Storing Total Voted count
    outcome: number;
  } } = {};

  // Initialize all existing users to 0 points
  state.users.forEach((u) => {
    userStatsMap[u.id] = { score: 0, exact: 0, diff: 0, outcome: 0 };
  });

  // Calculate points for each prediction
  const updatedPredictions = predictions.map((pred) => {
    const match = matches.find((m) => m.id === pred.matchId);
    if (!match || match.status !== "finished") {
      return { ...pred, pointsWon: undefined };
    }

    const hs = match.homeScore ?? 0;
    const as = match.awayScore ?? 0;
    const ph = pred.homePredict;
    const pa = pred.awayPredict;

    // Actual outcome: 1 = home win, -1 = away win, 0 = draw
    let actualOutcome = hs > as ? 1 : hs < as ? -1 : 0;

    // If the admin manually specified who won the match (as an override or penalty shootout setter)
    if (match.winnerId) {
      if (match.winnerId === match.homeTeam) {
        actualOutcome = 1;
      } else if (match.winnerId === match.awayTeam) {
        actualOutcome = -1;
      } else if (match.winnerId === "draw" || match.winnerId === "Draw") {
        actualOutcome = 0;
      }
    }

    const predictedOutcome = ph > pa ? 1 : ph < pa ? -1 : 0;

    // RULE: predicting matches gets predictingPoints (e.g. 1 point). Correct prediction outcome adds correctPredictionPoints (e.g. 4 points).
    const predictingPoints = state.settings?.rules?.exactScorePoints ?? 1;
    const correctPredictionPoints = state.settings?.rules?.correctOutcomePoints ?? 4;
    const knockoutAdvancePoints = state.settings?.rules?.knockoutAdvancePoints ?? 1;

    let points = predictingPoints; // participation point (e.g. 1 point) even if wrong
    let isCorrectOutcome = false;

    if (actualOutcome === predictedOutcome) {
      points += correctPredictionPoints; // accuracy bonus points (e.g. 4 points)
      isCorrectOutcome = true;
    }

    // Add extra advance points in knockouts if predicted winner matches the actual winner
    if (match.stage !== "Group Stage" && match.winnerId && pred.predictedWinnerId) {
      if (pred.predictedWinnerId === match.winnerId) {
        points += knockoutAdvancePoints;
      }
    }

    // Accumulate for user if they exist in mapping
    if (userStatsMap[pred.userId]) {
      userStatsMap[pred.userId].score += points;
      if (isCorrectOutcome) {
        userStatsMap[pred.userId].exact += 1; // Count as Correct pick
        userStatsMap[pred.userId].outcome += 1;
      }
      userStatsMap[pred.userId].diff += 1; // Count as Vote cast
    }

    return { ...pred, pointsWon: points };
  });

  // Update user models with accumulated values
  const updatedUsers = state.users.map((u) => {
    const stats = userStatsMap[u.id];
    if (stats) {
      return {
        ...u,
        score: stats.score,
        exactScoresCount: stats.exact,
        correctDiffsCount: stats.diff,
        correctOutcomesCount: stats.outcome,
      };
    }
    return u;
  });

  return {
    ...state,
    predictions: updatedPredictions,
    users: updatedUsers,
  };
}

// Express JSON parsing
app.use(express.json());

// API Endpoints
// get current full state
app.get("/api/state", (req, res) => {
  const db = readDB();
  res.json(db);
});

// create or join as user (deprecating or fallback)
app.post("/api/users", (req, res) => {
  const { name, pin, role } = req.body;
  
  if (!name || !pin) {
    return res.status(400).json({ error: "Name and PIN are required parameters." });
  }

  const db = readDB();
  
  // check if username exists
  const existingUser = db.users.find((u) => u.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (existingUser) {
    // Return existing user info if PIN matches (login flow)
    if (existingUser.pin === pin) {
      return res.json({ message: "Welcome back!", user: existingUser });
    } else {
      return res.status(401).json({ error: "Access Denied: PIN incorrect for this user name." });
    }
  }

  // Create new user
  const newUser: User = {
    id: `u-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: name.trim(),
    phoneNumber: "0000000000",
    pin: pin,
    role: role === "admin" && pin === db.settings.adminPin ? "admin" : "member",
    score: 0,
    exactScoresCount: 0,
    correctDiffsCount: 0,
    correctOutcomesCount: 0,
  };

  db.users.push(newUser);
  writeDB(db);
  
  res.status(201).json({ message: "Successfully signed up!", user: newUser });
});

// Secure Signup (Enforces phone-number uniqueness)
app.post("/api/users/signup", (req, res) => {
  const { name, phoneNumber, pin } = req.body;

  if (!name || !phoneNumber || !pin) {
    return res.status(400).json({ error: "Name, Phone Number, and PIN are required." });
  }

  const cleanPhone = phoneNumber.replace(/[^0-9a-zA-Z]/g, "").trim().toLowerCase();
  
  if (cleanPhone.length < 3) {
    return res.status(400).json({ error: "Please enter a valid phone number or identifier." });
  }

  if (pin.trim().length < 3) {
    return res.status(400).json({ error: "PIN must be at least 3 characters long." });
  }

  const db = readDB();

  // Cross reference if this phone number is unique (One phone number, one account)
  const phoneExists = db.users.some(
    (u) => u.phoneNumber.replace(/[^0-9a-zA-Z]/g, "").trim().toLowerCase() === cleanPhone
  );

  if (phoneExists) {
    return res.status(400).json({ error: "This phone number is already registered. Please log in." });
  }

  const newUser: User = {
    id: `u-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: name.trim(),
    phoneNumber: cleanPhone,
    pin: pin.trim(),
    role: pin.trim() === db.settings.adminPin ? "admin" : "member",
    score: 0,
    exactScoresCount: 0,
    correctDiffsCount: 0,
    correctOutcomesCount: 0,
  };

  db.users.push(newUser);
  writeDB(db);

  res.status(201).json({ message: "Registered successfully!", user: newUser });
});

// Secure Login (Uses Phone Number / Username and PIN)
app.post("/api/users/login", (req, res) => {
  const { phoneNumber, pin } = req.body;

  if (!phoneNumber || !pin) {
    return res.status(400).json({ error: "Phone number/Username and PIN are required." });
  }

  const cleanPhone = phoneNumber.replace(/[^0-9a-zA-Z]/g, "").trim().toLowerCase();
  const db = readDB();

  // Robustly find user by matching cleaned phone number, or lowercased name, or literal match
  const user = db.users.find((u) => {
    const rawPhone = u.phoneNumber.replace(/[^0-9a-zA-Z]/g, "").trim().toLowerCase();
    const rawName = u.name.trim().toLowerCase();
    return rawPhone === cleanPhone || rawName === cleanPhone;
  });

  if (!user) {
    return res.status(401).json({ error: "No account found with this phone number or name." });
  }

  if (user.pin !== pin.trim()) {
    return res.status(401).json({ error: "Incorrect PIN code. Access Denied." });
  }

  res.json({ message: "Logged in successfully!", user });
});

// Request an OTP code to recover/forgot password / PIN
app.post("/api/users/request-otp", (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ error: "Phone number or username is required." });
  }

  const cleanPhone = phoneNumber.replace(/[^0-9a-zA-Z]/g, "").trim().toLowerCase();
  const db = readDB();

  // Find the user with this username or phone number
  const user = db.users.find((u) => {
    const rawPhone = u.phoneNumber.replace(/[^0-9a-zA-Z]/g, "").trim().toLowerCase();
    const rawName = u.name.trim().toLowerCase();
    return rawPhone === cleanPhone || rawName === cleanPhone;
  });

  if (!user) {
    return res.status(404).json({ error: "No player profile associated with this phone number or name." });
  }

  // Generate a random 6-digit OTP code
  const otpCode = String(Math.floor(100000 + Math.random() * 900000)).substring(0, 6);
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes from now

  otpStorage.set(user.id, { otp: otpCode, expiresAt, userId: user.id });

  console.log(`[SMS Gateway Simulated] OTP sent to ${user.name} (${user.phoneNumber}): ${otpCode}`);

  res.json({
    message: "OTP Code triggered successfully!",
    phoneNumber: user.phoneNumber,
    // Return OTP in response so that the client-side code can show it to user
    // ensuring the flow is 100% testable in sandboxed environment.
    otp: otpCode,
  });
});

// Verify OTP and reset password / PIN
app.post("/api/users/verify-otp-reset-pin", (req, res) => {
  const { phoneNumber, otp, newPin } = req.body;

  if (!phoneNumber || !otp || !newPin) {
    return res.status(400).json({ error: "Phone number, OTP, and new PIN code are required." });
  }

  const cleanPhone = phoneNumber.replace(/[^0-9a-zA-Z]/g, "").trim().toLowerCase();
  const db = readDB();

  const user = db.users.find((u) => {
    const rawPhone = u.phoneNumber.replace(/[^0-9a-zA-Z]/g, "").trim().toLowerCase();
    const rawName = u.name.trim().toLowerCase();
    return rawPhone === cleanPhone || rawName === cleanPhone;
  });

  if (!user) {
    return res.status(404).json({ error: "No player profile associated with this phone number." });
  }

  if (newPin.trim().length < 3) {
    return res.status(400).json({ error: "New PIN code must be at least 3 characters." });
  }

  const record = otpStorage.get(user.id);
  if (!record) {
    return res.status(400).json({ error: "No pending password recovery request found." });
  }

  if (record.expiresAt < Date.now()) {
    otpStorage.delete(user.id);
    return res.status(400).json({ error: "OTP code has expired. Please trigger a new one." });
  }

  if (record.otp !== otp.trim()) {
    return res.status(400).json({ error: "Incorrect OTP code. Reset declined." });
  }

  // Success! Clean up storage and update PIN
  user.pin = newPin.trim();

  // Also maintain global settings admin PIN if nidal's account is recovered
  if (user.id === "u-nidal" || user.name.trim().toLowerCase() === "nidal") {
    db.settings.adminPin = newPin.trim();
  }

  otpStorage.delete(user.id);
  writeDB(db);

  res.json({
    message: "PIN updated successfully! You can now log in.",
    user,
  });
});

// save or edit current user predictions
app.post("/api/predictions", (req, res) => {
  const { userId, pin, predictions: userPreds } = req.body; // userPreds is array of predictions
  
  if (!userId || !pin || !Array.isArray(userPreds)) {
    return res.status(400).json({ error: "Invalid data structure." });
  }

  const db = readDB();
  const user = db.users.find((u) => u.id === userId);
  if (!user || user.pin !== pin) {
    return res.status(401).json({ error: "Unauthorized access: Invalid User or PIN verification failed." });
  }

  // Filter out any matches that are already finished
  const finishedMatchIds = new Set(db.matches.filter((m) => m.status === "finished").map((m) => m.id));
  const now = new Date();

  userPreds.forEach((upred: { matchId: string; homePredict: number; awayPredict: number; predictedWinnerId?: string }) => {
    if (finishedMatchIds.has(upred.matchId)) return; // Lock prediction edits once match starts

    const matchExists = db.matches.find((m) => m.id === upred.matchId);
    if (!matchExists) return;

    // RULE: block predictions saved on custom lock date or within 5 minutes of match start time
    let isLocked = false;
    if (matchExists.lockDate) {
      try {
        const lockTime = new Date(matchExists.lockDate.replace(" ", "T"));
        if (now.getTime() >= lockTime.getTime()) {
          isLocked = true;
        }
      } catch (err) {}
    } else if (matchExists.date) {
      try {
        const matchTime = new Date(matchExists.date.replace(" ", "T"));
        if (now.getTime() >= (matchTime.getTime() - 5 * 60 * 1000)) {
          isLocked = true;
        }
      } catch (err) {}
    }
    if (isLocked) return;

    // Remove old matching prediction if it exists
    db.predictions = db.predictions.filter((p) => !(p.userId === userId && p.matchId === upred.matchId));

    // Push new prediction
    db.predictions.push({
      userId,
      matchId: upred.matchId,
      homePredict: Number(upred.homePredict),
      awayPredict: Number(upred.awayPredict),
      predictedWinnerId: upred.predictedWinnerId,
      createdAt: new Date().toISOString(),
    });
  });

  const updatedState = recalculateScores(db);
  writeDB(updatedState);

  res.json({ message: "Predictions saved successfully!", state: updatedState });
});

// Admin ONLY: update match scores or set match details (home, away, stage, date)
app.post("/api/admin/match", (req, res) => {
  const { adminPin, matchId, homeTeam, awayTeam, stage, date, status, homeScore, awayScore, winnerId, homeFlag, awayFlag, lockDate } = req.body;

  const db = readDB();
  if (adminPin !== db.settings.adminPin) {
    return res.status(401).json({ error: "Invalid Admin PIN constraint." });
  }

  const matchIndex = db.matches.findIndex((m) => m.id === matchId);
  if (matchIndex === -1) {
    return res.status(404).json({ error: "Match not found." });
  }

  const currentMatch = db.matches[matchIndex];
  
  // Update fields if provided
  if (homeTeam !== undefined) currentMatch.homeTeam = homeTeam;
  if (awayTeam !== undefined) currentMatch.awayTeam = awayTeam;
  if (stage !== undefined) currentMatch.stage = stage;
  if (date !== undefined) currentMatch.date = date;
  if (status !== undefined) currentMatch.status = status;
  if (homeFlag !== undefined) currentMatch.homeFlag = homeFlag;
  if (awayFlag !== undefined) currentMatch.awayFlag = awayFlag;
  if (lockDate !== undefined) currentMatch.lockDate = lockDate;
  
  if (homeScore !== undefined && homeScore !== null) {
    currentMatch.homeScore = Number(homeScore);
  } else if (status === "scheduled") {
    delete currentMatch.homeScore;
  }
  
  if (awayScore !== undefined && awayScore !== null) {
    currentMatch.awayScore = Number(awayScore);
  } else if (status === "scheduled") {
    delete currentMatch.awayScore;
  }

  if (winnerId !== undefined) {
    if (winnerId === "" || winnerId === null || winnerId === "auto") {
      delete currentMatch.winnerId;
    } else {
      currentMatch.winnerId = winnerId;
    }
  }

  const updatedState = recalculateScores(db);
  writeDB(updatedState);

  res.json({ message: "Match details modernized!", state: updatedState });
});

// Admin ONLY: Add a new custom match
app.post("/api/admin/match/add", (req, res) => {
  const { adminPin, homeTeam, awayTeam, stage, date, homeFlag, awayFlag, lockDate } = req.body;

  const db = readDB();
  if (adminPin !== db.settings.adminPin) {
    return res.status(401).json({ error: "Invalid Admin PIN constraint." });
  }

  if (!homeTeam || !awayTeam || !stage || !date) {
    return res.status(400).json({ error: "Missing required fields (homeTeam, awayTeam, stage, date)." });
  }

  const newMatch: Match = {
    id: `m-custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    homeTeam: homeTeam.trim(),
    awayTeam: awayTeam.trim(),
    homeFlag: homeFlag ? homeFlag.trim() : undefined,
    awayFlag: awayFlag ? awayFlag.trim() : undefined,
    group: stage === "Group Stage" ? "Group Match" : "Knockout",
    stage: stage,
    date: date.trim(),
    lockDate: lockDate ? lockDate.trim() : undefined,
    status: "scheduled",
  };

  db.matches.push(newMatch);
  writeDB(db);

  res.status(201).json({ message: "Match successfully created!", state: db });
});

// Admin ONLY: Delete an existing match
app.post("/api/admin/match/delete", (req, res) => {
  const { adminPin, matchId } = req.body;

  const db = readDB();
  if (adminPin !== db.settings.adminPin) {
    return res.status(401).json({ error: "Invalid Admin PIN constraint." });
  }

  const matchExists = db.matches.some(m => m.id === matchId);
  if (!matchExists) {
    return res.status(404).json({ error: "Match not found." });
  }

  // Remove match and associated predictions
  db.matches = db.matches.filter(m => m.id !== matchId);
  db.predictions = db.predictions.filter(p => p.matchId !== matchId);

  const updatedState = recalculateScores(db);
  writeDB(updatedState);

  res.json({ message: "Match deleted completely!", state: updatedState });
});

// Admin ONLY: Automate match updates by scraping match info and results from Google Search
app.post("/api/admin/automate-matches", async (req, res) => {
  const { adminPin, targetDate } = req.body; // targetDate format e.g. "2026-06-11"

  const db = readDB();
  if (adminPin !== db.settings.adminPin) {
    return res.status(401).json({ error: "Invalid Admin PIN constraint." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const dateToSearch = targetDate || new Date().toISOString().split("T")[0]; // default to today in YYYY-MM-DD

  if (!apiKey) {
    // Elegant fallback simulation if API key is not present
    let updatedCount = 0;
    db.matches = db.matches.map(m => {
      if (m.date.startsWith(dateToSearch)) {
        updatedCount++;
        // Generate logical football score
        return {
          ...m,
          status: "finished",
          homeScore: Math.floor(Math.random() * 4),
          awayScore: Math.floor(Math.random() * 3),
        };
      }
      return m;
    });

    if (updatedCount > 0) {
      const updatedState = recalculateScores(db);
      writeDB(updatedState);
      return res.json({
        message: `[Demo Mode / Direct Update] No GEMINI_API_KEY detected. Simulated match scores successfully updated for ${updatedCount} matches playing on ${dateToSearch}!`,
        state: updatedState,
        searchUsed: false
      });
    }

    return res.status(400).json({
      error: `GEMINI_API_KEY is not defined. (Could not find any predefined matches on the date '${dateToSearch}' to simulate a local status update). Please configure the Gemini API key in Settings > Secrets to activate real Google Search Grounding!`
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });

    // We search international football scores and schedules for the requested date
    const prompt = `Search Google for real-world international soccer/football games played or scheduled on this precise date: ${dateToSearch}. Focus on major international matches or cup tournaments.
Extract:
1. Home team name
2. Away team name
3. Match stage (e.g. Group Stage, Round of 16, Quarterfinal, etc.)
4. Match status (e.g. scheduled, live, finished)
5. Current or final scores (with homeScore and awayScore)
6. Date and kickoff time in GMT or local format 'YYYY-MM-DD HH:MM'

Respond ONLY with a clean JSON array matching this typescript schema:
[
  {
    "homeTeam": "Team Name A",
    "awayTeam": "Team Name B",
    "stage": "Group Stage",
    "status": "finished" | "live" | "scheduled",
    "homeScore": number | null,
    "awayScore": number | null,
    "date": "YYYY-MM-DD HH:MM"
  }
]`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              homeTeam: { type: Type.STRING },
              awayTeam: { type: Type.STRING },
              stage: { type: Type.STRING },
              status: { type: Type.STRING },
              homeScore: { type: Type.INTEGER },
              awayScore: { type: Type.INTEGER },
              date: { type: Type.STRING }
            },
            required: ["homeTeam", "awayTeam", "stage", "status", "date"]
          }
        }
      }
    });

    const parsedResponse = response.text ? JSON.parse(response.text.trim()) : null;

    if (!Array.isArray(parsedResponse) || parsedResponse.length === 0) {
      return res.status(404).json({
        error: `Google Search finished but did not locate any international football fixtures scheduled for ${dateToSearch}. Try checking another date (such as 2026-06-11)!`
      });
    }

    let updatedCount = 0;
    let addedCount = 0;

    parsedResponse.forEach((scraped: any) => {
      const homeNorm = scraped.homeTeam.trim().toLowerCase();
      const awayNorm = scraped.awayTeam.trim().toLowerCase();

      const existingIndex = db.matches.findIndex(m => {
        const dbHome = m.homeTeam.trim().toLowerCase();
        const dbAway = m.awayTeam.trim().toLowerCase();
        return (dbHome === homeNorm && dbAway === awayNorm) ||
               (dbHome === awayNorm && dbAway === homeNorm);
      });

      const parsedStatus: "scheduled" | "finished" = scraped.status === "finished" ? "finished" : "scheduled";

      if (existingIndex !== -1) {
        // Update match status and scores
        const existing = db.matches[existingIndex];
        existing.status = parsedStatus;
        if (scraped.status === "finished" || scraped.status === "live") {
          existing.homeScore = scraped.homeScore !== null ? Number(scraped.homeScore) : existing.homeScore;
          existing.awayScore = scraped.awayScore !== null ? Number(scraped.awayScore) : existing.awayScore;
        }
        if (scraped.date) {
          existing.date = scraped.date;
        }
        updatedCount++;
      } else {
        // Create new auto match reference
        const scrapedStage = scraped.stage || "Group Stage";
        db.matches.push({
          id: `m-auto-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          homeTeam: scraped.homeTeam.trim(),
          awayTeam: scraped.awayTeam.trim(),
          group: scrapedStage === "Group Stage" ? "Group Match" : "Knockout",
          stage: scrapedStage,
          date: scraped.date || `${dateToSearch} 18:00`,
          status: parsedStatus,
          homeScore: scraped.homeScore !== null && scraped.homeScore !== undefined ? Number(scraped.homeScore) : undefined,
          awayScore: scraped.awayScore !== null && scraped.awayScore !== undefined ? Number(scraped.awayScore) : undefined,
        });
        addedCount++;
      }
    });

    const updatedState = recalculateScores(db);
    writeDB(updatedState);

    res.json({
      message: `Google Search auto-synchronization completed for ${dateToSearch}!`,
      details: `Successfully updated ${updatedCount} matches and added ${addedCount} new matches.`,
      state: updatedState,
      searchUsed: true,
      scrapedMatches: parsedResponse
    });

  } catch (err: any) {
    console.error("Scraper Error: ", err);
    res.status(500).json({ error: `Automated sync failed: ${err.message}` });
  }
});

// Admin ONLY: Update calculation settings
app.post("/api/admin/settings", (req, res) => {
  const { adminPin, rules, hideLeaderboard } = req.body;

  const db = readDB();
  if (adminPin !== db.settings.adminPin) {
    return res.status(401).json({ error: "Invalid Admin PIN constraint." });
  }

  if (rules) {
    db.settings.rules = {
      exactScorePoints: Number(rules.exactScorePoints ?? db.settings.rules.exactScorePoints),
      correctDiffPoints: Number(rules.correctDiffPoints ?? db.settings.rules.correctDiffPoints),
      correctOutcomePoints: Number(rules.correctOutcomePoints ?? db.settings.rules.correctOutcomePoints),
      knockoutAdvancePoints: Number(rules.knockoutAdvancePoints ?? db.settings.rules.knockoutAdvancePoints),
    };
  }

  if (typeof hideLeaderboard === "boolean") {
    db.settings.hideLeaderboard = hideLeaderboard;
  }

  const updatedState = recalculateScores(db);
  writeDB(updatedState);

  res.json({ message: "Settings successfully updated!", state: updatedState });
});

// Admin ONLY: Reset all predictions and scores completely, or re-seed matches
app.post("/api/admin/reset", (req, res) => {
  const { adminPin, action } = req.body; // action: 'predictions' | 'restart-all'

  const db = readDB();
  if (adminPin !== db.settings.adminPin) {
    return res.status(401).json({ error: "Invalid Admin PIN constraint." });
  }

  if (action === "predictions") {
    db.predictions = [];
    db.matches = db.matches.map(m => ({
      ...m,
      status: "scheduled",
      homeScore: undefined,
      awayScore: undefined,
      winnerId: undefined,
    }));
  } else if (action === "clear-matches") {
    db.predictions = [];
    db.matches = [];
    db.settings.manualMode = true;
  } else if (action === "restart-all") {
    db.predictions = [];
    db.users = db.users.filter(u => u.role === "admin"); // Keep admin only
    db.matches = seedMatches();
    db.settings.manualMode = false;
  }

  const updatedState = recalculateScores(db);
  writeDB(updatedState);

  res.json({ message: "Reset successfully executed!", state: updatedState });
});

// Vite dev & build mounting
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`World Cup Family Match Predictor serving on port ${PORT}`);
  });
}

startServer();
