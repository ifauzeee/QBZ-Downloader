import React from 'react';
import { Box, Text } from 'ink';

interface Props {
    percent: number;
    color?: string;
    width?: number;
}

const ProgressBar: React.FC<Props> = ({ percent, color = 'green', width = 30 }) => {
    const safePercent = Math.min(1, Math.max(0, percent));
    const filledLength = Math.round(width * safePercent);
    const emptyLength = width - filledLength;

    const filledChar = '█';
    const emptyChar = '░';

    return (
        <Box>
            <Text color={color}>
                {filledChar.repeat(filledLength)}
            </Text>
            <Text color="gray">
                {emptyChar.repeat(emptyLength)}
            </Text>
        </Box>
    );
};

export default ProgressBar;
