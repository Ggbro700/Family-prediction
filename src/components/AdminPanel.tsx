/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { AppState, Match } from "../types";
import { Shield, RefreshCw, Trophy, Edit2, Settings, AlertTriangle, Check, RotateCcw, Calendar, PlusCircle, Trash2, Search } from "lucide-react";

interface AdminPanelProps {
  state: AppState;
  onStateUpdate: (newState: AppState) => void;
  adminPin: string;
}

export default function AdminPanel({ state, onStateUpdate, adminPin }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<"scores" | "brackets" | "settings" | "resets">("scores");
  
  // Scoring update states
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [homeScore, setHomeScore] = useState<string>("");
  const [awayScore, setAwayScore] = useState<string>("");
  const [isFinished, setIsFinished] = useState<boolean>(true);
  const [koWinnerTeamName, setKoWinnerTeamName] = useState<string>("");
  
  // Adding Custom Match states
  const [addHome, setAddHome] = useState<string>("");
  const [addAway, setAddAway] = useState<string>("");
  const [addHomeFlag, setAddHomeFlag] = useState<string>("");
  const [addAwayFlag, setAddAwayFlag] = useState<string>("");
  const [addStage, setAddStage] = useState<Match["stage"]>("Group Stage");
  const [addDate, setAddDate] = useState<string>("2026-06-11 18:00");
  const [addLockDate, setAddLockDate] = useState<string>("");

  // Bracket team editing states
  const [editMatchId, setEditMatchId] = useState<string>("");
  const [customHome, setCustomHome] = useState<string>("");
  const [customAway, setCustomAway] = useState<string>("");
  const [customHomeFlag, setCustomHomeFlag] = useState<string>("");
  const [customAwayFlag, setCustomAwayFlag] = useState<string>("");
  const [customStage, setCustomStage] = useState<Match["stage"]>("Group Stage");
  const [customDate, setCustomDate] = useState<string>("2026-06-11 18:00");
  const [customLockDate, setCustomLockDate] = useState<string>("");
  const [customHidden, setCustomHidden] = useState<boolean>(false);

  // Automated Match sync states
  const [syncDate, setSyncDate] = useState<string>("2026-06-11");
  const [syncLoading, setSyncLoading] = useState<boolean>(false);

  // Scoring rule adjustments
  const [exactPts, setExactPts] = useState<number>(state.settings.rules.exactScorePoints);
  const [diffPts, setDiffPts] = useState<number>(state.settings.rules.correctDiffPoints);
  const [outcomePts, setOutcomePts] = useState<number>(state.settings.rules.correctOutcomePoints);
  const [koPts, setKoPts] = useState<number>(state.settings.rules.knockoutAdvancePoints);
  const [hideLeaderboardState, setHideLeaderboardState] = useState<boolean>(state.settings.hideLeaderboard ?? false);

  React.useEffect(() => {
    if (state.settings) {
      if (state.settings.rules) {
        setExactPts(state.settings.rules.exactScorePoints);
        setDiffPts(state.settings.rules.correctDiffPoints);
        setOutcomePts(state.settings.rules.correctOutcomePoints);
        setKoPts(state.settings.rules.knockoutAdvancePoints);
      }
      setHideLeaderboardState(state.settings.hideLeaderboard ?? false);
    }
  }, [state.settings]);

  // Status messages
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const triggerToast = (text: string, type: "success" | "error" = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3500);
  };

  // Add a new custom match handler
  const handleAddNewMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addHome || !addAway || !addStage || !addDate) {
      triggerToast("Please enter all required match details", "error");
      return;
    }

    try {
      const res = await fetch("/api/admin/match/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminPin,
          homeTeam: addHome,
          awayTeam: addAway,
          stage: addStage,
          date: addDate,
          homeFlag: addHomeFlag,
          awayFlag: addAwayFlag,
          lockDate: addLockDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create match");

      onStateUpdate(data.state);
      triggerToast(`Successfully scheduled: ${addHome} vs ${addAway}!`);
      // Reset state fields
      setAddHome("");
      setAddAway("");
      setAddHomeFlag("");
      setAddAwayFlag("");
      setAddLockDate("");
    } catch (err: any) {
      triggerToast(err.message || "Operation failed", "error");
    }
  };

  // Delete match handler
  const handleDeleteMatch = async (matchId: string) => {
    if (!matchId) return;
    const confirmDelete = window.confirm("Are you sure you want to permanently delete this match and all its associated predictions?");
    if (!confirmDelete) return;

    try {
      const res = await fetch("/api/admin/match/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminPin,
          matchId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete match");

      onStateUpdate(data.state);
      triggerToast("Match permanently deleted!");
      
      // Clear selections if it was the selected one
      if (editMatchId === matchId) {
        setEditMatchId("");
        setCustomHome("");
        setCustomAway("");
      }
      if (selectedMatchId === matchId) {
        setSelectedMatchId("");
      }
    } catch (err: any) {
      triggerToast(err.message || "Failed to delete", "error");
    }
  };

  // Automated Google Search sync handler
  const handleAutomatedSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setSyncLoading(true);
    triggerToast(`Starting automated search sync for ${syncDate}...`);

    try {
      const res = await fetch("/api/admin/automate-matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminPin,
          targetDate: syncDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Google automated search failed");

      onStateUpdate(data.state);
      triggerToast(data.message || "Google Search synchronization completed successfully!");
    } catch (err: any) {
      triggerToast(err.message || "Automation failed", "error");
    } finally {
      setSyncLoading(false);
    }
  };

  // 1. Submit match score
  const handleScoreUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatchId) {
      triggerToast("Please select a match to update", "error");
      return;
    }

    const matchObj = state.matches.find(m => m.id === selectedMatchId);
    if (!matchObj) return;

    const payload = {
      adminPin,
      matchId: selectedMatchId,
      status: isFinished ? "finished" : "scheduled",
      homeScore: homeScore !== "" ? Number(homeScore) : null,
      awayScore: awayScore !== "" ? Number(awayScore) : null,
      winnerId: koWinnerTeamName || "auto",
    };

    try {
      const res = await fetch("/api/admin/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update match");
      
      onStateUpdate(data.state);
      triggerToast(`Successfully saved results for ${matchObj.homeTeam} vs ${matchObj.awayTeam}!`);
      // Reset input states
      setSelectedMatchId("");
      setHomeScore("");
      setAwayScore("");
      setKoWinnerTeamName("");
    } catch (err: any) {
      triggerToast(err.message || "Operation failed", "error");
    }
  };

  // 1b. Selecting match copies current values
  const handleSelectMatchToScore = (mId: string) => {
    setSelectedMatchId(mId);
    const m = state.matches.find(item => item.id === mId);
    if (m) {
      setHomeScore(m.homeScore !== undefined ? String(m.homeScore) : "");
      setAwayScore(m.awayScore !== undefined ? String(m.awayScore) : "");
      setIsFinished(m.status === "finished");
      setKoWinnerTeamName(m.winnerId || "");
    }
  };

  // 2. Submit bracket customizations
  const handleBracketUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMatchId) {
      triggerToast("Please select a match to adjust teams", "error");
      return;
    }
    
    const payload = {
      adminPin,
      matchId: editMatchId,
      homeTeam: customHome,
      awayTeam: customAway,
      stage: customStage,
      date: customDate,
      homeFlag: customHomeFlag,
      awayFlag: customAwayFlag,
      lockDate: customLockDate,
      hidden: customHidden,
    };

    try {
      const res = await fetch("/api/admin/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update bracket team description");

      onStateUpdate(data.state);
      triggerToast("Fixture teams successfully updated!");
      setEditMatchId("");
      setCustomHome("");
      setCustomAway("");
      setCustomHomeFlag("");
      setCustomAwayFlag("");
      setCustomLockDate("");
      setCustomHidden(false);
    } catch (err: any) {
      triggerToast(err.message || "Failed to edit bracket info", "error");
    }
  };

  const handleSelectMatchToEdit = (mId: string) => {
    setEditMatchId(mId);
    const m = state.matches.find(item => item.id === mId);
    if (m) {
      setCustomHome(m.homeTeam);
      setCustomAway(m.awayTeam);
      setCustomHomeFlag(m.homeFlag || "");
      setCustomAwayFlag(m.awayFlag || "");
      setCustomStage(m.stage);
      setCustomDate(m.date);
      setCustomLockDate(m.lockDate || "");
      setCustomHidden(m.hidden ?? false);
    }
  };

  // 3. Submit rule points adjustment
  const handleSettingsUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      adminPin,
      rules: {
        exactScorePoints: exactPts,
        correctDiffPoints: diffPts,
        correctOutcomePoints: outcomePts,
        knockoutAdvancePoints: koPts,
      },
      hideLeaderboard: hideLeaderboardState,
    };

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update database rules");

      onStateUpdate(data.state);
      triggerToast("Settings and rules customized successfully!");
    } catch (err: any) {
      triggerToast(err.message || "Failed to update settings rules", "error");
    }
  };

  // 4. Trigger resets
  const handleResetAction = async (action: "predictions" | "restart-all" | "clear-matches") => {
    const confirmation = window.confirm(
      action === "predictions"
        ? "Are you sure you want to delete all predictions, reset match status to scheduled and reset points?"
        : action === "clear-matches"
        ? "Are you sure you want to delete ALL matches and all user predictions completely so you can add matches manually?"
        : "CRITICAL: This will delete ALL projections and users (except for Admin) and completely regenerate the tournament. Proceed?"
    );

    if (!confirmation) return;

    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminPin, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed resetting resources");

      onStateUpdate(data.state);
      triggerToast("Reset successful - records updated!");
    } catch (err: any) {
      triggerToast(err.message || "Failed to complete reset", "error");
    }
  };

  return (
    <div className="bg-slate-900/60 rounded-2xl p-6 border border-slate-800 shadow-xl text-left">
      {/* Header banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-4 mb-5 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-505/10 rounded-xl text-indigo-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-display font-bold text-white leading-tight">Admin Tournament Panel</h2>
            <p className="text-xs text-slate-400">Live scorer & match setup operations</p>
          </div>
        </div>
        <div className="flex flex-wrap bg-slate-950 p-1 rounded-xl text-xs font-semibold border border-slate-850/60 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("scores")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === "scores" ? "bg-slate-800 text-white" : "text-slate-450 hover:text-slate-200"
            }`}
          >
            Enter Scores
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("brackets")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === "brackets" ? "bg-slate-800 text-white" : "text-slate-450 hover:text-slate-200"
            }`}
          >
            Edit Fixtures
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === "settings" ? "bg-slate-800 text-white" : "text-slate-450 hover:text-slate-200"
            }`}
          >
            Points Config
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("resets")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === "resets" ? "bg-red-955 text-red-200 border border-red-900/40" : "text-red-400 hover:text-red-200"
            }`}
          >
            Danger Zone
          </button>
        </div>
      </div>

      {msg && (
        <div
          className={`mb-4 p-3 rounded-xl text-xs font-semibold border flex items-center gap-2 ${
            msg.type === "success"
              ? "bg-emerald-950/20 text-emerald-400 border-emerald-990/30"
              : "bg-red-950/25 text-red-400 border-red-900/30"
          }`}
        >
          {msg.type === "success" ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* 1. Enter Scores Tab */}
      {activeTab === "scores" && (
        <form onSubmit={handleScoreUpdate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                Select Active Match
              </label>
              <select
                value={selectedMatchId}
                onChange={(e) => handleSelectMatchToScore(e.target.value)}
                className="w-full text-sm rounded-xl border border-slate-800 p-2.5 bg-slate-950 text-slate-100 focus:border-indigo-500 focus:outline-hidden transition-all cursor-pointer"
              >
                <option value="">-- Choose a scheduled fixture --</option>
                {/* Group matches by Stage for readability */}
                {state.matches.map((m) => (
                  <option key={m.id} value={m.id}>
                    [{m.stage}] {m.homeTeam} vs {m.awayTeam} {m.status === "finished" ? `(${m.homeScore}-${m.awayScore})` : "(Scheduled)"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                Match Status
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsFinished(true)}
                  className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                    isFinished
                      ? "bg-emerald-950/20 text-emerald-400 border-emerald-900/30"
                      : "bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-350"
                  }`}
                >
                  Finished (Locks & Calculates Points)
                </button>
                <button
                  type="button"
                  onClick={() => setIsFinished(false)}
                  className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                    !isFinished
                      ? "bg-indigo-950/20 text-indigo-400 border-indigo-900/30 font-bold"
                      : "bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-350"
                  }`}
                >
                  Scheduled (Accepts Predictions)
                </button>
              </div>
            </div>
          </div>

          {selectedMatchId && (
            <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-850 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between text-center gap-3">
                {/* Home */}
                <div className="flex-1">
                  <span className="block font-display font-medium text-slate-200 text-sm line-clamp-1">
                    {state.matches.find(m => m.id === selectedMatchId)?.homeTeam}
                  </span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Goals"
                    value={homeScore}
                    onChange={(e) => setHomeScore(e.target.value)}
                    className="w-20 mt-2 text-center text-base font-display font-bold text-indigo-400 bg-slate-900 p-2 rounded-xl border border-slate-800 focus:outline-hidden focus:border-indigo-500 shadow-sm"
                    required={isFinished}
                  />
                </div>

                <div className="text-slate-650 font-display font-bold text-xs select-none">VS</div>

                {/* Away */}
                <div className="flex-1">
                  <span className="block font-display font-medium text-slate-200 text-sm line-clamp-1">
                    {state.matches.find(m => m.id === selectedMatchId)?.awayTeam}
                  </span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Goals"
                    value={awayScore}
                    onChange={(e) => setAwayScore(e.target.value)}
                    className="w-20 mt-2 text-center text-base font-display font-bold text-indigo-400 bg-slate-900 p-2 rounded-xl border border-slate-800 focus:outline-hidden focus:border-indigo-500 shadow-sm"
                    required={isFinished}
                  />
                </div>
              </div>

              {/* Explicit winner & outcome selector */}
              {isFinished && (
                <div className="p-4 bg-indigo-950/20 rounded-2xl border border-indigo-900/30 space-y-3 text-xs animate-fade-in">
                  <div>
                    <span className="font-semibold text-indigo-300 block text-xs">Set Winner / Outcome (Optional Override)</span>
                    <span className="text-slate-400 text-[10px]">Explicitly state who won this match. This assists with penalty outcomes or custom grading. Default is automated calculation based on scores.</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setKoWinnerTeamName("")}
                      className={`px-3 py-1.5 rounded-lg border font-semibold cursor-pointer transition-all text-xs ${
                        !koWinnerTeamName || koWinnerTeamName === "auto"
                          ? "bg-indigo-650 text-white border-indigo-500 shadow-sm"
                          : "bg-slate-900 text-slate-400 border-slate-850 hover:bg-slate-800"
                      }`}
                    >
                      ⚽ Auto (Calculate from Goals)
                    </button>
                    <button
                      type="button"
                      onClick={() => setKoWinnerTeamName(state.matches.find(m => m.id === selectedMatchId)?.homeTeam || "")}
                      className={`px-3 py-1.5 rounded-lg border font-semibold cursor-pointer transition-all text-xs ${
                        koWinnerTeamName === state.matches.find(m => m.id === selectedMatchId)?.homeTeam
                          ? "bg-indigo-650 text-white border-indigo-500 shadow-sm"
                          : "bg-slate-900 text-slate-400 border border-slate-850 hover:bg-slate-800"
                      }`}
                    >
                      🏠 {state.matches.find(m => m.id === selectedMatchId)?.homeTeam} Win
                    </button>
                    <button
                      type="button"
                      onClick={() => setKoWinnerTeamName(state.matches.find(m => m.id === selectedMatchId)?.awayTeam || "")}
                      className={`px-3 py-1.5 rounded-lg border font-semibold cursor-pointer transition-all text-xs ${
                        koWinnerTeamName === state.matches.find(m => m.id === selectedMatchId)?.awayTeam
                          ? "bg-indigo-650 text-white border-indigo-500 shadow-sm"
                          : "bg-slate-900 text-slate-400 border border-slate-850 hover:bg-slate-800"
                      }`}
                    >
                      ✈️ {state.matches.find(m => m.id === selectedMatchId)?.awayTeam} Win
                    </button>
                    <button
                      type="button"
                      onClick={() => setKoWinnerTeamName("draw")}
                      className={`px-3 py-1.5 rounded-lg border font-semibold cursor-pointer transition-all text-xs ${
                        koWinnerTeamName === "draw" || koWinnerTeamName === "Draw"
                          ? "bg-indigo-650 text-white border-indigo-500 shadow-sm"
                          : "bg-slate-900 text-slate-400 border border-slate-850 hover:bg-slate-800"
                      }`}
                    >
                      🤝 Draw / Tie
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500 transition-all flex items-center gap-1.5 shadow-md font-display cursor-pointer"
                >
                  <Trophy className="w-3.5 h-3.5" /> Save Result & Calculate Points
                </button>
              </div>
            </div>
          )}
        </form>
      )}

      {/* 2. Edit Brackets / Teams Tab */}
      {activeTab === "brackets" && (
        <div className="space-y-6 animate-fade-in">
          {/* Section 1: Automated Sync with Google Search Grounding */}
          <div className="bg-gradient-to-br from-indigo-950/20 to-slate-950/50 p-5 rounded-2xl border border-indigo-900/40">
            <div className="flex items-center gap-2 mb-3">
              <Search className="w-5 h-5 text-indigo-400 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-white leading-tight">Automated Match & Score Sync</h3>
                <p className="text-xs text-slate-400">Search Google to automatically update today's soccer matches and scores!</p>
              </div>
            </div>
            <form onSubmit={handleAutomatedSync} className="flex flex-col sm:flex-row items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Target Date to Synchronize
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={syncDate}
                    onChange={(e) => setSyncDate(e.target.value)}
                    placeholder="e.g. 2026-06-11"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-800 bg-slate-900 text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-hidden transition-all font-mono"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={syncLoading}
                className={`w-full sm:w-auto px-5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
                  syncLoading
                    ? "bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white"
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncLoading ? "animate-spin" : ""}`} />
                {syncLoading ? "Scraping match data..." : "Auto-Sync Today's Games from Google"}
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Section 2: Add New Scheduled Match */}
            <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-850 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <PlusCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-white leading-tight">Add Custom Match</h3>
                  <p className="text-xs text-slate-400">Manually schedule new custom fixtures</p>
                </div>
              </div>
              <form onSubmit={handleAddNewMatch} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Home Name
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={addHomeFlag}
                        onChange={(e) => setAddHomeFlag(e.target.value)}
                        placeholder="🇺🇸"
                        className="w-12 text-center text-xs rounded-xl border border-slate-800 p-2.5 bg-slate-900 text-slate-100 focus:border-emerald-500 focus:outline-hidden transition-all"
                      />
                      <input
                        type="text"
                        value={addHome}
                        onChange={(e) => setAddHome(e.target.value)}
                        placeholder="e.g. USA"
                        className="flex-1 text-xs rounded-xl border border-slate-800 p-2.5 bg-slate-900 text-slate-100 focus:border-emerald-500 focus:outline-hidden transition-all"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Away Name
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={addAwayFlag}
                        onChange={(e) => setAddAwayFlag(e.target.value)}
                        placeholder="🇲🇦"
                        className="w-12 text-center text-xs rounded-xl border border-slate-800 p-2.5 bg-slate-900 text-slate-100 focus:border-emerald-500 focus:outline-hidden transition-all"
                      />
                      <input
                        type="text"
                        value={addAway}
                        onChange={(e) => setAddAway(e.target.value)}
                        placeholder="e.g. Morocco"
                        className="flex-1 text-xs rounded-xl border border-slate-800 p-2.5 bg-slate-900 text-slate-100 focus:border-emerald-500 focus:outline-hidden transition-all"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Tournament Stage
                    </label>
                    <select
                      value={addStage}
                      onChange={(e) => setAddStage(e.target.value as Match["stage"])}
                      className="w-full text-xs rounded-xl border border-slate-800 p-2.5 bg-slate-900 text-slate-100 focus:border-emerald-500 focus:outline-hidden transition-all cursor-pointer"
                    >
                      <option value="Group Stage">Group Stage</option>
                      <option value="Round of 32">Round of 32</option>
                      <option value="Round of 16">Round of 16</option>
                      <option value="Quarterfinal">Quarterfinal</option>
                      <option value="Semifinal">Semifinal</option>
                      <option value="Third Place">Third Place</option>
                      <option value="Final">Final</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Kickoff Date & Time
                    </label>
                    <input
                      type="text"
                      value={addDate}
                      onChange={(e) => setAddDate(e.target.value)}
                      placeholder="YYYY-MM-DD HH:MM"
                      className="w-full text-xs rounded-xl border border-slate-800 p-2.5 bg-slate-900 text-slate-100 focus:border-emerald-500 focus:outline-hidden transition-all font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Lock predictions (Optional)
                    </label>
                    <input
                      type="text"
                      value={addLockDate}
                      onChange={(e) => setAddLockDate(e.target.value)}
                      placeholder="YYYY-MM-DD HH:MM"
                      className="w-full text-xs rounded-xl border border-slate-800 p-2.5 bg-slate-900 text-slate-100 focus:border-emerald-500 focus:outline-hidden transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Schedule Match
                  </button>
                </div>
              </form>
            </div>

            {/* Section 3: Edit and Delete Scheduled Matches */}
            <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-850 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Edit2 className="w-5 h-5 text-indigo-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-white leading-tight">Edit / Delete Match</h3>
                  <p className="text-xs text-slate-400">Instantly modify names, stage, schedule, or remove a fixture</p>
                </div>
              </div>
              <form onSubmit={handleBracketUpdate} className="space-y-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Select Match
                  </label>
                  <select
                    value={editMatchId}
                    onChange={(e) => handleSelectMatchToEdit(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-800 p-2.5 bg-slate-900 text-slate-100 focus:border-indigo-500 focus:outline-hidden transition-all cursor-pointer"
                  >
                    <option value="">-- Choose match to modify --</option>
                    {state.matches.map((m) => (
                      <option key={m.id} value={m.id}>
                        [{m.stage}] {m.homeTeam} vs {m.awayTeam} ({m.date})
                      </option>
                    ))}
                  </select>
                </div>

                {editMatchId && (
                  <div className="space-y-3 animate-fade-in">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Home Name
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={customHomeFlag}
                            onChange={(e) => setCustomHomeFlag(e.target.value)}
                            placeholder="🇺🇸"
                            className="w-12 text-center text-xs rounded-xl border border-slate-800 p-2 bg-slate-950 text-slate-100 focus:border-indigo-500 focus:outline-hidden transition-all"
                          />
                          <input
                            type="text"
                            value={customHome}
                            onChange={(e) => setCustomHome(e.target.value)}
                            className="flex-1 text-xs rounded-xl border border-slate-800 p-2 bg-slate-950 text-slate-100 focus:border-indigo-500 focus:outline-hidden transition-all"
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Away Name
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={customAwayFlag}
                            onChange={(e) => setCustomAwayFlag(e.target.value)}
                            placeholder="🇲🇦"
                            className="w-12 text-center text-xs rounded-xl border border-slate-800 p-2 bg-slate-950 text-slate-100 focus:border-indigo-500 focus:outline-hidden transition-all"
                          />
                          <input
                            type="text"
                            value={customAway}
                            onChange={(e) => setCustomAway(e.target.value)}
                            className="flex-1 text-xs rounded-xl border border-slate-800 p-2 bg-slate-950 text-slate-100 focus:border-indigo-500 focus:outline-hidden transition-all"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Stage
                        </label>
                        <select
                          value={customStage}
                          onChange={(e) => setCustomStage(e.target.value as Match["stage"])}
                          className="w-full text-xs rounded-xl border border-slate-800 p-2 bg-slate-950 text-slate-100 focus:border-indigo-500-hidden/40 transition-all cursor-pointer"
                        >
                          <option value="Group Stage">Group Stage</option>
                          <option value="Round of 32">Round of 32</option>
                          <option value="Round of 16">Round of 16</option>
                          <option value="Quarterfinal">Quarterfinal</option>
                          <option value="Semifinal">Semifinal</option>
                          <option value="Third Place">Third Place</option>
                          <option value="Final">Final</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Schedule Date
                        </label>
                        <input
                          type="text"
                          value={customDate}
                          onChange={(e) => setCustomDate(e.target.value)}
                          className="w-full text-xs rounded-xl border border-slate-800 p-2 bg-slate-950 text-slate-100 focus:border-indigo-500 focus:outline-hidden transition-all font-mono"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Predictions Lock (Optional)
                        </label>
                        <input
                          type="text"
                          value={customLockDate}
                          onChange={(e) => setCustomLockDate(e.target.value)}
                          placeholder="YYYY-MM-DD HH:MM"
                          className="w-full text-xs rounded-xl border border-slate-800 p-2 bg-slate-950 text-slate-100 focus:border-indigo-500 focus:outline-hidden transition-all font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 py-1">
                      <input
                        type="checkbox"
                        id="customHiddenCheckbox"
                        checked={customHidden}
                        onChange={(e) => setCustomHidden(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                      />
                      <label htmlFor="customHiddenCheckbox" className="text-xs font-semibold text-slate-350 select-none cursor-pointer">
                        🔒 Hide match from members (Only visible to admin)
                      </label>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-850/60">
                      <button
                        type="button"
                        onClick={() => handleDeleteMatch(editMatchId)}
                        className="px-3.5 py-1.5 bg-red-950/40 hover:bg-red-900/30 text-red-400 border border-red-900/40 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete Match
                      </button>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditMatchId("")}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-md transition-all cursor-pointer"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 3. Settings Tab */}
      {activeTab === "settings" && (
        <form onSubmit={handleSettingsUpdate} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-450 uppercase tracking-wide mb-1">
                Exact Score Points
              </label>
              <input
                type="number"
                min="0"
                value={exactPts}
                onChange={(e) => setExactPts(Number(e.target.value))}
                className="w-full text-center text-sm rounded-xl border border-slate-800 p-2.5 bg-slate-950 text-slate-100 focus:border-indigo-505 focus:outline-hidden transition-all font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-450 uppercase tracking-wide mb-1">
                Goal Diff Points
              </label>
              <input
                type="number"
                min="0"
                value={diffPts}
                onChange={(e) => setDiffPts(Number(e.target.value))}
                className="w-full text-center text-sm rounded-xl border border-slate-800 p-2.5 bg-slate-950 text-slate-100 focus:border-indigo-505 focus:outline-hidden transition-all font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-450 uppercase tracking-wide mb-1">
                Outcome Winner Pts
              </label>
              <input
                type="number"
                min="0"
                value={outcomePts}
                onChange={(e) => setOutcomePts(Number(e.target.value))}
                className="w-full text-center text-sm rounded-xl border border-slate-800 p-2.5 bg-slate-950 text-slate-100 focus:border-indigo-505 focus:outline-hidden transition-all font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-450 uppercase tracking-wide mb-1">
                KO Advance Bonus
              </label>
              <input
                type="number"
                min="0"
                value={koPts}
                onChange={(e) => setKoPts(Number(e.target.value))}
                className="w-full text-center text-sm rounded-xl border border-slate-800 p-2.5 bg-slate-950 text-slate-100 focus:border-indigo-505 focus:outline-hidden transition-all font-bold"
              />
            </div>
          </div>

          {/* Toggles and controls */}
          <div className="bg-slate-950/40 rounded-xl p-4 border border-slate-800/80 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Display Preferences</h4>
            <label className="flex items-center gap-3 cursor-pointer group select-none">
              <input
                type="checkbox"
                checked={hideLeaderboardState}
                onChange={(e) => setHideLeaderboardState(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-650 focus:ring-opacity-50 checked:bg-indigo-600 focus:ring-0 cursor-pointer"
              />
              <div className="text-left font-sans">
                <span className="text-xs font-bold text-slate-200 block group-hover:text-white transition-colors">
                  Hide Leaderboard Standings
                </span>
                <span className="text-[10px] text-slate-500 block leading-normal mt-0.5">
                  When enabled, players will only see a "Standings Temporarily Hidden" message. Scores continue to calculate securely in the backend.
                </span>
              </div>
            </label>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500 transition-all flex items-center gap-1.5 shadow-md font-display cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" /> Save Point Values
            </button>
          </div>
        </form>
      )}

      {/* 4. Danger Zone Resets Tab */}
      {activeTab === "resets" && (
        <div className="p-4 bg-red-950/20 rounded-2xl border border-red-900/30 space-y-4 text-xs">
          <div className="flex items-start gap-2.5 text-red-400 mb-2 text-left">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
            <div>
              <span className="font-bold block text-sm">Destructive Tournament Actions</span>
              <span className="text-red-300">These actions cannot be undone. Always double-check before proceeding.</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <button
              type="button"
              onClick={() => handleResetAction("predictions")}
              className="py-3 bg-slate-900 hover:bg-slate-800 text-red-400 border border-slate-850 rounded-xl transition-all font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> Clear All Predictions
            </button>
            <button
              type="button"
              onClick={() => handleResetAction("clear-matches")}
              className="py-3 bg-slate-900 hover:bg-slate-800 text-amber-500 border border-slate-850 rounded-xl transition-all font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" /> Clear All Matches
            </button>
            <button
              type="button"
              onClick={() => handleResetAction("restart-all")}
              className="py-3 bg-red-650 hover:bg-red-700 text-white rounded-xl transition-all font-bold flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" /> Reset & Re-seed Defaults
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
