import { ActivityIndicator, StyleSheet, View } from "react-native";
import { AmakiColors } from "@/constants/theme";

/**
 * Spinner centré plein écran.
 */
export function LoadingState() {
  return (
    <View style={styles.root}>
      <ActivityIndicator size="large" color={AmakiColors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AmakiColors.background,
  },
});
