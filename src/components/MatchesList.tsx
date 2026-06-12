/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { AppState, Match, Prediction, User } from "../types";
import { Calendar, Check, Search, ShieldAlert, Award, AlertCircle, Plus, Minus, ArrowRight, Save, Lock } from "lucide-react";

interface MatchesListProps {
  state: AppState;
  currentUser: User | null;
  onStateUpdate: (newState: AppState) => void;
  predictedUserOnlyId?: string; // If viewing another user's projections (read-only mode!)
}

export default function MatchesList({ state, currentUser, onStateUpdate, predictedUserOnlyId }: MatchesListProps) {
  const [searchTermState, setSearchTermState] = useState<string>("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [predictionFilter, setPredictionFilter] = useState<"all" | "completed" | "pending" | "predicted" | "unpredicted">("all");

  // Local state to keep track of predictions before sending them to the database
  const [localProjections, setLocalProjections] = useState<{
    [matchId: string]: { homePredict: number; awayPredict: number; predictedWinnerId?: string };
  }>({});

  const [savingMatches, setSavingMatches] = useState<{ [matchId: string]: boolean }>({});
  const [message, setMessage] = useState<string | null>(null);

  // Date filter option: "all" displays all tournament matches, "today" filters to current date
  const [dateViewOption, setDateViewOption] = useState<"all" | "today">("all");

  const todayStr = (() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  })();

  // Check if viewing someone else's profile (read-only mode)
  const isReadOnly = !!predictedUserOnlyId;
  const activeViewingUserId = predictedUserOnlyId || currentUser?.id;

  // Initialize helper to grab predictions
  const getUserPredictionForMatch = (matchId: string): Prediction | undefined => {
    if (!activeViewingUserId) return undefined;
    return state.predictions.find(p => p.userId === activeViewingUserId && p.matchId === matchId);
  };

  // Helper mapping score predictions to simple human outcome selections
  const getPredChoice = (home: number, away: number): "home" | "draw" | "away" | "none" => {
    if (home === 0 && away === 0) return "none";
    if (home > away) return "home";
    if (home < away) return "away";
    return "draw";
  };

  // Handler for winner selection (replaces goals adjust)
  const selectWinnerLocal = (matchId: string, choice: "home" | "draw" | "away") => {
    if (isReadOnly) return;
    
    let hp = 0;
    let ap = 0;
    if (choice === "home") {
      hp = 1;
      ap = 0;
    } else if (choice === "draw") {
      hp = 1;
      ap = 1;
    } else if (choice === "away") {
      hp = 0;
      ap = 1;
    }

    setLocalProjections({
      ...localProjections,
      [matchId]: { homePredict: hp, awayPredict: ap, predictedWinnerId: undefined },
    });
  };

  // Keep compatibility placeholder
  const setKnockoutWinnerLocal = (matchId: string, teamName: string) => {
    if (isReadOnly) return;
    const matchedSaved = getUserPredictionForMatch(matchId);
    const existing = localProjections[matchId] || {
      homePredict: matchedSaved ? matchedSaved.homePredict : 0,
      awayPredict: matchedSaved ? matchedSaved.awayPredict : 0,
      predictedWinnerId: matchedSaved ? matchedSaved.predictedWinnerId : undefined,
    };

    setLocalProjections({
      ...localProjections,
      [matchId]: { ...existing, predictedWinnerId: teamName },
    });
  };

  // Save prediction handler for a single match row
  const savePredictionForMatch = async (matchId: string) => {
    if (!currentUser) return;
    const local = localProjections[matchId];
    const saved = getUserPredictionForMatch(matchId);

    // If no changes were locally registered, nothing to save!
    const hp = local ? local.homePredict : (saved ? saved.homePredict : 0);
    const ap = local ? local.awayPredict : (saved ? saved.awayPredict : 0);
    const pw = local ? local.predictedWinnerId : (saved ? saved.predictedWinnerId : undefined);

    setSavingMatches(prev => ({ ...prev, [matchId]: true }));
    try {
      const payload = {
        userId: currentUser.id,
        pin: currentUser.pin,
        predictions: [{ matchId, homePredict: hp, awayPredict: ap, predictedWinnerId: pw }],
      };

      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed protecting forecast.");

      onStateUpdate(data.state);
      
      // Clean up local temp buffer for this match
      const updatedLocal = { ...localProjections };
      delete updatedLocal[matchId];
      setLocalProjections(updatedLocal);

      setMessage("Winner prediction successfully locked!");
      setTimeout(() => setMessage(null), 2500);
    } catch (err: any) {
      alert(err.message || "Failed saving predictions");
    } finally {
      setSavingMatches(prev => ({ ...prev, [matchId]: false }));
    }
  };

  // Filtration logic
  const filteredMatches = state.matches.filter((m) => {
    const isAdmin = currentUser?.role === "admin";
    if (m.hidden && !isAdmin) {
      return false;
    }

    const matchDateOnly = m.date.split(" ")[0];
    if (dateViewOption === "today" && matchDateOnly !== todayStr) {
      return false;
    }

    const sSaved = getUserPredictionForMatch(m.id);
    const hasPrediction = !!sSaved;

    // Search term check
    const matchesSearch =
      m.homeTeam.toLowerCase().includes(searchTermState.toLowerCase()) ||
      m.awayTeam.toLowerCase().includes(searchTermState.toLowerCase()) ||
      m.group.toLowerCase().includes(searchTermState.toLowerCase()) ||
      m.stage.toLowerCase().includes(searchTermState.toLowerCase());

    if (!matchesSearch) return false;

    // Stage filter
    if (stageFilter !== "all") {
      if (stageFilter === "group" && m.stage !== "Group Stage") return false;
      if (stageFilter === "knockout" && m.stage === "Group Stage") return false;
    }

    // Status / Prediction check
    if (predictionFilter === "completed") {
      return m.status === "finished";
    }
    if (predictionFilter === "pending") {
      return m.status === "scheduled";
    }
    if (predictionFilter === "predicted") {
      return hasPrediction;
    }
    if (predictionFilter === "unpredicted") {
      return m.status === "scheduled" && !hasPrediction;
    }

    return true;
  });

  // Calculate stats
  const totalPredictableCount = state.matches.filter(m => m.status === "scheduled").length;
  const myPredictedCount = state.matches.filter(m => getUserPredictionForMatch(m.id)).length;

  return (
    <div className="space-y-4 text-left">
      {/* Filters HUD */}
      <div className="bg-slate-900/60 rounded-2xl p-4 border border-slate-800 shadow-xl space-y-3 font-medium">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search teams (e.g. Argentina, Germany) or groups..."
            value={searchTermState}
            onChange={(e) => setSearchTermState(e.target.value)}
            className="w-full text-xs placeholder:text-slate-600 pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 focus:border-indigo-500 focus:bg-slate-950 focus:outline-hidden transition-all"
          />
        </div>

        {/* For fair play, only today's matches are displayed */}

        {/* Action Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80 text-xs text-left">
          {/* Stage filter */}
          <div className="flex bg-slate-950 p-0.5 rounded-xl border border-slate-850">
            <button
              onClick={() => setStageFilter("all")}
              className={`px-3 py-1.5 rounded-lg transition-all font-semibold cursor-pointer ${
                stageFilter === "all" ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              All Matches
            </button>
            <button
              onClick={() => setStageFilter("group")}
              className={`px-3 py-1.5 rounded-lg transition-all font-semibold cursor-pointer ${
                stageFilter === "group" ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Groups
            </button>
            <button
              onClick={() => setStageFilter("knockout")}
              className={`px-3 py-1.5 rounded-lg transition-all font-semibold cursor-pointer ${
                stageFilter === "knockout" ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Knockouts
            </button>
          </div>

          {/* Predict state filters & Date filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-slate-950 p-0.5 rounded-xl border border-slate-850">
              <button
                type="button"
                onClick={() => setDateViewOption("all")}
                className={`px-3 py-1 rounded-lg transition-all font-semibold cursor-pointer text-[11px] ${
                  dateViewOption === "all" ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                📅 All Days
              </button>
              <button
                type="button"
                onClick={() => setDateViewOption("today")}
                className={`px-3 py-1 rounded-lg transition-all font-semibold cursor-pointer text-[11px] ${
                  dateViewOption === "today" ? "bg-slate-800 text-amber-450 font-bold" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                ⚡ Today Only
              </button>
            </div>

            <select
              value={predictionFilter}
              onChange={(e) => setPredictionFilter(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-350 font-semibold focus:outline-hidden focus:border-indigo-500 text-[11px] cursor-pointer"
            >
              <option value="all">Display Status: All</option>
              <option value="pending">Upcoming Matches</option>
              <option value="completed">Finished Matches</option>
              {activeViewingUserId && <option value="predicted">My Predictions</option>}
              {activeViewingUserId && <option value="unpredicted">Missing Projections</option>}
            </select>
          </div>
        </div>

        {/* Subtitle status banner */}
        {currentUser && !isReadOnly && (
          <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 bg-slate-950/20 -mx-4 -mb-4 px-4 py-2 rounded-b-2xl">
            <span>
              Your Progression: <strong className="text-slate-200">{myPredictedCount}</strong> / {state.matches.length} Predicted
            </span>
            {myPredictedCount < state.matches.length && totalPredictableCount > 0 && (
              <span className="text-amber-400 font-semibold flex items-center gap-1 animate-pulse">
                <AlertCircle className="w-3.5 h-3.5" />
                {totalPredictableCount - (myPredictedCount - (state.matches.length - totalPredictableCount))} unpredicted games left!
              </span>
            )}
          </div>
        )}
      </div>

      {notificationSnackbar(message)}

      {/* Matches Grid */}
      <div className="space-y-3">
        {filteredMatches.length === 0 ? (
          <div className="text-center py-12 bg-slate-905 rounded-2xl border border-slate-800 shadow-md">
            <ShieldAlert className="w-10 h-10 text-slate-700 mx-auto mb-2.5" />
            <p className="font-display font-medium text-slate-400 text-sm">No matches found matching your filters</p>
            <p className="text-xs text-slate-500 mt-1">Try resetting search labels or stage categories</p>
          </div>
        ) : (
          filteredMatches.map((m) => {
            const savedPred = getUserPredictionForMatch(m.id);
            const local = localProjections[m.id];
            
            // Check if there is any unsaved input
            const hasLocalChanges = !!local;

            // Values shown: priority given to local draft changes
            const displayHome = local ? local.homePredict : (savedPred ? savedPred.homePredict : 0);
            const displayAway = local ? local.awayPredict : (savedPred ? savedPred.awayPredict : 0);
            const displayWinner = local ? local.predictedWinnerId : (savedPred ? savedPred.predictedWinnerId : undefined);

            const isSavedVal = !!savedPred;
            const isFinished = m.status === "finished";

            // Calculate if the match is locked (either on custom lock date/time or fallback to 5 minutes before kick-off)
            const isMatchLocked = (() => {
              if (isFinished) return true;
              const now = new Date();
              if (m.lockDate) {
                try {
                  const lockTime = new Date(m.lockDate.replace(" ", "T"));
                  return now.getTime() >= lockTime.getTime();
                } catch (e) {
                  // Fallback
                }
              }
              if (!m.date) return false;
              try {
                const matchTime = new Date(m.date.replace(" ", "T"));
                // 5 minutes in milliseconds
                return now.getTime() >= (matchTime.getTime() - 5 * 60 * 1000);
              } catch (e) {
                return false;
              }
            })();

            return (
              <div
                key={m.id}
                className={`rounded-2xl p-4 border transition-all relative ${
                  hasLocalChanges
                    ? "bg-slate-900 border-amber-500/80 ring-2 ring-amber-500/20 shadow-lg"
                    : isFinished
                    ? "bg-slate-900/40 border-slate-900/60 opacity-[0.88]"
                    : "bg-slate-900/60 border-slate-800 shadow-md hover:border-slate-700/60"
                }`}
              >
                {/* Stage Header */}
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-3.5">
                  <span className="text-[10px] font-bold text-slate-450 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500/60"></span>
                    {m.group === "Knockout" ? m.stage : `${m.stage} • ${m.group}`}
                  </span>
                  
                  <span className="text-[10px] text-slate-500 font-mono font-medium flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {m.date}
                  </span>

                  {m.lockDate && (
                    <span className="text-[10px] text-amber-500 font-mono font-bold flex items-center gap-1 bg-amber-500/10 px-1.5 py-0.5 rounded-sm">
                      <Lock className="w-3 h-3" />
                      Locks: {m.lockDate}
                    </span>
                  )}

                  {m.hidden && (
                    <span className="text-[10px] text-indigo-400 font-bold bg-indigo-950/40 border border-indigo-900/30 px-1.5 py-0.5 rounded-sm flex items-center gap-1">
                      🔒 Hidden Match
                    </span>
                  )}
                </div>

                {/* Match Board */}
                <div className="flex items-center justify-between text-center gap-2">
                  {/* Home Team */}
                  <div className="flex-1 max-w-[40%] flex flex-col items-center">
                    <div className="w-10 h-10 bg-slate-950 border border-slate-800 rounded-full flex items-center justify-center font-display font-bold text-base shadow-inner">
                      {m.homeFlag || getTeamEmojiFlag(m.homeTeam)}
                    </div>
                    <span className="mt-2 text-xs font-display font-medium text-slate-200 leading-tight line-clamp-1 block">
                      {m.homeTeam}
                    </span>
                  </div>

                  {/* SCORE SECTION */}
                  <div className="flex flex-col items-center justify-center min-w-[20%] text-center px-2">
                    {isFinished ? (
                      <div>
                        <div className="flex items-center gap-2 bg-slate-950 border border-slate-850 px-3.5 py-1 rounded-xl">
                          <span className="text-base font-display font-black text-white">{m.homeScore}</span>
                          <span className="text-slate-650 text-xs font-bold">:</span>
                          <span className="text-base font-display font-black text-white">{m.awayScore}</span>
                        </div>
                        <span className="text-[8px] uppercase tracking-wider text-indigo-400 font-bold block mt-1">Final</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs font-bold text-indigo-455 uppercase tracking-widest font-mono">VS</span>
                        {isMatchLocked && (
                          <span className="text-[9px] bg-rose-500/10 text-rose-450 border border-rose-900/30 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider animate-pulse flex items-center gap-1">
                            🔒 Locked
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Away Team */}
                  <div className="flex-1 max-w-[40%] flex flex-col items-center">
                    <div className="w-10 h-10 bg-slate-950 border border-slate-800 rounded-full flex items-center justify-center font-display font-bold text-base shadow-inner">
                      {m.awayFlag || getTeamEmojiFlag(m.awayTeam)}
                    </div>
                    <span className="mt-2 text-xs font-display font-medium text-slate-200 leading-tight line-clamp-1 block">
                      {m.awayTeam}
                    </span>
                  </div>
                </div>

                {/* Winner Picker Row */}
                <div className="mt-4 bg-slate-950/45 border border-slate-850/80 p-3 rounded-2xl">
                  <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider text-center mb-2.5">
                    {isMatchLocked ? "🔒 Predictions Locked" : (isReadOnly ? "Viewing prediction" : "Select Your predicted Winner")}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Home Team to Win Button */}
                    <button
                      disabled={isReadOnly || !currentUser || isMatchLocked}
                      onClick={() => selectWinnerLocal(m.id, "home")}
                      className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        getPredChoice(displayHome, displayAway) === "home"
                          ? "bg-indigo-650 border-indigo-500 text-white shadow-lg scale-[1.01]"
                          : "bg-slate-900 border-slate-800/85 text-slate-450 hover:text-slate-200 hover:border-slate-705"
                      }`}
                    >
                      <span className="text-[9px] tracking-wide uppercase opacity-75">Home Win</span>
                      <span className="font-display line-clamp-1 text-slate-300">{m.homeTeam}</span>
                    </button>

                    {/* Draw Button (Only Group Stage!) */}
                    {m.stage === "Group Stage" ? (
                      <button
                        disabled={isReadOnly || !currentUser || isMatchLocked}
                        onClick={() => selectWinnerLocal(m.id, "draw")}
                        className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                          getPredChoice(displayHome, displayAway) === "draw"
                            ? "bg-indigo-650 border-indigo-505 text-white shadow-lg scale-[1.01]"
                            : "bg-slate-900 border-slate-800/85 text-slate-450 hover:text-slate-200 hover:border-slate-705"
                        }`}
                      >
                        <span className="text-[9px] tracking-wide uppercase opacity-75">Tie</span>
                        <span className="font-display text-slate-300 font-medium">Draw Match 🤝</span>
                      </button>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center text-[10px] text-slate-500 px-2 leading-snug font-medium italic animate-pulse">
                        <span>Knockout Stage</span>
                        <span>Direct winner only</span>
                      </div>
                    )}

                    {/* Away Team to Win Button */}
                    <button
                      disabled={isReadOnly || !currentUser || isMatchLocked}
                      onClick={() => selectWinnerLocal(m.id, "away")}
                      className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        getPredChoice(displayHome, displayAway) === "away"
                          ? "bg-indigo-650 border-indigo-500 text-white shadow-lg scale-[1.01]"
                          : "bg-slate-900 border-slate-800/85 text-slate-450 hover:text-slate-200 hover:border-slate-705"
                      }`}
                    >
                      <span className="text-[9px] tracking-wide uppercase opacity-75">Away Win</span>
                      <span className="font-display line-clamp-1 text-slate-300">{m.awayTeam}</span>
                    </button>
                  </div>
                </div>

                {/* Sub-row panel with info about user choices */}
                <div className="mt-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between pt-3 border-t border-slate-800/80 gap-2 text-xs">
                  <div>
                    {isFinished ? (
                      <div className="flex items-center gap-2 flex-wrap text-left">
                        <span className="text-[11px] text-slate-400">Your Pick:</span>
                        {isSavedVal ? (
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            savedPred?.pointsWon && savedPred.pointsWon > 1
                              ? "bg-indigo-500/10 text-indigo-300 border border-indigo-900/30"
                              : "bg-slate-950 text-slate-400 border border-slate-905"
                          }`}>
                            {getPredChoice(savedPred?.homePredict ?? 0, savedPred?.awayPredict ?? 0) === "home" ? `${m.homeTeam} to Win` :
                             getPredChoice(savedPred?.homePredict ?? 0, savedPred?.awayPredict ?? 0) === "away" ? `${m.awayTeam} to Win` : "Draw/Tie"}
                          </span>
                        ) : (
                          <span className="text-slate-550 italic text-[11px]">No pick logged</span>
                        )}

                        {isSavedVal && savedPred?.pointsWon !== undefined && (
                          <div className="ml-0.5 flex gap-1 items-center">
                            {savedPred.pointsWon > 1 ? (
                              <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-450 px-2 py-0.5 text-[10px] font-black rounded-lg">
                                Correct! (+{savedPred.pointsWon} pts)
                              </span>
                            ) : (
                              <span className="bg-indigo-550/10 border border-indigo-500/30 text-indigo-400 px-2 py-0.5 text-[10px] font-bold rounded-lg font-mono">
                                Vote participation (+{savedPred.pointsWon} pt)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Predictable row state actions */
                      <div>
                        {isReadOnly ? (
                          <div className="text-slate-500 italic text-[10px] leading-tight">
                            Viewing predictions of selected family member
                          </div>
                        ) : !currentUser ? (
                          <div className="text-amber-400 font-medium text-[9px] leading-tight flex items-center gap-1 bg-amber-950/20 px-2.5 py-1.5 rounded-lg border border-amber-900/20">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            Create or Login your Profile to start predicting!
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-405 flex items-center gap-1.5">
                            {isSavedVal ? (
                              <span className="text-emerald-405 font-bold flex items-center gap-1 bg-emerald-950/10 border border-emerald-900/20 px-2 rounded-md py-0.5">
                                <Check className="w-3 h-3 text-emerald-400" /> Locked Pick: {
                                  getPredChoice(savedPred?.homePredict ?? 0, savedPred?.awayPredict ?? 0) === "home" ? `${m.homeTeam} Win` :
                                  getPredChoice(savedPred?.homePredict ?? 0, savedPred?.awayPredict ?? 0) === "away" ? `${m.awayTeam} Win` : "Draw/Tie"
                                }
                              </span>
                            ) : (
                              <span className="italic text-slate-550">No pick locked-in saved yet</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Explicit Save Forecast widget for active logged-in user only */}
                  {currentUser && !isReadOnly && !isFinished && !isMatchLocked && (
                    <div className="flex items-center gap-2">
                      {hasLocalChanges && (
                        <span className="text-[10px] font-mono font-bold text-amber-400 animate-pulse bg-amber-950/20 rounded-md px-1.5 py-0.5 border border-amber-900/25">
                          Draft Selection
                        </span>
                      )}
                      <button
                        disabled={savingMatches[m.id]}
                        onClick={() => savePredictionForMatch(m.id)}
                        className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg shadow-sm transition-all flex items-center gap-1 border cursor-pointer ${
                          hasLocalChanges
                            ? "bg-amber-500 text-slate-950 hover:bg-amber-450 border-amber-500"
                            : isSavedVal
                            ? "bg-slate-855 text-slate-400 border-slate-750 hover:bg-slate-800"
                            : "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-500"
                        }`}
                      >
                        {savingMatches[m.id] ? (
                          "..."
                        ) : hasLocalChanges ? (
                          <>
                            <Save className="w-3 h-3" /> Lock Prediction
                          </>
                        ) : isSavedVal ? (
                          "Change Active Pick"
                        ) : (
                          <>
                            <ArrowRight className="w-3 h-3" /> Secure Pick
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* If user is predicted and match has locked, let them know */}
                  {currentUser && !isReadOnly && isMatchLocked && !isFinished && (
                    <div className="text-[9px] text-rose-455 font-bold bg-rose-950/25 border border-rose-900/30 px-2.5 py-1 rounded-md">
                      🔒 Submissions locked (Kick-off within 5m)
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Helpers
function getPointBadgeColor(pts: number): string {
  if (pts >= 5) return "bg-emerald-600"; // Exact match
  if (pts >= 3) return "bg-violet-600"; // Goal difference match
  return "bg-sky-600"; // Winner outcome match
}

function getTeamEmojiFlag(teamName: string): string {
  const flags: { [key: string]: string } = {
    Qatar: "🇶🇦", Ecuador: "🇪🇨", Senegal: "🇸🇳", Netherlands: "🇳🇱",
    England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", Iran: "🇮🇷", USA: "🇺🇸", Wales: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
    Argentina: "🇦🇷", "Saudi Arabia": "🇸🇦", Mexico: "🇲🇽", Poland: "🇵🇱",
    France: "🇫🇷", Australia: "🇦🇺", Denmark: "🇩🇰", Tunisia: "🇹🇳",
    Spain: "🇪🇸", "Costa Rica": "🇨🇷", Germany: "🇩🇪", Japan: "🇯🇵",
    Belgium: "🇧🇪", Canada: "🇨🇦", Morocco: "🇲🇦", Croatia: "🇭🇷",
    Brazil: "🇧🇷", Serbia: "🇷🇸", Switzerland: "🇨🇭", Cameroon: "🇨🇲",
    Portugal: "🇵🇹", Ghana: "🇬🇭", Uruguay: "🇺🇾", "South Korea": "🇰🇷",
    Venezuela: "🇻🇪", Jamaica: "🇯🇲", Ireland: "🇮🇪", Nigeria: "🇳🇬", Colombia: "🇨🇴",
    Sweden: "🇸🇪", Uzbekistan: "🇺🇿", Egypt: "🇪🇬", Czechia: "🇨🇿", Mali: "🇲🇱",
    Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", Algeria: "🇩🇿", Iraq: "🇮🇶", "New Zealand": "🇳🇿", Peru: "🇵🇪",
    "Ivory Coast": "🇨🇮", Italy: "🇮🇹", Ukraine: "🇺🇦", "South Africa": "🇿🇦", Panama: "🇵🇦",
    Chile: "🇨🇱", Uzbekistan_Flag: "🇺🇿", Egyptian: "🇪🇬"
  };

  return flags[teamName] || "⚽";
}

function notificationSnackbar(msg: string | null) {
  if (!msg) return null;
  return (
    <div className="p-3 bg-indigo-600 text-white text-xs font-semibold rounded-xl text-center shadow-md animate-fade-in border border-indigo-500/20">
      <div className="flex items-center justify-center gap-2">
        <Check className="w-4 h-4 text-indigo-205 animate-bounce" />
        <span>{msg}</span>
      </div>
    </div>
  );
}
