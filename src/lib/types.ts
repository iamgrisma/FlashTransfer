
export interface FileDetails {
  name: string;
  size: number;
  type: string;
}

export type ScannedFile = FileDetails & {
    scanStatus: 'unscanned' | 'scanning' | 'scanned' | 'failed';
}

export type Permission = "View Only" | "Download" | "Editor";

export interface SignalingData {
  id: string;
  created_at: string;
  short_code?: string;
}

    