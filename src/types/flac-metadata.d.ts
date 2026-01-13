declare module 'flac-metadata' {
    import { Transform } from 'stream';

    export class Processor extends Transform {
        static MDB_TYPE_STREAMINFO: number;
        static MDB_TYPE_PADDING: number;
        static MDB_TYPE_APPLICATION: number;
        static MDB_TYPE_SEEKTABLE: number;
        static MDB_TYPE_VORBIS_COMMENT: number;
        static MDB_TYPE_CUESHEET: number;
        static MDB_TYPE_PICTURE: number;

        constructor(options?: { parseMetaDataBlocks?: boolean });
    }

    export namespace data {
        class MetaDataBlock {
            type: number;
            isLast: boolean;
            remove(): void;
            publish(): Buffer;
        }

        class MetaDataBlockVorbisComment extends MetaDataBlock {
            static create(
                isLast: boolean,
                vendor: string,
                comments: string[]
            ): MetaDataBlockVorbisComment;
        }

        class MetaDataBlockPicture extends MetaDataBlock {
            static create(
                isLast: boolean,
                type: number,
                mimeType: string,
                description: string,
                width: number,
                height: number,
                depth: number,
                colors: number,
                pictureData: Buffer
            ): MetaDataBlockPicture;
        }
    }
}
