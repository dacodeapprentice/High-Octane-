import React, { useState } from 'react';
import { Copy, Check, Download, Layers, Info, RefreshCw } from 'lucide-react';
import JSZip from 'jszip';
import {
  generateShipGd,
  generateMainTscn,
  generateProjectGodot,
  generateReadme,
  ShipPhysicsParams
} from '../shipPhysics.ts';

interface Props {
  physics: ShipPhysicsParams;
  onPhysicsChange: (params: ShipPhysicsParams) => void;
  onResetPhysics: () => void;
}

export const GodotCodeViewer: React.FC<Props> = ({
  physics,
  onPhysicsChange,
  onResetPhysics
}) => {
  const [activeTab, setActiveTab] = useState<'main.tscn' | 'ship.gd' | 'project.godot' | 'custom' | 'nodes'>('main.tscn');
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [customFileContent, setCustomFileContent] = useState<string>(`# High Octane 0G - Paste your custom .tscn or .gd file here to inspect or edit
[gd_scene load_steps=2 format=3]

[node name="CustomScene" type="Node3D"]
`);
  const [customFileName, setCustomFileName] = useState<string>('my_scene.tscn');

  const mainTscnContent = generateMainTscn(physics);
  const shipGdContent = generateShipGd(physics);
  const projectGodotContent = generateProjectGodot();

  const handleCopy = (content: string, tabName: string) => {
    navigator.clipboard.writeText(content);
    setCopiedTab(tabName);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  const handleDownloadZip = async () => {
    const zip = new JSZip();
    zip.file('main.tscn', generateMainTscn(physics));
    zip.file('ship.gd', generateShipGd(physics));
    zip.file('project.godot', generateProjectGodot());
    zip.file('README.md', generateReadme());

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'High_Octane_0G_Godot4_Project.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getCurrentContent = () => {
    switch (activeTab) {
      case 'main.tscn':
        return mainTscnContent;
      case 'ship.gd':
        return shipGdContent;
      case 'project.godot':
        return projectGodotContent;
      case 'custom':
        return customFileContent;
      default:
        return '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800">
      {/* Top action toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-mono">
          <button
            onClick={() => setActiveTab('main.tscn')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'main.tscn'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            main.tscn
          </button>
          <button
            onClick={() => setActiveTab('ship.gd')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'ship.gd'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            ship.gd
          </button>
          <button
            onClick={() => setActiveTab('project.godot')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'project.godot'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            project.godot
          </button>
          <button
            onClick={() => setActiveTab('nodes')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'nodes'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Scene Tree
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'custom'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Edit / Paste File
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab !== 'nodes' && (
            <button
              onClick={() => handleCopy(getCurrentContent(), activeTab)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-md border border-slate-700 transition-colors"
            >
              {copiedTab === activeTab ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={handleDownloadZip}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-md transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .ZIP</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'nodes' ? (
          <div className="p-5 overflow-y-auto space-y-5 text-sm">
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
              <h3 className="text-sm font-bold text-cyan-400 mb-2 flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                High Octane 0G - Godot 4.x Node Hierarchy
              </h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Minimal core setup: a plane for the track, a box for the ship, and a camera parented directly to the ship node.
              </p>

              <div className="space-y-2 font-mono text-xs">
                <div className="p-2.5 rounded bg-slate-900 border border-slate-800/80">
                  <div className="text-cyan-400 font-semibold">▼ Main (Node3D)</div>
                  <div className="pl-4 mt-1.5 space-y-1.5 text-slate-300 border-l border-slate-700/60 ml-2">
                    <div>├─ <span className="text-sky-300">WorldEnvironment</span> <span className="text-slate-500">(Sky, Glow, ToneMapping)</span></div>
                    <div>├─ <span className="text-sky-300">DirectionalLight3D</span> <span className="text-slate-500">(Sunlight + Soft Shadows)</span></div>
                    
                    <div>
                      <div className="text-amber-300">▼ Track (StaticBody3D)</div>
                      <div className="pl-4 space-y-1 text-slate-400 border-l border-slate-700/60 ml-2 mt-1">
                        <div>├─ <span className="text-slate-300">MeshInstance3D</span> <span className="text-slate-500">(PlaneMesh 250x250m)</span></div>
                        <div>└─ <span className="text-slate-300">CollisionShape3D</span> <span className="text-slate-500">(BoxShape3D)</span></div>
                      </div>
                    </div>

                    <div>
                      <div className="text-emerald-400">▼ Ship (CharacterBody3D) <span className="text-cyan-400 text-[11px]">[res://ship.gd]</span></div>
                      <div className="pl-4 space-y-1 text-slate-400 border-l border-slate-700/60 ml-2 mt-1">
                        <div>├─ <span className="text-slate-300">CollisionShape3D</span> <span className="text-slate-500">(BoxShape3D for ship body)</span></div>
                        <div>├─ <span className="text-slate-300">MeshInstance3D</span> <span className="text-slate-500">(BoxMesh 2x0.6x3.6m)</span></div>
                        <div>├─ <span className="text-slate-300">RayCast3D</span> <span className="text-slate-500">(Hover suspension sensor, -4.0m)</span></div>
                        <div>└─ <span className="text-fuchsia-400 font-medium">Camera3D</span> <span className="text-slate-500">(Parented behind ship at Y:2.5, Z:6.0)</span></div>
                      </div>
                    </div>

                    <div>
                      <div className="text-purple-400">▼ HUD (CanvasLayer)</div>
                      <div className="pl-4 space-y-1 text-slate-400 border-l border-slate-700/60 ml-2 mt-1">
                        <div>└─ <span className="text-slate-300">HeatBar (ProgressBar)</span> <span className="text-slate-500">(Displays nitro heat & overheat warning)</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Why CharacterBody3D */}
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-2">
              <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-cyan-400" />
                Why CharacterBody3D for High Octane 0G?
              </h4>
              <p className="text-slate-400 leading-relaxed">
                Classic zero-gravity and hover-racing physics (like <span className="text-cyan-300">Wipeout</span> and <span className="text-cyan-300">F-Zero</span>) use kinematic raycast suspension rather than unconstrained RigidBody physics. Godot 4's <code className="text-amber-300 font-mono">move_and_slide()</code> ensures smooth track adhesion, eliminates erratic tumbling, and gives precise control over aerodynamic lateral drift.
              </p>
            </div>
          </div>
        ) : activeTab === 'custom' ? (
          <div className="flex-1 flex flex-col p-4 bg-slate-950">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">File Name:</span>
                <input
                  type="text"
                  value={customFileName}
                  onChange={(e) => setCustomFileName(e.target.value)}
                  className="px-2 py-1 text-xs font-mono bg-slate-900 border border-slate-800 rounded text-cyan-300 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <span className="text-[11px] text-slate-500">Edit or paste your uploaded file here</span>
            </div>
            <textarea
              value={customFileContent}
              onChange={(e) => setCustomFileContent(e.target.value)}
              className="flex-1 w-full p-3 font-mono text-xs bg-slate-900 text-slate-200 border border-slate-800 rounded-lg resize-none focus:outline-none focus:border-cyan-500"
              spellCheck={false}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-auto bg-slate-950 p-4">
            <pre className="font-mono text-xs text-slate-300 whitespace-pre leading-relaxed select-text">
              <code>{getCurrentContent()}</code>
            </pre>
          </div>
        )}

        {/* Bottom Tuning Panel */}
        <div className="p-4 bg-slate-950 border-t border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Live Physics & Script Tuning
            </span>
            <button
              onClick={onResetPhysics}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-cyan-400 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Reset Defaults
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Idle Height</span>
                <span className="font-mono text-cyan-400">{physics.idleHoverHeight.toFixed(1)}m</span>
              </div>
              <input
                type="range"
                min="1.2"
                max="3.5"
                step="0.1"
                value={physics.idleHoverHeight}
                onChange={(e) => onPhysicsChange({ ...physics, idleHoverHeight: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400 h-1 bg-slate-800 rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Cruise Height</span>
                <span className="font-mono text-cyan-400">{physics.cruiseHoverHeight.toFixed(2)}m</span>
              </div>
              <input
                type="range"
                min="0.4"
                max="1.6"
                step="0.05"
                value={physics.cruiseHoverHeight}
                onChange={(e) => onPhysicsChange({ ...physics, cruiseHoverHeight: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400 h-1 bg-slate-800 rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Lift Transition</span>
                <span className="font-mono text-cyan-400">{physics.hoverTransitionSpeed.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="10.0"
                step="0.5"
                value={physics.hoverTransitionSpeed}
                onChange={(e) => onPhysicsChange({ ...physics, hoverTransitionSpeed: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400 h-1 bg-slate-800 rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Idle Bobbing</span>
                <span className="font-mono text-cyan-400">{physics.idleBobAmount.toFixed(2)}m</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.25"
                step="0.01"
                value={physics.idleBobAmount}
                onChange={(e) => onPhysicsChange({ ...physics, idleBobAmount: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400 h-1 bg-slate-800 rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Bob Speed</span>
                <span className="font-mono text-cyan-400">{physics.idleBobSpeed.toFixed(1)}Hz</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="5.0"
                step="0.5"
                value={physics.idleBobSpeed}
                onChange={(e) => onPhysicsChange({ ...physics, idleBobSpeed: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400 h-1 bg-slate-800 rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Top Speed</span>
                <span className="font-mono text-cyan-400">{physics.maxSpeed}</span>
              </div>
              <input
                type="range"
                min="30"
                max="120"
                step="5"
                value={physics.maxSpeed}
                onChange={(e) => onPhysicsChange({ ...physics, maxSpeed: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400 h-1 bg-slate-800 rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Drift Grip</span>
                <span className="font-mono text-cyan-400">{(physics.lateralGrip * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="0.98"
                step="0.02"
                value={physics.lateralGrip}
                onChange={(e) => onPhysicsChange({ ...physics, lateralGrip: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400 h-1 bg-slate-800 rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Roll Banking</span>
                <span className="font-mono text-cyan-400">{physics.maxRollAngle}°</span>
              </div>
              <input
                type="range"
                min="10"
                max="50"
                step="2"
                value={physics.maxRollAngle}
                onChange={(e) => onPhysicsChange({ ...physics, maxRollAngle: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400 h-1 bg-slate-800 rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Heat Rate</span>
                <span className="font-mono text-cyan-400">{physics.boostHeatRate.toFixed(1)}/s</span>
              </div>
              <input
                type="range"
                min="5.0"
                max="40.0"
                step="1.0"
                value={physics.boostHeatRate}
                onChange={(e) => onPhysicsChange({ ...physics, boostHeatRate: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400 h-1 bg-slate-800 rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Cool Rate</span>
                <span className="font-mono text-cyan-400">{physics.coolRate.toFixed(1)}/s</span>
              </div>
              <input
                type="range"
                min="2.0"
                max="25.0"
                step="0.5"
                value={physics.coolRate}
                onChange={(e) => onPhysicsChange({ ...physics, coolRate: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400 h-1 bg-slate-800 rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Cool Delay</span>
                <span className="font-mono text-cyan-400">{physics.cooldownDelay.toFixed(2)}s</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.5"
                step="0.05"
                value={physics.cooldownDelay}
                onChange={(e) => onPhysicsChange({ ...physics, cooldownDelay: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400 h-1 bg-slate-800 rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Recov Threshold</span>
                <span className="font-mono text-cyan-400">{physics.recoverThreshold}%</span>
              </div>
              <input
                type="range"
                min="15"
                max="80"
                step="5"
                value={physics.recoverThreshold}
                onChange={(e) => onPhysicsChange({ ...physics, recoverThreshold: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400 h-1 bg-slate-800 rounded"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
