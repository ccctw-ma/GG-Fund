import { createCloudflareApi, type CloudflareEnv } from '../api';

export const onRequest = (context: { request: Request; env: CloudflareEnv }) =>
  createCloudflareApi().fetch(context.request, context.env);
