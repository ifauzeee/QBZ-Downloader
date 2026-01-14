declare module 'ink-progress-bar' {
    import { FC } from 'react';
    interface Props {
        percent: number;
        color?: string;
    }
    const ProgressBar: FC<Props>;
    export default ProgressBar;
}
