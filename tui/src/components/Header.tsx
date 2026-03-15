import React from "react";
import { Box, Text } from "ink";
import { visualTruncate } from "../utils/text.js";
import { useTheme } from "../hooks/ThemeContext.js";

interface HeaderProps {
  breadcrumbs: string;
  terminalWidth: number;
}

export const Header: React.FC<HeaderProps> = ({
  breadcrumbs,
  terminalWidth,
}) => {
  const { theme } = useTheme();

  return (
    <Box height={1} width="100%">
      <Text backgroundColor={theme.colors.headerBg} color={theme.colors.headerFg}>
        {` `}
        {visualTruncate(` ${breadcrumbs}`, terminalWidth - 3, true)}
      </Text>
    </Box>
  );
};
