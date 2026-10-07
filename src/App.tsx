/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Compass,
  Gauge,
  Video,
  RotateCcw,
  Maximize2,
  Minimize2,
  Flame,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Zap
} from 'lucide-react';
import { Simulation3D } from './components/Simulation3D.tsx';
import { GodotCodeViewer } from './components/GodotCodeViewer.tsx';
import { DEFAULT_PHYSICS, PhysicsParams } from './types.ts';

export default function App() {
  const [physics, setPhysics] = useState<PhysicsParams>(DEFAULT_PHYSICS);
  const [telemetry, setTelemetry] = useState({
    speedKmh: 0,
    altitude: 1.3,
    rollDeg: 0,
    driftPercent: 0,
    isHovering: true,
    isBoosting: false
  });
  const [isFullScreenSim, setIsFullScreenSim] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Quick virtual controls simulation dispatcher for touch / click
  const triggerKeyEvent = (key: string, type: 'keydown' | 'keyup') => {
    let code = '';
    if (key === 'forward') code = 'KeyW';
    if (key === 'backward') code = 'KeyS';
    if (key === 'left') code = 'KeyA';
    if (key === 'right') code = 'KeyD';
    if (key === 'boost') code = 'Space';
    if (key === 'reset') code = 'KeyR';

    if (code) {
      window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Header bar */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-slate-950 border-b border-slate-800 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center text-cyan-400 font-black text-sm">
            <Zap className="w-4 h-4 fill-cyan-400 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-extrabold tracking-tight text-white font-display">
                AEROGLIDE
              </h1>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                GODOT 4.x
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              3D Glider Racer Scene & Physics Testbed
            </p>
          </div>
        </div>

        {/* Camera mode selector */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
          <span className="text-[11px] text-slate-400 px-2 flex items-center gap-1 hidden md:flex">
            <Video className="w-3.5 h-3.5 text-cyan-400" /> Camera:
          </span>
          {(['smooth', 'rigid', 'cockpit', 'orbit'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setPhysics({ ...physics, cameraMode: mode })}
              className={`px-2.5 py-1 text-xs rounded font-medium capitalize transition-all ${
                physics.cameraMode === mode
                  ? 'bg-cyan-500 text-slate-950 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {mode === 'rigid' ? 'Rigid Parent' : mode === 'smooth' ? 'Chase Cam' : mode}
            </button>
          ))}
        </div>

        {/* Right action controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => triggerKeyEvent('reset', 'keydown')}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-md transition-colors"
            title="Reset position (Press R)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset (R)</span>
          </button>
          <button
            onClick={() => setIsFullScreenSim(!isFullScreenSim)}
            className="p-1.5 text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-md transition-colors"
            title="Toggle fullscreen simulator"
          >
            {isFullScreenSim ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main split work area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* 3D Simulation Viewport */}
        <div
          className={`relative ${
            isFullScreenSim ? 'w-full h-full' : 'w-full lg:w-7/12 h-[45vh] lg:h-full'
          } border-b lg:border-b-0 border-slate-800 bg-black flex flex-col`}
        >
          {/* Live Flight Telemetry Overlay */}
          <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2 pointer-events-none">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-800/80 font-mono text-xs shadow-lg">
              <Gauge className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400">SPD:</span>
              <span className="text-white font-bold text-sm">{telemetry.speedKmh}</span>
              <span className="text-[10px] text-slate-500">KM/H</span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-800/80 font-mono text-xs shadow-lg">
              <span className="text-slate-400">ALT:</span>
              <span className="text-cyan-300 font-bold">{telemetry.altitude}m</span>
              <span className={`w-2 h-2 rounded-full ${telemetry.isHovering ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-800/80 font-mono text-xs shadow-lg">
              <Compass className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-slate-400">ROLL:</span>
              <span className="text-slate-200 font-medium">{telemetry.rollDeg}°</span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-800/80 font-mono text-xs shadow-lg">
              <span className="text-slate-400">DRIFT:</span>
              <span className="text-amber-400 font-medium">{telemetry.driftPercent}%</span>
            </div>

            {telemetry.isBoosting && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 font-mono text-xs animate-pulse">
                <Flame className="w-3.5 h-3.5 text-cyan-400" />
                NITRO
              </div>
            )}
          </div>

          {/* Drive instructions pill overlay */}
          <div className="absolute top-3 right-3 z-10 px-3 py-1.5 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-800/80 font-mono text-[11px] text-slate-300 hidden sm:flex items-center gap-2 shadow-lg pointer-events-none">
            <span className="text-cyan-400">WASD / Arrows</span> Drive
            <span className="text-slate-600">·</span>
            <span className="text-cyan-400">Shift</span> Boost
            <span className="text-slate-600">·</span>
            <span className="text-cyan-400">R</span> Reset
          </div>

          {/* Three.js Simulation Canvas */}
          <div className="flex-1 w-full h-full relative">
            <Simulation3D
              physics={physics}
              onTelemetryUpdate={setTelemetry}
              isPaused={isPaused}
            />
          </div>

          {/* On-screen Touch / Click Controls for fast testing */}
          <div className="absolute bottom-4 right-4 z-10 flex flex-col items-center gap-1.5 select-none opacity-85 hover:opacity-100 transition-opacity">
            <button
              onMouseDown={() => triggerKeyEvent('forward', 'keydown')}
              onMouseUp={() => triggerKeyEvent('forward', 'keyup')}
              onTouchStart={() => triggerKeyEvent('forward', 'keydown')}
              onTouchEnd={() => triggerKeyEvent('forward', 'keyup')}
              className="w-11 h-11 bg-slate-900/90 hover:bg-cyan-500/30 active:bg-cyan-500 text-cyan-300 rounded-lg border border-slate-700/80 flex items-center justify-center shadow-lg transition-colors"
            >
              <ArrowUp className="w-5 h-5" />
            </button>
            <div className="flex gap-1.5">
              <button
                onMouseDown={() => triggerKeyEvent('left', 'keydown')}
                onMouseUp={() => triggerKeyEvent('left', 'keyup')}
                onTouchStart={() => triggerKeyEvent('left', 'keydown')}
                onTouchEnd={() => triggerKeyEvent('left', 'keyup')}
                className="w-11 h-11 bg-slate-900/90 hover:bg-cyan-500/30 active:bg-cyan-500 text-cyan-300 rounded-lg border border-slate-700/80 flex items-center justify-center shadow-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                onMouseDown={() => triggerKeyEvent('backward', 'keydown')}
                onMouseUp={() => triggerKeyEvent('backward', 'keyup')}
                onTouchStart={() => triggerKeyEvent('backward', 'keydown')}
                onTouchEnd={() => triggerKeyEvent('backward', 'keyup')}
                className="w-11 h-11 bg-slate-900/90 hover:bg-cyan-500/30 active:bg-cyan-500 text-cyan-300 rounded-lg border border-slate-700/80 flex items-center justify-center shadow-lg transition-colors"
              >
                <ArrowDown className="w-5 h-5" />
              </button>
              <button
                onMouseDown={() => triggerKeyEvent('right', 'keydown')}
                onMouseUp={() => triggerKeyEvent('right', 'keyup')}
                onTouchStart={() => triggerKeyEvent('right', 'keydown')}
                onTouchEnd={() => triggerKeyEvent('right', 'keyup')}
                className="w-11 h-11 bg-slate-900/90 hover:bg-cyan-500/30 active:bg-cyan-500 text-cyan-300 rounded-lg border border-slate-700/80 flex items-center justify-center shadow-lg transition-colors"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 select-none">
            <button
              onMouseDown={() => triggerKeyEvent('boost', 'keydown')}
              onMouseUp={() => triggerKeyEvent('boost', 'keyup')}
              onTouchStart={() => triggerKeyEvent('boost', 'keydown')}
              onTouchEnd={() => triggerKeyEvent('boost', 'keyup')}
              className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 active:from-cyan-400 active:to-blue-400 text-slate-950 font-bold rounded-lg border border-cyan-400/50 flex items-center gap-1.5 text-xs shadow-lg"
            >
              <Flame className="w-4 h-4 fill-slate-950" />
              NITRO BOOST
            </button>
          </div>
        </div>

        {/* Godot 4 Code Inspector & File Generator (Right Panel) */}
        {!isFullScreenSim && (
          <div className="w-full lg:w-5/12 h-[55vh] lg:h-full flex flex-col">
            <GodotCodeViewer
              physics={physics}
              onPhysicsChange={setPhysics}
              onResetPhysics={() => setPhysics(DEFAULT_PHYSICS)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
