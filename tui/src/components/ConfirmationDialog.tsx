import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../hooks/ThemeContext.js";

interface ConfirmationDialogProps {
  title: string;
  borderColor: string;
  width: number;
  height: number;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  title,
  borderColor,
  width,
  height,
}) => {
  const { theme } = useTheme();

  return (
    <Box flexGrow={1} justifyContent="center" alignItems="center">
      <Box
        flexDirection="column"
        borderStyle="double"
        borderColor={borderColor || theme.colors.infoFg}
        padding={1}
        alignItems="center"
        justifyContent="center"
        width={width}
        minHeight={height}
      >
        <Text bold color={borderColor || theme.colors.infoFg}>
          {title}
        </Text>
        <Box marginTop={1}>
          <Text bold>[Y]es</Text>
          <Text> / [N]o</Text>
        </Box>
      </Box>
    </Box>
  );
};
