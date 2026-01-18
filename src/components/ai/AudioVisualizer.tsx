// AudioVisualizer - Ses Dalga Gösterimi Komponenti
import React, { useEffect, useRef, useState } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
  type: 'listening' | 'speaking' | 'idle';
  className?: string;
  barCount?: number;
  color?: string;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isActive,
  type,
  className = '',
  barCount = 5,
  color
}) => {
  const [bars, setBars] = useState<number[]>(Array(barCount).fill(0.2));
  const animationRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Renk belirleme
  const getColor = () => {
    if (color) return color;
    switch (type) {
      case 'listening':
        return 'bg-red-500';
      case 'speaking':
        return 'bg-emerald-500';
      default:
        return 'bg-slate-400';
    }
  };

  // Mikrofondan ses seviyesi al
  useEffect(() => {
    if (!isActive || type !== 'listening') {
      // Cleanup
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      setBars(Array(barCount).fill(0.2));
      return;
    }

    const startAudioCapture = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();

        analyser.fftSize = 32;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);

        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateBars = () => {
          if (!analyserRef.current) return;

          analyserRef.current.getByteFrequencyData(dataArray);

          // Bar sayısına göre frekans verilerini grupla
          const step = Math.floor(dataArray.length / barCount);
          const newBars = Array(barCount).fill(0).map((_, i) => {
            const start = i * step;
            const end = start + step;
            let sum = 0;
            for (let j = start; j < end; j++) {
              sum += dataArray[j];
            }
            const avg = sum / step / 255;
            return Math.max(0.15, Math.min(1, avg * 2 + 0.15));
          });

          setBars(newBars);
          animationRef.current = requestAnimationFrame(updateBars);
        };

        updateBars();
      } catch (error) {
        console.error('Mikrofon erişimi hatası:', error);
        // Fallback: Simüle edilmiş animasyon
        startSimulatedAnimation();
      }
    };

    startAudioCapture();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isActive, type, barCount]);

  // AI konuşurken veya mikrofon erişimi yoksa simüle edilmiş animasyon
  useEffect(() => {
    if (!isActive || type !== 'speaking') {
      if (animationRef.current && type !== 'listening') {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
        setBars(Array(barCount).fill(0.2));
      }
      return;
    }

    startSimulatedAnimation();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isActive, type, barCount]);

  // Simüle edilmiş animasyon
  const startSimulatedAnimation = () => {
    let phase = 0;

    const animate = () => {
      phase += 0.15;

      const newBars = Array(barCount).fill(0).map((_, i) => {
        // Sinüs dalgası bazlı animasyon
        const wave = Math.sin(phase + i * 0.5) * 0.4 + 0.5;
        const noise = Math.random() * 0.2;
        return Math.max(0.15, Math.min(1, wave + noise));
      });

      setBars(newBars);
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
  };

  if (!isActive && type === 'idle') {
    return null;
  }

  return (
    <div className={`flex items-center justify-center gap-1 h-8 ${className}`}>
      {bars.map((height, index) => (
        <div
          key={index}
          className={`w-1 rounded-full transition-all duration-75 ${getColor()}`}
          style={{
            height: `${height * 100}%`,
            opacity: isActive ? 1 : 0.3
          }}
        />
      ))}
    </div>
  );
};

// Compact versiyonu - satır içi kullanım için
export const AudioVisualizerCompact: React.FC<AudioVisualizerProps> = ({
  isActive,
  type,
  className = '',
  barCount = 3,
  color
}) => {
  const [bars, setBars] = useState<number[]>(Array(barCount).fill(0.3));
  const animationRef = useRef<number | null>(null);

  const getColor = () => {
    if (color) return color;
    switch (type) {
      case 'listening':
        return 'bg-red-500';
      case 'speaking':
        return 'bg-emerald-500';
      default:
        return 'bg-slate-400';
    }
  };

  useEffect(() => {
    if (!isActive) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      setBars(Array(barCount).fill(0.3));
      return;
    }

    let phase = 0;

    const animate = () => {
      phase += 0.12;

      const newBars = Array(barCount).fill(0).map((_, i) => {
        const wave = Math.sin(phase + i * 0.8) * 0.35 + 0.5;
        return Math.max(0.2, Math.min(1, wave));
      });

      setBars(newBars);
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, barCount]);

  return (
    <div className={`inline-flex items-center gap-0.5 h-4 ${className}`}>
      {bars.map((height, index) => (
        <div
          key={index}
          className={`w-0.5 rounded-full ${getColor()}`}
          style={{
            height: `${height * 100}%`,
            transition: 'height 75ms ease-out'
          }}
        />
      ))}
    </div>
  );
};

// Circular versiyonu - buton içi kullanım için
export const AudioVisualizerCircular: React.FC<{
  isActive: boolean;
  type: 'listening' | 'speaking' | 'idle';
  size?: number;
  className?: string;
}> = ({
  isActive,
  type,
  size = 48,
  className = ''
}) => {
  const [scale, setScale] = useState(1);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      setScale(1);
      return;
    }

    let phase = 0;

    const animate = () => {
      phase += 0.1;
      const newScale = 1 + Math.sin(phase) * 0.15;
      setScale(newScale);
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive]);

  const getColor = () => {
    switch (type) {
      case 'listening':
        return 'rgba(239, 68, 68, 0.3)'; // red-500
      case 'speaking':
        return 'rgba(16, 185, 129, 0.3)'; // emerald-500
      default:
        return 'transparent';
    }
  };

  if (!isActive) return null;

  return (
    <div
      className={`absolute inset-0 rounded-full pointer-events-none ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: getColor(),
        transform: `scale(${scale})`,
        transition: 'transform 100ms ease-out'
      }}
    />
  );
};

export default AudioVisualizer;
