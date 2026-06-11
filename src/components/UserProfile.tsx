/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { User, AppState } from "../types";
import { Lock, LogIn, LogOut, Medal, PlusCircle, Shield, Target, UserCheck, UserPlus, Users } from "lucide-react";

interface UserProfileProps {
  currentUser: User | null;
  onLogin: (user: User) => void;
  onLogout: () => void;
  onStateUpdate: (newState: AppState) => void;
  adminPin: string;
}

export default function UserProfile({ currentUser, onLogin, onLogout, onStateUpdate, adminPin }: UserProfileProps) {
  // Login/Signup form toggling
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [name, setName] = useState<string>("");
  const [pin, setPin] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg("Please type in a name!");
      return;
    }
    if (!pin || pin.length < 3) {
      setErrorMsg("PIN must be at least 3 digits.");
      return;
    }

    setIsLoading(true);
    try {
      // Determine if they are trying to gain Admin status with the global admin pin
      const bodyPayload = {
        name: name.trim(),
        pin: pin.trim(),
        role: pin.trim() === adminPin ? "admin" : "member",
      };

      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "An error occurred during authentication.");
      }

      // Successful login/signup
      onLogin(data.user);
      
      // Refresh state to fetch updated active users
      const stateRes = await fetch("/api/state");
      if (stateRes.ok) {
        const stateData = await stateRes.json();
        onStateUpdate(stateData);
      }
      
      // Clear forms
      setName("");
      setPin("");
    } catch (err: any) {
      setErrorMsg(err.message || "Credential verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/60 rounded-2xl p-5 border border-slate-800 shadow-xl">
      {currentUser ? (
        /* LOGGED IN USER VIEW */
        <div className="space-y-4 animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5 text-left">
              <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
                {currentUser.role === "admin" ? <Shield className="w-5 h-5 text-indigo-300 animate-pulse" /> : <UserCheck className="w-5 h-5" />}
              </div>
              <div>
                <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider block leading-none">Logged In Player</span>
                <span className="text-sm font-display font-medium text-white leading-tight">
                  {currentUser.name}
                </span>
              </div>
            </div>
            
            <button
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-rose-450 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              title="Change Profile"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Quick Scoreboard stats */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="bg-emerald-950/20 rounded-xl p-3 border border-emerald-900/30 text-left">
              <span className="text-[10px] text-emerald-450 font-medium block">Total Points Won</span>
              <span className="text-xl font-display font-bold text-emerald-400 tracking-tight block mt-0.5">
                {currentUser.score} pts
              </span>
            </div>
            
            <div className="bg-indigo-950/20 rounded-xl p-3 border border-indigo-900/30 text-left">
              <span className="text-[10px] text-indigo-450 font-medium block">Exact Scores (x5)</span>
              <span className="text-xl font-display font-bold text-indigo-300 tracking-tight block mt-0.5 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-indigo-400 shrink-0" />
                {currentUser.exactScoresCount} hits
              </span>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 italic leading-snug text-left">
            Your inputs are auto-saved in your device. Type your PIN ({currentUser.pin}) to re-login from other computers or phones!
          </div>
        </div>
      ) : (
        /* LOGIN / REGISTER FORM SCREEN */
        <div className="animate-fade-in text-left">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              <h2 className="text-sm font-display font-bold text-white">
                {isSignUp ? "Create predictions profile" : "Select predictions profile"}
              </h2>
            </div>
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMsg(null);
              }}
              className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
            >
              {isSignUp ? "Already joined? Login" : "First time? Join Here"}
            </button>
          </div>

          {errorMsg && (
            <div className="mb-3.5 p-3 rounded-xl bg-rose-950/40 text-rose-300 text-xs font-semibold border border-rose-900/40 flex items-center gap-2">
              <Medal className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-widest mb-1">
                Your Name
              </label>
              <input
                type="text"
                placeholder="e.g. Grandma, Uncle Dave, Sarah..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                className="w-full text-xs rounded-xl border border-slate-800 bg-slate-950 p-2.5 focus:bg-slate-950 focus:border-indigo-500 focus:outline-hidden transition-all text-slate-100 placeholder:text-slate-600"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-widest mb-1 flex items-center justify-between">
                <span>Personal PIN Code</span>
                <span className="text-[9px] text-slate-500 font-normal lowercase">(For logging back in)</span>
              </label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  placeholder="e.g. 1290"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  maxLength={6}
                  className="w-full text-xs rounded-xl border border-slate-800 bg-slate-950 pl-9 pr-3 py-2.5 focus:bg-slate-950 focus:border-indigo-500 focus:outline-hidden transition-all text-slate-100 placeholder:text-slate-600"
                  required
                />
              </div>
            </div>

            {pin === adminPin && (
              <div className="bg-indigo-950/40 text-indigo-300 border border-indigo-900/30 p-2.5 rounded-xl text-[10px] font-medium leading-relaxed">
                🛡️ You are authenticating as the **Admin controller**! This PIN matches the master settings PIN.
              </div>
            )}

            <button
              disabled={isLoading}
              type="submit"
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-1.5 font-display cursor-pointer"
            >
              {isSignUp ? (
                <>
                  <UserPlus className="w-4 h-4" /> Register & Begin Predictions
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" /> Open Profile / Log In
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
