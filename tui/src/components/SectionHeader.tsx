import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../hooks/ThemeContext.js";

interface SectionHeaderProps {
  title: string;
  terminalWidth: number;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, terminalWidth }) => {
  const { theme } = useTheme();

  return (
    <Box flexDirection="column">
      <Text color={theme.colors.sectionHeaderFg} bold>
        {` ${title}`}
      </Text>
      <Text color={theme.colors.sectionHeaderFg}>{"─".repeat(Math.max(1, terminalWidth - 2))}</Text>
    </Box>
  );
};
