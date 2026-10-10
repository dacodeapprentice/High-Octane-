import React, { useRef, useState } from 'react';
import {
  Upload,
  RotateCw,
  Sliders,
  Check,
  AlertTriangle,
  RefreshCw,
  Box,
  Download,
  Info,
  X,
  Sparkles
} from 'lucide-react';
import {
  ModelMeta,
  ModelOrientationSettings,
  DEFAULT_MODEL_SETTINGS
} from '../utils/modelStorage.ts';
import {
  createSpeederDartMesh,
  createHeavyTankerMesh,
  exportGroupToGLB
} from '../utils/sampleModels.ts';

interface Props {
  modelMeta: ModelMeta;
  onImportGLB: (buffer: ArrayBuffer, fileName: string) => Promise<void>;
  onUpdateSettings: (settings: ModelOrientationSettings) => void;
  onResetToDefault: () => void;
  onLoadPreset: (presetName: 'dart' | 'tanker') => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
}

export const ShipModelManager: React.FC<Props> = ({
  modelMeta,
  onImportGLB,
  onUpdateSettings,
  onResetToDefault,
  onLoadPreset,
  isOpen,
  onClose
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.glb')) {
      setErrorMessage('Please select a valid glTF Binary (.glb) file.');
      return;
    }
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      await onImportGLB(buffer, file.name);
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || 'Failed to import model');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleDownloadSample = async (preset: 'dart' | 'tanker') => {
    try {
      const group = preset === 'dart' ? createSpeederDartMesh() : createHeavyTankerMesh();
      const glbBuffer = await exportGroupToGLB(group);
      const blob = new Blob([glbBuffer], { type: 'model/gltf-binary' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = preset === 'dart' ? 'sample_speeder_dart.glb' : 'sample_heavy_tanker.glb';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export sample GLB:', err);
    }
  };

  const settings = modelMeta.settings;

  const updateField = <K extends keyof ModelOrientationSettings>(
    key: K,
    val: ModelOrientationSettings[K]
  ) => {
    onUpdateSettings({
      ...settings,
      [key]: val
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-800 rounded-xl shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Box className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">3D Ship Model Manager</h2>
              <p className="text-[11px] text-slate-400">
                Decoupled mesh architecture · Import any .glb without breaking flight physics
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* Active Model Status Card */}
          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-semibold text-slate-400">CURRENT MODEL:</span>
                <span className="font-bold font-mono text-cyan-400">{modelMeta.fileName}</span>
                {modelMeta.isCustom ? (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    Custom GLB
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                    Default Fallback
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400 font-mono">
                <div>
                  Triangles: <span className="text-white font-semibold">{modelMeta.triangleCount.toLocaleString()}</span>
                </div>
                <div>
                  Dimensions: <span className="text-white font-semibold">{modelMeta.normalizedDimensions.x} × {modelMeta.normalizedDimensions.y} × {modelMeta.normalizedDimensions.z}m</span>
                </div>
                {modelMeta.fileSize > 0 && (
                  <div>
                    Size: <span className="text-white font-semibold">{(modelMeta.fileSize / 1024).toFixed(1)} KB</span>
                  </div>
                )}
              </div>
            </div>

            {modelMeta.isCustom && (
              <button
                onClick={onResetToDefault}
                className="px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors flex items-center gap-1 shrink-0"
              >
                <RefreshCw className="w-3 h-3" />
                Reset Default
              </button>
            )}
          </div>

          {/* Warnings or Error messages */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/50 text-rose-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {modelMeta.warning && (
            <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/50 text-amber-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{modelMeta.warning}</span>
            </div>
          )}

          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2.5 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-cyan-400 bg-cyan-950/20 text-cyan-300'
                : 'border-slate-700 bg-slate-950/60 hover:border-cyan-500/60 hover:bg-slate-950 text-slate-300'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".glb"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileChange(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-cyan-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-white">Drop your .glb file here or click to browse</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Standard glTF Binary with embedded materials & textures (no Draco compression)
              </p>
            </div>
            {isLoading && (
              <span className="text-cyan-400 text-xs font-mono animate-pulse">Loading & Normalizing mesh...</span>
            )}
          </div>

          {/* Instant Test Presets (Verification for different geometries) */}
          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Test With Different Geometry Presets
              </span>
              <span className="text-[10px] text-slate-500">1-click test meshes</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800 flex flex-col justify-between gap-2">
                <div>
                  <div className="font-bold text-cyan-300">Preset 1: Speeder Dart</div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Long & needle-thin craft (8.0m long × 1.4m wide). Tests elongated delta wing physics.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <button
                    onClick={() => onLoadPreset('dart')}
                    className="flex-1 px-2 py-1 font-semibold rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors"
                  >
                    Load in Sim
                  </button>
                  <button
                    onClick={() => handleDownloadSample('dart')}
                    title="Download .glb file for Godot testing"
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    .glb
                  </button>
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-900 border border-slate-800 flex flex-col justify-between gap-2">
                <div>
                  <div className="font-bold text-rose-300">Preset 2: Ironclad Tanker</div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Short & wide (6.2m wide), intentionally off-center pivot & 90° rotated. Tests auto-centering.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <button
                    onClick={() => onLoadPreset('tanker')}
                    className="flex-1 px-2 py-1 font-semibold rounded bg-rose-500 hover:bg-rose-400 text-slate-950 transition-colors"
                  >
                    Load in Sim
                  </button>
                  <button
                    onClick={() => handleDownloadSample('tanker')}
                    title="Download .glb file for Godot testing"
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    .glb
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Normalization & Alignment Controls */}
          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                Mesh Normalization & Alignment
              </span>
              <button
                onClick={() => onUpdateSettings(DEFAULT_MODEL_SETTINGS)}
                className="text-[10px] text-slate-400 hover:text-cyan-400 transition-colors"
              >
                Reset Alignment
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <label className="text-slate-400 block mb-1">Forward Axis</label>
                <select
                  value={settings.forwardAxis}
                  onChange={(e) =>
                    updateField('forwardAxis', e.target.value as ModelOrientationSettings['forwardAxis'])
                  }
                  className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-800 text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
                >
                  <option value="-Z">-Z (Standard glTF)</option>
                  <option value="+Z">+Z (Reversed)</option>
                  <option value="-X">-X (Left is forward)</option>
                  <option value="+X">+X (Right is forward)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Quick Orientation</label>
                <button
                  onClick={() => updateField('flip180', !settings.flip180)}
                  className={`w-full px-2 py-1 rounded font-medium border flex items-center justify-center gap-1 transition-colors ${
                    settings.flip180
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <RotateCw className="w-3 h-3" />
                  {settings.flip180 ? 'Flipped 180°' : 'Flip 180°'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Target Length</span>
                  <span className="font-mono text-cyan-400">{settings.targetLength.toFixed(1)}m</span>
                </div>
                <input
                  type="range"
                  min="1.5"
                  max="10.0"
                  step="0.1"
                  value={settings.targetLength}
                  onChange={(e) => updateField('targetLength', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1 bg-slate-800 rounded"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Scale Multiplier</span>
                  <span className="font-mono text-cyan-400">{settings.scaleMultiplier.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="3.0"
                  step="0.05"
                  value={settings.scaleMultiplier}
                  onChange={(e) => updateField('scaleMultiplier', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1 bg-slate-800 rounded"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Rotation Offset Y</span>
                  <span className="font-mono text-cyan-400">{settings.rotationYDeg}°</span>
                </div>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="5"
                  value={settings.rotationYDeg}
                  onChange={(e) => updateField('rotationYDeg', parseInt(e.target.value))}
                  className="w-full accent-cyan-400 h-1 bg-slate-800 rounded"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Height Offset Y</span>
                  <span className="font-mono text-cyan-400">{settings.offsetY.toFixed(2)}m</span>
                </div>
                <input
                  type="range"
                  min="-1.0"
                  max="1.5"
                  step="0.05"
                  value={settings.offsetY}
                  onChange={(e) => updateField('offsetY', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1 bg-slate-800 rounded"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[10px] text-slate-500">
            Model and alignment are saved in browser storage
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md font-semibold text-xs bg-cyan-400 hover:bg-cyan-300 text-slate-950 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
