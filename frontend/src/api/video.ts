import api from "./client";

export interface VideoTokenResponse {
  token: string;
  url: string;
  roomName: string;
}

export async function getVideoToken(matchId: string): Promise<VideoTokenResponse> {
  const { data } = await api.post<VideoTokenResponse>("/video/token", { matchId });
  return data;
}

export async function getVideoStatus(): Promise<{ enabled: boolean }> {
  const { data } = await api.get<{ enabled: boolean }>("/video/status");
  return data;
}