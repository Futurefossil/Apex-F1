import { useCallback, useEffect, useRef, useState } from 'react';
import { ControlOverlay } from './components/ControlOverlay';
import { F1Viewport } from './components/F1Viewport';
import { F1AudioEngine } from './f1/audio';
import {
  CameraPresetId,
  LightingPresetId,
  SpeedModeId,
  TireCompoundId,
} from './f1/types';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function App() {
  const [skipInitialReveal] = useState<boolean>(() => prefersReducedMotion());
  const [revealNonce, setRevealNonce] = useState<number>(0);
  const [isRevealing, setIsRevealing] = useState<boolean>(() => !prefersReducedMotion());

  const [tireCompoundId, setTireCompoundId] = useState<TireCompoundId>('medium');
  const [lightingId, setLightingId] = useState<LightingPresetId>('darkSpotlight');
  const [cameraPreset, setCameraPreset] = useState<{ id: CameraPresetId; nonce: number }>({
    id: 'hero',
    nonce: 0,
  });
  const [exploded, setExploded] = useState<boolean>(false);
  const [drsOpen, setDrsOpen] = useState<boolean>(false);
  const [windTunnel, setWindTunnel] = useState<boolean>(false);
  const [speedMode, setSpeedMode] = useState<SpeedModeId>('static');
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const [selectedPartKey, setSelectedPartKey] = useState<string | null>(null);
  const [hoveredPartKey, setHoveredPartKey] = useState<string | null>(null);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);

  const audioEngineRef = useRef<F1AudioEngine | null>(null);

  useEffect(() => {
    const engine = new F1AudioEngine();
    audioEngineRef.current = engine;
    return () => {
      engine.dispose();
    };
  }, []);

  useEffect(() => {
    if (audioEnabled) {
      audioEngineRef.current?.setMode(speedMode);
    }
  }, [speedMode, audioEnabled]);

  const handleToggleExploded = useCallback(() => {
    setExploded((prev) => !prev);
    setSelectedPartKey(null);
    setHoveredPartKey(null);
  }, []);

  const handleReplayReveal = useCallback(() => {
    setIsRevealing(true);
    setRevealNonce((prev) => prev + 1);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      } else if (e.key === 'e' || e.key === 'E') {
        handleToggleExploded();
      } else if (e.key === 'd' || e.key === 'D') {
        setDrsOpen((prev) => !prev);
      } else if (e.key === 'w' || e.key === 'W') {
        setWindTunnel((prev) => !prev);
      } else if (e.key === 'r' || e.key === 'R') {
        handleReplayReveal();
      } else if (e.key === 'Escape') {
        setSelectedPartKey(null);
        setHoveredPartKey(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleToggleExploded, handleReplayReveal]);

  const handleToggleAudio = useCallback(() => {
    const engine = audioEngineRef.current;
    if (!engine) return;
    if (audioEnabled) {
      engine.stop();
      setAudioEnabled(false);
    } else {
      const ok = engine.start(speedMode);
      setAudioEnabled(ok);
    }
  }, [audioEnabled, speedMode]);

  const handleSelectCamera = useCallback((id: CameraPresetId) => {
    setCameraPreset((prev) => ({ id, nonce: prev.nonce + 1 }));
  }, []);

  const handleResetAll = useCallback(() => {
    setExploded(false);
    setDrsOpen(false);
    setWindTunnel(false);
    setSpeedMode('static');
    setAutoRotate(false);
    setSelectedPartKey(null);
    setHoveredPartKey(null);
    setCameraPreset((prev) => ({ id: 'hero', nonce: prev.nonce + 1 }));
  }, []);

  return (
    <main
      className={`relative h-screen w-screen overflow-hidden ${
        lightingId === 'studioWhite' ? 'bg-[#f4f5f7]' : 'bg-[#131820]'
      }`}
    >
      <F1Viewport
        tireCompoundId={tireCompoundId}
        lightingId={lightingId}
        cameraPreset={cameraPreset}
        exploded={exploded}
        drsOpen={drsOpen}
        windTunnel={windTunnel}
        speedMode={speedMode}
        autoRotate={autoRotate}
        selectedPartKey={selectedPartKey}
        hoveredPartKey={hoveredPartKey}
        revealNonce={revealNonce}
        skipInitialReveal={skipInitialReveal}
        onSelectPart={setSelectedPartKey}
        onHoverPart={setHoveredPartKey}
        onRevealStateChange={setIsRevealing}
      />
      <ControlOverlay
        tireCompoundId={tireCompoundId}
        onSelectTireCompound={setTireCompoundId}
        lightingId={lightingId}
        onSelectLighting={setLightingId}
        activeCameraId={cameraPreset.id}
        onSelectCamera={handleSelectCamera}
        exploded={exploded}
        onToggleExploded={handleToggleExploded}
        drsOpen={drsOpen}
        onToggleDrs={() => setDrsOpen((p) => !p)}
        windTunnel={windTunnel}
        onToggleWindTunnel={() => setWindTunnel((p) => !p)}
        speedMode={speedMode}
        onSelectSpeedMode={setSpeedMode}
        autoRotate={autoRotate}
        onToggleAutoRotate={() => setAutoRotate((p) => !p)}
        audioEnabled={audioEnabled}
        onToggleAudio={handleToggleAudio}
        isRevealing={isRevealing}
        onReplayReveal={handleReplayReveal}
        selectedPartKey={selectedPartKey}
        hoveredPartKey={hoveredPartKey}
        onHoverPart={setHoveredPartKey}
        onClearPart={() => setSelectedPartKey(null)}
        onResetAll={handleResetAll}
        dockCollapsed={dockCollapsed}
        onToggleDock={() => setDockCollapsed((p) => !p)}
      />
    </main>
  );
}
