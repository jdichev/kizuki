import React from "react";
import { Box, Text } from "ink";
import { View } from "../types/index.js";

interface FooterProps {
  terminalWidth: number;
  view: View;
}

export const Footer: React.FC<FooterProps> = ({ terminalWidth, view }) => {
  const getKeysString = () => {
    let keys = "WASD/Arrows: Navigate | R: Reload | Esc: Exit";

    if (view === "start") {
      keys = "WASD/Arrows: Select Mode | Enter: Open | Esc: Exit";
    } else if (view === "sidebar") {
      keys = "WASD/Arrows: Select Category | Enter: Open | R: Reload | Esc: Exit";
    } else if (view === "items") {
      keys = "WASD/Arrows: Select Item | Enter: Open | Q: Mark All Read | R: Reload | Esc: Exit";
    } else if (view === "reader") {
      keys = "WASD/Arrows: Scroll | A: Back | Esc: Exit";
    }

    return keys;
  };

  return (
    <Box height={1} width="100%">
      <Text backgroundColor="blue" color="white">
        <Text bold> keys: </Text>
        {` ${getKeysString()} `.padEnd(terminalWidth - 7)}
      </Text>
    </Box>
  );
};
