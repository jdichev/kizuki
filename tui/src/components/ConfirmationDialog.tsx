import React from "react";
import { Box, Text } from "ink";

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
}) => (
  <Box flexGrow={1} justifyContent="center" alignItems="center">
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={borderColor}
      padding={1}
      alignItems="center"
      justifyContent="center"
      width={width}
      minHeight={height}
    >
      <Text bold color={borderColor}>
        {title}
      </Text>
      <Box marginTop={1}>
        <Text bold>[Y]es</Text>
        <Text> / [N]o</Text>
      </Box>
    </Box>
  </Box>
);
