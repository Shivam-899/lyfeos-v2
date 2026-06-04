import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, StyleSheet, View } from "react-native";

const { width: SW, height: SH } = Dimensions.get("window");

const COLORS = [
  "#FF6B35", "#4ECDC4", "#FFE66D", "#FF4757", "#2ED573",
  "#FF6B81", "#5352ED", "#FFA502", "#ECCC68", "#1E90FF",
];

const PARTICLE_COUNT = 60;

interface Particle {
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  rotate: Animated.Value;
  scale: Animated.Value;
  color: string;
  shape: "square" | "circle" | "rect";
  size: number;
}

interface Props {
  trigger: number;
  originX?: number;
  originY?: number;
}

export function ConfettiEffect({ trigger, originX = SW / 2, originY = SH * 0.45 }: Props) {
  const particles = useRef<Particle[]>(
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      rotate: new Animated.Value(0),
      scale: new Animated.Value(0),
      color: COLORS[i % COLORS.length],
      shape: (["square", "circle", "rect"] as const)[i % 3],
      size: 6 + Math.random() * 8,
    }))
  ).current;

  useEffect(() => {
    if (trigger === 0) return;

    particles.forEach((p, i) => {
      p.x.setValue(0);
      p.y.setValue(0);
      p.opacity.setValue(0);
      p.rotate.setValue(0);
      p.scale.setValue(0);
    });

    const animations = particles.map((p, i) => {
      const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + (Math.random() - 0.5) * 0.8;
      const speed = 120 + Math.random() * 180;
      const tx = Math.cos(angle) * speed;
      const ty = Math.sin(angle) * speed - 60;
      const duration = 800 + Math.random() * 600;
      const delay = Math.random() * 120;

      return Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(p.opacity, { toValue: 1, duration: 80, useNativeDriver: true }),
          Animated.timing(p.scale, { toValue: 1 + Math.random() * 0.5, duration: 120, useNativeDriver: true }),
          Animated.timing(p.x, { toValue: tx, duration, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(p.y, { toValue: ty, duration: duration * 0.45, useNativeDriver: true }),
            Animated.timing(p.y, { toValue: ty + 260 + Math.random() * 160, duration: duration * 0.55, useNativeDriver: true }),
          ]),
          Animated.timing(p.rotate, { toValue: 6 + Math.random() * 10, duration, useNativeDriver: true }),
          Animated.sequence([
            Animated.delay(duration * 0.5),
            Animated.timing(p.opacity, { toValue: 0, duration: duration * 0.5, useNativeDriver: true }),
          ]),
        ]),
      ]);
    });

    Animated.parallel(animations).start();
  }, [trigger]);

  if (trigger === 0) return null;

  return (
    <View style={[styles.container, { left: originX, top: originY }]} pointerEvents="none">
      {particles.map((p, i) => {
        const rotate = p.rotate.interpolate({ inputRange: [0, 10], outputRange: ["0deg", "720deg"] });
        const size = p.size;
        const isRect = p.shape === "rect";
        const isCircle = p.shape === "circle";
        return (
          <Animated.View
            key={i}
            style={[
              styles.particle,
              {
                width: isRect ? size * 0.5 : size,
                height: isRect ? size * 1.8 : size,
                borderRadius: isCircle ? size / 2 : 2,
                backgroundColor: p.color,
                opacity: p.opacity,
                transform: [
                  { translateX: p.x },
                  { translateY: p.y },
                  { rotate },
                  { scale: p.scale },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    width: 0,
    height: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  particle: {
    position: "absolute",
  },
});
