export interface FileDetails {
  name: string;
  size: number;
  type: string;
}

export type Permission = "View Only" | "Download" | "Editor";
