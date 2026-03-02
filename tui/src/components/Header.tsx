import React from "react";
import { Box, Text } from "ink";
import { visualTruncate } from "../utils/text.js";

interface HeaderProps {
  breadcrumbs: string;
  terminalWidth: number;
}

export const Header: React.FC<HeaderProps> = ({ breadcrumbs, terminalWidth }) => (
  <Box height={1} width="100%">
    <Text backgroundColor="green" color="white">
      {visualTruncate(` ${breadcrumbs}`, terminalWidth - 2)}
    </Text>
  </Box>
);
