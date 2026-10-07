import React, { useState } from 'react';
import { Copy, Check, Download, FileCode, Layers, Info, RefreshCw } from 'lucide-react';
import JSZip from 'jszip';
import { PhysicsParams } from '../types.ts';

interface Props {
  physics: PhysicsParams;
  onPhysicsChange: (params: PhysicsParams) => void;
  onResetPhysics: () => void;
}

export const GodotCodeViewer: React.FC<Props> = ({
  physics,
  onPhysicsChange,
  onResetPhysics
}) => {
  const [activeTab, setActiveTab] = useState<'main.tscn' | 'ship.gd' | 'project.godot' | 'custom' | 'nodes'>('main.tscn');
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [customFileContent, setCustomFileContent] = useState<string>(`# Paste your existing Godot 4 .tscn or .gd file here to inspect or compare
[gd_scene load_steps=2 format=3]

[node name="CustomScene" type="Node3D"]
`);
  const [customFileName, setCustomFileName] = useState<string>('my_game.tscn');

  // Dynamically generated ship.gd based on live tuned parameters
  const generateShipGd = (p: PhysicsParams): string => {
    return `extends CharacterBody3D

## High-Octane Gliding Ship Movement & Camera Tracking Controller
## Godot 4.x Compatible (CharacterBody3D arcade hover-racer physics)

@export_group("Hover & Suspension")
@export var hover_height: float = ${p.hoverHeight.toFixed(2)}
@export var hover_force: float = ${p.hoverForce.toFixed(1)}
@export var hover_damping: float = ${p.hoverDamping.toFixed(1)}

@export_group("Thrusters & Speed")
@export var max_speed: float = ${p.maxSpeed.toFixed(1)}
@export var acceleration: float = ${p.acceleration.toFixed(1)}
@export var reverse_brake_force: float = ${p.brakingForce.toFixed(1)}
@export var drag: float = 0.988
@export var boost_multiplier: float = ${p.boostMultiplier.toFixed(2)}
@export var boost_acceleration: float = ${(p.acceleration * 1.8).toFixed(1)}

@export_group("Steering & Aerodynamics")
@export var steering_speed: float = ${p.steeringSpeed.toFixed(2)}
@export var lateral_grip: float = ${p.lateralGrip.toFixed(2)} # 0.0 = pure ice drift, 1.0 = locked rails
@export var max_roll_angle: float = ${p.maxRollAngle.toFixed(1)} # degrees of visual banking roll
@export var roll_speed: float = ${p.rollSpeed.toFixed(1)}
@export var pitch_tilt_angle: float = ${p.pitchTiltAngle.toFixed(1)} # degrees of nose pitch tilt

@export_group("Camera Settings")
@export var base_fov: float = ${p.cameraFov.toFixed(1)}
@export var max_fov_boost: float = 16.0
@export var camera_lerp_weight: float = 8.0

# Node references
@onready var raycast: RayCast3D = $RayCast3D
@onready var mesh: MeshInstance3D = $MeshInstance3D
@onready var camera: Camera3D = $Camera3D

# Internal velocity & rotation state
var current_turn_input: float = 0.0
var current_roll: float = 0.0
var current_pitch: float = 0.0
var is_grounded: bool = false

func _ready() -> void:
	if camera:
		camera.fov = base_fov

func _physics_process(delta: float) -> void:
	# 1. Gather player input (WASD / Arrows / Gamepad)
	var throttle := Input.get_axis("ui_down", "ui_up") # -1.0 reverse/brake, +1.0 forward
	var steer := Input.get_axis("ui_right", "ui_left")  # +1.0 turn left, -1.0 turn right
	var is_boosting := Input.is_action_pressed("boost") or Input.is_key_pressed(KEY_SHIFT)

	# 2. Hover Suspension: RayCast3D detection to track plane
	if raycast and raycast.is_colliding():
		is_grounded = true
		var hit_point = raycast.get_collision_point()
		var distance = global_position.distance_to(hit_point)
		var compression = hover_height - distance
		
		# Spring force: F = k * x - c * v
		var spring_force = compression * hover_force
		var damping_force = velocity.y * hover_damping
		velocity.y += (spring_force - damping_force) * delta
	else:
		is_grounded = false
		# Apply gravity when airborne or over jumps
		velocity += get_gravity() * delta

	# 3. Steering & Yaw Rotation
	if is_grounded or velocity.length() > 3.0:
		current_turn_input = lerp(current_turn_input, steer * steering_speed, 10.0 * delta)
		rotate_y(current_turn_input * delta)

	# 4. Forward Thrusters & Air Braking
	var forward_dir := -transform.basis.z.normalized()
	var right_dir := transform.basis.x.normalized()
	
	var active_accel = boost_acceleration if is_boosting else acceleration
	var active_top_speed = (max_speed * boost_multiplier) if is_boosting else max_speed

	var forward_speed = velocity.dot(forward_dir)

	if throttle > 0.0:
		if forward_speed < active_top_speed:
			velocity += forward_dir * (active_accel * throttle * delta)
	elif throttle < 0.0:
		velocity -= forward_dir * (reverse_brake_force * abs(throttle) * delta)

	# 5. Gliding Aerodynamics: Decoupled forward & lateral drift velocities
	var forward_vel = forward_dir * velocity.dot(forward_dir)
	var lateral_vel = right_dir * velocity.dot(right_dir)
	var vertical_vel = Vector3(0, velocity.y, 0)

	# Lateral friction dampens sideways sliding according to grip factor
	lateral_vel = lateral_vel * pow(1.0 - (1.0 - lateral_grip), delta * 60.0)
	
	# Aerodynamic forward air drag
	forward_vel *= pow(drag, delta * 60.0)

	velocity = forward_vel + lateral_vel + vertical_vel

	# 6. Apply Movement in Godot 4
	move_and_slide()

	# 7. Visual Roll Banking & Pitch Tilt (giving that Wipeout / F-Zero feel)
	var target_roll = -steer * deg_to_rad(max_roll_angle)
	var target_pitch = throttle * deg_to_rad(pitch_tilt_angle)
	current_roll = lerp(current_roll, target_roll, roll_speed * delta)
	current_pitch = lerp(current_pitch, target_pitch, roll_speed * delta)

	if mesh:
		mesh.rotation.z = current_roll
		mesh.rotation.x = -current_pitch

	# 8. Dynamic Camera Tracking (Speed FOV expansion)
	if camera:
		var speed_ratio = clamp(velocity.length() / max_speed, 0.0, 1.8)
		var target_fov = base_fov + (speed_ratio * max_fov_boost)
		camera.fov = lerp(camera.fov, target_fov, camera_lerp_weight * delta)
`;
  };

  const mainTscnContent = `[gd_scene load_steps=8 format=3 uid="uid://bq7xk4m8j2tq1"]

[ext_resource type="Script" path="res://ship.gd" id="1_ship_script"]

[sub_resource type="StandardMaterial3D" id="StandardMaterial3D_track"]
albedo_color = Color(0.12, 0.14, 0.18, 1)
metallic = 0.1
roughness = 0.7

[sub_resource type="PlaneMesh" id="PlaneMesh_track"]
material = SubResource("StandardMaterial3D_track")
size = Vector2(250, 250)

[sub_resource type="BoxShape3D" id="BoxShape3D_track"]
size = Vector3(250, 1, 250)

[sub_resource type="StandardMaterial3D" id="StandardMaterial3D_ship"]
albedo_color = Color(0.1, 0.65, 0.95, 1)
metallic = 0.8
roughness = 0.25
emission_enabled = true
emission = Color(0.05, 0.45, 0.85, 1)
emission_energy_multiplier = 0.6

[sub_resource type="BoxMesh" id="BoxMesh_ship"]
material = SubResource("StandardMaterial3D_ship")
size = Vector3(2, 0.6, 3.6)

[sub_resource type="BoxShape3D" id="BoxShape3D_ship"]
size = Vector3(2, 0.6, 3.6)

[sub_resource type="ProceduralSkyMaterial" id="ProceduralSkyMaterial_sky"]
sky_top_color = Color(0.15, 0.25, 0.45, 1)
sky_horizon_color = Color(0.4, 0.45, 0.55, 1)
ground_bottom_color = Color(0.08, 0.09, 0.12, 1)

[sub_resource type="Sky" id="Sky_main"]
sky_material = SubResource("ProceduralSkyMaterial_sky")

[sub_resource type="Environment" id="Environment_main"]
background_mode = 2
sky = SubResource("Sky_main")
ambient_light_source = 3
ambient_light_color = Color(0.3, 0.35, 0.4, 1)
tonemap_mode = 2
glow_enabled = true
glow_bloom = 0.2

[node name="Main" type="Node3D"]

[node name="WorldEnvironment" type="WorldEnvironment" parent="."]
environment = SubResource("Environment_main")

[node name="DirectionalLight3D" type="DirectionalLight3D" parent="."]
transform = Transform3D(0.866025, -0.353553, 0.353553, 0, 0.707107, 0.707107, -0.5, -0.612372, 0.612372, 0, 40, 0)
shadow_enabled = true

[node name="Track" type="StaticBody3D" parent="."]

[node name="MeshInstance3D" type="MeshInstance3D" parent="Track"]
mesh = SubResource("PlaneMesh_track")

[node name="CollisionShape3D" type="CollisionShape3D" parent="Track"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, -0.5, 0)
shape = SubResource("BoxShape3D_track")

[node name="Ship" type="CharacterBody3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, ${physics.hoverHeight.toFixed(1)}, 0)
script = ExtResource("1_ship_script")

[node name="CollisionShape3D" type="CollisionShape3D" parent="Ship"]
shape = SubResource("BoxShape3D_ship")

[node name="MeshInstance3D" type="MeshInstance3D" parent="Ship"]
mesh = SubResource("BoxMesh_ship")

[node name="RayCast3D" type="RayCast3D" parent="Ship"]
target_position = Vector3(0, -2.5, 0)

[node name="Camera3D" type="Camera3D" parent="Ship"]
transform = Transform3D(1, 0, 0, 0, 0.965926, 0.258819, 0, -0.258819, 0.965926, 0, ${physics.cameraHeight.toFixed(1)}, ${physics.cameraDistance.toFixed(1)})
current = true
fov = ${physics.cameraFov.toFixed(1)}
`;

  const projectGodotContent = `; Engine configuration file.
; It's best edited using the editor UI and not directly,
; since the parameters that go here are not all obvious.
;
; Format:
;   [section] ; section goes between []
;   param=value ; assign values to parameters

config_version=5

[application]

config/name="AeroGlide - High Octane Glider Racer"
config/description="3D Glider Racing prototype with hover physics and camera tracking"
run/main_scene="res://main.tscn"
config/features=PackedStringArray("4.3", "Forward Plus")

[display]

window/size/viewport_width=1920
window/size/viewport_height=1080
window/stretch/mode="canvas_items"
window/stretch/aspect="expand"

[input]

ui_up={
"deadzone": 0.5,
"events": [Object(InputEventKey,"keycode":4194320), Object(InputEventKey,"keycode":87)]
}
ui_down={
"deadzone": 0.5,
"events": [Object(InputEventKey,"keycode":4194322), Object(InputEventKey,"keycode":83)]
}
ui_left={
"deadzone": 0.5,
"events": [Object(InputEventKey,"keycode":4194319), Object(InputEventKey,"keycode":65)]
}
ui_right={
"deadzone": 0.5,
"events": [Object(InputEventKey,"keycode":4194321), Object(InputEventKey,"keycode":68)]
}
boost={
"deadzone": 0.5,
"events": [Object(InputEventKey,"keycode":4194325), Object(InputEventKey,"keycode":32)]
}
`;

  const handleCopy = (content: string, tabName: string) => {
    navigator.clipboard.writeText(content);
    setCopiedTab(tabName);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  const handleDownloadZip = async () => {
    const zip = new JSZip();
    zip.file('main.tscn', mainTscnContent);
    zip.file('ship.gd', generateShipGd(physics));
    zip.file('project.godot', projectGodotContent);
    zip.file('README.md', `# AeroGlide - 3D Glider Racer Prototype for Godot 4.x

## How to Run in Godot 4:
1. Open Godot Engine (version 4.2+ or 4.3+).
2. Click "Import" and select the folder containing these unzipped files (or click "Scan").
3. Godot will recognize the project and open the editor.
4. Press F5 (or click the Play icon in top right) to launch main.tscn.

## Controls:
- W / Up Arrow: Forward Thrusters
- S / Down Arrow: Air Brake / Reverse
- A / Left Arrow: Turn Left (Rolls into turn)
- D / Right Arrow: Turn Right (Rolls into turn)
- Space / Shift: Nitro Boost

## Node Architecture:
- Main (Node3D)
  - WorldEnvironment (Sky & ambient glow)
  - DirectionalLight3D (Sunlight & shadows)
  - Track (StaticBody3D)
    - MeshInstance3D (PlaneMesh 250x250)
    - CollisionShape3D (BoxShape3D)
  - Ship (CharacterBody3D) [res://ship.gd]
    - CollisionShape3D (BoxShape3D)
    - MeshInstance3D (BoxMesh)
    - RayCast3D (Hover ground detection)
    - Camera3D (Parented directly behind ship)
`);

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Godot4_Glider_Racer_Project.zip';
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
        return generateShipGd(physics);
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
                Godot 4.x Node Hierarchy
              </h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                This scene meets the exact core requirements: a plane for the track, a box for the ship, and a camera parented directly to the ship node.
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
                        <div>├─ <span className="text-slate-300">RayCast3D</span> <span className="text-slate-500">(Hover suspension sensor, -2.5m)</span></div>
                        <div>└─ <span className="text-fuchsia-400 font-medium">Camera3D</span> <span className="text-slate-500">(Parented behind ship at Y:2.5, Z:6.0)</span></div>
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
                Why CharacterBody3D for High-Octane Gliders?
              </h4>
              <p className="text-slate-400 leading-relaxed">
                Classic hover-racing engines like <span className="text-cyan-300">Wipeout</span> and <span className="text-cyan-300">F-Zero</span> use kinematic raycast suspension rather than pure RigidBody physics. With Godot 4's <code className="text-amber-300 font-mono">move_and_slide()</code>, you gain millimeter-precise hover control, zero erratic tumbling, and full authority over lateral drift grip.
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
                <span>Hover Height</span>
                <span className="font-mono text-cyan-400">{physics.hoverHeight.toFixed(1)}m</span>
              </div>
              <input
                type="range"
                min="0.6"
                max="3.0"
                step="0.1"
                value={physics.hoverHeight}
                onChange={(e) => onPhysicsChange({ ...physics, hoverHeight: parseFloat(e.target.value) })}
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
          </div>
        </div>
      </div>
    </div>
  );
};
