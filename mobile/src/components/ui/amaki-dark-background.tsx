import { StyleSheet, View, type ViewProps } from "react-native";
import { AmakiColors } from "@/constants/theme";

type Props = ViewProps & {
  children?: React.ReactNode;
};

/**
 * Fond sombre dégradé AMAKI sans expo-linear-gradient
 * (couches bleues / slate alignées charte Web).
 */
export function AmakiDarkBackground({ children, style, ...rest }: Props) {
  return (
    <View style={[styles.root, style]} {...rest}>
      <View pointerEvents="none" style={styles.layerDeep} />
      <View pointerEvents="none" style={styles.layerMid} />
      <View pointerEvents="none" style={styles.layerBottom} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AmakiColors.gradientDeep,
    overflow: "hidden",
  },
  layerDeep: {
    ...StyleSheet.absoluteFill,
    backgroundColor: AmakiColors.gradientDeep,
  },
  layerMid: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: "55%",
    backgroundColor: AmakiColors.gradientMid,
    opacity: 0.72,
  },
  layerBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "50%",
    backgroundColor: AmakiColors.gradientBottom,
    opacity: 0.85,
  },
});
