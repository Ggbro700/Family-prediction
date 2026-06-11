/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { User } from "../types";
import { Trophy, Medal, Crown, Target, Layers, Sparkles, CheckSquare, Search, Eye } from "lucide-react";

interface LeaderboardProps {
  users: User[];
  currentUser: User | null;
  onSelectInspectUser: (user: User | null) => void;
  selectedInspectUser: User | null;
  hideLeaderboard?: boolean;
}

export default function Leaderboard({ users, currentUser, onSelectInspectUser, selectedInspectUser, hideLeaderboard = false }: LeaderboardProps) {
  const isAdmin = currentUser?.role === "admin";
  const showStatsOrLeaderboard = !hideLeaderboard || isAdmin;

  // Sort users. First by total score, then exact scores count, then goal diff count, then name
  const sortedUsers = [...users].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (b.exactScoresCount !== a.exactScoresCount) {
      return b.exactScoresCount - a.exactScoresCount;
    }
    if (b.correctDiffsCount !== a.correctDiffsCount) {
      return b.correctDiffsCount - a.correctDiffsCount;
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="bg-slate-900/60 rounded-2xl p-5 border border-slate-800 shadow-xl">
      {/* Header element */}
      <div className="flex flex-col border-b border-slate-800/80 pb-3 mb-4 gap-1.5 font-sans">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-indigo-450 animate-bounce" />
            <h2 className="text-base font-display font-bold text-white">Family Standings</h2>
          </div>
          <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2.5 py-1 rounded-full font-bold font-mono">
            {users.length} Family Players
          </span>
        </div>
        {hideLeaderboard && isAdmin && (
          <div className="text-[10px] bg-amber-500/10 text-amber-500 px-2.5 py-1 rounded-lg font-bold border border-amber-500/20 text-center flex items-center justify-center gap-1 mt-1">
            <span>🕵️ Leaderboard is HIDDEN from players!</span>
          </div>
        )}
      </div>

      {!showStatsOrLeaderboard ? (
        <div className="py-8 px-4 text-center space-y-3 bg-slate-950/45 rounded-xl border border-slate-900 shadow-inner font-sans">
          <div className="w-11 h-11 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L17.772 17.772m0 0a10.42 10.42 0 01-5.774 2.131M11.25 11.25h.008v.008H11.25v-.008zm3.75 0h.008v.008H15v-.008z" />
            </svg>
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Standings Are Hidden</h4>
            <p className="text-[10px] text-slate-400 leading-relaxed max-w-sm mx-auto">
              The tournament administrator has hidden the family standings. Lock in your score forecasts to climb soon!
            </p>
          </div>
        </div>
      ) : (
        <>
          {selectedInspectUser && (
            <div className="mb-4 p-3 bg-indigo-950/40 rounded-xl border border-indigo-900/30 flex items-center justify-between animate-fade-in text-xs text-slate-300">
              <div>
                <span className="text-slate-500 font-medium">Inspecting:</span>
                <span className="font-display font-bold text-indigo-400 ml-1">{selectedInspectUser.name}</span>
              </div>
              <button
                onClick={() => onSelectInspectUser(null)}
                className="text-[10px] font-bold text-rose-400 bg-slate-800 hover:bg-slate-705 px-2.5 py-1 rounded-lg border border-slate-700 shadow-sm cursor-pointer transition-colors"
              >
                Clear Inspection
              </button>
            </div>
          )}

          {/* Leaderboard rows */}
          <div className="space-y-2">
        {sortedUsers.map((user, index) => {
          const isTopThree = index < 3;
          const isMe = currentUser?.id === user.id;
          const isCurrentlyInspected = selectedInspectUser?.id === user.id;

          return (
            <div
              key={user.id}
              onClick={() => onSelectInspectUser(isCurrentlyInspected ? null : user)}
              className={`rounded-2xl p-3 flex items-center justify-between border cursor-pointer group transition-all duration-300 ${
                isCurrentlyInspected
                  ? "bg-indigo-600 text-white border-indigo-500 shadow-md scale-[1.01]"
                  : isMe
                  ? "bg-slate-800/60 border-amber-500/20 shadow-sm"
                  : "bg-slate-950/40 border-slate-900 hover:bg-slate-800/40 hover:border-slate-850"
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Ranking Emblem */}
                <div className="w-7 h-7 flex items-center justify-center shrink-0">
                  {index === 0 ? (
                    <Crown className="w-6 h-6 text-indigo-300 fill-indigo-400/20 animate-pulse" />
                  ) : index === 1 ? (
                    <Medal className="w-5 h-5 text-slate-400 fill-slate-500/10" />
                  ) : index === 2 ? (
                    <Medal className="w-5 h-5 text-amber-600 fill-amber-700/10" />
                  ) : (
                    <span className={`text-xs font-mono font-bold ${isCurrentlyInspected ? "text-white/60" : "text-slate-500"}`}>
                      #{index + 1}
                    </span>
                  )}
                </div>

                {/* Name / Tags */}
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-display font-bold ${isCurrentlyInspected ? "text-white" : "text-slate-200"}`}>
                      {user.name}
                    </span>
                    {user.role === "admin" && (
                      <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${
                        isCurrentlyInspected ? "bg-white/20 text-white" : "bg-indigo-500/20 text-indigo-400"
                      }`}>
                        Admin
                      </span>
                    )}
                    {isMe && !isCurrentlyInspected && (
                      <span className="text-[8px] font-bold uppercase bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded-sm">
                        You
                      </span>
                    )}
                  </div>
                  
                  {/* Tie-breaker detailed badges */}
                  <div className="flex gap-2 mt-1">
                    <span className={`text-[9px] flex items-center gap-0.5 ${isCurrentlyInspected ? "text-white/80" : "text-slate-500"}`}>
                      <Target className="w-2.5 h-2.5 text-indigo-300" /> Exact: <strong>{user.exactScoresCount}</strong>
                    </span>
                    <span className={`text-[9px] flex items-center gap-0.5 ${isCurrentlyInspected ? "text-white/80" : "text-slate-500"}`}>
                      <Layers className="w-2.5 h-2.5" /> GD: <strong>{user.correctDiffsCount}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Total Points */}
              <div className="flex items-center gap-2">
                <span className={`text-left pr-1 text-[10px] hidden group-hover:flex items-center gap-1 font-semibold ${isCurrentlyInspected ? "text-white/85" : "text-indigo-400"}`}>
                  <Eye className="w-3.5 h-3.5" /> inspect
                </span>
                <div className={`px-3.5 py-1.5 rounded-xl font-display font-extrabold text-xs text-center min-w-14 shrink-0 transition-colors ${
                  isCurrentlyInspected
                    ? "bg-white text-indigo-950 shadow-inner"
                    : isMe
                    ? "bg-amber-500 text-slate-950 shadow-md"
                    : isTopThree
                    ? "bg-indigo-500/20 text-indigo-300"
                    : "bg-slate-800 text-slate-300"
                }`}>
                  {user.score} pts
                </div>
              </div>
            </div>
          );
        })}
      </div>
        </>
      )}
      
      {/* Footer Brag Tip */}
      <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] text-slate-500 leading-normal flex items-start gap-1.5 text-left">
        <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
        <p>
          Click feedback: Click a family member to review what scores they projected! Ties broken by <strong>Exact Match count</strong> first, then <strong>Goal Difference (GD) count</strong> matches.
        </p>
      </div>
    </div>
  );
}
