/**
 * Canonical Single Source of Truth for "High Octane 0G"
 * Physics parameters, GDScript generator, and Godot 4 scene definition.
 * Decouples physics body from visual 3D mesh (supporting custom GLB import).
 */

export interface ShipPhysicsParams {
  // Hover & Suspension Lift
  idleHoverHeight: number;
  cruiseHoverHeight: number;
  hoverTransitionSpeed: number;
  idleBobAmount: number;
  idleBobSpeed: number;
  hoverForce: number;
  hoverDamping: number;

  // Backwards compatibility alias
  hoverHeight?: number;

  // Thrusters & Speed
  maxSpeed: number;
  acceleration: number;
  brakingForce: number;
  drag: number;
  boostMultiplier: number;
  boostAcceleration: number;

  // Nitro Overheat System
  boostHeatRate: number;
  coolRate: number;
  cooldownDelay: number;
  overheatThreshold: number;
  recoverThreshold: number;

  // 3D Model Decoupling & Normalization
  modelScale: number;
  modelForwardOffsetDeg: number;
  targetModelLength: number;
  colliderSizeX: number;
  colliderSizeY: number;
  colliderSizeZ: number;
  autoFitCollider: boolean;

  // Steering & Aerodynamics
  steeringSpeed: number;
  lateralGrip: number;
  maxRollAngle: number;
  rollSpeed: number;
  pitchTiltAngle: number;

  // Camera Settings
  baseFov: number;
  cameraFov: number;
  maxFovBoost: number;
  cameraLerpWeight: number;
  cameraDistance: number;
  cameraHeight: number;
  cameraMode: 'smooth' | 'rigid' | 'cockpit' | 'orbit';
}

export const DEFAULT_SHIP_PHYSICS: ShipPhysicsParams = {
  idleHoverHeight: 2.0,
  cruiseHoverHeight: 0.9,
  hoverTransitionSpeed: 4.0,
  idleBobAmount: 0.08,
  idleBobSpeed: 2.0,
  hoverForce: 48.0,
  hoverDamping: 6.5,

  // Alias
  hoverHeight: 2.0,

  maxSpeed: 70.0,
  acceleration: 48.0,
  brakingForce: 35.0,
  drag: 0.988,
  boostMultiplier: 1.55,
  boostAcceleration: 85.0,

  // Nitro Overheat System
  boostHeatRate: 18.0,
  coolRate: 9.0,
  cooldownDelay: 0.4,
  overheatThreshold: 100.0,
  recoverThreshold: 40.0,

  // 3D Model Decoupling & Normalization
  modelScale: 1.0,
  modelForwardOffsetDeg: 0.0,
  targetModelLength: 4.0,
  colliderSizeX: 2.0,
  colliderSizeY: 0.6,
  colliderSizeZ: 3.6,
  autoFitCollider: false,

  steeringSpeed: 2.6,
  lateralGrip: 0.86,
  maxRollAngle: 30.0,
  rollSpeed: 7.0,
  pitchTiltAngle: 10.0,
  baseFov: 75.0,
  cameraFov: 75.0,
  maxFovBoost: 16.0,
  cameraLerpWeight: 8.0,
  cameraDistance: 6.0,
  cameraHeight: 2.5,
  cameraMode: 'smooth'
};

/**
 * Generates the canonical Godot 4 ship.gd GDScript from physics parameters.
 */
export function generateShipGd(p: ShipPhysicsParams = DEFAULT_SHIP_PHYSICS): string {
  const idleHeight = p.idleHoverHeight ?? 2.0;
  const cruiseHeight = p.cruiseHoverHeight ?? 0.9;
  const transSpeed = p.hoverTransitionSpeed ?? 4.0;
  const bobAmount = p.idleBobAmount ?? 0.08;
  const bobSpeed = p.idleBobSpeed ?? 2.0;
  const raycastLength = (idleHeight + 2.0).toFixed(1);

  const boostHeatRate = (p.boostHeatRate ?? 18.0).toFixed(1);
  const coolRate = (p.coolRate ?? 9.0).toFixed(1);
  const cooldownDelay = (p.cooldownDelay ?? 0.4).toFixed(2);
  const overheatThreshold = (p.overheatThreshold ?? 100.0).toFixed(1);
  const recoverThreshold = (p.recoverThreshold ?? 40.0).toFixed(1);

  const modelScale = (p.modelScale ?? 1.0).toFixed(2);
  const modelForwardOffsetDeg = (p.modelForwardOffsetDeg ?? 0.0).toFixed(1);
  const targetModelLength = (p.targetModelLength ?? 4.0).toFixed(1);
  const colX = (p.colliderSizeX ?? 2.0).toFixed(1);
  const colY = (p.colliderSizeY ?? 0.6).toFixed(1);
  const colZ = (p.colliderSizeZ ?? 3.6).toFixed(1);
  const autoFitCol = p.autoFitCollider ? 'true' : 'false';

  return `extends CharacterBody3D

## High Octane 0G - Gliding Ship Movement & Camera Tracking Controller
## Godot 4.x Compatible (CharacterBody3D Arcade Hover-Racer Physics)
## Independent Physics Body & Swappable 3D Mesh Architecture

signal heat_changed(current_heat: float, is_overheated: bool)

@export_group("Hover Lift & Suspension")
@export var idle_hover_height: float = ${idleHeight.toFixed(2)}
@export var cruise_hover_height: float = ${cruiseHeight.toFixed(2)}
@export var hover_transition_speed: float = ${transSpeed.toFixed(1)}
@export var idle_bob_amount: float = ${bobAmount.toFixed(3)}
@export var idle_bob_speed: float = ${bobSpeed.toFixed(1)}
@export var hover_force: float = ${p.hoverForce.toFixed(1)}
@export var hover_damping: float = ${p.hoverDamping.toFixed(1)}

@export_group("Thrusters & Speed")
@export var max_speed: float = ${p.maxSpeed.toFixed(1)}
@export var acceleration: float = ${p.acceleration.toFixed(1)}
@export var reverse_brake_force: float = ${p.brakingForce.toFixed(1)}
@export var drag: float = ${p.drag.toFixed(3)}
@export var boost_multiplier: float = ${p.boostMultiplier.toFixed(2)}
@export var boost_acceleration: float = ${p.boostAcceleration.toFixed(1)}

@export_group("Nitro Overheat System")
@export var boost_heat_rate: float = ${boostHeatRate}
@export var cool_rate: float = ${coolRate}
@export var cooldown_delay: float = ${cooldownDelay}
@export var overheat_threshold: float = ${overheatThreshold}
@export var recover_threshold: float = ${recoverThreshold}

@export_group("3D Visual Model & Swappable Mesh")
@export var model_scale: float = ${modelScale}
@export var model_forward_offset_deg: float = ${modelForwardOffsetDeg} # Rotation on Y axis (degrees)
@export var model_offset: Vector3 = Vector3.ZERO
@export var target_model_length: float = ${targetModelLength}
@export var collider_size: Vector3 = Vector3(${colX}, ${colY}, ${colZ})
@export var auto_fit_collider_to_model: bool = ${autoFitCol}

@export_group("Steering & Aerodynamics")
@export var steering_speed: float = ${p.steeringSpeed.toFixed(2)}
@export var lateral_grip: float = ${p.lateralGrip.toFixed(2)} # 0.0 = pure ice drift, 1.0 = locked rails
@export var max_roll_angle: float = ${p.maxRollAngle.toFixed(1)} # degrees of visual banking roll
@export var roll_speed: float = ${p.rollSpeed.toFixed(1)}
@export var pitch_tilt_angle: float = ${p.pitchTiltAngle.toFixed(1)} # degrees of nose pitch tilt

@export_group("Camera Settings")
@export var base_fov: float = ${p.baseFov.toFixed(1)}
@export var max_fov_boost: float = ${p.maxFovBoost.toFixed(1)}
@export var camera_lerp_weight: float = ${p.cameraLerpWeight.toFixed(1)}

# Node references (Physics is fully decoupled from the visual mesh!)
@onready var raycast: RayCast3D = $RayCast3D
@onready var ship_model: Node3D = $ShipModel
@onready var collision_shape: CollisionShape3D = $CollisionShape3D
@onready var camera: Camera3D = $Camera3D

# Internal velocity & rotation state
var current_turn_input: float = 0.0
var current_roll: float = 0.0
var current_pitch: float = 0.0
var is_grounded: bool = false

# Hover lift state
var current_speed_ratio: float = 0.0
var current_boost_ratio: float = 0.0
var bob_time: float = 0.0
var effective_hover_height: float = ${idleHeight.toFixed(2)}

# Nitro Overheat state
var heat: float = 0.0
var is_overheated: bool = false
var time_since_boost: float = 0.0

func _ready() -> void:
	if camera:
		camera.fov = base_fov
	if raycast:
		raycast.target_position = Vector3(0, -${raycastLength}, 0)
	apply_model_transform()
	heat_changed.emit(heat, is_overheated)

## Applies model scale and orientation offsets to the visual ShipModel pivot
func apply_model_transform() -> void:
	if not ship_model:
		return
	ship_model.position = model_offset
	ship_model.rotation.y = deg_to_rad(model_forward_offset_deg)
	ship_model.scale = Vector3.ONE * model_scale

## Swaps the 3D model with any imported GLB scene, auto-centers its AABB and normalizes length
func set_ship_model(new_model_scene: PackedScene) -> void:
	if not ship_model or not new_model_scene:
		return
	
	# Clear previous model instances safely
	for child in ship_model.get_children():
		child.queue_free()
	
	# Instantiate imported scene
	var instance = new_model_scene.instantiate()
	ship_model.add_child(instance)
	
	# Calculate combined AABB
	var combined_aabb := AABB()
	var has_aabb := false
	
	for child in instance.find_children("*", "VisualInstance3D"):
		if child is VisualInstance3D:
			var aabb = child.get_aabb()
			var child_trans = instance.global_transform.affine_inverse() * child.global_transform
			var transformed_aabb = child_trans * aabb
			if not has_aabb:
				combined_aabb = transformed_aabb
				has_aabb = true
			else:
				combined_aabb = combined_aabb.merge(transformed_aabb)
	
	if has_aabb:
		# Auto-center pivot: center horizontally, align bottom at Y = 0
		var center = combined_aabb.get_center()
		instance.position = Vector3(-center.x, -combined_aabb.position.y, -center.z)
		
		# Uniform scale normalization to target_model_length
		var length = combined_aabb.size.z
		if length > 0.05:
			var scale_factor = target_model_length / length
			instance.scale = Vector3.ONE * scale_factor
		
		# Optional auto-fit collider from model bounding box
		if auto_fit_collider_to_model and collision_shape:
			var box_shape = collision_shape.shape as BoxShape3D
			if not box_shape:
				box_shape = BoxShape3D.new()
				collision_shape.shape = box_shape
			box_shape.size = Vector3(combined_aabb.size.x, combined_aabb.size.y, target_model_length)

func _physics_process(delta: float) -> void:
	# 1. Gather player input (WASD / Arrows / Gamepad)
	var throttle := Input.get_axis("ui_down", "ui_up") # -1.0 reverse/brake, +1.0 forward
	var steer := Input.get_axis("ui_right", "ui_left")  # +1.0 turn left, -1.0 turn right
	var raw_boost_input := Input.is_action_pressed("boost") or Input.is_key_pressed(KEY_SHIFT)

	# 2. Nitro Overheat System Logic
	var is_boosting := raw_boost_input and throttle > 0.0 and not is_overheated

	if is_boosting:
		time_since_boost = 0.0
		heat = min(overheat_threshold, heat + boost_heat_rate * delta)
		if heat >= overheat_threshold:
			is_overheated = true
	else:
		time_since_boost += delta
		if time_since_boost >= cooldown_delay:
			heat = max(0.0, heat - cool_rate * delta)
			if is_overheated and heat <= recover_threshold:
				is_overheated = false

	heat_changed.emit(heat, is_overheated)

	# 3. Hover Lift Effect Calculation
	var horizontal_speed := Vector2(velocity.x, velocity.z).length()
	var target_speed_ratio := clamp(horizontal_speed / max_speed, 0.0, 1.0)
	
	# Smooth speed ratio so transition has aerodynamic inertia
	current_speed_ratio = lerp(current_speed_ratio, target_speed_ratio, clamp(hover_transition_speed * delta, 0.0, 1.0))
	
	# Boost drops hover height slightly lower
	var target_boost := 1.0 if is_boosting else 0.0
	current_boost_ratio = lerp(current_boost_ratio, target_boost, clamp(hover_transition_speed * delta, 0.0, 1.0))
	var boost_drop := current_boost_ratio * 0.15

	# Gentle idle bobbing sine wave when slowed or stopped (fades out at speed)
	bob_time += delta * idle_bob_speed
	var bob_factor := 1.0 - clamp(current_speed_ratio, 0.0, 1.0)
	var bob_offset := sin(bob_time * TAU) * idle_bob_amount * bob_factor

	# Target hover height smoothly transitions from idle (high) to cruise (low)
	var base_target_height := lerp(idle_hover_height, cruise_hover_height, current_speed_ratio)
	effective_hover_height = max(0.4, base_target_height - boost_drop + bob_offset)

	# 4. Hover Suspension: RayCast3D detection to track plane
	if raycast and raycast.is_colliding():
		is_grounded = true
		var hit_point = raycast.get_collision_point()
		var distance = global_position.distance_to(hit_point)
		var compression = effective_hover_height - distance
		
		# Spring force: F = k * x - c * v
		var spring_force = compression * hover_force
		var damping_force = velocity.y * hover_damping
		velocity.y += (spring_force - damping_force) * delta
	else:
		is_grounded = false
		# Apply gravity when airborne or over jumps
		velocity += get_gravity() * delta

	# 5. Steering & Yaw Rotation
	if is_grounded or velocity.length() > 3.0:
		current_turn_input = lerp(current_turn_input, steer * steering_speed, 10.0 * delta)
		rotate_y(current_turn_input * delta)

	# 6. Forward Thrusters & Air Braking
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

	# 7. Gliding Aerodynamics: Decoupled forward & lateral drift velocities
	var forward_vel = forward_dir * velocity.dot(forward_dir)
	var lateral_vel = right_dir * velocity.dot(right_dir)
	var vertical_vel = Vector3(0, velocity.y, 0)

	# Lateral friction dampens sideways sliding according to grip factor
	lateral_vel = lateral_vel * pow(1.0 - (1.0 - lateral_grip), delta * 60.0)
	
	# Aerodynamic forward air drag
	forward_vel *= pow(drag, delta * 60.0)

	velocity = forward_vel + lateral_vel + vertical_vel

	# 8. Apply Movement in Godot 4
	move_and_slide()

	# 9. Visual Roll Banking & Pitch Tilt applied ONLY to the ShipModel pivot
	var target_roll = -steer * deg_to_rad(max_roll_angle)
	var target_pitch = throttle * deg_to_rad(pitch_tilt_angle)
	current_roll = lerp(current_roll, target_roll, roll_speed * delta)
	current_pitch = lerp(current_pitch, target_pitch, roll_speed * delta)

	if ship_model:
		ship_model.rotation.z = current_roll
		ship_model.rotation.x = -current_pitch

	# 10. Dynamic Camera Tracking (Speed FOV expansion)
	if camera:
		var speed_ratio = clamp(velocity.length() / max_speed, 0.0, 1.8)
		var target_fov = base_fov + (speed_ratio * max_fov_boost)
		camera.fov = lerp(camera.fov, target_fov, camera_lerp_weight * delta)
`;
}

/**
 * Generates the canonical Godot 4 main.tscn scene file with decoupled ShipModel pivot node.
 */
export function generateMainTscn(p: ShipPhysicsParams = DEFAULT_SHIP_PHYSICS): string {
  const idleHeight = p.idleHoverHeight ?? 2.0;
  const raycastLength = (idleHeight + 2.0).toFixed(1);
  const colX = (p.colliderSizeX ?? 2.0).toFixed(1);
  const colY = (p.colliderSizeY ?? 0.6).toFixed(1);
  const colZ = (p.colliderSizeZ ?? 3.6).toFixed(1);

  return `[gd_scene load_steps=11 format=3 uid="uid://bq7xk4m8j2tq1"]

[ext_resource type="Script" path="res://ship.gd" id="1_ship_script"]

[sub_resource type="GDScript" id="GDScript_hud"]
script/source = "extends CanvasLayer

@onready var heat_bar: ProgressBar = $HeatBar
@onready var heat_label: Label = $HeatBar/HeatLabel
@onready var ship: CharacterBody3D = $\\"../Ship\\"

func _ready() -> void:
	if ship:
		ship.heat_changed.connect(_on_heat_changed)

func _on_heat_changed(current_heat: float, is_overheated: bool) -> void:
	if heat_bar:
		heat_bar.value = current_heat
	if heat_label:
		if is_overheated:
			heat_label.text = \\"ENGINE OVERHEATED (COOLING)\\"
			heat_label.modulate = Color(1.0, 0.2, 0.2, 1.0)
		else:
			heat_label.text = \\"NITRO HEAT: %d%%\\" % int(current_heat)
			heat_label.modulate = Color(0.2, 0.9, 1.0, 1.0)
"

[sub_resource type="StyleBoxFlat" id="StyleBoxFlat_heat_bg"]
bg_color = Color(0.05, 0.07, 0.11, 0.85)
corner_radius_top_left = 6
corner_radius_top_right = 6
corner_radius_bottom_right = 6
corner_radius_bottom_left = 6
border_width_left = 1
border_width_top = 1
border_width_right = 1
border_width_bottom = 1
border_color = Color(0.2, 0.3, 0.45, 0.6)

[sub_resource type="StyleBoxFlat" id="StyleBoxFlat_heat_fill"]
bg_color = Color(0.0, 0.85, 1.0, 1.0)
corner_radius_top_left = 4
corner_radius_top_right = 4
corner_radius_bottom_right = 4
corner_radius_bottom_left = 4

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
size = Vector3(${colX}, ${colY}, ${colZ})

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
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, ${idleHeight.toFixed(1)}, 0)
script = ExtResource("1_ship_script")

[node name="CollisionShape3D" type="CollisionShape3D" parent="Ship"]
shape = SubResource("BoxShape3D_ship")

[node name="RayCast3D" type="RayCast3D" parent="Ship"]
target_position = Vector3(0, -${raycastLength}, 0)

[node name="Camera3D" type="Camera3D" parent="Ship"]
transform = Transform3D(1, 0, 0, 0, 0.965926, 0.258819, 0, -0.258819, 0.965926, 0, ${p.cameraHeight.toFixed(1)}, ${p.cameraDistance.toFixed(1)})
current = true
fov = ${p.baseFov.toFixed(1)}

[node name="ShipModel" type="Node3D" parent="Ship"]

[node name="MeshInstance3D" type="MeshInstance3D" parent="Ship/ShipModel"]
mesh = SubResource("BoxMesh_ship")

[node name="HUD" type="CanvasLayer" parent="."]
script = SubResource("GDScript_hud")

[node name="HeatBar" type="ProgressBar" parent="HUD"]
anchors_preset = 7
anchor_left = 0.5
anchor_top = 1.0
anchor_right = 0.5
anchor_bottom = 1.0
offset_left = -150.0
offset_top = -54.0
offset_right = 150.0
offset_bottom = -34.0
grow_horizontal = 2
grow_vertical = 0
theme_override_styles/background = SubResource("StyleBoxFlat_heat_bg")
theme_override_styles/fill = SubResource("StyleBoxFlat_heat_fill")
max_value = 100.0
show_percentage = false

[node name="HeatLabel" type="Label" parent="HUD/HeatBar"]
layout_mode = 1
anchors_preset = 8
anchor_left = 0.5
anchor_top = 0.5
anchor_right = 0.5
anchor_bottom = 0.5
offset_left = -100.0
offset_top = -12.0
offset_right = 100.0
offset_bottom = 12.0
grow_horizontal = 2
grow_vertical = 2
text = "NITRO HEAT: 0%"
horizontal_alignment = 1
vertical_alignment = 1
`;
}

/**
 * Generates the project.godot configuration.
 */
export function generateProjectGodot(): string {
  return `; Engine configuration file.
; It's best edited using the editor UI and not directly,
; since the parameters that go here are not all obvious.
;
; Format:
;   [section] ; section goes between []
;   param=value ; assign values to parameters

config_version=5

[application]

config/name="High Octane 0G"
config/description="High Octane 0G - 3D Glider Racing prototype with hover physics, nitro overheat, and swappable GLB meshes"
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
}

/**
 * Generates the README for the Godot project.
 */
export function generateReadme(): string {
  return `# High Octane 0G - 3D Glider Racer Prototype for Godot 4.x

## Swappable 3D Model Architecture:
The physics body and visual mesh are completely separated:
- **Node Hierarchy**:
  \`Ship (CharacterBody3D)\`
  ├── \`CollisionShape3D\` (Fixed box collider)
  ├── \`RayCast3D\` (Ground hover sensor)
  ├── \`Camera3D\` (Ship-tracked third-person camera)
  └── \`ShipModel (Node3D)\` (Visual pivot for roll, pitch, and imported mesh)

### How to Import Any Custom 3D Model (.glb) into Godot:
1. Drop your \`.glb\` file into the Godot project filesystem.
2. In the scene tree, open \`main.tscn\` and select \`Ship/ShipModel\`.
3. Replace the placeholder \`MeshInstance3D\` with your imported \`.glb\` scene (or drag the .glb into \`ShipModel\`).
4. Alternatively, in your script call:
   \`$Ship.set_ship_model(preload("res://my_custom_ship.glb"))\`
   This automatically computes the AABB, centers the model at (X=0, Z=0), aligns the base at Y=0, and normalizes length to \`target_model_length\`.

## Nitro Overheat System:
- **Heat Generation**: Boosting with throttle generates engine heat (18.0 units/sec, ~5.5s of continuous nitro).
- **Cooldown**: Releasing nitro initiates cooldown after a 0.4s grace delay (9.0 units/sec).
- **Lockout & Recovery**: If heat reaches 100, the nitro engine locks out until heat cools down below 40. Normal driving continues unhindered.
- **HUD Bar**: Visible ProgressBar on the CanvasLayer displays live heat and overheat status.

## Hover Lift Effect:
- **Idle Hover**: When stopped, the ship floats high at 2.0m with an idle sine wave bob.
- **Cruise Hover**: Accelerating smoothly lowers target hover height to 0.9m close to the track.
- **Boost Dip**: Active boosting lowers the hover profile an extra ~0.15m.
- **Inertial Transitions**: Decelerating smoothly lifts the glider back to idle height without snapping.

## How to Run in Godot 4:
1. Open Godot Engine (version 4.2+ or 4.3+).
2. Click "Import" and select this folder (or click "Scan").
3. Godot will recognize the project and open the editor.
4. Press F5 (or click the Play icon in top right) to launch main.tscn.

## Controls:
- W / Up Arrow: Forward Thrusters
- S / Down Arrow: Air Brake / Reverse
- A / Left Arrow: Turn Left (Rolls into turn)
- D / Right Arrow: Turn Right (Rolls into turn)
- Space / Shift: Nitro Boost (subject to overheat)
`;
}
