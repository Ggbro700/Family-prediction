/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Team {
  id: string;
  name: string;
  flag: string; // Emoji flag or short name
}

export interface Match {
  id: string;
  homeTeam: string; // Team name or ID (e.g., "Argentina")
  awayTeam: string; // Team name or ID (e.g., "France")
  homeFlag?: string; // Flag emoji/icon (e.g., "🇦🇷")
  awayFlag?: string; // Flag emoji/icon (e.g., "🇫🇷")
  group: string; // e.g., "Group A", or "Knockout"
  stage: "Group Stage" | "Round of 32" | "Round of 16" | "Quarterfinal" | "Semifinal" | "Third Place" | "Final";
  date: string;
  lockDate?: string; // Custom optional locking date/time e.g., "2026-06-11 15:00"
  status: "scheduled" | "finished";
  homeScore?: number;
  awayScore?: number;
  winnerId?: string; // For knockouts when penalties happen / to declare who advanced
}

export interface Prediction {
  userId: string;
  matchId: string;
  homePredict: number;
  awayPredict: number;
  predictedWinnerId?: string; // Optional (to settle tiebreaker in knockouts)
  pointsWon?: number; // Calculated after the match is finished
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  phoneNumber: string; // Statically typed user phone number
  pin: string; // Simple 3-4 digit password for basic family security
  role: "admin" | "member";
  score: number;
  exactScoresCount: number;
  correctDiffsCount: number;
  correctOutcomesCount: number;
}

export interface AppState {
  users: User[];
  matches: Match[];
  predictions: Prediction[];
  settings: {
    adminPin: string;
    hideLeaderboard?: boolean;
    manualMode?: boolean;
    rules: {
      exactScorePoints: number;
      correctDiffPoints: number;
      correctOutcomePoints: number;
      knockoutAdvancePoints: number;
    };
  };
}
