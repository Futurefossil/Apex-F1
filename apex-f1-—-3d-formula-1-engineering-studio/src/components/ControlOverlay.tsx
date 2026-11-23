import React, { useMemo, useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Disc,
  Layers,
  RotateCcw,
  ScanLine,
  Sliders,
  Volume2,
  VolumeX,
  Wind,
  X,
} from 'lucide-react';
import {
  CAMERA_PRESETS,
  CameraPresetId,
  LightingPresetId,
  PART_CATALOG,
  PART_LIST,
  SpeedModeId,
  TIRE_COMPOUNDS,
  TireCompoundId,
} from '../f1/types';

export interface ControlOverlayProps {
  tireCompoundId: TireCompoundId;
  onSelectTireCompound: (id: TireCompoundId) => void;
  lightingId: LightingPresetId;
  onSelectLighting: (id: LightingPresetId) => void;
  activeCameraId: CameraPresetId;
  onSelectCamera: (id: CameraPresetId) => void;
  exploded: boolean;
  onToggleExploded: () => void;
  drsOpen: boolean;
  onToggleDrs: () => void;
  windTunnel: boolean;
  onToggleWindTunnel: () => void;
  speedMode: SpeedModeId;
  onSelectSpeedMode: (mode: SpeedModeId) => void;
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  isRevealing: boolean;
  onReplayReveal: () => void;
  selectedPartKey: string | null;
  hoveredPartKey: string | null;
  onHoverPart: (key: string | null) => void;
  onClearPart: () => void;
  onResetAll: () => void;
  dockCollapsed: boolean;
  onToggleDock: () => void;
}

type DockTab = 'aero' | 'tires' | 'camera';

const LIGHTING_OPTIONS: { id: LightingPresetId; label: string }[] = [
  { id: 'darkSpotlight', label: 'Spotlight Studio' },
  { id: 'nightPit', label: 'Night Pit' },
  { id: 'studioWhite', label: 'White Studio' },
];

const SPEED_OPTIONS: { id: SpeedModeId; label: string }[] = [
  { id: 'static', label: 'Static' },
  { id: 'pit', label: 'Pit Roll' },
  { id: 'track', label: '320 km/h' },
];

export const ControlOverlay: React.FC<ControlOverlayProps> = ({
  tireCompoundId,
  onSelectTireCompound,
  lightingId,
  onSelectLighting,
  activeCameraId,
  onSelectCamera,
  exploded,
  onToggleExploded,
  drsOpen,
  onToggleDrs,
  windTunnel,
  onToggleWindTunnel,
  speedMode,
  onSelectSpeedMode,
  autoRotate,
  onToggleAutoRotate,
  audioEnabled,
  onToggleAudio,
  isRevealing,
  onReplayReveal,
  selectedPartKey,
  hoveredPartKey,
  onHoverPart,
  onClearPart,
  onResetAll,
  dockCollapsed,
  onToggleDock,
}) => {
  const [activeTab, setActiveTab] = useState<DockTab>('aero');

  const currentCompound =
    TIRE_COMPOUNDS.find((t) => t.id === tireCompoundId) || TIRE_COMPOUNDS[0];

  const activePartKey = exploded ? hoveredPartKey : (hoveredPartKey ?? selectedPartKey);
  const activePart = activePartKey ? PART_CATALOG[activePartKey] : null;
  const isLight = lightingId === 'studioWhite';

  const leftParts = useMemo(() => PART_LIST.filter((p) => p.sideColumn === 'left'), []);
  const rightParts = useMemo(() => PART_LIST.filter((p) => p.sideColumn === 'right'), []);

  return (
    <>
      {/* Minimal Top-Left Header: Unboxed typography with adaptive contrast */}
      <header className="pointer-events-none fixed top-5 left-6 z-10 max-w-md">
        <div className="flex items-baseline gap-3">
          <h1
            className={`font-display text-3xl font-bold tracking-tight leading-none transition-colors ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}
          >
            Apex F1
          </h1>
          <span
            className={`font-mono-tech text-xs font-semibold tracking-wider transition-colors ${
              isLight ? 'text-teal-700' : 'text-teal-300'
            }`}
          >
            W17 · #63
          </span>
        </div>
        <div
          className={`mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs transition-colors ${
            isLight ? 'text-slate-600' : 'text-slate-300'
          }`}
        >
          <span>Mercedes-AMG PETRONAS</span>
          <span aria-hidden="true">·</span>
          <span>1.6L V6 Turbo-Hybrid</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tech">
            {currentCompound.code} {currentCompound.label}
          </span>
        </div>
      </header>

      {/* Right-Side Component Specification Callout (never obscures center 3D car) */}
      {!dockCollapsed && activePart && (
        <aside
          aria-live="polite"
          className="fixed top-5 right-5 z-10 w-68 sm:w-76 rounded-xl border border-white/15 bg-[#0f131a]/92 px-4 py-3 shadow-2xl"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono-tech text-[10px] font-semibold uppercase tracking-widest text-teal-300">
              {activePart.category}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap">
                {exploded ? 'Hover Focus' : selectedPartKey === activePart.key ? 'Locked' : 'Hovered'}
              </span>
              {!exploded && selectedPartKey && (
                <button
                  type="button"
                  onClick={onClearPart}
                  title="Clear Focus (Esc)"
                  className="flex items-center gap-1 rounded border border-white/15 bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-white/20 cursor-pointer"
                >
                  <X className="h-2.5 w-2.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>
          <h2 className="mt-1 font-display text-xl font-semibold tracking-wide text-white leading-tight">
            {activePart.title}
          </h2>
          <p className="mt-1 font-mono-tech text-[11px] text-teal-200/95">
            {activePart.spec}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">
            {activePart.detail}
          </p>
        </aside>
      )}

      {/* Side Component Lists in Exploded View (Left & Right Margins) */}
      {exploded && !dockCollapsed && (
        <>
          {/* Left Side Systems */}
          <nav
            aria-label="Front and Cockpit Components"
            className="hidden lg:flex fixed left-5 top-24 z-10 w-58 flex-col gap-1"
          >
            <div className="mb-1 px-2 font-mono-tech text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Front &amp; Cockpit Systems
            </div>
            {leftParts.map((part) => {
              const isFocused = activePartKey === part.key;
              return (
                <button
                  key={part.key}
                  type="button"
                  onMouseEnter={() => onHoverPart(part.key)}
                  onMouseLeave={() => onHoverPart(null)}
                  onFocus={() => onHoverPart(part.key)}
                  onBlur={() => onHoverPart(null)}
                  className={`group flex flex-col items-start rounded-lg border-l-2 px-3 py-1.5 text-left transition-colors cursor-pointer ${
                    isFocused
                      ? 'border-teal-400 bg-[#0f131a]/95 text-white shadow-lg'
                      : 'border-white/15 bg-[#0f131a]/75 text-slate-300 hover:border-teal-300/70 hover:bg-[#0f131a]/90 hover:text-white'
                  }`}
                >
                  <span className="text-xs font-semibold leading-snug whitespace-nowrap truncate w-full">
                    {part.title}
                  </span>
                  <span
                    className={`font-mono-tech text-[10px] truncate w-full ${
                      isFocused ? 'text-teal-300' : 'text-slate-400'
                    }`}
                  >
                    {part.category}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Right Side Systems (placed cleanly below top-right active readout or aligned top-right) */}
          <nav
            aria-label="Aero, Powertrain and Rear Components"
            className="hidden lg:flex fixed right-5 bottom-40 z-10 w-60 flex-col gap-1"
          >
            <div className="mb-1 px-2 text-right font-mono-tech text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Aero, Power &amp; Rear Systems
            </div>
            {rightParts.map((part) => {
              const isFocused = activePartKey === part.key;
              return (
                <button
                  key={part.key}
                  type="button"
                  onMouseEnter={() => onHoverPart(part.key)}
                  onMouseLeave={() => onHoverPart(null)}
                  onFocus={() => onHoverPart(part.key)}
                  onBlur={() => onHoverPart(null)}
                  className={`group flex flex-col items-end rounded-lg border-r-2 px-3 py-1.5 text-right transition-colors cursor-pointer ${
                    isFocused
                      ? 'border-teal-400 bg-[#0f131a]/95 text-white shadow-lg'
                      : 'border-white/15 bg-[#0f131a]/75 text-slate-300 hover:border-teal-300/70 hover:bg-[#0f131a]/90 hover:text-white'
                  }`}
                >
                  <span className="text-xs font-semibold leading-snug whitespace-nowrap truncate w-full">
                    {part.title}
                  </span>
                  <span
                    className={`font-mono-tech text-[10px] truncate w-full ${
                      isFocused ? 'text-teal-300' : 'text-slate-400'
                    }`}
                  >
                    {part.category}
                  </span>
                </button>
              );
            })}
          </nav>
        </>
      )}

      {/* Collapsible Unified Bottom Control Dock */}
      <div
        className={`fixed bottom-4 left-1/2 z-20 w-[min(940px,94vw)] -translate-x-1/2 transition-transform duration-200 ease-out ${
          dockCollapsed ? 'translate-y-[calc(100%-30px)]' : 'translate-y-0'
        }`}
      >
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onToggleDock}
            aria-expanded={!dockCollapsed}
            title="Toggle Controls (H)"
            className="flex items-center gap-1.5 rounded-t-lg border border-b-0 border-white/15 bg-[#0f131a]/95 px-4 py-1 text-xs font-medium text-slate-200 hover:bg-[#181e28] hover:text-white focus-visible:outline-2 focus-visible:outline-teal-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {dockCollapsed ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                <span>Show Controls</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                <span>Hide Controls</span>
              </>
            )}
          </button>
        </div>

        {/* Main Dock Panel */}
        <div className="rounded-xl border border-white/15 bg-[#0f131a]/95 shadow-2xl">
          {/* Compact Inspection Status Strip */}
          <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-2 text-xs">
            {activePart ? (
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <div className="min-w-0 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                  <span className="font-semibold text-white whitespace-nowrap">
                    {activePart.title}
                  </span>
                  <span className="text-slate-400 whitespace-nowrap">
                    {activePart.category}
                  </span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="font-mono-tech text-teal-300 whitespace-nowrap">
                    {activePart.spec}
                  </span>
                </div>
                {!exploded && selectedPartKey && (
                  <button
                    type="button"
                    onClick={onClearPart}
                    className="flex items-center gap-1 shrink-0 rounded-md border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/20 whitespace-nowrap cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                    <span>Clear Focus</span>
                  </button>
                )}
              </div>
            ) : (
              <p className="text-slate-400 truncate">
                {exploded
                  ? 'Hover any 3D component or side label to isolate with Gaussian blur · Press E to assemble'
                  : 'Hover any part to inspect on the side · Click to isolate with Gaussian blur · Press E to explode'}
              </p>
            )}
          </div>

          {/* Tab Navigation + Instant Action Toggles */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
            <div className="flex items-center gap-1 rounded-lg bg-[#171c25] p-1">
              <button
                type="button"
                onClick={() => setActiveTab('aero')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'aero'
                    ? 'bg-white text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>Aero & Assembly</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('tires')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'tires'
                    ? 'bg-white text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Disc className="h-3.5 w-3.5" />
                <span>Pirelli Tires</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('camera')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'camera'
                    ? 'bg-white text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Camera className="h-3.5 w-3.5" />
                <span>Camera & Studio</span>
              </button>
            </div>

            {/* Instant Action Toggles */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleExploded}
                aria-pressed={exploded}
                className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  exploded
                    ? 'border-teal-300 bg-teal-400 text-slate-950'
                    : 'border-white/15 bg-[#171c25] text-slate-200 hover:border-white/30 hover:text-white'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Exploded View: {exploded ? 'On' : 'Off'}</span>
              </button>
              <button
                type="button"
                onClick={onToggleDrs}
                aria-pressed={drsOpen}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  drsOpen
                    ? 'border-amber-400/70 bg-amber-500/20 text-amber-200'
                    : 'border-white/12 bg-[#171c25] text-slate-300 hover:border-white/25 hover:text-white'
                }`}
              >
                DRS: {drsOpen ? 'Open' : 'Closed'}
              </button>
              <button
                type="button"
                onClick={onToggleWindTunnel}
                aria-pressed={windTunnel}
                className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  windTunnel
                    ? 'border-teal-400/70 bg-teal-500/20 text-teal-200'
                    : 'border-white/12 bg-[#171c25] text-slate-300 hover:border-white/25 hover:text-white'
                }`}
              >
                <Wind className="h-3.5 w-3.5" />
                <span>Airflow</span>
              </button>
              <button
                type="button"
                onClick={onToggleAudio}
                title={audioEnabled ? 'Mute V6 Audio' : 'Start V6 Audio'}
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  audioEnabled
                    ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200'
                    : 'border-white/12 bg-[#171c25] text-slate-300 hover:border-white/25 hover:text-white'
                }`}
              >
                {audioEnabled ? (
                  <Volume2 className="h-3.5 w-3.5" />
                ) : (
                  <VolumeX className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">V6 Sound</span>
              </button>
              <button
                type="button"
                onClick={onReplayReveal}
                title="Replay CAD-to-Car Reveal (R)"
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isRevealing
                    ? 'border-teal-400/70 bg-teal-500/20 text-teal-200'
                    : 'border-white/12 bg-[#171c25] text-slate-300 hover:border-white/25 hover:text-white'
                }`}
              >
                <ScanLine className="h-3.5 w-3.5" />
                <span>{isRevealing ? 'Revealing...' : 'Replay Reveal'}</span>
              </button>
              <button
                type="button"
                onClick={onResetAll}
                title="Reset View & Assembly"
                className="flex items-center gap-1 rounded-md border border-white/12 bg-[#171c25] px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-white/25 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            </div>
          </div>

          {/* Active Tab Controls Content */}
          <div className="px-4 py-3">
            {activeTab === 'aero' && (
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                {/* Assembly State Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-300 whitespace-nowrap">
                    Assembly State
                  </span>
                  <div className="flex items-center gap-1 rounded-lg bg-[#171c25] p-1">
                    <button
                      type="button"
                      onClick={() => exploded && onToggleExploded()}
                      className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        !exploded
                          ? 'bg-slate-200 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Assembled
                    </button>
                    <button
                      type="button"
                      onClick={() => !exploded && onToggleExploded()}
                      className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        exploded
                          ? 'bg-teal-400 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Exploded Breakdown
                    </button>
                  </div>
                </div>

                {/* Rolling Road Speed */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-300 whitespace-nowrap">
                    Rolling Road
                  </span>
                  <div className="flex items-center gap-1 rounded-lg bg-[#171c25] p-1">
                    {SPEED_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onSelectSpeedMode(opt.id)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          speedMode === opt.id
                            ? 'bg-slate-200 text-slate-950'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Turntable Orbit */}
                <button
                  type="button"
                  onClick={onToggleAutoRotate}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    autoRotate
                      ? 'border-white/50 bg-white/15 text-white'
                      : 'border-white/12 bg-[#171c25] text-slate-300 hover:text-white'
                  }`}
                >
                  Turntable: {autoRotate ? 'On' : 'Off'}
                </button>
              </div>
            )}

            {activeTab === 'tires' && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-slate-400 whitespace-nowrap">
                    Pirelli P-Zero Compound
                  </span>
                  {TIRE_COMPOUNDS.map((comp) => {
                    const active = comp.id === tireCompoundId;
                    return (
                      <button
                        key={comp.id}
                        type="button"
                        onClick={() => onSelectTireCompound(comp.id)}
                        className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'border-white bg-white/15 text-white'
                            : 'border-white/10 bg-[#171c25] text-slate-300 hover:border-white/25 hover:text-white'
                        }`}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full border border-white/25"
                          style={{ backgroundColor: comp.stripeHex }}
                        />
                        <span>{comp.label}</span>
                        <span className="font-mono-tech text-[10px] text-slate-400">
                          {comp.code}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <span className="text-[11px] text-slate-400">
                  18-inch 7-spoke forged hubs with woven carbon aero rings
                </span>
              </div>
            )}

            {activeTab === 'camera' && (
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-xs font-medium text-slate-400">View</span>
                  {CAMERA_PRESETS.map((cam) => {
                    const active = cam.id === activeCameraId;
                    return (
                      <button
                        key={cam.id}
                        type="button"
                        onClick={() => onSelectCamera(cam.id)}
                        className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'border-white bg-white text-slate-950'
                            : 'border-white/10 bg-[#171c25] text-slate-300 hover:border-white/25 hover:text-white'
                        }`}
                      >
                        {cam.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="mr-1 text-xs font-medium text-slate-400">Studio</span>
                  <div className="flex items-center gap-1 rounded-lg bg-[#171c25] p-1">
                    {LIGHTING_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onSelectLighting(opt.id)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          lightingId === opt.id
                            ? 'bg-slate-200 text-slate-950'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
