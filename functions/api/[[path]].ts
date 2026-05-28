import { createCloudflareApi, type CloudflareEnv } from '../../backend/api';

export const onRequest = (context: { request: Request; env: CloudflareEnv }) =>
  createCloudflareApi().fetch(context.request, context.env);
