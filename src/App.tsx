/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { AppState, User } from "./types";
import RulesModal from "./components/RulesModal";
import UserProfile from "./components/UserProfile";
import Leaderboard from "./components/Leaderboard";
import MatchesList from "./components/MatchesList";
import AdminPanel from "./components/AdminPanel";
import LoginPage from "./components/LoginPage";
import { Trophy, Award, Scroll, Users, MessageSquareCode, ShieldCheck, Heart, Info, RefreshCw, Star } from "lucide-react";

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedInspectUser, setSelectedInspectUser] = useState<User | null>(null);
  const [showRules, setShowRules] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // 1. Initial State Fetching
  const fetchState = async (silent = false) => {
    if (!silent) setIsSyncing(true);
    try {
      const res = await fetch("/api/state");
      if (res.ok) {
        const data: AppState = await res.json();
        setState(data);

        // Sync local current user details with updated backend database records
        const localSavedUserStr = localStorage.getItem("worldcup_current_user");
        if (localSavedUserStr) {
          try {
            const savedUser: User = JSON.parse(localSavedUserStr);
            const liveUser = data.users.find((u) => u.id === savedUser.id);
            if (liveUser) {
              // Update state and refresh store to sync scores
              setCurrentUser(liveUser);
              localStorage.setItem("worldcup_current_user", JSON.stringify(liveUser));
            } else {
              // If user was deleted or couldn't be searched
              setCurrentUser(null);
              localStorage.removeItem("worldcup_current_user");
            }
          } catch (itemErr) {
            console.error(itemErr);
          }
        }
      }
    } catch (err) {
      console.error("Failed syncing cloud database", err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchState(false);

    // Setup background network sync (polls every 10 seconds for seamless multi-device play!)
    const syncInterval = setInterval(() => {
      fetchState(true);
    }, 10000);

    return () => clearInterval(syncInterval);
  }, []);

  // 2. Authentication triggers
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem("worldcup_current_user", JSON.stringify(user));
    setSelectedInspectUser(null); // Clear inspect overlays of other players
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("worldcup_current_user");
    setSelectedInspectUser(null);
  };

  if (!state) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-200">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-slate-800 border-t-indigo-500 animate-spin"></div>
          <Trophy className="w-6 h-6 text-indigo-400 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <h3 className="text-base font-display font-bold text-white mt-5">Assembling Stadium...</h3>
        <p className="text-xs text-slate-400 mt-1">Booting family world cup bracket engine</p>
      </div>
    );
  }

  const adminPin = state.settings.adminPin;
  const isAdminLoggedIn = currentUser && currentUser.role === "admin";

  if (!currentUser) {
    return (
      <LoginPage
        onLogin={handleLogin}
        onStateUpdate={setState}
        adminPin={adminPin}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* GLORIOUS CHAMPIONSHIP HEADER */}
      <header className="bg-slate-900/50 border-b border-slate-800 backdrop-blur-md text-white relative overflow-hidden">
        {/* Sleek abstract lights */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.1),transparent_60%)]"></div>

        <div className="w-full max-w-7xl mx-auto px-4 py-5 sm:py-6 flex flex-col md:flex-row items-center justify-between gap-4 relative z-10">
          <div className="text-center md:text-left space-y-1">
            <div className="inline-flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest text-indigo-400 uppercase">
              <Star className="w-3.5 h-3.5 fill-indigo-400 animate-pulse text-indigo-400" /> Matches Forecast Center
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight uppercase leading-none mt-1">
              FAMILY<span className="text-indigo-400">CUP</span> <span className="text-slate-400 text-lg font-normal lowercase italic tracking-normal ml-1">predictor</span>
            </h1>
            
            <p className="text-xs text-slate-400 max-w-lg font-medium">
              Create a profile, lock your score forecasts, and climb the family standings. May the best manager win!
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRules(true)}
              className="px-4 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700/80 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer"
            >
              <Scroll className="w-4 h-4 text-indigo-400" />
              How Points Work
            </button>
            <button
              onClick={() => fetchState(false)}
              disabled={isSyncing}
              className="p-2.5 bg-slate-800 border border-slate-700 hover:bg-slate-700/80 text-white rounded-xl transition-all cursor-pointer"
              title="Refresh database score"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* DASHBOARD BODY */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* COLUMN 1 (SIDEBAR): STANDINGS & LOGIN */}
          <div className="space-y-6 lg:col-span-1">
            
            {/* 1. Account Profile manager */}
            <UserProfile
              currentUser={currentUser}
              onLogin={handleLogin}
              onLogout={handleLogout}
              onStateUpdate={setState}
              adminPin={adminPin}
            />

            {/* 2. Interactive Standings Leaderboard */}
            <Leaderboard
              users={state.users}
              currentUser={currentUser}
              onSelectInspectUser={setSelectedInspectUser}
              selectedInspectUser={selectedInspectUser}
              hideLeaderboard={state.settings?.hideLeaderboard}
            />

            {/* 3. Community Shoutout HUD */}
            <div className="bg-slate-900/40 text-slate-300 p-4 rounded-2xl border border-slate-800 text-left relative overflow-hidden">
              <div className="absolute right-0 bottom-0 opacity-[0.03] font-black font-display text-7xl select-none leading-none -mb-3 pointer-events-none">
                GP
              </div>
              <h3 className="font-display font-extrabold text-xs text-slate-200 flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-500 shrink-0" /> Points System Guard
              </h3>
              <p className="text-[11px] font-medium leading-relaxed mt-1.5 opacity-90 text-slate-400">
                To guarantee fair play, predictions are frozen automatically for everyone the moment a match transitions to <strong>Finished</strong> status by the administrator. Good luck!
              </p>
            </div>
          </div>

          {/* COLUMN 2 (MAIN STAGE): FIXTURE LISTS & ADMIN ACTIONS */}
          <div className="space-y-6 lg:col-span-2">
            
            {/* 1. Admin setup panel (rendered only when administrator accounts authenticate) */}
            {isAdminLoggedIn && (
              <AdminPanel
                state={state}
                onStateUpdate={setState}
                adminPin={currentUser.pin}
              />
            )}

            {/* Inspect user read-only HUD */}
            {selectedInspectUser && (
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950/40 p-4 rounded-2xl border border-indigo-900/30 flex flex-col md:flex-row items-center justify-between gap-3 animate-fade-in text-left">
                <div>
                  <h3 className="font-display font-bold text-sm tracking-tight text-white flex items-center gap-2">
                    <span>👀</span> Inspection Mode: Viewing forecasts of <span className="text-indigo-400">{selectedInspectUser.name}</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    You are browsing the predictions entered by this player. Your inputs are hidden. Click the button to inspect your own scorecard.
                  </p>
                </div>
                <button
                  onClick={() => setSelectedInspectUser(null)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-display font-bold text-xs rounded-xl transition-all shadow-md shrink-0 cursor-pointer"
                >
                  Return to my Scorecard
                </button>
              </div>
            )}

            {/* 2. The Interactive predictive games engine */}
            <MatchesList
              state={state}
              currentUser={currentUser}
              onStateUpdate={setState}
              predictedUserOnlyId={selectedInspectUser?.id}
            />
          </div>

        </div>
      </main>

      {/* PERSISTENT FOOTER */}
      <footer className="bg-slate-950 border-t border-slate-900 py-6 text-center mt-12">
        <div className="w-full max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p className="flex items-center gap-1 font-medium">
            <Heart className="w-3.5 h-3.5 text-indigo-500 animate-pulse fill-indigo-500" />
            Designed for World Cup tournament prediction circles.
          </p>
          <p>© 2026 World Cup Family Predictor Dashboard • Local Database Syncing</p>
        </div>
      </footer>

      {/* Rules rules helper modal */}
      {showRules && (
        <RulesModal
          onClose={() => setShowRules(false)}
        />
      )}
    </div>
  );
}
