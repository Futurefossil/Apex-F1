export type TireCompoundId = 'medium' | 'soft' | 'hard' | 'inter';

export type LightingPresetId = 'darkSpotlight' | 'nightPit' | 'studioWhite';

export type CameraPresetId = 'hero' | 'front' | 'side' | 'cockpit' | 'rear' | 'top';

export type SpeedModeId = 'static' | 'pit' | 'track';

export interface TireCompound {
  id: TireCompoundId;
  label: string;
  code: string;
  stripeHex: string;
  grooved: boolean;
}

export interface CameraPreset {
  id: CameraPresetId;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
}

export interface PartMetadata {
  key: string;
  title: string;
  category: string;
  spec: string;
  detail: string;
  focusCenter: [number, number, number];
  sideColumn: 'left' | 'right';
}

export const TIRE_COMPOUNDS: TireCompound[] = [
  { id: 'medium', label: 'Yellow (Med)', code: 'C3', stripeHex: '#f5c518', grooved: false },
  { id: 'soft', label: 'Red (Soft)', code: 'C5', stripeHex: '#e10600', grooved: false },
  { id: 'hard', label: 'White (Hard)', code: 'C1', stripeHex: '#f1f5f9', grooved: false },
  { id: 'inter', label: 'Green (Inter)', code: 'INT', stripeHex: '#22c55e', grooved: true },
];

export const CAMERA_PRESETS: CameraPreset[] = [
  { id: 'hero', label: '3/4 Front', position: [-3.75, 1.25, 3.85], target: [0, 0.38, 0.05] },
  { id: 'side', label: 'Side Profile', position: [5.45, 0.62, 0.0], target: [0, 0.38, -0.02] },
  { id: 'front', label: 'Front Elevated', position: [0.0, 2.05, 4.45], target: [0, 0.32, 0.45] },
  { id: 'rear', label: '3/4 Rear', position: [-3.15, 1.38, -3.55], target: [0, 0.36, -0.35] },
  { id: 'cockpit', label: 'Cockpit & Halo', position: [0.95, 1.32, 1.15], target: [0, 0.56, 0.14] },
  { id: 'top', label: 'Top Overhead', position: [0.01, 5.95, -0.05], target: [0, 0.25, 0] },
];

export const PART_CATALOG: Record<string, PartMetadata> = {
  frontWing: {
    key: 'frontWing',
    title: 'Front Wing Cascade',
    category: 'Aerodynamics',
    spec: 'V-Swept Mainplane · 4-Element Carbon',
    detail: 'Twill carbon multi-element front wing with TeamViewer, INEOS & Petronas Syntium planes and Microsoft outwash endplates.',
    focusCenter: [0, 0.18, 2.48],
    sideColumn: 'left',
  },
  noseCone: {
    key: 'noseCone',
    title: 'Silver & Carbon Nose Cone',
    category: 'Impact Structure',
    spec: 'Brushed Silver Deck · #63 · Pitot Mast',
    detail: 'Metallic silver nose cone with Petronas teal pinstripes, #63 badge, INEOS/Crowdstrike graphics, and central Pitot mast.',
    focusCenter: [0, 0.28, 1.85],
    sideColumn: 'left',
  },
  frontSuspension: {
    key: 'frontSuspension',
    title: 'Front Double-Wishbone Suspension',
    category: 'Front Kinematics',
    spec: 'Carbon Aero A-Arms · Pushrod & Track Rod',
    detail: 'Exposed structural carbon wishbones and titanium track rods linking the bulkhead to the front brake hubs.',
    focusCenter: [0, 0.36, 1.72],
    sideColumn: 'left',
  },
  brakes: {
    key: 'brakes',
    title: 'Carbon-Ceramic Brakes & Ducts',
    category: 'Braking System',
    spec: '328mm Cross-Drilled Rotor · 6-Piston Caliper',
    detail: 'Ventilated carbon brake discs paired with 6-piston calipers and sculpted carbon-fiber cooling ducts.',
    focusCenter: [0.75, 0.36, 1.72],
    sideColumn: 'left',
  },
  wheels: {
    key: 'wheels',
    title: '18-Inch Forged Wheels & Pirelli P-Zero',
    category: 'Tires & Wheel Deflectors',
    spec: '7-Spoke Forged Hub · Carbon Aero Ring',
    detail: 'Deep 7-spoke forged black wheels inside a woven carbon aero shroud, green/red center lock, and Pirelli P-Zero rubber.',
    focusCenter: [0.85, 0.36, 1.72],
    sideColumn: 'left',
  },
  halo: {
    key: 'halo',
    title: 'Carbon Halo & LED Mirrors',
    category: 'Cockpit Safety',
    spec: 'Grade-5 Ti Core · Teal-Capped Mirrors',
    detail: 'Carbon-faired Halo with Petronas teal stripe & Crowdstrike graphic, paired with amber-LED telemetry wing mirrors.',
    focusCenter: [0, 0.76, 0.18],
    sideColumn: 'left',
  },
  monocoque: {
    key: 'monocoque',
    title: 'Monocoque, Cockpit & Driver',
    category: 'Survival Cell',
    spec: 'Honeycomb CFRP · Petronas Helmet',
    detail: 'Carbon survival cell housing the butterfly telemetry wheel, Petronas teal driver helmet, and G42/Crowdstrike headrest.',
    focusCenter: [0, 0.48, 0.20],
    sideColumn: 'left',
  },
  sidepods: {
    key: 'sidepods',
    title: 'Petronas Sidepods & Radiators',
    category: 'Cooling & Aero',
    spec: 'Silver Shoulder Louvers · Signify Vanes',
    detail: 'Sculpted silver-and-black sidepods with sweeping Petronas teal wave, Signify multi-tier floor fences, and internal radiators.',
    focusCenter: [0, 0.40, -0.35],
    sideColumn: 'right',
  },
  engineCover: {
    key: 'engineCover',
    title: 'Airbox, T-Cam & Star Cowling',
    category: 'Upper Cowling',
    spec: 'Teal Roll-Hoop · Star Mosaic · #63 Fin',
    detail: 'Petronas-teal framed airbox intake, broadcast T-Cam, Microsoft/Solera cowling, and Mercedes star-mosaic #63 dorsal fin.',
    focusCenter: [0, 0.80, -0.82],
    sideColumn: 'right',
  },
  powerUnit: {
    key: 'powerUnit',
    title: '1.6L V6 Turbo-Hybrid Power Unit',
    category: 'Powertrain & ERS',
    spec: 'V6 ICE · Turbo · MGU-H/K · 8-Spd Gearbox',
    detail: '90° V6 engine with Inconel exhaust headers, central turbo, gold-shielded Energy Store battery, and carbon gearbox.',
    focusCenter: [0, 0.36, -1.05],
    sideColumn: 'right',
  },
  floor: {
    key: 'floor',
    title: 'Ground-Effect Venturi Floor',
    category: 'Underbody Downforce',
    spec: 'Twin Venturi Tunnels · Multi-Strake Diffuser',
    detail: 'Full twill carbon Venturi underfloor with front tunnel fences, upturned edge wing, and rear diffuser exit strakes.',
    focusCenter: [0, 0.10, -0.55],
    sideColumn: 'right',
  },
  rearSuspension: {
    key: 'rearSuspension',
    title: 'Rear Suspension & Driveshafts',
    category: 'Rear Kinematics',
    spec: 'Gearbox-Mounted Wishbones · Driveshafts',
    detail: 'High-clearance rear carbon suspension arms and titanium driveshafts routing power from the gearbox to rear hubs.',
    focusCenter: [0, 0.36, -1.78],
    sideColumn: 'right',
  },
  rearWing: {
    key: 'rearWing',
    title: 'Rear Wing, DRS & Endplate LEDs',
    category: 'Drag Reduction',
    spec: 'Petronas / Crowdstrike Flap · Twin Swan-Neck',
    detail: 'Swan-neck carbon rear wing with Petronas DRS flap, Snapdragon endplates, beam wing, and vertical red LED strips.',
    focusCenter: [0, 0.78, -2.02],
    sideColumn: 'right',
  },
  exhaust: {
    key: 'exhaust',
    title: 'Tailpipe & Rear Crash Rain Light',
    category: 'Exhaust & Safety',
    spec: 'Inconel Tailpipe · Ring LED Rain Light',
    detail: 'Brushed Inconel central exhaust pipe nested above the FIA rear impact structure and illuminated LED rain light ring.',
    focusCenter: [0, 0.32, -2.05],
    sideColumn: 'right',
  },
};

export const PART_LIST = Object.values(PART_CATALOG);
