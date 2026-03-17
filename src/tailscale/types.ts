export type TailscaleWhoisResponse = {
  Node?: {
    ID?: string | number;
    Name?: string;
    ComputedName?: string;
    StableID?: string;
    Tags?: string[];
  };
  UserProfile?: {
    ID?: string | number;
    LoginName?: string;
    DisplayName?: string;
  };
};

export type TailscaleIdentity = {
  login: string;
  displayName: string;
  userId: string | null;
  nodeId: string | null;
  nodeName: string | null;
  tailnet: string | null;
};
