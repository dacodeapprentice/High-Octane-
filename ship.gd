extends CharacterBody3D

## High-Octane Gliding Ship Movement & Camera Tracking Controller
## Godot 4.x Compatible

@export_group("Hover & Suspension")
@export var hover_height: float = 1.3
@export var hover_force: float = 48.0
@export var hover_damping: float = 6.5

@export_group("Thrusters & Speed")
@export var max_speed: float = 70.0
@export var acceleration: float = 48.0
@export var reverse_brake_force: float = 35.0
@export var drag: float = 0.988
@export var boost_multiplier: float = 1.55
@export var boost_acceleration: float = 85.0

@export_group("Steering & Aerodynamics")
@export var steering_speed: float = 2.6
@export var lateral_grip: float = 0.86 # 0.0 = zero friction drift, 1.0 = sharp rails
@export var max_roll_angle: float = 30.0 # visual banking degrees on turns
@export var roll_speed: float = 7.0
@export var pitch_tilt_angle: float = 10.0 # nose dip on brake, rise on accel

@export_group("Camera Settings")
@export var base_fov: float = 75.0
@export var max_fov_boost: float = 16.0
@export var camera_lerp_weight: float = 8.0

# Node references
@onready var raycast: RayCast3D = $RayCast3D
@onready var mesh: MeshInstance3D = $MeshInstance3D
@onready var camera: Camera3D = $Camera3D

# Internal tracking
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

	# 2. Hover Suspension Raycast calculation
	if raycast and raycast.is_colliding():
		is_grounded = true
		var hit_point = raycast.get_collision_point()
		var distance = global_position.distance_to(hit_point)
		var compression = hover_height - distance
		
		# Spring: F = k * x, Damper: F = -c * v
		var spring_force = compression * hover_force
		var damping_force = velocity.y * hover_damping
		velocity.y += (spring_force - damping_force) * delta
	else:
		is_grounded = false
		# Apply gravity when airborne
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

	# 5. Gliding Physics: Split Forward & Sideways Velocity for Arcade Drift
	var forward_vel = forward_dir * velocity.dot(forward_dir)
	var lateral_vel = right_dir * velocity.dot(right_dir)
	var vertical_vel = Vector3(0, velocity.y, 0)

	# Lateral friction dampens sideways sliding according to grip factor
	lateral_vel = lateral_vel * pow(1.0 - (1.0 - lateral_grip), delta * 60.0)
	
	# Aerodynamic forward air resistance
	forward_vel *= pow(drag, delta * 60.0)

	velocity = forward_vel + lateral_vel + vertical_vel

	# 6. Apply Movement to Godot physics engine
	move_and_slide()

	# 7. Visual Roll Banking & Pitch Tilt
	var target_roll = -steer * deg_to_rad(max_roll_angle)
	var target_pitch = throttle * deg_to_rad(pitch_tilt_angle)
	current_roll = lerp(current_roll, target_roll, roll_speed * delta)
	current_pitch = lerp(current_pitch, target_pitch, roll_speed * delta)

	if mesh:
		mesh.rotation.z = current_roll
		mesh.rotation.x = -current_pitch

	# 8. Dynamic Camera Tracking (FOV stretch at speed)
	if camera:
		var speed_ratio = clamp(velocity.length() / max_speed, 0.0, 1.8)
		var target_fov = base_fov + (speed_ratio * max_fov_boost)
		camera.fov = lerp(camera.fov, target_fov, camera_lerp_weight * delta)
