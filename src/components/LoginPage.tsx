/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { User, AppState } from "../types";
import { Trophy, Shield, Lock, Phone, User as UserIcon, LogIn, UserPlus, Star, Info } from "lucide-react";

interface LoginPageProps {
  onLogin: (user: User) => void;
  onStateUpdate: (newState: AppState) => void;
  adminPin: string;
}

export default function LoginPage({ onLogin, onStateUpdate, adminPin }: LoginPageProps) {
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [name, setName] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [pin, setPin] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // OTP PIN recovery states
  const [isForgotPin, setIsForgotPin] = useState<boolean>(false);
  const [resetStep, setResetStep] = useState<"request" | "verify">("request");
  const [otpCode, setOtpCode] = useState<string>("");
  const [simulatedOtp, setSimulatedOtp] = useState<string | null>(null);
  const [newPin, setNewPin] = useState<string>("");

  // Normalize phone inputs as clean letters/digits for search robustness
  const cleanPhone = (phone: string) => {
    return phone.replace(/[^0-9a-zA-Z]/g, "").trim().toLowerCase();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const formattedPhone = cleanPhone(phoneNumber);

    if (isSignUp) {
      if (!name.trim()) {
        setErrorMsg("Please enter your name.");
        return;
      }
      if (formattedPhone.length < 3) {
        setErrorMsg("Please enter a valid phone number.");
        return;
      }
      if (pin.trim().length < 3) {
        setErrorMsg("PIN must be at least 3 digits/characters.");
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetch("/api/users/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            phoneNumber: formattedPhone,
            pin: pin.trim(),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Signup failed.");
        }

        setSuccessMsg("Success! Account created.");
        
        // Login immediately
        onLogin(data.user);

        // Fetch refreshed state
        const stateRes = await fetch("/api/state");
        if (stateRes.ok) {
          const stateData = await stateRes.json();
          onStateUpdate(stateData);
        }
      } catch (err: any) {
        setErrorMsg(err.message || "Unable to complete signup.");
      } finally {
        setIsLoading(false);
      }
    } else {
      // Login flow
      if (!formattedPhone) {
        setErrorMsg("Please enter your registered phone number.");
        return;
      }
      if (!pin) {
        setErrorMsg("PIN is required.");
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetch("/api/users/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phoneNumber: formattedPhone,
            pin: pin.trim(),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Login parameters failed.");
        }

        // Complete Login
        onLogin(data.user);

        // Update application state
        const stateRes = await fetch("/api/state");
        if (stateRes.ok) {
          const stateData = await stateRes.json();
          onStateUpdate(stateData);
        }
      } catch (err: any) {
        setErrorMsg(err.message || "Invalid phone number or PIN.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSimulatedOtp(null);

    const formattedPhone = cleanPhone(phoneNumber);
    if (!formattedPhone) {
      setErrorMsg("Please enter your registered phone number or username.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/users/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: formattedPhone }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to trigger recovery process.");
      }

      setSuccessMsg("We sent a simulated OTP code successfully!");
      setResetStep("verify");
      if (data.otp) {
        setSimulatedOtp(data.otp);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtpAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const formattedPhone = cleanPhone(phoneNumber);
    if (!otpCode.trim() || !newPin.trim()) {
      setErrorMsg("OTP and new PIN are required.");
      return;
    }
    if (newPin.trim().length < 3) {
      setErrorMsg("New PIN must be at least 3 characters.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/users/verify-otp-reset-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: formattedPhone,
          otp: otpCode.trim(),
          newPin: newPin.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Reset failed. Please check the OTP.");
      }

      setSuccessMsg("Success! Your PIN has been updated. Please log in below.");
      // Go back to login and prepopulate PIN for instant convenience
      setIsForgotPin(false);
      setPin(newPin.trim());
      setResetStep("request");
      setOtpCode("");
      setNewPin("");
      setSimulatedOtp(null);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to complete recovery.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between text-slate-200 selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Sleek aesthetic background grids/glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* Dynamic Header on login screen */}
      <header className="bg-slate-900/40 border-b border-slate-905 backdrop-blur-md">
        <div className="w-full max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-indigo-400" />
            <span className="font-display font-extrabold text-sm uppercase tracking-wider text-white">
              FAMILY<span className="text-indigo-400">CUP</span> PREDICTOR
            </span>
          </div>
          <span className="text-[10px] bg-indigo-500/10 border border-indigo-550/20 text-indigo-400 px-2.5 py-1 rounded-full font-mono font-bold tracking-wide">
            🏆 tournament mode
          </span>
        </div>
      </header>

      {/* Main Form container */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-12 flex flex-col justify-center relative z-10">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
          
          {/* Aesthetic mini-banner */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-display font-black uppercase text-white tracking-tight">
              {isForgotPin
                ? "Reset Your PIN Code"
                : isSignUp
                  ? "Create predictions profile"
                  : "Select predictions profile"}
            </h1>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              {isForgotPin
                ? "Verify your account with a secure One-Time Password (OTP) sent to your phone number."
                : isSignUp
                  ? "Enter your name, phone number, and a simple PIN code to start locking in your predictions!"
                  : "Enter your registered phone number and PIN code to enter the dashboard."}
            </p>
          </div>

          {/* Feedback alerts */}
          {errorMsg && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 text-rose-400 text-xs font-semibold border border-rose-900/30 flex items-start gap-2.5">
              <span>⚠️</span>
              <span className="text-left mt-0.5">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-990/30 flex items-start gap-2.5">
              <span>✅</span>
              <span className="text-left mt-0.5">{successMsg}</span>
            </div>
          )}
               {isForgotPin ? (
            /* Forgot PIN / Password Recovery View */
            <div className="space-y-4 text-left animate-fade-in">
              {resetStep === "request" ? (
                <form onSubmit={handleRequestOtp} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                      Your Registered Phone Number or Account Name
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="e.g. 0501234567 or 'nidal'"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full text-xs rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-3 py-3 focus:bg-slate-950 focus:border-indigo-500 focus:outline-hidden transition-all text-slate-100 placeholder:text-slate-655"
                        required
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium block mt-1.5 leading-snug">
                      📱 We will lookup the user profile and generate a simulated secure One-Time Password (OTP).
                    </span>
                  </div>

                  <button
                    disabled={isLoading}
                    type="submit"
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-2 font-display cursor-pointer"
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                    ) : (
                      <>Get One-Time Reset PIN OTP</>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtpAndReset} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Target Account Name / Phone Number
                    </label>
                    <p className="text-xs font-semibold text-white bg-slate-950 p-2.5 rounded-lg border border-slate-850 font-mono">
                      {phoneNumber}
                    </p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                      Enter 6-Digit OTP Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="Enter 6-digit OTP"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-3 focus:bg-slate-950 focus:border-indigo-500 focus:outline-hidden transition-all text-slate-100 placeholder:text-slate-600 font-mono tracking-widest text-center"
                      required
                    />
                  </div>

                  {simulatedOtp && (
                    <div className="bg-emerald-950/40 text-emerald-300 border border-emerald-900/30 p-3.5 rounded-xl text-[10px] leading-relaxed">
                      <p className="font-bold flex items-center gap-1 text-emerald-400 mb-1">
                        <span>📱</span> [Simulated SMS Gateway] OTP Sent!
                      </p>
                      <p className="text-slate-300">Your secure password recovery verification code is <strong className="text-emerald-400 text-sm font-mono tracking-wider">{simulatedOtp}</strong>.</p>
                      <button
                        type="button"
                        onClick={() => setOtpCode(simulatedOtp)}
                        className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 font-bold underline cursor-pointer flex items-center gap-1"
                      >
                        ⚡ Express Auto-fill verification code
                      </button>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                      <span>Define New Personal PIN</span>
                      <span className="text-[9px] text-slate-500 font-normal lowercase">(At least 3 characters)</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        placeholder="Enter your new PIN code"
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value)}
                        className="w-full text-xs rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-3 py-3 focus:bg-slate-950 focus:border-indigo-500 focus:outline-hidden transition-all text-slate-100 placeholder:text-slate-600"
                        required
                      />
                    </div>
                  </div>

                  <button
                    disabled={isLoading}
                    type="submit"
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-2 font-display cursor-pointer"
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                    ) : (
                      <>Confirm Verification & Reset PIN</>
                    )}
                  </button>
                </form>
              )}

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPin(false);
                    setResetStep("request");
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setOtpCode("");
                    setNewPin("");
                    setSimulatedOtp(null);
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 underline font-semibold cursor-pointer"
                >
                  ← Return to predictor login
                </button>
              </div>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4 text-left">
                {isSignUp && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                      Your Full Name
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="e.g. Grandma, Uncle Dave, Sarah..."
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={20}
                        className="w-full text-xs rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-3 py-3 focus:bg-slate-950 focus:border-indigo-500 focus:outline-hidden transition-all text-slate-100 placeholder:text-slate-600"
                        required={isSignUp}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                    {isSignUp ? "Phone Number" : "Phone Number or Username"} <span className="text-rose-500/70">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder={isSignUp ? "e.g. 0501234567 or 12345" : "e.g. 0501234567 or 'nidal'"}
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-3 py-3 focus:bg-slate-950 focus:border-indigo-500 focus:outline-hidden transition-all text-slate-100 placeholder:text-slate-600"
                      required
                    />
                  </div>
                  {!isSignUp ? (
                    <span className="text-[10px] text-slate-500 font-medium block mt-1 leading-snug">
                      💡 Tip: The admin profile username is <strong className="text-indigo-400">nidal</strong> with PIN <strong className="text-indigo-400">2009</strong>!
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-medium block mt-1 leading-snug">
                      📌 Enforces **one account per phone number** for fair scoring. Only digits/letters are checked.
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                    <span>Personal PIN Code</span>
                    <span className="text-[9px] text-slate-500 font-normal lowercase">(At least 3 characters)</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      placeholder="e.g. 2009"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-855 bg-slate-950 pl-10 pr-3 py-3 focus:bg-slate-950 focus:border-indigo-500 focus:outline-hidden transition-all text-slate-100 placeholder:text-slate-600"
                      required
                    />
                  </div>
                  {!isSignUp && (
                    <div className="text-right mt-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotPin(true);
                          setResetStep("request");
                          setErrorMsg(null);
                          setSuccessMsg(null);
                          setOtpCode("");
                          setNewPin("");
                        }}
                        className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        🔐 Forgot your PIN or password? Click here
                      </button>
                    </div>
                  )}
                </div>

                {pin === adminPin && (
                  <div className="bg-indigo-950/40 text-indigo-300 border border-indigo-900/30 p-3 rounded-xl text-[10px] font-medium leading-relaxed flex items-start gap-2 animate-pulse">
                    <Shield className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <span>🛡️ Master admin mode triggered! The PIN matches. You will have full schedule & scoring control!</span>
                  </div>
                )}

                <button
                  disabled={isLoading}
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-2 font-display cursor-pointer mt-2"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                  ) : isSignUp ? (
                    <>
                      <UserPlus className="w-4 h-4" /> Sign Up & Enter Stadium
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" /> Log In to Scorecard
                    </>
                  )}
                </button>
              </form>

              {/* Toggle buttons links */}
              <div className="mt-6 pt-5 border-t border-slate-800/80 text-center flex flex-col gap-2.5 items-center">
                <span className="text-xs text-slate-400 font-medium">
                  {isSignUp ? "Already have a predictor account?" : "Brand new player for the tournament?"}
                </span>
                <button
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setName("");
                    setPhoneNumber("");
                    setPin("");
                  }}
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300 underline underline-offset-4 cursor-pointer transition-colors"
                >
                  {isSignUp ? "Log in instead with Phone & PIN" : "Register a personal account here"}
                </button>
              </div>
            </>
          )}
          </div>

        {/* Informative micro card on fair play */}
        <div className="mt-4 p-3 bg-slate-900/35 border border-slate-900 rounded-2xl flex items-start gap-2.5 text-left">
          <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <p className="text-[10px] leading-relaxed text-slate-500">
            For maximum parity, match predictors are locked automatically <strong>5 minutes before kickoff</strong>. One account permitted per phone. Enjoy the World Cup!
          </p>
        </div>
      </main>

      <footer className="bg-slate-950 border-t border-slate-900 py-4 text-center">
        <p className="text-[10px] text-slate-600">© 2026 World Cup Family Predictor • Fully Persistent Stadium</p>
      </footer>
    </div>
  );
}
