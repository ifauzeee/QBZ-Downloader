import chalk from 'chalk';
import { validateSelection } from '../../utils/input.js';
import { getQualityEmoji, getQualityName } from '../../config.js';

export const getUrlPrompt = (when) => ({
    type: 'input',
    name: 'url',
    message: chalk.cyan('🔗 Enter Qobuz URL or Album/Track ID:'),
    when: when,
    validate: (input) => input.length > 0 || 'Please enter a valid URL'
});

export const getQualityPrompt = () => ({
    type: 'list',
    name: 'quality',
    message: chalk.cyan('🎚️ Select audio quality:'),
    choices: [
        { name: '🔥 Hi-Res Max (FLAC 24/192)', value: 27 },
        { name: '✨ Hi-Res (FLAC 24/96)', value: 7 },
        { name: '💿 CD Quality (FLAC 16/44.1)', value: 6 },
        { name: '🎵 MP3 320kbps', value: 5 }
    ],
    default: 27
});

export const getLyricsPrompt = () => ({
    type: 'confirm',
    name: 'embedLyrics',
    message: chalk.cyan('🎤 Embed lyrics?'),
    default: true
});

export const getActionPrompt = () => ({
    type: 'list',
    name: 'action',
    message: chalk.cyan('Choose action:'),
    choices: [
        { name: '📥 Download entire album', value: 'download' },
        { name: '📝 Select specific tracks', value: 'select' },
        { name: '❌ Cancel', value: 'cancel' }
    ]
});

export const getTrackSelectionPrompt = (totalTracks) => ({
    type: 'input',
    name: 'tracks',
    message: chalk.cyan(`Enter track numbers (1-${totalTracks}):`),
    validate: (input) => validateSelection(input, totalTracks)
});

export const getConfirmationPrompt = (quality, type = 'album') => ({
    type: 'confirm',
    name: 'proceed',
    message: chalk.cyan(
        `\n📥 Download this ${type} in ${getQualityEmoji(quality)} ${getQualityName(quality)}?`
    ),
    default: true
});

export const getContinuePrompt = () => ({
    type: 'input',
    name: 'continue',
    message: chalk.gray('Press Enter to continue...')
});

export const getTrackDownloadPrompt = () => ({
    type: 'input',
    name: 'proceed',
    message: 'Download track? (y/n):',
    default: 'y',
    validate: (input) => {
        if (['y', 'n', 'Y', 'N', 'yes', 'no'].includes(input.toLowerCase())) return true;
        return 'Please enter y or n';
    }
});
