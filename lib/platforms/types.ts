export type PublishInput = {
  temporaryUploadUrl: string;
  title?: string;
  description?: string;
  caption?: string;
  scheduledAt?: string;
  metadata?: Record<string, unknown>;
};

export type PublishResult = {
  platformPostId?: string;
  platformUrl?: string;
  embedUrl?: string;
  thumbnailUrl?: string;
  rawResponse?: unknown;
};

export interface PlatformAdapter {
  platformId: string;
  publish(input: PublishInput): Promise<PublishResult>;
}
