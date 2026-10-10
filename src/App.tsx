/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  Zap,
  Box,
  X
} from 'lucide-react';
import { Simulation3D } from './components/Simulation3D.tsx';
import { GodotCodeViewer } from './components/GodotCodeViewer.tsx';
import { ShipModelManager } from './components/ShipModelManager.tsx';
import { DEFAULT_PHYSICS, PhysicsParams } from './types.ts';
import {
  ModelMeta,
  ModelOrientationSettings,
  DEFAULT_MODEL_SETTINGS,
  saveModelToStorage,
  loadModelFromStorage,
  clearModelFromStorage
} from './utils/modelStorage.ts';
import {
  createSpeederDartMesh,
  createHeavyTankerMesh,
  exportGroupToGLB
} from './utils/sampleModels.ts';

export default function App() {
  const [physics, setPhysics] = useState<PhysicsParams>(DEFAULT_PHYSICS);
  const [telemetry, setTelemetry] = useState({
    speedKmh: 0,
    altitude: 2.0,
    effectiveHoverHeight: 2.0,
    targetHoverHeight: 2.0,
    rollDeg: 0,
    driftPercent: 0,
    isHovering: true,
    isBoosting: false,
    heat: 0,
    isOverheated: false
  });
  const [isFullScreenSim, setIsFullScreenSim] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Custom 3D Model state & IndexedDB persistence
  const [customModelBuffer, setCustomModelBuffer] = useState<ArrayBuffer | null>(null);
  const [customModelFileName, setCustomModelFileName] = useState<string>('default_ship.glb');
  const [modelSettings, setModelSettings] = useState<ModelOrientationSettings>(DEFAULT_MODEL_SETTINGS);
  const [modelMeta, setModelMeta] = useState<ModelMeta>({
    fileName: 'Default High-Octane Glider',
    fileSize: 0,
    triangleCount: 48,
    vertexCount: 96,
    originalDimensions: { x: 4.7, y: 1.1, z: 4.9 },
    normalizedDimensions: { x: 4.7, y: 1.1, z: 4.9 },
    settings: DEFAULT_MODEL_SETTINGS,
    isCustom: false
  });
  const [isModelManagerOpen, setIsModelManagerOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Restore saved model from IndexedDB on initial mount
  useEffect(() => {
    loadModelFromStorage()
      .then((saved) => {
        if (saved && saved.fileBuffer) {
          setCustomModelBuffer(saved.fileBuffer);
          setCustomModelFileName(saved.fileName);
          if (saved.settings) {
            setModelSettings(saved.settings);
          }
        }
      })
      .catch((err) => {
        console.warn('Failed to load saved ship model:', err);
      });
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleImportGLB = async (buffer: ArrayBuffer, fileName: string) => {
    try {
      await saveModelToStorage(buffer, fileName, modelSettings);
      setCustomModelBuffer(buffer);
      setCustomModelFileName(fileName);
      showToast(`Loaded ${fileName} (${(buffer.byteLength / 1024).toFixed(1)} KB)`, 'success');
    } catch (err) {
      showToast((err as Error)?.message || 'Failed to import GLB model', 'error');
    }
  };

  const handleUpdateModelSettings = async (newSettings: ModelOrientationSettings) => {
    setModelSettings(newSettings);
    if (customModelBuffer) {
      await saveModelToStorage(customModelBuffer, customModelFileName, newSettings);
    }
  };

  const handleResetModelToDefault = async () => {
    await clearModelFromStorage();
    setCustomModelBuffer(null);
    setCustomModelFileName('default_ship.glb');
    setModelSettings(DEFAULT_MODEL_SETTINGS);
    showToast('Reverted to default procedural ship', 'info');
  };

  const handleLoadPreset = async (preset: 'dart' | 'tanker') => {
    try {
      const group = preset === 'dart' ? createSpeederDartMesh() : createHeavyTankerMesh();
      const glbBuffer = await exportGroupToGLB(group);
      const name = preset === 'dart' ? 'sample_speeder_dart.glb' : 'sample_heavy_tanker.glb';
      await handleImportGLB(glbBuffer, name);
    } catch (err) {
      showToast('Failed to load preset: ' + (err as Error)?.message, 'error');
    }
  };

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

  // Safe pointer binding for virtual on-screen controls:
  // - Uses pointer capture so pointerup is never missed even if dragged off-button
  // - Prevents synthetic delayed mouse events on touch devices
  // - tabIndex={-1} prevents stealing keyboard focus
  const bindVirtualControl = (key: string) => ({
    type: 'button' as const,
    tabIndex: -1,
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
      triggerKeyEvent(key, 'keydown');
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      triggerKeyEvent(key, 'keyup');
    },
    onPointerCancel: (e: React.PointerEvent) => {
      e.preventDefault();
      triggerKeyEvent(key, 'keyup');
    },
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
    }
  });

  // Global safety listener: release all keys on pointer up, touch end, or window blur
  useEffect(() => {
    const handleGlobalRelease = () => {
      ['forward', 'backward', 'left', 'right', 'boost'].forEach((k) => {
        triggerKeyEvent(k, 'keyup');
      });
    };

    window.addEventListener('pointerup', handleGlobalRelease);
    window.addEventListener('pointercancel', handleGlobalRelease);
    window.addEventListener('mouseup', handleGlobalRelease);
    window.addEventListener('touchend', handleGlobalRelease);
    window.addEventListener('blur', handleGlobalRelease);

    return () => {
      window.removeEventListener('pointerup', handleGlobalRelease);
      window.removeEventListener('pointercancel', handleGlobalRelease);
      window.removeEventListener('mouseup', handleGlobalRelease);
      window.removeEventListener('touchend', handleGlobalRelease);
      window.removeEventListener('blur', handleGlobalRelease);
    };
  }, []);

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
                HIGH OCTANE 0G
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
          {/* Custom 3D Model Manager Button */}
          <button
            onClick={() => setIsModelManagerOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-all cursor-pointer ${
              customModelBuffer
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-sm shadow-cyan-900/30'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
            }`}
            title="Import custom 3D model (.glb) or test sample meshes"
          >
            <Box className="w-3.5 h-3.5 text-cyan-400" />
            <span>{customModelBuffer ? 'Custom Mesh' : 'Import Ship'}</span>
            {customModelBuffer && (
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            )}
          </button>

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
          {/* Quick Model Selector & Test Presets Pill Overlay */}
          <div className="absolute top-12 left-3 z-10 flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setIsModelManagerOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950/85 backdrop-blur-md border border-slate-800 hover:border-cyan-500/50 text-[11px] font-mono text-slate-300 hover:text-white transition-colors cursor-pointer shadow-lg"
            >
              <Box className="w-3 h-3 text-cyan-400" />
              <span className="text-slate-400">Mesh:</span>
              <span className="text-cyan-300 font-medium truncate max-w-[130px]">
                {modelMeta.fileName.replace(/\.glb$/i, '')}
              </span>
              {modelMeta.isCustom ? (
                <span className="px-1 py-0.2 bg-cyan-950 text-cyan-300 text-[9px] rounded border border-cyan-800 font-bold">
                  CUSTOM
                </span>
              ) : (
                <span className="px-1 py-0.2 bg-slate-800 text-slate-400 text-[9px] rounded">
                  DEFAULT
                </span>
              )}
            </button>

            {/* Quick-test Presets to instantly verify decoupling */}
            <button
              onClick={() => handleLoadPreset('dart')}
              className="px-2 py-1 rounded-md bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-[10px] font-mono text-cyan-300 hover:text-cyan-200 transition-colors shadow-lg cursor-pointer hidden sm:block"
              title="Test with long thin needle dart mesh"
            >
              + Dart Mesh
            </button>
            <button
              onClick={() => handleLoadPreset('tanker')}
              className="px-2 py-1 rounded-md bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-[10px] font-mono text-amber-300 hover:text-amber-200 transition-colors shadow-lg cursor-pointer hidden sm:block"
              title="Test with short wide off-center tanker mesh"
            >
              + Tanker Mesh
            </button>
            {customModelBuffer && (
              <button
                onClick={handleResetModelToDefault}
                className="px-2 py-1 rounded-md bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-[10px] font-mono text-slate-400 hover:text-white transition-colors shadow-lg cursor-pointer"
                title="Revert to default procedural ship"
              >
                Reset Mesh
              </button>
            )}
          </div>
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
              <span className="text-cyan-300 font-bold">{telemetry.altitude.toFixed(2)}m</span>
              <span className="text-[10px] text-slate-400 font-normal">
                (lift: {telemetry.effectiveHoverHeight.toFixed(2)}m)
              </span>
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

            {/* Nitro Heat Bar HUD */}
            <div
              className={`flex flex-col gap-1 px-3 py-1.5 rounded-md bg-slate-950/85 backdrop-blur-md border ${
                telemetry.isOverheated
                  ? 'border-rose-500 bg-rose-950/30 animate-pulse shadow-rose-950/80'
                  : telemetry.heat > 80
                  ? 'border-rose-500/50'
                  : telemetry.heat > 50
                  ? 'border-amber-500/50'
                  : 'border-slate-800/80'
              } font-mono text-xs shadow-lg w-60`}
            >
              <div className="flex items-center justify-between text-[11px] h-4">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Flame
                    className={`w-3.5 h-3.5 shrink-0 ${
                      telemetry.isOverheated
                        ? 'text-rose-400 fill-rose-500 animate-bounce'
                        : telemetry.heat > 80
                        ? 'text-rose-400 fill-rose-500'
                        : telemetry.heat > 50
                        ? 'text-amber-400 fill-amber-500'
                        : 'text-cyan-400 fill-cyan-400'
                    }`}
                  />
                  <span
                    className={`truncate ${
                      telemetry.isOverheated
                        ? 'text-rose-400 font-black tracking-wider'
                        : 'text-slate-300 font-medium'
                    }`}
                  >
                    {telemetry.isOverheated ? 'OVERHEAT' : 'NITRO HEAT'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {telemetry.isOverheated ? (
                    <span className="text-[10px] text-rose-400 font-bold animate-pulse">LOCKED</span>
                  ) : telemetry.isBoosting ? (
                    <span className="text-[10px] text-cyan-300 animate-pulse font-bold">BURNING</span>
                  ) : null}
                  <span
                    className={`font-bold ${
                      telemetry.isOverheated
                        ? 'text-rose-400'
                        : telemetry.heat > 80
                        ? 'text-rose-400'
                        : telemetry.heat > 50
                        ? 'text-amber-300'
                        : 'text-cyan-300'
                    }`}
                  >
                    {Math.round(telemetry.heat)}%
                  </span>
                </div>
              </div>

              {/* Progress bar with recovery threshold marker (zero transition lag so release stops immediately) */}
              <div className="relative w-full h-2 bg-slate-800/90 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    telemetry.isOverheated
                      ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                      : telemetry.heat > 80
                      ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                      : telemetry.heat > 50
                      ? 'bg-gradient-to-r from-cyan-400 to-amber-400'
                      : 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.5)]'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, telemetry.heat))}%` }}
                />
                {/* Recovery Threshold Marker (default 40%) */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white/80 z-10 pointer-events-none"
                  style={{
                    left: `${((physics.recoverThreshold ?? 40) / (physics.overheatThreshold || 100)) * 100}%`
                  }}
                  title={`Recovery Threshold: ${physics.recoverThreshold}%`}
                />
              </div>

              <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono leading-none">
                <span>0%</span>
                <span
                  className={
                    telemetry.isOverheated
                      ? 'text-amber-300 font-bold'
                      : 'text-slate-400'
                  }
                >
                  {telemetry.isOverheated
                    ? `Cool <${physics.recoverThreshold}% to unlock`
                    : `Recov: ${physics.recoverThreshold}%`}
                </span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* Drive instructions pill overlay */}
          <div className="absolute top-3 right-3 z-10 px-3 py-1.5 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-800/80 font-mono text-[11px] text-slate-300 hidden sm:flex items-center gap-2 shadow-lg pointer-events-none">
            <span className="text-cyan-400">WASD / Arrows</span> Drive
            <span className="text-slate-600">·</span>
            <span className="text-cyan-400">Shift / Space</span> Boost
            <span className="text-slate-600">·</span>
            <span className="text-cyan-400">R</span> Reset
          </div>

          {/* Three.js Simulation Canvas */}
          <div className="flex-1 w-full h-full relative">
            <Simulation3D
              physics={physics}
              customModelBuffer={customModelBuffer}
              customModelFileName={customModelFileName}
              modelSettings={modelSettings}
              onModelMetaChange={setModelMeta}
              onModelLoadError={(err) => showToast(err, 'error')}
              onFileDropped={(buf, name) => handleImportGLB(buf, name)}
              onTelemetryUpdate={setTelemetry}
              isPaused={isPaused}
            />
          </div>

          {/* Toast Notification */}
          {toastMessage && (
            <div
              className={`absolute bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg font-mono text-xs flex items-center gap-2 shadow-2xl backdrop-blur-md border ${
                toastMessage.type === 'error'
                  ? 'bg-rose-950/90 border-rose-500 text-rose-200'
                  : toastMessage.type === 'success'
                  ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
                  : 'bg-slate-900/90 border-cyan-500 text-cyan-200'
              }`}
            >
              <span>{toastMessage.message}</span>
              <button
                onClick={() => setToastMessage(null)}
                className="ml-2 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* On-screen Touch / Click Controls for fast testing */}
          <div className="absolute bottom-4 right-4 z-10 flex flex-col items-center gap-1.5 select-none opacity-85 hover:opacity-100 transition-opacity">
            <button
              {...bindVirtualControl('forward')}
              className="w-11 h-11 bg-slate-900/90 hover:bg-cyan-500/30 active:bg-cyan-500 text-cyan-300 rounded-lg border border-slate-700/80 flex items-center justify-center shadow-lg transition-colors cursor-pointer"
            >
              <ArrowUp className="w-5 h-5 pointer-events-none" />
            </button>
            <div className="flex gap-1.5">
              <button
                {...bindVirtualControl('left')}
                className="w-11 h-11 bg-slate-900/90 hover:bg-cyan-500/30 active:bg-cyan-500 text-cyan-300 rounded-lg border border-slate-700/80 flex items-center justify-center shadow-lg transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5 pointer-events-none" />
              </button>
              <button
                {...bindVirtualControl('backward')}
                className="w-11 h-11 bg-slate-900/90 hover:bg-cyan-500/30 active:bg-cyan-500 text-cyan-300 rounded-lg border border-slate-700/80 flex items-center justify-center shadow-lg transition-colors cursor-pointer"
              >
                <ArrowDown className="w-5 h-5 pointer-events-none" />
              </button>
              <button
                {...bindVirtualControl('right')}
                className="w-11 h-11 bg-slate-900/90 hover:bg-cyan-500/30 active:bg-cyan-500 text-cyan-300 rounded-lg border border-slate-700/80 flex items-center justify-center shadow-lg transition-colors cursor-pointer"
              >
                <ArrowRight className="w-5 h-5 pointer-events-none" />
              </button>
            </div>
          </div>

          <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 select-none">
            <button
              {...bindVirtualControl('boost')}
              aria-disabled={telemetry.isOverheated}
              className={`px-4 py-2 font-bold rounded-lg border flex items-center gap-1.5 text-xs shadow-lg transition-colors select-none cursor-pointer ${
                telemetry.isOverheated
                  ? 'bg-rose-950/80 border-rose-500/80 text-rose-300 opacity-70 animate-pulse'
                  : 'bg-gradient-to-r from-cyan-600 to-blue-600 active:from-cyan-400 active:to-blue-400 text-slate-950 border-cyan-400/50'
              }`}
            >
              <Flame
                className={`w-4 h-4 pointer-events-none ${
                  telemetry.isOverheated ? 'text-rose-400 fill-rose-500' : 'fill-slate-950'
                }`}
              />
              {telemetry.isOverheated ? 'OVERHEATED (COOLING)' : 'NITRO BOOST'}
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

      {/* Custom 3D Ship Model Importer & Normalization Studio Modal */}
      <ShipModelManager
        isOpen={isModelManagerOpen}
        onClose={() => setIsModelManagerOpen(false)}
        modelMeta={modelMeta}
        onImportGLB={handleImportGLB}
        onUpdateSettings={handleUpdateModelSettings}
        onResetToDefault={handleResetModelToDefault}
        onLoadPreset={handleLoadPreset}
      />
    </div>
  );
}
