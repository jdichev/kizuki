import React from "react";
import { Box, Text } from "ink";

interface SectionHeaderProps {
  title: string;
  terminalWidth: number;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, terminalWidth }) => (
  <Box flexDirection="column">
    <Text color="cyan" bold>
      {title}
    </Text>
    <Text color="cyan">{"─".repeat(Math.max(1, terminalWidth - 2))}</Text>
  </Box>
);
