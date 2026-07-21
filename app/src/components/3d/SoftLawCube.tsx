import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sphere } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '@/lib/store'

interface SoftLawCubeProps {
  progress: number
  performanceTier: 'high' | 'medium' | 'low'
  theme?: 'dark' | 'light'
}

export function SoftLawCube({ progress, performanceTier, theme = 'dark' }: SoftLawCubeProps) {
  const isDark = theme === 'dark'
  const groupRef = useRef<THREE.Group>(null)
  const shieldRef = useRef<THREE.Mesh>(null)
  const outerShieldRef = useRef<THREE.Mesh>(null)

  const mouseX = useStore((state) => state.mouseX)
  const mouseY = useStore((state) => state.mouseY)

  const phase = useMemo(() => {
    if (progress < 0.33) {
      return {
        state: 1,
        coreOpacity: 0.3 + (progress / 0.33) * 0.5,
        shieldOpacity: 0,
        outerShieldOpacity: 0,
        shieldScale: 0,
        dotGlow: 0.2,
      }
    } else if (progress < 0.66) {
      const localProgress = (progress - 0.33) / 0.33
      return {
        state: 2,
        coreOpacity: 0.8,
        shieldOpacity: localProgress * 0.25,
        outerShieldOpacity: 0,
        shieldScale: 1 + localProgress * 0.3,
        dotGlow: 0.5 + localProgress * 0.3,
      }
    } else {
      const localProgress = (progress - 0.66) / 0.34
      return {
        state: 3,
        coreOpacity: 1,
        shieldOpacity: 0.25,
        outerShieldOpacity: localProgress * 0.15,
        shieldScale: 1.3,
        dotGlow: 0.8 + localProgress * 0.4,
      }
    }
  }, [progress])

  const edgesGeo = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(2.5, 2.5, 2.5)),
    [],
  )

  useFrame((state) => {
    if (!groupRef.current) return

    const targetRotationY = mouseX * 0.4
    const targetRotationX = -mouseY * 0.3

    groupRef.current.rotation.y += (targetRotationY - groupRef.current.rotation.y) * 0.05
    groupRef.current.rotation.x += (targetRotationX - groupRef.current.rotation.x) * 0.05

    groupRef.current.position.x += (mouseX * 1.5 - groupRef.current.position.x) * 0.02
    groupRef.current.position.y += (-mouseY * 1.5 - groupRef.current.position.y) * 0.02

    groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.2) * 0.05

    if (shieldRef.current && phase.shieldOpacity > 0) {
      const pulse = Math.sin(state.clock.elapsedTime * 1.5) * 0.05 + 1
      shieldRef.current.scale.setScalar(phase.shieldScale * pulse)
    }

    if (outerShieldRef.current && phase.outerShieldOpacity > 0) {
      outerShieldRef.current.rotation.x += 0.002
      outerShieldRef.current.rotation.y -= 0.003
    }
  })

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Semi-transparent cube faces */}
      <mesh>
        <boxGeometry args={[2.5, 2.5, 2.5]} />
        <meshStandardMaterial
          color={isDark ? '#FFFFFF' : '#0A0A0A'}
          emissive={isDark ? '#E8E8E8' : '#1A1A1A'}
          emissiveIntensity={isDark ? 0.05 : 0.03}
          metalness={isDark ? 0.1 : 0.3}
          roughness={isDark ? 0.7 : 0.5}
          opacity={phase.coreOpacity * 0.28}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Edge wireframe */}
      <lineSegments geometry={edgesGeo}>
        <lineBasicMaterial
          color={isDark ? '#FFFFFF' : '#0A0A0A'}
          opacity={phase.coreOpacity * 0.55}
          transparent
        />
      </lineSegments>

      {/* Gold sphere — warm gradient (FDE68A → FACC15 → D97706) */}
      <Sphere args={[0.4, 32, 32]}>
        <meshStandardMaterial
          color="#FACC15"
          emissive="#D97706"
          emissiveIntensity={phase.dotGlow}
          metalness={0.8}
          roughness={0.2}
          opacity={phase.coreOpacity}
          transparent
        />
      </Sphere>

      <pointLight color="#FACC15" intensity={phase.dotGlow * 0.6} distance={5} decay={2} />

      {phase.shieldOpacity > 0 && (
        <mesh ref={shieldRef}>
          <octahedronGeometry args={[3.5, 0]} />
          <meshStandardMaterial
            color={isDark ? '#808080' : '#1A1A1A'}
            emissive={isDark ? '#505050' : '#0A0A0A'}
            emissiveIntensity={isDark ? 0.2 : 0.1}
            metalness={isDark ? 0.5 : 0.7}
            roughness={isDark ? 0.5 : 0.4}
            opacity={phase.shieldOpacity}
            transparent
            wireframe
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {phase.outerShieldOpacity > 0 && (
        <mesh ref={outerShieldRef}>
          <icosahedronGeometry args={[4.5, 1]} />
          <meshStandardMaterial
            color={isDark ? '#6B7280' : '#262626'}
            emissive={isDark ? '#404040' : '#0A0A0A'}
            emissiveIntensity={isDark ? 0.15 : 0.08}
            metalness={isDark ? 0.3 : 0.6}
            roughness={isDark ? 0.7 : 0.5}
            opacity={phase.outerShieldOpacity}
            transparent
            wireframe
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {performanceTier === 'high' && phase.state >= 2 && (
        <>
          {[...Array(8)].map((_, i) => {
            const angle = (i / 8) * Math.PI * 2
            const radius = 5
            return (
              <Sphere
                key={i}
                args={[0.08, 16, 16]}
                position={[
                  Math.cos(angle) * radius,
                  Math.sin(angle) * radius,
                  Math.sin(angle * 2) * 2,
                ]}
              >
                <meshStandardMaterial
                  color="#FACC15"
                  emissive="#FACC15"
                  emissiveIntensity={0.8}
                  opacity={phase.shieldOpacity * 2}
                  transparent
                />
              </Sphere>
            )
          })}
        </>
      )}
    </group>
  )
}
