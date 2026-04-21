import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { LightProbeGrid } from 'three/addons/lighting/LightProbeGrid.js';
import { LightProbeGridHelper } from 'three/addons/helpers/LightProbeGridHelper.js';
import { createWorldSettings, createWorld, addBroadphaseLayer, addObjectLayer, enableCollision, registerAll, updateWorld, rigidBody, box, MotionType } from 'crashcat';
import { Vehicle, MAX_SPEED } from './Vehicle.js';
import { Camera } from './Camera.js';
import { Controls } from './Controls.js';
import { buildTrack, decodeCells, computeSpawnPosition, computeTrackBounds } from './Track.js';
import { buildWallColliders, createSphereBody } from './Physics.js';
import { SmokeTrails } from './Particles.js';
import { DriftMarks } from './DriftMarks.js';
import { GameAudio } from './Audio.js';


const renderer = new THREE.WebGLRenderer( { antialias: true, outputBufferType: THREE.HalfFloatType } );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setPixelRatio( window.devicePixelRatio );
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ) );
bloomPass.strength = 0.02;
bloomPass.radius = 0.02;
bloomPass.threshold = 0.5;

renderer.setEffects( [ bloomPass ] );

document.body.appendChild( renderer.domElement );

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0xadb2ba );
scene.fog = new THREE.Fog( 0xadb2ba, 30, 55 );

const dirLight = new THREE.DirectionalLight( 0xffffff, 3 );
dirLight.position.set( 11.4, 15, -5.3 );
dirLight.castShadow = true;
dirLight.shadow.mapSize.setScalar( 4096 );
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 60;
dirLight.shadow.radius = 4;
scene.add( dirLight );

const hemiLight = new THREE.HemisphereLight( 0xc8d8e8, 0x7a8a5a, 2 );
hemiLight.position.copy( dirLight.position )
scene.add( hemiLight );


window.addEventListener( 'resize', () => {

	renderer.setSize( window.innerWidth, window.innerHeight );

} );

const loader = new GLTFLoader();
const modelNames = [
	'vehicle-truck-yellow', 'vehicle-truck-green', 'vehicle-truck-purple', 'vehicle-truck-red',
	'track-straight', 'track-corner', 'track-bump', 'track-finish',
	'decoration-empty', 'decoration-forest', 'decoration-tents',
];

const extraVehicles = [
	{
		file: 'toyota_land_cruiser_j79_pickup', name: 'Land Cruiser J79', scale: 0.85,
		materialOverrides: {
			'carpaint': { color: 0x2e5339 },
			'carpaint_second': { color: 0x1f3a28 },
			'black_gloss': { color: 0x111111 },
			'black': { color: 0x0a0a0a },
			'chrome': { color: 0xcccccc },
			'clearglass': { color: 0xc8dce8 },
			'windowglass': { color: 0x4f657b },
			'redglass': { color: 0x991111 },
			'orangeglass': { color: 0xcc6611 },
			'white': { color: 0xeeeeee },
			'Gravel_Tyre_Wall': { color: 0x222222 },
			'Gravel_Tyre_Tread': { color: 0x1a1a1a },
			'Gravel_Tyre_Wall2': { color: 0x222222 },
			'Gravel_Tyre_Tread2': { color: 0x1a1a1a },
			'rim_blur': { color: 0x999999 },
			'brakedisk': { color: 0x555555 },
			'metal_int': { color: 0x888888 },
			'plastic_int': { color: 0x333333 },
			'material': { color: 0x444444 },
			'material_22': { color: 0x333333 },
			'red_toyota': { color: 0xcc2222 },
		}
	},
	{ file: '2024_toyota_land_cruiser_lc300_vxr_409_tt', name: 'Land Cruiser LC300', scale: 1.1 },
	{
		file: 'toyota_camry_2020', name: 'Toyota Camry', scale: 0.85,
		materialOverrides: {
			'Paint_Color': { color: 0x9c8e74 },
			'Index_0_2': { color: 0x4f657b },
			'Index_0_2_SS': { color: 0x4f657b },
		}
	},
	{
		file: '2007_nissan_altima_2.5_se', name: 'Altima 2007', scale: 0.45,
		materialOverrides: {
			'skin': { color: 0x1a3a5c },
			'windows': { color: 0x4f657b },
			'windows_inside': { color: 0x3a4f63 },
			'black_glass': { color: 0x1a1a1a },
			'black': { color: 0x111111 },
			'chrome': { color: 0xcccccc },
			'tire': { color: 0x1a1a1a },
			'wheel': { color: 0x999999 },
			'brake': { color: 0x555555 },
			'grill': { color: 0x222222 },
			'lights': { color: 0xdddddd },
			'chassis': { color: 0x333333 },
		}
	},
	{
		file: '2013_nissan_gt-r_black_edition_coupe', name: 'GT-R Black Edition', scale: 0.45,
		materialOverrides: {
			'CarPaint': { color: 0x111111 },
			'window': { color: 0x3a4f63 },
			'light_glass': { color: 0xcccccc },
			'red_glass': { color: 0x991111 },
			'tire': { color: 0x1a1a1a },
			'rubber': { color: 0x1a1a1a },
			'chrome': { color: 0xcccccc },
			'metal': { color: 0x888888 },
			'plastic': { color: 0x222222 },
			'chassis': { color: 0x222222 },
			'glass_surr': { color: 0x111111 },
			'calipers': { color: 0xcc2222 },
			'plate': { color: 0xeeeeee },
		}
	},
	{
		file: 'nissan_altima_17', name: 'Altima 2017', scale: 0.45,
		materialOverrides: {
			'carpaint': { color: 0x8b1a1a },
			'windowglass': { color: 0x4f657b },
			'clearglass': { color: 0xc8dce8 },
			'clearglass.001': { color: 0xc8dce8 },
			'black': { color: 0x111111 },
			'chrome': { color: 0xcccccc },
			'TIRE': { color: 0x1a1a1a },
			'wheel.0': { color: 0x999999 },
			'wheel.1': { color: 0x777777 },
			'wheel.2': { color: 0x888888 },
			'redglass': { color: 0x991111 },
			'orangeglass': { color: 0xcc6611 },
			'lens': { color: 0xdddddd },
			'interior': { color: 0x333333 },
			'mattemetal': { color: 0x666666 },
		}
	},
];

const allVehicleKeys = [
	'vehicle-truck-yellow', 'vehicle-truck-green', 'vehicle-truck-purple', 'vehicle-truck-red',
	...extraVehicles.map( v => v.file ),
];

const vehicleLabels = {
	'vehicle-truck-yellow': 'Truck (Yellow)',
	'vehicle-truck-green': 'Truck (Green)',
	'vehicle-truck-purple': 'Truck (Purple)',
	'vehicle-truck-red': 'Truck (Red)',
};

for ( const v of extraVehicles ) vehicleLabels[ v.file ] = v.name;

const models = {};

async function loadModels() {

	const promises = modelNames.map( ( name ) =>
		new Promise( ( resolve, reject ) => {

			loader.load( `models/${ name }.glb`, ( gltf ) => {

				const meshes = [];
				gltf.scene.traverse( ( child ) => {

					if ( child.isMesh ) {

						child.material.side = THREE.FrontSide;
						meshes.push( child );

					}

				} );

				if ( name.startsWith( 'vehicle-' ) ) {

					gltf.scene.scale.setScalar( 0.5 );

				}

				if ( meshes.length === 1 ) {

					const mesh = meshes[ 0 ];
					mesh.removeFromParent();
					models[ name ] = mesh;

				} else {

					models[ name ] = gltf.scene;

				}

				resolve();

			}, undefined, reject );

		} )
	);

	const extraPromises = extraVehicles.map( ( entry ) =>
		new Promise( ( resolve, reject ) => {

			loader.load( `models/${ entry.file }.glb`, ( gltf ) => {

				const root = gltf.scene;

				const bbox = new THREE.Box3().setFromObject( root );
				const size = new THREE.Vector3();
				bbox.getSize( size );

				const targetHeight = 1.4;
				const uniformScale = ( targetHeight / size.y ) * entry.scale;
				root.scale.setScalar( uniformScale );

				bbox.setFromObject( root );
				const center = new THREE.Vector3();
				bbox.getCenter( center );

				const wrapper = new THREE.Group();
				wrapper.position.set( - center.x, - bbox.min.y, - center.z );
				wrapper.add( root );

				const overrides = entry.materialOverrides || {};
				const clonedMats = {};

				root.traverse( ( child ) => {

					if ( child.isMesh ) {

						child.material.side = THREE.FrontSide;
						child.castShadow = true;
						child.receiveShadow = true;

						const matName = child.material.name;
						const ov = overrides[ matName ];
						if ( ov ) {

							if ( ! clonedMats[ matName ] ) {

								const mat = child.material.clone();
								mat.color.setHex( ov.color );
								mat.needsUpdate = true;
								clonedMats[ matName ] = mat;

							}

							child.material = clonedMats[ matName ];

						}

					}

				} );

				const outerGroup = new THREE.Group();
				outerGroup.add( wrapper );
				models[ entry.file ] = outerGroup;

				resolve();

			}, undefined, reject );

		} )
	);

	await Promise.all( [ ...promises, ...extraPromises ] );

}

function getSelectedVehicle() {

	const params = new URLSearchParams( window.location.search );
	return params.get( 'vehicle' ) || 'vehicle-truck-yellow';

}

function buildVehiclePicker() {

	const selected = getSelectedVehicle();
	const select = document.getElementById( 'vehicle-select' );
	if ( ! select ) return;

	for ( const key of allVehicleKeys ) {

		const opt = document.createElement( 'option' );
		opt.value = key;
		opt.textContent = vehicleLabels[ key ] || key;
		if ( key === selected ) opt.selected = true;
		select.appendChild( opt );

	}

	select.addEventListener( 'change', () => {

		const params = new URLSearchParams( window.location.search );
		params.set( 'vehicle', select.value );
		window.location.search = params.toString();

	} );

}

async function init() {

	buildVehiclePicker();

	registerAll();
	await loadModels();

	const mapParam = new URLSearchParams( window.location.search ).get( 'map' );
	let customCells = null;
	let spawn = null;

	if ( mapParam ) {

		try {

			customCells = decodeCells( mapParam );
			spawn = computeSpawnPosition( customCells );

		} catch ( e ) {

			console.warn( 'Invalid map parameter, using default track' );

		}

	}

	// Compute track bounds and size physics/shadows to fit
	const bounds = computeTrackBounds( customCells );
	const hw = bounds.halfWidth;
	const hd = bounds.halfDepth;
	const groundSize = Math.max( hw, hd ) * 2 + 20;

	const shadowExtent = Math.max( hw, hd ) + 10;
	dirLight.shadow.camera.left = - shadowExtent;
	dirLight.shadow.camera.right = shadowExtent;
	dirLight.shadow.camera.top = shadowExtent;
	dirLight.shadow.camera.bottom = - shadowExtent;
	dirLight.shadow.camera.updateProjectionMatrix();

	scene.fog.near = groundSize * 0.4;
	scene.fog.far = groundSize * 0.8;

	buildTrack( scene, models, customCells );

	// Probes

	const probeHeight = 6;
	const probes = new LightProbeGrid(
		hw * 2, probeHeight, hd * 2,
		Math.max( 4, Math.round( hw / 4 ) ),
		2,
		Math.max( 4, Math.round( hd / 4 ) ),
	);
	probes.position.set( bounds.centerX, probeHeight / 2, bounds.centerZ );
	probes.bake( renderer, scene, { cubemapSize: 32, near: 0.1, far: groundSize } );
	scene.add( probes );

	// scene.add( new LightProbeGridHelper( probes, 0.5 ) );

	//

	const worldSettings = createWorldSettings();
	worldSettings.gravity = [ 0, - 9.81, 0 ];

	const BPL_MOVING = addBroadphaseLayer( worldSettings );
	const BPL_STATIC = addBroadphaseLayer( worldSettings );
	const OL_MOVING = addObjectLayer( worldSettings, BPL_MOVING );
	const OL_STATIC = addObjectLayer( worldSettings, BPL_STATIC );

	enableCollision( worldSettings, OL_MOVING, OL_STATIC );
	enableCollision( worldSettings, OL_MOVING, OL_MOVING );

	const world = createWorld( worldSettings );
	world._OL_MOVING = OL_MOVING;
	world._OL_STATIC = OL_STATIC;

	buildWallColliders( world, null, customCells );

	const roadHalf = groundSize / 2;
	rigidBody.create( world, {
		shape: box.create( { halfExtents: [ roadHalf, 0.01, roadHalf ] } ),
		motionType: MotionType.STATIC,
		objectLayer: OL_STATIC,
		position: [ bounds.centerX, - 0.125, bounds.centerZ ],
		friction: 5.0,
		restitution: 0.0,
	} );

	const sphereBody = createSphereBody( world, spawn ? spawn.position : null );

	const vehicle = new Vehicle();
	vehicle.rigidBody = sphereBody;
	vehicle.physicsWorld = world;

	if ( spawn ) {

		const [ sx, sy, sz ] = spawn.position;
		vehicle.spherePos.set( sx, sy, sz );
		vehicle.prevModelPos.set( sx, 0, sz );
		vehicle.container.rotation.y = spawn.angle;

	}

	const selectedKey = getSelectedVehicle();
	const vehicleGroup = vehicle.init( models[ selectedKey ] || models[ 'vehicle-truck-yellow' ] );
	scene.add( vehicleGroup );

	dirLight.target = vehicleGroup;

	const cam = new Camera();
	cam.targetPosition.copy( vehicle.spherePos );

	const controls = new Controls();

	const particles = new SmokeTrails( scene );
	const driftMarks = new DriftMarks( scene );

	const audio = new GameAudio();
	audio.init( cam.camera );

	const _forward = new THREE.Vector3();

	const contactListener = {
		onContactAdded( bodyA, bodyB ) {

			if ( bodyA !== sphereBody && bodyB !== sphereBody ) return;

			_forward.set( 0, 0, 1 ).applyQuaternion( vehicle.container.quaternion );
			_forward.y = 0;
			_forward.normalize();

			const impactVelocity = Math.abs( vehicle.modelVelocity.dot( _forward ) );
			audio.playImpact( impactVelocity );

		}
	};

	const timer = new THREE.Timer();

	function animate() {

		requestAnimationFrame( animate );

		timer.update();
		const dt = Math.min( timer.getDelta(), 1 / 30 );

		const input = controls.update();

		updateWorld( world, contactListener, dt );

		vehicle.update( dt, input );

		dirLight.position.set(
			vehicle.spherePos.x + 11.4,
			15,
			vehicle.spherePos.z - 5.3
		);

		cam.update( dt, vehicle.spherePos );
		particles.update( dt, vehicle );
		driftMarks.update( dt, vehicle );
		audio.update( dt, vehicle.linearSpeed / MAX_SPEED, input.z, vehicle.driftIntensity );

		renderer.render( scene, cam.camera );

	}

	animate();

}

init();
