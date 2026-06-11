/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Award, CheckCircle, Info, Star, Target, X } from "lucide-react";

interface RulesModalProps {
  onClose: () => void;
  rules: {
    exactScorePoints: number;
    correctDiffPoints: number;
    correctOutcomePoints: number;
    knockoutAdvancePoints: number;
  };
}

export default function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-800 animate-slide-up text-left">
        {/* Header */}
        <div className="bg-slate-800/60 border-b border-slate-700/60 p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Award className="w-6 h-6 text-indigo-400 animate-bounce" />
            <h2 className="text-xl font-display font-medium text-white tracking-tight">Predictor Rules & Scoring</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-slate-800 p-2 rounded-full transition-colors"
            aria-label="Close rules"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          <p className="text-sm text-slate-300 leading-relaxed">
            Choose the predicted winner (or predicted tie/draw in group stage matches) for any game. Points are generated instantly based on your participation and accuracy!
          </p>

          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Star className="w-4 h-4 text-indigo-400" /> Point System
            </h3>

            {/* Voting Participation points */}
            <div className="flex gap-4 p-3.5 bg-indigo-950/30 rounded-xl border border-indigo-900/30">
              <div className="bg-indigo-600 text-white rounded-lg w-12 h-12 flex items-center justify-center shrink-0 font-display font-black text-lg">
                +1
              </div>
              <div className="space-y-0.5">
                <h4 className="font-semibold text-white text-sm flex items-center gap-1.5">
                  Participation Point <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-medium">Guaranteed</span>
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Earn +1 point simply for predicting a score (even if your prediction turns out wrong!).
                </p>
              </div>
            </div>

            {/* Correct Winner Outcome */}
            <div className="flex gap-4 p-3.5 bg-emerald-950/30 rounded-xl border border-emerald-905/30">
              <div className="bg-emerald-600 text-white rounded-lg w-12 h-12 flex items-center justify-center shrink-0 font-display font-black text-lg">
                +4
              </div>
              <div className="space-y-0.5">
                <h4 className="font-semibold text-white text-sm flex items-center gap-1.5">
                  Correct Prediction Points <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-medium">Accuracy</span>
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Earn an additional +4 points if you correctly predict the match outcome.
                </p>
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex items-start gap-2.5">
            <Target className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
            <div className="text-xs text-slate-400 space-y-1">
              <p className="font-medium text-slate-200">Prediction Deadline Lock</p>
              <p>For fair play, predictions automatically **lock exactly 5 minutes before kickoff** of each scheduled game, or when the match starts.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-6 py-4 flex justify-end border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-500 active:scale-95 transition-all font-display shadow-md cursor-pointer"
          >
            I'm Ready to Play!
          </button>
        </div>
      </div>
    </div>
  );
}
