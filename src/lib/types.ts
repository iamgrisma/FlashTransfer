export interface FileDetails {
  name: string;
  size: number;
  type: string;
}

export type Permission = "View Only" | "Download" | "Editor";

export interface SignalingData {
  id: string;
  offer?: string;
  answer?: string;
  created_at: string;
}
