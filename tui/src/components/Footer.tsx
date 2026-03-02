import React from "react";
import { Box, Text } from "ink";

interface FooterProps {
  terminalWidth: number;
}

export const Footer: React.FC<FooterProps> = ({ terminalWidth }) => (
  <Box height={1} width="100%">
    <Text backgroundColor="blue" color="white">
      <Text bold> keys: </Text>
      {`WASD/Arrows: Navigate | R: Reload | Q: Mark Read | Esc: Exit `.padEnd(
        terminalWidth - 7
      )}
    </Text>
  </Box>
);
