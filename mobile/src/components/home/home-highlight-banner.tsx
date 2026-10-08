import { useEffect, useState } from "react";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import highlightGradient from "@/assets/images/home-highlight-gradient.png";
import {
  homeHighlightDotCount,
  type HomeHighlightSlide,
} from "@/features/home/home-model";
import { shouldRenderHomeHighlightBanner } from "@/features/home/home-highlight-sources";
import {
  AmakiColors,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

type Props = {
  slides: HomeHighlightSlide[];
};

/**
 * « À la une » — uniquement des slides réelles ; sinon null (pas de fallback).
 */
export function HomeHighlightBanner({ slides }: Props) {
  const [index, setIndex] = useState(0);
  const dotCount = homeHighlightDotCount(slides);

  useEffect(() => {
    if (slides.length === 0) {
      setIndex(0);
      return;
    }
    if (index > slides.length - 1) {
      setIndex(Math.max(0, slides.length - 1));
    }
  }, [slides.length, index]);

  if (!shouldRenderHomeHighlightBanner(slides.length)) {
    return null;
  }

  const safeIndex = Math.min(index, slides.length - 1);
  const slide = slides[safeIndex];

  return (
    <View>
      <Pressable
        onPress={() => router.push(slide.href)}
        accessibilityRole="button"
        accessibilityLabel={slide.a11y}
        style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      >
        <Image
          source={highlightGradient}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          alt=""
        />
        <View style={styles.content}>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.subtitle}>{slide.subtitle}</Text>
        </View>
      </Pressable>

      {dotCount > 0 ? (
        <View
          style={styles.dots}
          accessibilityRole="adjustable"
          accessibilityLabel={`Actualité ${safeIndex + 1} sur ${slides.length}`}
        >
          {slides.map((s, i) => (
            <Pressable
              key={s.id}
              onPress={() => setIndex(i)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Aller à ${s.title}`}
              style={[styles.dot, i === safeIndex && styles.dotActive]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 22,
    overflow: "hidden",
    minHeight: 100,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    shadowColor: "#0f172a",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pressed: {
    opacity: 0.9,
  },
  content: {
    padding: AmakiSpacing.lg,
    justifyContent: "center",
    minHeight: 100,
  },
  title: {
    ...AmakiTypography.heading,
    color: AmakiColors.onDark,
  },
  subtitle: {
    ...AmakiTypography.caption,
    color: AmakiColors.onDark,
    opacity: 0.92,
    marginTop: AmakiSpacing.xs,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: AmakiSpacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AmakiColors.border,
  },
  dotActive: {
    backgroundColor: AmakiColors.primary,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
