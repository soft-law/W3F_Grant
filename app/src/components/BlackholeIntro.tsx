import { useEffect, useState } from "react";
import { Canvas } from '@react-three/fiber';
import { SoftLawCube } from './3d/SoftLawCube';
import { useTheme } from '@/hooks/useTheme';

export interface BlackholeIntroProps {
  onComplete: () => void;
  isReady?: boolean;
}

export function BlackholeIntro({ onComplete, isReady = true }: BlackholeIntroProps) {
  const [opacity, setOpacity] = useState(1);
  const [progress, setProgress] = useState(0);
  const [animDone, setAnimDone] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 1) {
          clearInterval(progressInterval);
          setAnimDone(true);
          return 1;
        }
        return prev + 0.02;
      });
    }, 40);

    return () => clearInterval(progressInterval);
  }, []);

  useEffect(() => {
    if (!animDone || !isReady) return;

    const fadeTimer = setTimeout(() => setOpacity(0), 150);
    const completeTimer = setTimeout(() => onComplete(), 1150);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [animDone, isReady, onComplete]);

  const darkBackground = `
    radial-gradient(circle at 20% 30%, rgba(250, 204, 21, 0.15) 0px, transparent 1px),
    radial-gradient(circle at 80% 70%, rgba(246, 232, 139, 0.1) 0px, transparent 1px),
    radial-gradient(circle at 40% 80%, rgba(245, 216, 142, 0.12) 0px, transparent 1px),
    radial-gradient(circle at 90% 20%, rgba(255, 255, 255, 0.08) 0px, transparent 1px),
    radial-gradient(circle at 10% 50%, rgba(250, 204, 21, 0.1) 0px, transparent 1px)
  `;

  const lightBackground = `
    radial-gradient(circle at 20% 30%, rgba(212, 160, 23, 0.12) 0px, transparent 1px),
    radial-gradient(circle at 80% 70%, rgba(245, 216, 142, 0.1) 0px, transparent 1px),
    radial-gradient(circle at 40% 80%, rgba(184, 134, 11, 0.1) 0px, transparent 1px),
    radial-gradient(circle at 90% 20%, rgba(0, 0, 0, 0.04) 0px, transparent 1px),
    radial-gradient(circle at 10% 50%, rgba(212, 160, 23, 0.08) 0px, transparent 1px)
  `;

  // Show a subtle hint only when animation is done but auth is still settling
  const showConnecting = animDone && !isReady;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-1000"
      style={{
        opacity,
        background: isDark ? '#000000' : '#FFFFFF',
        backgroundImage: isDark ? darkBackground : lightBackground,
        backgroundSize: '3px 3px, 2px 2px, 4px 4px, 2px 2px, 3px 3px',
        backgroundPosition: '0 0, 40px 60px, 80px 20px, 130px 90px, 20px 120px',
      }}
    >
      <div className="text-center">
        <div className="w-48 h-48 sm:w-64 sm:h-64 mx-auto mb-8">
          <Canvas
            camera={{
              fov: 60,
              position: [0, 0, 10],
              near: 0.1,
              far: 100,
            }}
            dpr={[1, 1.5]}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: 'default',
              failIfMajorPerformanceCaveat: false,
            }}
            onCreated={({ gl }) => {
              gl.domElement.addEventListener('webglcontextlost', (e) => {
                e.preventDefault()
                onComplete()
              })
            }}
          >
            <ambientLight intensity={0.5} color="#F5D88E" />
            <directionalLight position={[5, 5, 5]} intensity={1.2} color="#FFFFFF" />
            <directionalLight position={[-5, -5, -5]} intensity={0.3} color="#FACC15" />
            <SoftLawCube progress={progress} performanceTier="high" theme={theme} />
          </Canvas>
        </div>

        <h1 className="text-4xl font-bold flex items-center justify-center" aria-label="Soft.Law">
          <img
            src={isDark ? "/brand/logo_white.png" : "/brand/logo_black.png"}
            alt="Soft.Law Logo"
            className="h-10 sm:h-12 w-auto"
          />
        </h1>

        {/* Shown only when cube animation is done but auth state is still settling */}
        <div
          className="mt-5 h-4 transition-opacity duration-500"
          style={{ opacity: showConnecting ? 1 : 0 }}
        >
          <span
            className="text-xs tracking-widest uppercase animate-pulse"
            style={{ color: isDark ? 'rgba(250,204,21,0.5)' : 'rgba(146,100,11,0.5)' }}
          >
            Connecting
          </span>
        </div>
      </div>
    </div>
  );
}
