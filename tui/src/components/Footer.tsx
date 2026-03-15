import React from "react";
import { Box, Text } from "ink";
import { View } from "../types/index.js";
import { useTheme } from "../hooks/ThemeContext.js";

interface FooterProps {
  terminalWidth: number;
  view: View;
}

export const Footer: React.FC<FooterProps> = ({ terminalWidth, view }) => {
  const { theme } = useTheme();

  const getKeysString = () => {
    let keys = "WASD/Arrows: Navigate | T: Theme | R: Reload | Esc: Exit";

    if (view === "start") {
      keys = "WASD/Arrows: Select Mode | Enter: Open | T: Theme | Esc: Exit";
    } else if (view === "categories") {
      keys = "WASD/Arrows: Select Category | Enter: Open | T: Theme | R: Reload | Esc: Exit";
    } else if (view === "items") {
      keys = "WASD/Arrows: Select Item | Enter: Open | E: Toggle Unread | B: Toggle Bookmarked | F: Bookmark | Q: Mark All Read | T: Theme | R: Reload | Esc: Exit";
    } else if (view === "reader") {
      keys = "WASD/Arrows: Scroll | O: Summarize | F: Bookmark | T: Theme | A: Back | Esc: Exit";
    }

    return keys;
  };

  return (
    <Box height={1} width="100%">
      <Text backgroundColor={theme.colors.footerBg} color={theme.colors.footerFg}>
        <Text bold> keys: </Text>
        {` ${getKeysString()} `.padEnd(terminalWidth - 7)}
      </Text>
    </Box>
  );
};
