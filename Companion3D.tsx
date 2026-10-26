'use client';

import { Canvas } from '@react-three/fiber';
import { Float, Stars } from '@react-three/drei';
import { useEffect, useState, Component, ReactNode } from 'react';

interface Companion3DProps {
  avatarType: string;
  mood: 'happy' | 'neutral' | 'sad';
}

// ألوان العين حسب الحالة المزاجية (تُستخدم في كل الشخصيات)
const MOOD_EYE_COLOR: Record<Companion3DProps['mood'], string> = {
  happy: '#22c55e',
  neutral: '#38bdf8',
  sad: '#ef4444',
};

// إمالة بسيطة للشخصية حسب المزاج (فرح = وقوف منتصب، حزن = ميل خفيف للأسفل)
const MOOD_TILT: Record<Companion3DProps['mood'], number> = {
  happy: 0,
  neutral: 0,
  sad: 0.15,
};

/* ---------------------- 🤖 الروبوت ---------------------- */
function RobotModel({ mood }: { mood: Companion3DProps['mood'] }) {
  const eye = MOOD_EYE_COLOR[mood];
  return (
    <group rotation={[MOOD_TILT[mood], 0, 0]} position={[0, -0.4, 0]}>
      {/* الجسم */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.55, 0.65, 1.1, 16]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* الرأس */}
      <mesh position={[0, 0.95, 0]}>
        <boxGeometry args={[0.9, 0.7, 0.8]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.5} roughness={0.3} />
      </mesh>
      {/* العينان */}
      <mesh position={[-0.22, 1.0, 0.41]}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial color={eye} emissive={eye} emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[0.22, 1.0, 0.41]}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial color={eye} emissive={eye} emissiveIntensity={1.2} />
      </mesh>
      {/* الهوائي */}
      <mesh position={[0, 1.45, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.35, 8]} />
        <meshStandardMaterial color="#64748b" />
      </mesh>
      <mesh position={[0, 1.68, 0]}>
        <sphereGeometry args={[0.08, 10, 10]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.6} />
      </mesh>
      {/* الذراعان */}
      <mesh position={[-0.75, 0.15, 0]} rotation={[0, 0, 0.3]}>
        <cylinderGeometry args={[0.12, 0.12, 0.7, 10]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0.75, 0.15, 0]} rotation={[0, 0, -0.3]}>
        <cylinderGeometry args={[0.12, 0.12, 0.7, 10]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

/* ---------------------- 👨‍🚀 رائد الفضاء ---------------------- */
function AstronautModel({ mood }: { mood: Companion3DProps['mood'] }) {
  const eye = MOOD_EYE_COLOR[mood];
  return (
    <group rotation={[MOOD_TILT[mood], 0, 0]} position={[0, -0.4, 0]}>
      {/* البدلة */}
      <mesh position={[0, 0, 0]}>
        <capsuleGeometry args={[0.5, 0.7, 6, 16]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.6} />
      </mesh>
      {/* الخوذة */}
      <mesh position={[0, 0.95, 0]}>
        <sphereGeometry args={[0.5, 20, 20]} />
        <meshStandardMaterial color="#e2e8f0" transparent opacity={0.85} roughness={0.1} />
      </mesh>
      {/* الوجه خلف الزجاج */}
      <mesh position={[0, 0.95, 0.15]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      {/* العينان */}
      <mesh position={[-0.12, 1.0, 0.4]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color={eye} emissive={eye} emissiveIntensity={1} />
      </mesh>
      <mesh position={[0.12, 1.0, 0.4]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color={eye} emissive={eye} emissiveIntensity={1} />
      </mesh>
      {/* حقيبة الظهر */}
      <mesh position={[0, 0.1, -0.45]}>
        <boxGeometry args={[0.45, 0.6, 0.25]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      {/* شارة على الصدر */}
      <mesh position={[0, 0.15, 0.48]}>
        <boxGeometry args={[0.18, 0.18, 0.02]} />
        <meshStandardMaterial color="#dc2626" />
      </mesh>
    </group>
  );
}

/* ---------------------- 🧙‍♂️ الساحر ---------------------- */
function WizardModel({ mood }: { mood: Companion3DProps['mood'] }) {
  const eye = MOOD_EYE_COLOR[mood];
  return (
    <group rotation={[MOOD_TILT[mood], 0, 0]} position={[0, -0.4, 0]}>
      {/* الرداء */}
      <mesh position={[0, 0.1, 0]}>
        <coneGeometry args={[0.65, 1.3, 16]} />
        <meshStandardMaterial color="#6d28d9" roughness={0.5} />
      </mesh>
      {/* الوجه */}
      <mesh position={[0, 0.85, 0]}>
        <sphereGeometry args={[0.32, 16, 16]} />
        <meshStandardMaterial color="#fcd9b8" />
      </mesh>
      {/* العينان */}
      <mesh position={[-0.11, 0.88, 0.28]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color={eye} emissive={eye} emissiveIntensity={1} />
      </mesh>
      <mesh position={[0.11, 0.88, 0.28]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color={eye} emissive={eye} emissiveIntensity={1} />
      </mesh>
      {/* اللحية */}
      <mesh position={[0, 0.62, 0.12]}>
        <coneGeometry args={[0.22, 0.4, 12]} />
        <meshStandardMaterial color="#e5e7eb" />
      </mesh>
      {/* قبعة الساحر */}
      <mesh position={[0, 1.35, 0]}>
        <coneGeometry args={[0.32, 0.75, 16]} />
        <meshStandardMaterial color="#4c1d95" />
      </mesh>
      <mesh position={[0, 1.0, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 0.08, 16]} />
        <meshStandardMaterial color="#4c1d95" />
      </mesh>
      {/* نجمة على القبعة */}
      <mesh position={[0, 1.55, 0.1]}>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.8} />
      </mesh>
      {/* العصا */}
      <mesh position={[0.6, 0.1, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1.2, 8]} />
        <meshStandardMaterial color="#78350f" />
      </mesh>
      <mesh position={[0.6, 0.75, 0]}>
        <sphereGeometry args={[0.11, 10, 10]} />
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={1} />
      </mesh>
    </group>
  );
}

/* ---------------------- 🦁 البطل الشجاع (الأسد) ---------------------- */
function AnimalModel({ mood }: { mood: Companion3DProps['mood'] }) {
  const eye = MOOD_EYE_COLOR[mood];
  return (
    <group rotation={[MOOD_TILT[mood], 0, 0]} position={[0, -0.4, 0]}>
      {/* الجسم */}
      <mesh position={[0, 0, 0]}>
        <capsuleGeometry args={[0.42, 0.55, 6, 16]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.8} />
      </mesh>
      {/* اللبدة (Mane) */}
      <mesh position={[0, 0.85, 0]}>
        <sphereGeometry args={[0.55, 16, 16]} />
        <meshStandardMaterial color="#92400e" roughness={0.9} />
      </mesh>
      {/* الرأس */}
      <mesh position={[0, 0.85, 0.1]}>
        <sphereGeometry args={[0.38, 18, 18]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.7} />
      </mesh>
      {/* الأذنان */}
      <mesh position={[-0.28, 1.2, 0.05]}>
        <sphereGeometry args={[0.11, 10, 10]} />
        <meshStandardMaterial color="#fbbf24" />
      </mesh>
      <mesh position={[0.28, 1.2, 0.05]}>
        <sphereGeometry args={[0.11, 10, 10]} />
        <meshStandardMaterial color="#fbbf24" />
      </mesh>
      {/* العينان */}
      <mesh position={[-0.13, 0.88, 0.42]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color={eye} emissive={eye} emissiveIntensity={1} />
      </mesh>
      <mesh position={[0.13, 0.88, 0.42]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color={eye} emissive={eye} emissiveIntensity={1} />
      </mesh>
      {/* الأنف */}
      <mesh position={[0, 0.75, 0.46]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#1c1917" />
      </mesh>
      {/* الذيل */}
      <mesh position={[0, -0.1, -0.5]} rotation={[0.8, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.06, 0.6, 8]} />
        <meshStandardMaterial color="#f59e0b" />
      </mesh>
    </group>
  );
}

const AVATAR_COMPONENTS: Record<
  string,
  (props: { mood: Companion3DProps['mood'] }) => React.JSX.Element
> = {
  robot: RobotModel,
  astronaut: AstronautModel,
  wizard: WizardModel,
  animal: AnimalModel,
};

function CharacterModel({ avatarType, mood }: Companion3DProps) {
  const ModelComponent = AVATAR_COMPONENTS[avatarType] ?? RobotModel;
  return (
    <Float speed={1.5} rotationIntensity={0.25} floatIntensity={0.5}>
      <ModelComponent mood={mood} />
    </Float>
  );
}

// Error Boundary: أي فشل غير متوقع في رسم Three.js يُعرض بديل إيموجي بدل تعطّل الصفحة
class ModelErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    console.error('❌ Companion3D render error:', error);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function AvatarEmojiFallback({ avatarType, mood }: Companion3DProps) {
  const icons: Record<string, string> = {
    robot: '🤖',
    astronaut: '👨‍🚀',
    wizard: '🧙‍♂️',
    animal: '🦁',
  };
  return (
    <div className="w-full h-full flex items-center justify-center text-7xl">
      {icons[avatarType] ?? '🤖'}
    </div>
  );
}

export default function Companion3D({ avatarType, mood }: Companion3DProps) {
  // فحص دعم WebGL في المتصفح قبل محاولة تركيب Canvas أصلاً
  const [webglSupported, setWebglSupported] = useState(true);

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl =
        canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      setWebglSupported(!!gl);
    } catch {
      setWebglSupported(false);
    }
  }, []);

  return (
    <div className="w-40 h-40 md:w-56 md:h-56 relative">
      {webglSupported ? (
        <ModelErrorBoundary
          fallback={<AvatarEmojiFallback avatarType={avatarType} mood={mood} />}
        >
          <Canvas camera={{ position: [0, 0, 4], fov: 50 }}>
            {/* إضاءة محيطة واتجاهية لإبراز الـ 3D */}
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
            <pointLight position={[-5, -5, -5]} intensity={0.5} color="#ff00ff" />

            {/* خلفية نجوم خفيفة لإعطاء عمق */}
            <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />

            {/* الشخصية (مبنية بأشكال Three.js أساسية، بدون ملفات glb خارجية) */}
            <CharacterModel avatarType={avatarType} mood={mood} />
          </Canvas>
        </ModelErrorBoundary>
      ) : (
        <AvatarEmojiFallback avatarType={avatarType} mood={mood} />
      )}

      {/* فقاعة كلام (اختياري) */}
      {mood === 'happy' && (
        <div className="absolute -top-4 -right-4 bg-white px-3 py-1 rounded-xl shadow-lg border-2 border-green-400 animate-bounce text-sm font-bold text-green-600">
          أحسنت! 🎉
        </div>
      )}
      {mood === 'sad' && (
        <div className="absolute -top-4 -right-4 bg-white px-3 py-1 rounded-xl shadow-lg border-2 border-red-400 animate-pulse text-sm font-bold text-red-600">
          حاول مرة أخرى 💪
        </div>
      )}
    </div>
  );
}
